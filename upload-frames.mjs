import dotenv from "dotenv";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "i6w7au57",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const folder = process.argv[2] || "public/frames";
const remoteFolder = process.argv[3] || "siwak-animation";

if (!existsSync(folder)) {
  console.error(`Frames folder not found: ${folder}`);
  process.exit(1);
}

const files = readdirSync(folder)
  .filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file))
  .sort();

if (!files.length) {
  console.error(`No image files found in ${folder}`);
  process.exit(1);
}

async function uploadFrames() {
  for (const file of files) {
    const publicId = `${remoteFolder}/${file.replace(/\.[^.]+$/, "")}`;
    const result = await cloudinary.uploader.upload(join(folder, file), {
      public_id: publicId,
      folder: remoteFolder,
      overwrite: true,
      resource_type: "image",
    });
    console.log(`Uploaded: ${file} -> ${result.secure_url}`);
  }
}

uploadFrames().catch((error) => {
  console.error("Upload failed:", error.message);
  process.exit(1);
});
