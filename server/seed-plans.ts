import { storage } from "./storage";
import { ensureSystemFreePlan } from "./utils/system-free-plan";

async function seedPlans() {
  console.log("Seeding subscription plans...");
  await ensureSystemFreePlan();

  const plans = [
    {
      name: "starter",
      displayName: "Starter",
      description: "Great for small businesses and startups",
      priceMonthly: 900, // $9.00 in cents
      priceQuarterly: 2400, // $24.00 (20% discount)
      priceYearly: 9000, // $90.00 (17% discount)
      features: {
        maxSessions: 3,
        maxMessagesPerMonth: 5000,
        maxApiCallsPerMinute: 60,
        maxWebhooks: 5,
        hasWhatsappBusinessApi: false,
        hasAnalytics: false,
        hasPrioritySupport: false,
        hasMessageHistorySync: true,
        messageHistorySyncPricePerMB: 10, // $0.10 per MB
        maxMessageHistorySyncMB: 100, // Max 100MB per sync request
      },
      isActive: true,
    },
    {
      name: "pro",
      displayName: "Pro",
      description: "Perfect for growing businesses with high volume messaging",
      priceMonthly: 2900, // $29.00
      priceQuarterly: 7800, // $78.00 (10% discount)
      priceYearly: 30000, // $300.00 (14% discount)
      features: {
        maxSessions: 10,
        maxMessagesPerMonth: 50000,
        maxApiCallsPerMinute: 100,
        maxWebhooks: 20,
        hasWhatsappBusinessApi: true,
        hasAnalytics: true,
        hasPrioritySupport: false,
        hasMessageHistorySync: true,
        messageHistorySyncPricePerMB: 8, // $0.08 per MB (discount for Pro)
        maxMessageHistorySyncMB: 500, // Max 500MB per sync request
      },
      isActive: true,
    },
    {
      name: "enterprise",
      displayName: "Enterprise",
      description: "Unlimited messaging for large-scale operations",
      defaultBillingCycle: "yearly" as const,
      priceMonthly: 9900, // $99.00
      priceQuarterly: 26700, // $267.00 (10% discount)
      priceYearly: 100000, // $1,000.00 (15% discount)
      features: {
        maxSessions: 999999, // Unlimited
        maxMessagesPerMonth: 999999999, // Unlimited
        maxApiCallsPerMinute: 200,
        maxWebhooks: 100,
        hasWhatsappBusinessApi: true,
        hasAnalytics: true,
        hasPrioritySupport: true,
        hasMessageHistorySync: true,
        messageHistorySyncPricePerMB: 5, // $0.05 per MB (best price for Enterprise)
        maxMessageHistorySyncMB: 999999, // Unlimited for Enterprise
      },
      isActive: true,
    },
  ];

  for (const plan of plans) {
    try {
      await storage.createPlan(plan as any);
      console.log(`✓ Created plan: ${plan.displayName}`);
    } catch (error: any) {
      // Skip if plan already exists (duplicate name constraint)
      if (error.code === '23505') {
        console.log(`- Plan ${plan.displayName} already exists, skipping`);
      } else {
        console.error(`✗ Error creating plan ${plan.displayName}:`, error.message);
      }
    }
  }

  try {
    const { ensureSystemFreePlan } = await import("./utils/system-free-plan");
    await ensureSystemFreePlan();
  } catch (ensureErr: any) {
    console.error("Failed to lock system Free plan:", ensureErr?.message || ensureErr);
  }

  console.log("\nPlans seeded successfully!");
  process.exit(0);
}

seedPlans().catch((error) => {
  console.error("Error seeding plans:", error);
  process.exit(1);
});
