import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectDir, "public", "ocr");
const coreOutputDir = path.join(outputDir, "core");
const langOutputDir = path.join(outputDir, "lang");

await Promise.all([
  mkdir(coreOutputDir, { recursive: true }),
  mkdir(langOutputDir, { recursive: true }),
]);

const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
    "core/tesseract-core-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "core/tesseract-core-simd-lstm.wasm.js",
  ],
  [
    "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
    "core/tesseract-core-relaxedsimd-lstm.wasm.js",
  ],
  [
    "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "lang/eng.traineddata.gz",
  ],
];

await Promise.all(
  assets.map(([source, destination]) =>
    copyFile(path.join(projectDir, source), path.join(outputDir, destination)),
  ),
);
