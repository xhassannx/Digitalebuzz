/**
 * Chatbot delay scheduler: resumes flows paused by delay nodes (for, until date, until weekday).
 * Runs every 5 seconds so chained delay nodes each resume in order.
 */
import { checkAndResumeScheduledDelays } from './executor';

const INTERVAL_MS = 5_000; // 5 seconds — short delays resume promptly; supports chained delay nodes

export async function runChatbotDelayCheck(): Promise<void> {
  try {
    await checkAndResumeScheduledDelays();
  } catch (err: any) {
    console.error('[Chatbot Delay Scheduler] Error:', err?.message);
  }
}

export function startChatbotDelayScheduler(): void {
  console.log('[Chatbot Delay Scheduler] Starting...');
  setInterval(runChatbotDelayCheck, INTERVAL_MS);
  runChatbotDelayCheck();
}
