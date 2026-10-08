// @ts-nocheck
import type { Express } from "express";
import { isAuthenticated } from "../../replitAuth";
import { resolveOrganizationContext } from "../../middleware/organization-context";
import { storage } from "../../storage";
import nodemailer from "nodemailer";

export function registerSMTPRoutes(app: Express) {
  const getUserId = (req: any): string => {
    return req.user?.claims?.sub || req.userId;
  };

  // Test SMTP connection
  app.post("/api/integrations/smtp/test", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const { host, port, secure, username, password, from } = req.body;

      if (!host || !port || !username || !password || !from) {
        return res.status(400).json({ message: "Missing required SMTP configuration" });
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: secure === true || secure === "true",
        auth: {
          user: username,
          pass: password,
        },
      });

      // Verify connection
      await transporter.verify();

      res.json({ success: true, message: "SMTP connection successful" });
    } catch (error: any) {
      console.error("SMTP test error:", error);
      res.status(400).json({ message: error.message || "Failed to connect to SMTP server" });
    }
  });

  // Send email via SMTP
  app.post("/api/integrations/smtp/send", isAuthenticated, resolveOrganizationContext, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const organizationId = req.context?.organizationId;
      const { to, subject, text, html, integrationId } = req.body;

      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ message: "Missing required email fields" });
      }

      // Get SMTP integration
      let integration;
      if (integrationId) {
        integration = await storage.getIntegration(integrationId, userId);
      } else {
        integration = await storage.getIntegrationByName("smtp", userId, organizationId);
      }

      if (!integration || integration.status !== "connected" || !integration.credentials) {
        return res.status(404).json({ message: "SMTP integration not found or not connected" });
      }

      const credentials = integration.credentials as any;
      const config = integration.config || {};

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: credentials.host || config.host,
        port: credentials.port || config.port || 587,
        secure: credentials.secure || config.secure === true,
        auth: {
          user: credentials.username || credentials.user,
          pass: credentials.password || credentials.pass,
        },
      });

      // Send email
      const mailOptions = {
        from: credentials.from || config.from || credentials.username || credentials.user,
        to,
        subject,
        text,
        html,
      };

      const info = await transporter.sendMail(mailOptions);

      res.json({
        success: true,
        messageId: info.messageId,
        response: info.response,
      });
    } catch (error: any) {
      console.error("SMTP send error:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });
}

