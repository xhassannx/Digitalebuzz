import crypto from 'crypto';
import { storage } from '../storage';
import type { Webhook } from '@shared/schema';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

interface DeliveryAttempt {
  webhookId: string;
  url: string;
  attempt: number;
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
const DELIVERY_TIMEOUT = 5000; // 5 seconds

function generateHmacSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

async function deliverWithTimeout(
  url: string,
  payload: string,
  signature: string,
  timeoutMs: number
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'User-Agent': 'WhatsApp-SaaS-Webhook/1.0',
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, statusCode: response.status };
    } else {
      return { 
        success: false, 
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout after 5 seconds' };
    }
    
    return { 
      success: false, 
      error: error.message || 'Network error'
    };
  }
}

async function attemptDelivery(
  webhook: Webhook,
  payload: WebhookPayload,
  attemptNumber: number
): Promise<DeliveryAttempt> {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);
  const signature = generateHmacSignature(payloadString, webhook.secret);

  const result = await deliverWithTimeout(
    webhook.url,
    payloadString,
    signature,
    DELIVERY_TIMEOUT
  );

  const duration = Date.now() - startTime;

  const attempt: DeliveryAttempt = {
    webhookId: webhook.id,
    url: webhook.url,
    attempt: attemptNumber,
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
    duration,
  };

  console.log(`[Webhook] Delivery attempt ${attemptNumber} to ${webhook.url}:`, {
    success: result.success,
    statusCode: result.statusCode,
    error: result.error,
    duration: `${duration}ms`,
  });

  return attempt;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload
): Promise<boolean> {
  console.log(`[Webhook] Starting delivery to ${webhook.url} for event: ${payload.event}`);

  let lastAttempt: DeliveryAttempt | null = null;

  // Initial attempt
  lastAttempt = await attemptDelivery(webhook, payload, 1);
  
  if (lastAttempt.success) {
    await storage.updateWebhookLastTriggered(webhook.id);
    await storage.resetWebhookFailureCount(webhook.id);
    return true;
  }

  // Retry with exponential backoff
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    const delay = RETRY_DELAYS[i];
    console.log(`[Webhook] Retrying in ${delay}ms...`);
    await sleep(delay);

    lastAttempt = await attemptDelivery(webhook, payload, i + 2);
    
    if (lastAttempt.success) {
      await storage.updateWebhookLastTriggered(webhook.id);
      await storage.resetWebhookFailureCount(webhook.id);
      return true;
    }
  }

  // All attempts failed
  console.error(`[Webhook] All delivery attempts failed for ${webhook.url}`);
  await storage.incrementWebhookFailureCount(webhook.id);
  
  return false;
}

export async function triggerWebhooks(
  userId: string,
  event: string,
  data: any
): Promise<void> {
  const webhooks = await storage.getActiveWebhooksByUserAndEvent(userId, event);

  if (webhooks.length === 0) {
    console.log(`[Webhook] No active webhooks found for user ${userId} and event ${event}`);
    return;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  console.log(`[Webhook] Triggering ${webhooks.length} webhook(s) for event: ${event}`);

  // Deliver webhooks in parallel (non-blocking)
  const deliveryPromises = webhooks.map(webhook => 
    deliverWebhook(webhook, payload).catch(error => {
      console.error(`[Webhook] Unexpected error delivering to ${webhook.url}:`, error);
      return false;
    })
  );

  // Don't wait for all deliveries to complete
  Promise.all(deliveryPromises).then(results => {
    const successCount = results.filter(r => r).length;
    console.log(`[Webhook] Delivery complete: ${successCount}/${webhooks.length} succeeded`);
  });
}
