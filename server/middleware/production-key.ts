import type { RequestHandler } from "express";

/**
 * Licensor / customer portal calls this panel with the same PRODUCTION_KEY as env on the whitelabel instance.
 * Accepts: header `X-Production-Key: <key>` or `Authorization: Bearer <key>`.
 */
export const requireProductionKey: RequestHandler = (req, res, next) => {
  const key = process.env.PRODUCTION_KEY?.trim();
  if (!key) {
    return res.status(503).json({
      error: "PRODUCTION_KEY is not configured on this panel",
    });
  }
  const headerKey =
    typeof req.headers["x-production-key"] === "string" ? req.headers["x-production-key"].trim() : "";
  const bearer =
    req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : "";
  const provided = headerKey || bearer;
  if (!provided || provided !== key) {
    return res.status(401).json({
      error: "Invalid or missing production key",
      hint: "Send header X-Production-Key or Authorization: Bearer <PRODUCTION_KEY>",
    });
  }
  next();
};
