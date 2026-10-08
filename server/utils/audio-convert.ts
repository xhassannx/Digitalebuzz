// @ts-nocheck
import { createRequire } from "module";
import { Readable, PassThrough } from "stream";

const require = createRequire(import.meta.url);
const ffmpegStatic = require("ffmpeg-static") as string;
const ffmpeg = require("fluent-ffmpeg") as typeof import("fluent-ffmpeg");

if (ffmpegStatic && typeof (ffmpeg as any).setFfmpegPath === "function") {
  (ffmpeg as any).setFfmpegPath(ffmpegStatic);
}

/**
 * Convert audio/webm buffer to audio/ogg (Opus) for WhatsApp/Meta API compatibility.
 * Meta does not accept audio/webm; allowed types include audio/ogg, audio/opus.
 */
export function convertWebmToOgg(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(webmBuffer);
    const chunks: Buffer[] = [];
    const outputStream = new PassThrough();

    outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    (ffmpeg as any)(inputStream)
      .inputFormat("webm")
      .toFormat("ogg")
      .audioCodec("libopus")
      .output(outputStream, { end: true })
      .on("error", (err: Error) => reject(err))
      .run();
  });
}
