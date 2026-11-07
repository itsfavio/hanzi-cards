#!/usr/bin/env sh
# Rebuild the on-device OCR used by "From a photo" and image paste.
#
#   vendor/ocr/ocr-worker.js   scripts/ocr/worker.js bundled with PaddleOCR.js, OpenCV.js and ONNX Runtime Web
#   vendor/ocr/ort-wasm.js     ONNX Runtime's wasm glue (renamed from .mjs)
#   vendor/ocr/ort-wasm.wasm   ONNX Runtime's wasm binary
#   vendor/ocr/version.txt     fingerprint of the cached files (the page prefetches them under it)
#   data/ocr/*.tar             PP-OCRv6 small detection + recognition models (official PaddleOCR ONNX exports)
#
# Usage (from the repo root):  sh scripts/build_ocr.sh
# Versions are pinned in scripts/ocr/package.json; the models are pinned by URL below.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/scripts/ocr"
OUT="$ROOT/vendor/ocr"
MODELS="$ROOT/data/ocr"
MODEL_BASE="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0"

cd "$SRC"
npm install --no-audit --no-fund
mkdir -p "$OUT" "$MODELS"

ORT="$SRC/node_modules/onnxruntime-web/dist"
cp "$ORT/ort-wasm-simd-threaded.mjs" "$OUT/ort-wasm.js"
cp "$ORT/ort-wasm-simd-threaded.wasm" "$OUT/ort-wasm.wasm"

# The models are served from this repo: Baidu's host sends no CORS headers and is slow outside China.
for m in PP-OCRv6_small_det PP-OCRv6_small_rec; do
  if [ ! -s "$MODELS/$m.tar" ]; then
    curl -fL --retry 5 -C - -o "$MODELS/$m.tar" "$MODEL_BASE/${m}_onnx_infer.tar"
  fi
  tar -tf "$MODELS/$m.tar" | grep -q "inference.onnx" || { echo "bad archive: $m.tar" >&2; exit 1; }
done

# Fingerprint of the files the worker keeps in Cache Storage: any change to them gives browsers a fresh cache.
VERSION=$(cat "$OUT/ort-wasm.wasm" "$MODELS/PP-OCRv6_small_det.tar" "$MODELS/PP-OCRv6_small_rec.tar" | sha256sum | cut -c1-12)

# fs/path/crypto are only touched by OpenCV.js's Node code path, never in a browser.
npx esbuild worker.js --bundle --format=esm --platform=browser --minify \
  --external:fs --external:path --external:crypto \
  --define:OCR_ASSET_VERSION="\"$VERSION\"" \
  --outfile="$OUT/ocr-worker.js"

# The page reads this to prefetch the same files into the same cache (see prefetchOcrFiles in index.html).
echo "$VERSION" > "$OUT/version.txt"
echo "OCR asset version: $VERSION"
ls -l "$OUT" "$MODELS"
