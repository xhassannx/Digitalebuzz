import fs from "fs";
import path from "path";
import type { Response } from "express";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type MediaStorageMode = "local" | "s3" | "dual";

export type UploadListEntry = {
  name: string;
  size: number;
  lastModified?: Date;
};

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

let s3Client: S3Client | null = null;

export function getMediaStorageMode(): MediaStorageMode {
  const raw = (process.env.MEDIA_STORAGE || "").trim().toLowerCase();
  if (raw === "s3" || raw === "dual") return raw;
  // local folder: local | disk | folder | uploads
  if (raw === "local" || raw === "disk" || raw === "folder" || raw === "uploads") {
    return "local";
  }
  // Default: local uploads/ folder (no S3 unless explicitly enabled)
  return "local";
}

export function describeMediaStorageMode(): string {
  const mode = getMediaStorageMode();
  if (mode === "local") return "local uploads/ folder";
  if (mode === "s3") {
    const bucket = process.env.AWS_S3_BUCKET?.trim() || "(bucket not set)";
    return `Amazon S3 (${bucket})`;
  }
  return `dual: uploads/ + S3 (${process.env.AWS_S3_BUCKET?.trim() || "bucket not set"})`;
}

export function isS3MediaEnabled(): boolean {
  const mode = getMediaStorageMode();
  return mode === "s3" || mode === "dual";
}

function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }
  return bucket;
}

function getS3Prefix(): string {
  const prefix = (process.env.AWS_S3_PREFIX || "uploads").trim().replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/` : "";
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION?.trim() || "ap-south-1",
    });
  }
  return s3Client;
}

/** `/uploads/org/gallery/a.png` → `org/gallery/a.png` */
export function publicUploadPathToKey(publicPath: string): string | null {
  const trimmed = String(publicPath || "").trim();
  if (!trimmed.startsWith("/uploads/")) return null;
  const after = trimmed.replace(/^\/?uploads\/?/i, "").replace(/\\/g, "/");
  if (!after || after.includes("..")) return null;
  return after.split("/").filter(Boolean).join("/");
}

export function buildPublicUploadPath(...segments: string[]): string {
  return `/uploads/${segments.filter(Boolean).join("/")}`;
}

function localAbsolutePath(key: string): string {
  return path.join(UPLOADS_ROOT, ...key.split("/"));
}

function s3ObjectKey(key: string): string {
  return `${getS3Prefix()}${key}`;
}

function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] || "application/octet-stream";
}

export async function saveUploadBuffer(
  publicPath: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const key = publicUploadPathToKey(publicPath);
  if (!key) {
    throw new Error(`Invalid upload path: ${publicPath}`);
  }
  const mode = getMediaStorageMode();
  const type = contentType || guessContentType(key);

  if (mode === "local" || mode === "dual") {
    const abs = localAbsolutePath(key);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buffer);
  }

  if (mode === "s3" || mode === "dual") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: s3ObjectKey(key),
        Body: buffer,
        ContentType: type,
      })
    );
  }

  return publicPath.startsWith("/uploads/") ? publicPath : buildPublicUploadPath(key);
}

/** After multer diskStorage — push to S3 and optionally remove local temp file. */
export async function ingestMulterDiskFile(
  file: { path: string; mimetype?: string; filename?: string },
  publicPath: string
): Promise<void> {
  const buffer = fs.readFileSync(file.path);
  await saveUploadBuffer(publicPath, buffer, file.mimetype);
  if (getMediaStorageMode() === "s3") {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
  }
}

export async function readUploadBuffer(publicPath: string): Promise<Buffer | null> {
  const key = publicUploadPathToKey(publicPath);
  if (!key) return null;

  const local = localAbsolutePath(key);
  if (fs.existsSync(local) && fs.statSync(local).isFile()) {
    return fs.readFileSync(local);
  }

  if (!isS3MediaEnabled()) return null;

  try {
    const out = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: s3ObjectKey(key),
      })
    );
    if (!out.Body) return null;
    return Buffer.from(await out.Body.transformToByteArray());
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

export function resolveUploadLocalPath(publicPath: string): string | null {
  const key = publicUploadPathToKey(publicPath);
  if (!key) return null;
  const candidates = [
    localAbsolutePath(key),
    path.join(process.cwd(), "..", "uploads", ...key.split("/")),
  ];
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (!normalized.includes("uploads")) continue;
    if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
      return normalized;
    }
  }
  return null;
}

export async function uploadExists(publicPath: string): Promise<boolean> {
  const local = resolveUploadLocalPath(publicPath);
  if (local) return true;
  if (!isS3MediaEnabled()) return false;
  const key = publicUploadPathToKey(publicPath);
  if (!key) return false;
  try {
    await getS3Client().send(
      new HeadObjectCommand({
        Bucket: getS3Bucket(),
        Key: s3ObjectKey(key),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function listUploadPrefix(relativePrefix: string): Promise<UploadListEntry[]> {
  const norm = relativePrefix.replace(/^\/+|\/+$/g, "");
  const entries: UploadListEntry[] = [];
  const seen = new Set<string>();

  const localDir = path.join(UPLOADS_ROOT, ...norm.split("/").filter(Boolean));
  if (fs.existsSync(localDir)) {
    for (const name of fs.readdirSync(localDir)) {
      const abs = path.join(localDir, name);
      if (!fs.statSync(abs).isFile()) continue;
      seen.add(name);
      entries.push({
        name,
        size: fs.statSync(abs).size,
        lastModified: fs.statSync(abs).mtime,
      });
    }
  }

  if (isS3MediaEnabled()) {
    const prefix = s3ObjectKey(norm ? `${norm}/` : "");
    let token: string | undefined;
    do {
      const page = await getS3Client().send(
        new ListObjectsV2Command({
          Bucket: getS3Bucket(),
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
      for (const obj of page.Contents || []) {
        if (!obj.Key) continue;
        const rel = obj.Key.slice(prefix.length);
        if (!rel || rel.includes("/")) continue;
        if (seen.has(rel)) continue;
        seen.add(rel);
        entries.push({
          name: rel,
          size: obj.Size || 0,
          lastModified: obj.LastModified,
        });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteUploadFile(publicPath: string): Promise<void> {
  const key = publicUploadPathToKey(publicPath);
  if (!key) return;

  const local = localAbsolutePath(key);
  if (fs.existsSync(local)) {
    try {
      fs.unlinkSync(local);
    } catch {
      /* ignore */
    }
  }

  if (!isS3MediaEnabled()) return;

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: s3ObjectKey(key),
    })
  );
}

export async function streamUploadToResponse(publicPath: string, res: Response): Promise<boolean> {
  const key = publicUploadPathToKey(publicPath);
  if (!key) return false;

  const local = resolveUploadLocalPath(publicPath);
  if (local) {
    const ext = path.extname(local).toLowerCase();
    res.setHeader("Content-Type", guessContentType(local));
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(local).pipe(res);
    return true;
  }

  if (!isS3MediaEnabled()) return false;

  try {
    const out = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getS3Bucket(),
        Key: s3ObjectKey(key),
      })
    );
    if (!out.Body) return false;
    res.setHeader("Content-Type", out.ContentType || guessContentType(key));
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await out.Body.transformToByteArray());
    res.send(buffer);
    return true;
  } catch {
    return false;
  }
}
