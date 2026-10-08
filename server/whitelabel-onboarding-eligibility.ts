import type { User } from "@shared/schema";
import { storage } from "./storage";

/** End-customer org owner with their own plan — not WL admin, not invited team member. */
export async function isOnboardingBillableEndCustomer(userId: string): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;
  return isOnboardingBillableEndCustomerUser(user) && !!(await storage.getActiveSubscriptionByUser(userId));
}

export function isOnboardingBillableEndCustomerUser(
  user: Pick<User, "id" | "isSaaSOwner" | "isActive" | "accountStatus">
): boolean {
  if (user.isSaaSOwner) return false;
  if (!user.isActive || user.accountStatus !== "active") return false;
  return true;
}

/** Mark invited team members so the monthly job never picks them up. */
export async function waiveOnboardingForTeamMember(userId: string): Promise<void> {
  await storage.updateUserOnboardingSchedule(userId, {
    onboardingMonthlyWaived: true,
    onboardingNextChargeAt: null,
  });
}
