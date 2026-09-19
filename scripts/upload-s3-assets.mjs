import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || "ap-south-1";
const prefix = (process.env.S3_PREFIX || "images").replace(/^\/+|\/+$/g, "");
const sourceDirectory = path.resolve(process.cwd(), "public/images");

if (process.env.SKIP_S3_UPLOAD === "true") {
  console.log("[StarzStyle] S3 upload skipped because SKIP_S3_UPLOAD=true.");
  process.exit(0);
}

if (!bucket) {
  console.log("[StarzStyle] S3_BUCKET is not set; continuing with local images.");
  process.exit(0);
}

const contentTypes = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    if (entry.isFile() && !entry.name.startsWith(".")) files.push(fullPath);
  }

  return files;
}

const files = await walk(sourceDirectory);
const client = new S3Client({ region });

console.log(`[StarzStyle] Uploading ${files.length} image(s) to s3://${bucket}/${prefix}/`);

for (const filePath of files) {
  const relativePath = path.relative(sourceDirectory, filePath).split(path.sep).join("/");
  const key = prefix ? `${prefix}/${relativePath}` : relativePath;
  const extension = path.extname(filePath).toLowerCase();
  const fileStats = await stat(filePath);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: fileStats.size,
    ContentType: contentTypes[extension] || "application/octet-stream",
    CacheControl: "public, max-age=31536000, immutable",
  }));

  console.log(`[StarzStyle] Uploaded ${key}`);
}

console.log(`[StarzStyle] S3 image upload complete: https://${bucket}.s3.${region}.amazonaws.com/${prefix}/`);
