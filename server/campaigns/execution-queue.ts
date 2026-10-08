import {
  executeCampaign,
  type ExecuteCampaignOptions,
  type CampaignExecutionResult,
} from './executor';

type QueuedJob = {
  fn: () => Promise<void>;
};

const waitQueue: QueuedJob[] = [];
let activeExecutions = 0;

/**
 * Queue is opt-in via CAMPAIGN_MAX_PARALLEL_EXECUTIONS so existing installs behave
 * exactly as before (unlimited parallel campaign runs per Node process).
 */
function getMaxParallelExecutions(): number | null {
  const raw = process.env.CAMPAIGN_MAX_PARALLEL_EXECUTIONS;
  if (raw === undefined || String(raw).trim() === '') {
    return null;
  }
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.min(10, n);
}

function tryStartNext(): void {
  const max = getMaxParallelExecutions();
  if (max === null) return;

  while (activeExecutions < max && waitQueue.length > 0) {
    const job = waitQueue.shift();
    if (!job) break;
    activeExecutions++;
    void job.fn().finally(() => {
      activeExecutions--;
      tryStartNext();
    });
  }
}

/**
 * Run a campaign. When CAMPAIGN_MAX_PARALLEL_EXECUTIONS is set (1–10), limits how
 * many campaigns run at once in this PM2 process; extra runs wait in a FIFO queue.
 * When unset, calls executeCampaign directly (legacy behavior).
 */
export function enqueueCampaignExecution(
  campaignId: string,
  userId: string,
  organizationId: string,
  options?: ExecuteCampaignOptions
): Promise<CampaignExecutionResult> {
  const max = getMaxParallelExecutions();
  if (max === null) {
    return executeCampaign(campaignId, userId, organizationId, options);
  }

  return new Promise((resolve, reject) => {
    const queuedBefore = waitQueue.length;

    waitQueue.push({
      fn: async () => {
        try {
          const result = await executeCampaign(campaignId, userId, organizationId, options);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
    });

    if (activeExecutions >= max || queuedBefore > 0) {
      console.log(
        `[Campaign Queue] ${campaignId} queued (running=${activeExecutions}, waiting=${waitQueue.length}, max=${max})`
      );
    }

    tryStartNext();
  });
}

export function getCampaignQueueStats(): {
  enabled: boolean;
  active: number;
  waiting: number;
  maxParallel: number | null;
} {
  const max = getMaxParallelExecutions();
  return {
    enabled: max !== null,
    active: activeExecutions,
    waiting: waitQueue.length,
    maxParallel: max,
  };
}
