// Source of vendor/ocr/ocr-worker.js: runs PaddleOCR (PP-OCRv6 small) in a Web Worker so reading an
// image never freezes the page. Rebuild with scripts/build_ocr.sh after editing.
//
// Protocol (see readHanFromImage and warmOcr in index.html):
//   page   → worker  { id, image: ImageBitmap }      read an image (the bitmap is transferred)
//                    { id, warm: true }              load the models and run one tiny read, so later reads start hot
//   worker → page    { id, status: "reading" }       once the models are loaded
//                    { id, lines: string[] }         recognised text, one entry per line, reading order
//                    { id, error: string }
import { PaddleOCR } from "@paddleocr/paddleocr-js";
// The same OpenCV instance PaddleOCR uses (the bundler dedupes it). predict() turns Blobs and bitmaps
// into an OpenCV Mat through a DOM <canvas>, which workers don't have, so the worker hands it a Mat
// built from an OffscreenCanvas instead, as PaddleOCR's own worker mode does.
import cvModule from "@techstark/opencv-js";

const HERE = new URL("./", import.meta.url);
const MODELS = new URL("../../data/ocr/", import.meta.url);
const DET = "PP-OCRv6_small_det", REC = "PP-OCRv6_small_rec";
// Phone photos are ~4000 px wide; the detector's cost grows with pixel count, and text stays legible far
// below that (PaddleOCR traditionally uses 960). Shrinking the longest side to this size made phone-sized
// photos ~9x faster in testing (16.7 s -> 1.9 s on a desktop) with no loss of accuracy on the test set.
const MAX_SIDE = 1280;

// The big files (models + ONNX Runtime's wasm, ~45 MB) are kept in Cache Storage after the first download,
// so later visits load them from the device instead of re-downloading or re-checking with the server
// (GitHub Pages lets browsers keep files only 10 minutes before re-checking, and phones evict big HTTP-cache
// entries). OCR_ASSET_VERSION is a fingerprint of those files that build_ocr.sh stamps in, so every rebuild
// gets a fresh cache and old ones are deleted. Anything else, or any cache failure, goes to the network.
const CACHE = "hanzi-cards-ocr-" + (typeof OCR_ASSET_VERSION === "string" ? OCR_ASSET_VERSION : "dev");
const PERSIST = [new URL(DET + ".tar", MODELS).href, new URL(REC + ".tar", MODELS).href, new URL("ort-wasm.wasm", HERE).href];
const netFetch = self.fetch.bind(self);
self.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!PERSIST.includes(url) || !self.caches) return netFetch(input, init);
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return hit;
    const res = await netFetch(input, init);
    if (res.ok) cache.put(url, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    return netFetch(input, init);
  }
};
if (self.caches) {
  caches.keys().then(keys => keys.filter(k => k.startsWith("hanzi-cards-ocr-") && k !== CACHE).forEach(k => caches.delete(k))).catch(() => {});
}

let engineP = null;
function engine() {
  return engineP || (engineP = PaddleOCR.create({
    textDetectionModelName: DET, textDetectionModelAsset: { url: new URL(DET + ".tar", MODELS).href },
    textRecognitionModelName: REC, textRecognitionModelAsset: { url: new URL(REC + ".tar", MODELS).href },
    // ONNX Runtime's glue and wasm are renamed to .js/.wasm so any static host serves them with the right type.
    ortOptions: { backend: "wasm", wasmPaths: { mjs: new URL("ort-wasm.js", HERE).href, wasm: new URL("ort-wasm.wasm", HERE).href } },
  }).catch(e => { engineP = null; throw e; }));
}

// Detected boxes come back unordered: sort into rows (boxes whose vertical centres overlap), then left to right.
function readingOrder(items) {
  const boxes = items.map(it => {
    const ys = it.poly.map(p => p[1]), xs = it.poly.map(p => p[0]);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    return { text: it.text, x: Math.min(...xs), cy: (top + bottom) / 2, h: bottom - top };
  }).sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const b of boxes) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(b.cy - row.cy) < Math.min(b.h, row.h) / 2) row.items.push(b);
    else rows.push({ cy: b.cy, h: b.h, items: [b] });
  }
  return rows.map(r => r.items.sort((a, b) => a.x - b.x).map(b => b.text).join(" "));
}

// Draws the image (scaled down if it's larger than MAX_SIDE) and wraps the pixels as an RGBA Mat, like cv.imread.
function bitmapToMat(cv, bitmap) {
  const s = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s)), h = Math.max(1, Math.round(bitmap.height * s));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return cv.matFromImageData(ctx.getImageData(0, 0, w, h));
}

async function handle({ id, image, warm }) {
  let mat = null;
  try {
    const ocr = await engine(); // also waits for OpenCV to finish initialising
    // Not `await cvModule` in a helper: the OpenCV module has a .then that resolves to itself, so returning
    // it from an async function makes the promise chase that forever.
    const cv = cvModule instanceof Promise ? await cvModule : cvModule;
    if (warm) {
      // One read of a small blank image compiles and allocates everything the first real read would.
      mat = new cv.Mat(64, 256, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
      await ocr.predict(mat);
      self.postMessage({ id, lines: [] });
      return;
    }
    self.postMessage({ id, status: "reading" });
    mat = bitmapToMat(cv, image);
    const [res] = await ocr.predict(mat);
    self.postMessage({ id, lines: readingOrder(res.items) });
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  } finally {
    if (mat) mat.delete();
    if (image && image.close) image.close();
  }
}

// One job at a time: a background warm-up and a real read never run on the model at once.
let queue = Promise.resolve();
self.onmessage = ({ data }) => { queue = queue.then(() => handle(data)); };
