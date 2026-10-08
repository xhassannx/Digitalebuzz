import type { RequestHandler } from "express";
import { storage } from "../storage";

// Middleware to check if user is a SaaS owner/admin
export const isSaaSOwner: RequestHandler = async (req: any, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "User ID not found" });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user || !user.isSaaSOwner) {
      return res.status(403).json({ message: "Forbidden: SaaS Owner access required" });
    }
    req.adminUser = user;
    next();
  } catch (error: any) {
    console.error("[AdminAuth] Error checking SaaS owner status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

