import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const output = resolve('public/extraction');
await mkdir(output, { recursive: true });
const assets = [
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['pdfjs-dist/LICENSE', 'PDFJS-LICENSE'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js/LICENSE.md', 'TESSERACT-LICENSE'],
  [
    '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    'eng.traineddata.gz',
  ],
  ...['lstm', 'simd-lstm', 'relaxedsimd-lstm'].map((kind) => [
    `tesseract.js-core/tesseract-core-${kind}.wasm.js`,
    `tesseract-core-${kind}.wasm.js`,
  ]),
];
for (const [source, target] of assets)
  await copyFile(resolve('node_modules', source), resolve(output, target));
console.log('Local PDF and OCR assets prepared.');
