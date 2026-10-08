/**
 * Webhook Forwarder Service
 * 
 * Forwards WhatsApp Business API webhook events to multiple domains.
 * Since Meta only allows one webhook URL per WABA, this service acts as a relay.
 */

interface ForwardingConfig {
  url: string;
  enabled: boolean;
  timeout?: number; // Timeout in milliseconds
}

class WebhookForwarder {
  private forwardingUrls: ForwardingConfig[] = [];

  /**
   * Initialize forwarding URLs from environment variable or database
   */
  initialize() {
    // Load from environment variable (comma-separated URLs)
    const envUrls = process.env.WEBHOOK_FORWARD_URLS;
    if (envUrls) {
      this.forwardingUrls = envUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0)
        .map(url => ({
          url: url.endsWith('/api/webhooks/whatsapp-business') 
            ? url 
            : `${url.replace(/\/$/, '')}/api/webhooks/whatsapp-business`,
          enabled: true,
          timeout: 10000, // 10 seconds default timeout
        }));
    }

    console.log(`[Webhook Forwarder] Initialized with ${this.forwardingUrls.length} forwarding URLs:`, 
      this.forwardingUrls.map(f => f.url));
  }

  /**
   * Add a forwarding URL programmatically
   */
  addForwardingUrl(url: string, enabled: boolean = true, timeout: number = 10000) {
    const normalizedUrl = url.endsWith('/api/webhooks/whatsapp-business') 
      ? url 
      : `${url.replace(/\/$/, '')}/api/webhooks/whatsapp-business`;

    // Check if URL already exists
    const existing = this.forwardingUrls.find(f => f.url === normalizedUrl);
    if (existing) {
      existing.enabled = enabled;
      existing.timeout = timeout;
      return;
    }

    this.forwardingUrls.push({
      url: normalizedUrl,
      enabled,
      timeout,
    });

    console.log(`[Webhook Forwarder] Added forwarding URL: ${normalizedUrl}`);
  }

  /**
   * Remove a forwarding URL
   */
  removeForwardingUrl(url: string) {
    this.forwardingUrls = this.forwardingUrls.filter(f => f.url !== url);
    console.log(`[Webhook Forwarder] Removed forwarding URL: ${url}`);
  }

  /**
   * Get all forwarding URLs
   */
  getForwardingUrls(): ForwardingConfig[] {
    return [...this.forwardingUrls];
  }

  /**
   * Forward webhook event to all configured URLs
   */
  async forwardWebhookEvent(eventData: any, headers: Record<string, string> = {}): Promise<{
    success: number;
    failed: number;
    results: Array<{ url: string; success: boolean; error?: string; duration: number }>;
  }> {
    const enabledUrls = this.forwardingUrls.filter(f => f.enabled);
    
    if (enabledUrls.length === 0) {
      console.log('[Webhook Forwarder] No forwarding URLs configured, skipping forward');
      return { success: 0, failed: 0, results: [] };
    }

    console.log(`[Webhook Forwarder] Forwarding webhook event to ${enabledUrls.length} URLs`);

    const forwardPromises = enabledUrls.map(async (config) => {
      const startTime = Date.now();
      try {
        // Create abort controller for timeout (fallback for older Node.js versions)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout || 10000);

        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'WhatsApp-Webhook-Forwarder/1.0',
            'X-Webhook-Forward': '1',
            ...headers,
          },
          body: JSON.stringify(eventData),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[Webhook Forwarder] Failed to forward to ${config.url}: ${response.status} ${errorText}`);
          return {
            url: config.url,
            success: false,
            error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
            duration,
          };
        }

        console.log(`[Webhook Forwarder] Successfully forwarded to ${config.url} (${duration}ms)`);
        return {
          url: config.url,
          success: true,
          duration,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorMessage = error.message || 'Unknown error';
        console.error(`[Webhook Forwarder] Error forwarding to ${config.url}:`, errorMessage);
        
        return {
          url: config.url,
          success: false,
          error: errorMessage,
          duration,
        };
      }
    });

    const results = await Promise.allSettled(forwardPromises);
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: enabledUrls[index].url,
          success: false,
          error: result.reason?.message || 'Promise rejected',
          duration: 0,
        };
      }
    });

    const success = processedResults.filter(r => r.success).length;
    const failed = processedResults.filter(r => !r.success).length;

    console.log(`[Webhook Forwarder] Forwarding complete: ${success} succeeded, ${failed} failed`);

    return {
      success,
      failed,
      results: processedResults,
    };
  }

  /**
   * Forward webhook verification (GET request) to all configured URLs
   */
  async forwardWebhookVerification(queryParams: Record<string, string>, headers: Record<string, string> = {}): Promise<{
    success: number;
    failed: number;
    results: Array<{ url: string; success: boolean; challenge?: string; error?: string; duration: number }>;
  }> {
    const enabledUrls = this.forwardingUrls.filter(f => f.enabled);
    
    if (enabledUrls.length === 0) {
      return { success: 0, failed: 0, results: [] };
    }

    console.log(`[Webhook Forwarder] Forwarding webhook verification to ${enabledUrls.length} URLs`);

    const forwardPromises = enabledUrls.map(async (config) => {
      const startTime = Date.now();
      try {
        const url = new URL(config.url);
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });

        // Create abort controller for timeout (fallback for older Node.js versions)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout || 10000);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'WhatsApp-Webhook-Forwarder/1.0',
            ...headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          return {
            url: config.url,
            success: false,
            error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
            duration,
          };
        }

        const challenge = await response.text();
        return {
          url: config.url,
          success: true,
          challenge,
          duration,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        return {
          url: config.url,
          success: false,
          error: error.message || 'Unknown error',
          duration,
        };
      }
    });

    const results = await Promise.allSettled(forwardPromises);
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: enabledUrls[index].url,
          success: false,
          error: result.reason?.message || 'Promise rejected',
          duration: 0,
        };
      }
    });

    const success = processedResults.filter(r => r.success).length;
    const failed = processedResults.filter(r => !r.success).length;

    return {
      success,
      failed,
      results: processedResults,
    };
  }
}

// Singleton instance
export const webhookForwarder = new WebhookForwarder();

// Initialize on module load
webhookForwarder.initialize();

