import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initNav } from "./nav.js";

gsap.registerPlugin(ScrollTrigger);
initNav();

const FRAME_COUNT = 598;
const frameUrl = (i) => `/frames/frame_${String(i).padStart(4, "0")}.jpg`;

const canvas = document.getElementById("videoCanvas");
const ctx = canvas.getContext("2d");
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
const loaderLabel = document.getElementById("loaderLabel");
const app = document.getElementById("app");

const images = new Array(FRAME_COUNT);
let currentIndex = 0;

function loadFrames() {
  let loaded = 0;
  const updateProgress = () => {
    loaded += 1;
    const pct = Math.round((loaded / FRAME_COUNT) * 100);
    loaderFill.style.width = `${pct}%`;
    loaderLabel.textContent = `Loading ${pct}%`;
  };

  const promises = [];
  for (let i = 1; i <= FRAME_COUNT; i += 1) {
    const img = new Image();
    const p = new Promise((resolve) => {
      img.onload = () => {
        updateProgress();
        resolve();
      };
      img.onerror = () => {
        updateProgress();
        resolve();
      };
    });
    img.src = frameUrl(i);
    images[i - 1] = img;
    promises.push(p);
  }
  return Promise.all(promises);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  drawFrame(currentIndex);
}

function drawFrame(index) {
  const img = images[index];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  currentIndex = index;

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
  ScrollTrigger.create({
    trigger: "#scrollVideo",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const index = Math.min(
        FRAME_COUNT - 1,
        Math.floor(self.progress * FRAME_COUNT)
      );
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
}

init();
