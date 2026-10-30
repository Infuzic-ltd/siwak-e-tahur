import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initNav } from "./nav.js";

gsap.registerPlugin(ScrollTrigger);
initNav();

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "i6w7au57";
const FRAME_COUNT = 150;
const PRELOAD_COUNT = 10;
const SCROLL_SPEED = 0.5; // lower values = slower animation; 1 = normal; >1 = faster

const cloudinaryFrameUrl = (i) =>
  `https://res.cloudinary.com/${cloudName}/image/upload/q_auto,f_auto/siwak-animation/frame_${String(i).padStart(4, "0")}.jpg`;
const localFrameUrl = (i) =>
  `/frames/frame_${String(i).padStart(4, "0")}.jpg`;

const canvas = document.getElementById("videoCanvas");
const ctx = canvas.getContext("2d");
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
const loaderLabel = document.getElementById("loaderLabel");
const app = document.getElementById("app");
const loaderMessages = [
  "Preparing nature's rhythm...",
  "Breathing life into the story...",
  "Polishing the ritual...",
  "Almost ready for the first frame...",
];

const images = new Array(FRAME_COUNT);
const frameLoads = new Array(FRAME_COUNT);
let currentIndex = 0; // frame the scroll position asks for
let drawnIndex = -1; // frame actually on the canvas (may lag while loading)
let drawQueued = false;

const isLoaded = (img) => img && img.complete && img.naturalWidth > 0;

function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    drawFrame(currentIndex);
  });
}

function ensureFrame(index) {
  const actualIndex = Math.max(1, Math.min(FRAME_COUNT, index));
  const slot = actualIndex - 1;
  if (!images[slot]) {
    const img = new Image();
    img.decoding = "async";
    img.dataset.fallbackUsed = "false";

    frameLoads[slot] = new Promise((resolve) => {
      img.onload = () => {
        resolve(img);
        // A frame closer to where the user scrolled just arrived: show it.
        if (slot <= currentIndex && slot > drawnIndex) scheduleDraw();
      };
      img.onerror = () => {
        if (img.dataset.fallbackUsed === "true") {
          resolve(img);
          return;
        }
        img.dataset.fallbackUsed = "true";
        img.src = cloudinaryFrameUrl(actualIndex);
      };
    });

    img.src = localFrameUrl(actualIndex);
    images[slot] = img;
  }

  return images[slot];
}

function loadFrame(index) {
  ensureFrame(index);
  return frameLoads[Math.max(1, Math.min(FRAME_COUNT, index)) - 1];
}

function nearestLoadedFrame(index) {
  for (let i = index; i >= 0; i -= 1) {
    if (isLoaded(images[i])) return i;
  }
  return -1;
}

function preloadRemainingFrames(concurrency = 4) {
  let next = PRELOAD_COUNT + 1;
  const worker = async () => {
    while (next <= FRAME_COUNT) {
      await loadFrame(next++);
    }
  };
  for (let i = 0; i < concurrency; i += 1) worker();
}

function lazyLoadNearbyFrames(current) {
  for (let offset = -2; offset <= 2; offset += 1) {
    const targetIndex = current + offset;
    if (targetIndex < 1 || targetIndex > FRAME_COUNT) continue;
    if (!images[targetIndex - 1]) {
      ensureFrame(targetIndex);
    }
  }
}

function loadFrames() {
  let loaded = 0;
  const updateProgress = () => {
    loaded += 1;
    const pct = Math.min(100, Math.round((loaded / PRELOAD_COUNT) * 100));
    loaderFill.style.width = `${pct}%`;
    const messageIndex = Math.min(
      loaderMessages.length - 1,
      Math.floor((pct / 100) * loaderMessages.length)
    );
    loaderLabel.textContent = `Loading ${pct}% · ${loaderMessages[messageIndex]}`;
  };

  const firstBatch = Array.from({ length: PRELOAD_COUNT }, (_, index) => index + 1);
  const promises = firstBatch.map((index) => loadFrame(index).then(updateProgress));

  return Promise.all(promises);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  drawFrame(currentIndex);
}

function drawFrame(index) {
  currentIndex = index;
  ensureFrame(index + 1);

  // Until the requested frame arrives, show the closest earlier one instead of freezing.
  const drawIndex = nearestLoadedFrame(index);
  if (drawIndex === -1) return;
  const img = images[drawIndex];
  drawnIndex = drawIndex;

  const canvasAspect = canvas.width / canvas.height;
  const imgAspect = img.naturalWidth / img.naturalHeight;

  let sx, sy, sw, sh;
  if (imgAspect > canvasAspect) {
    sh = img.naturalHeight;
    sw = sh * canvasAspect;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / canvasAspect;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

function initScrollAnimation() {
  // Slow the animation by lengthening the scroll, so every frame is still reached.
  document.getElementById("scrollVideo").style.setProperty("--scroll-speed", SCROLL_SPEED);

  ScrollTrigger.create({
    trigger: "#scrollVideo",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const index = Math.min(FRAME_COUNT - 1, Math.floor(self.progress * FRAME_COUNT));
      lazyLoadNearbyFrames(index + 1);
      drawFrame(index);
    },
  });

  const revealEls = gsap.utils.toArray("[data-reveal]");
  gsap.timeline({
    scrollTrigger: {
      trigger: "#scrollVideo",
      start: "top top",
      end: "+=35%",
      scrub: true,
    },
  })
    .to(revealEls, { opacity: 1, y: 0, stagger: 0.1, duration: 0.3 })
    .to(revealEls, { opacity: 0, y: -16, duration: 0.3 }, 0.65);
}

async function init() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  await loadFrames();

  loader.remove();
  app.hidden = false;

  drawFrame(0);
  initScrollAnimation();
  ScrollTrigger.refresh();
  preloadRemainingFrames();
}

init();
