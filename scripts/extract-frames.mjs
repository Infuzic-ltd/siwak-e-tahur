import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const SOURCE_VIDEO = process.argv[2];
const OUT_DIR = "public/frames";
const FPS = 15;
const WIDTH = 1280;

if (!SOURCE_VIDEO) {
  console.error("Usage: node scripts/extract-frames.mjs <path-to-video.mp4>");
  process.exit(1);
}

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

execFileSync(
  ffmpegPath,
  [
    "-y",
    "-i", SOURCE_VIDEO,
    "-vf", `fps=${FPS},scale=${WIDTH}:-1`,
    "-q:v", "4",
    `${OUT_DIR}/frame_%04d.jpg`,
  ],
  { stdio: "inherit" }
);

console.log(`Frames written to ${OUT_DIR}`);
