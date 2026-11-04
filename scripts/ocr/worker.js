// Source of vendor/ocr/ocr-worker.js: runs PaddleOCR (PP-OCRv6 small) in a Web Worker so reading an
// image never freezes the page. Rebuild with scripts/build_ocr.sh after editing.
//
// Protocol (see readHanFromImage in index.html):
//   page   → worker  { id, image: ImageBitmap }      (the bitmap is transferred)
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

function bitmapToMat(cv, bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return cv.matFromImageData(ctx.getImageData(0, 0, bitmap.width, bitmap.height)); // RGBA, like cv.imread
}

self.onmessage = async ({ data: { id, image } }) => {
  let mat = null;
  try {
    const ocr = await engine(); // also waits for OpenCV to finish initialising
    const cv = cvModule instanceof Promise ? await cvModule : cvModule;
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
};
