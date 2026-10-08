/** Default trial length for explicitly created trial accounts. */
export const TRIAL_ACCOUNT_DAYS = 3;

export function trialExpiresAtFromNow(days: number = TRIAL_ACCOUNT_DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
