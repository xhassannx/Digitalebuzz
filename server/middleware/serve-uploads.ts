import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import path from "path";
import { isS3MediaEnabled, streamUploadToResponse } from "../utils/media-storage";

/**
 * Serve /uploads/* from local disk and/or S3 (private bucket — same URLs as before).
 */
export function registerUploadsMiddleware(app: Express): void {
  const localRoot = path.join(process.cwd(), "uploads");

  if (!isS3MediaEnabled()) {
    app.use("/uploads", express.static(localRoot, { maxAge: "1d" }));
    return;
  }

  app.use("/uploads", async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    const publicPath = `/uploads${req.path}`;
    const served = await streamUploadToResponse(publicPath, res);
    if (served) return;
    return next();
  });

  app.use("/uploads", express.static(localRoot, { maxAge: "1d" }));
}
