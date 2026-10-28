import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FRAME_DIR = join(process.cwd(), "public", "frames");
const FOLDER = "siwak-animation";
const MAX_RETRIES = 3;

function listFrames(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })) {
    throw new Error(`Frames directory not found: ${dir}`);
  }

  return readdirSync(dir)
    .filter((file) => /^frame_\d{4}\.jpg$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function listExistingPublicIds() {
  const existing = new Set();
  let nextCursor = null;

  do {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: `${FOLDER}/`,
      max_results: 500,
      next_cursor: nextCursor,
    });

    for (const resource of result.resources || []) {
      const publicId = resource.public_id || "";
      if (publicId.startsWith(`${FOLDER}/`)) {
        existing.add(publicId.replace(`${FOLDER}/`, ""));
      }
    }

    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return existing;
}

async function uploadSingleFrame(file, existingIds) {
  const publicId = file.replace(/\.jpg$/i, "");
  const filePath = join(FRAME_DIR, file);

  if (existingIds.has(publicId)) {
    console.log(`Skipping ${file} because it is already on Cloudinary`);
    return false;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await cloudinary.uploader.upload(filePath, {
        folder: FOLDER,
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
        transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
      });

      existingIds.add(publicId);
      console.log(`Uploaded ${file} as ${FOLDER}/${publicId}`);
      return true;
    } catch (error) {
      const isRetryable = error?.http_code === 503 || error?.status === 503 || /503/.test(String(error));
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }

      console.warn(`Upload failed for ${file} (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
    }
  }

  return false;
}

async function uploadFrames() {
  const files = listFrames(FRAME_DIR);

  if (!files.length) {
    throw new Error(`No frame files found in ${FRAME_DIR}`);
  }

  const existingIds = await listExistingPublicIds();
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const publicId = file.replace(/\.jpg$/i, "");

    if (existingIds.has(publicId)) {
      skipped += 1;
      console.log(`Skipping ${file} because it already exists`);
      continue;
    }

    const uploadedThisFrame = await uploadSingleFrame(file, existingIds);
    if (uploadedThisFrame) {
      uploaded += 1;
    }
  }

  console.log(`Upload complete. Uploaded: ${uploaded}, skipped: ${skipped}, total frames: ${files.length}`);
}

uploadFrames().catch((error) => {
  console.error("Cloudinary upload failed:", error.message);
  process.exit(1);
});
