import {
  layoutText,
  parseProspectusText,
  validateProspectusFile,
  type TextToken,
} from './prospectus';
import type { Worker } from 'tesseract.js';

export async function extractProspectus(
  file: File,
  report: (message: string, progress: number) => void,
  signal: AbortSignal,
) {
  const kind = validateProspectusFile(file);
  let worker: Worker | undefined;
  let pdf:
    | Awaited<
        ReturnType<(typeof import('pdfjs-dist'))['getDocument']>['promise']
      >
    | undefined;
  let loadingTask:
    | ReturnType<(typeof import('pdfjs-dist'))['getDocument']>
    | undefined;
  const check = () => {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  };
  const cancel = () => {
    void worker?.terminate().catch(() => {});
    void loadingTask?.destroy().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  async function recognize(
    image: File | HTMLCanvasElement,
    page: number,
    pages: number,
  ) {
    check();
    if (!worker) {
      const { createWorker, OEM } = await import('tesseract.js');
      check();
      report('Loading text recognition', 0);
      worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: '/extraction/worker.min.js',
        corePath: '/extraction',
        langPath: '/extraction',
        workerBlobURL: false,
        logger: (m) => {
          if (!signal.aborted)
            report(
              `Reading page ${page} of ${pages}`,
              Math.round(((page - 1 + m.progress) / pages) * 100),
            );
        },
      });
      check();
      await worker.setParameters({ preserve_interword_spaces: '1' });
    }
    const { data } = await worker.recognize(
      image,
      {},
      { text: true, tsv: true },
    );
    check();
    const tokens: TextToken[] = (data.tsv ?? '')
      .split('\n')
      .slice(1)
      .flatMap((line) => {
        const c = line.split('\t');
        return c[0] === '5' && c[11]?.trim()
          ? [
              {
                text: c.slice(11).join('\t'),
                x: Number(c[6]),
                y: Number(c[7]),
                width: Number(c[8]),
                height: Number(c[9]),
              },
            ]
          : [];
      });
    return tokens.length ? layoutText(tokens) : data.text;
  }
  try {
    check();
    report('Reading file', 0);
    const bytes = new Uint8Array(await file.arrayBuffer());
    check();
    const signature = Array.from(bytes.slice(0, 5))
      .map((b) => String.fromCharCode(b))
      .join('');
    if (kind === 'application/pdf' && signature !== '%PDF-')
      throw new Error('This file is not a readable PDF.');
    if (
      kind === 'image/png' &&
      !(
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
      )
    )
      throw new Error('This file is not a readable PNG.');
    if (kind === 'image/jpeg' && !(bytes[0] === 255 && bytes[1] === 216))
      throw new Error('This file is not a readable JPG.');
    if (kind !== 'application/pdf') {
      const bitmap = await createImageBitmap(file);
      const tooLarge = bitmap.width * bitmap.height > 25_000_000;
      bitmap.close();
      if (tooLarge)
        throw new Error('Image is too large. Resize it below 25 megapixels.');
      const text = await recognize(file, 1, 1);
      report('Ready to review', 100);
      return parseProspectusText(text, file.name, 'ocr');
    }
    const pdfjs = await import('pdfjs-dist');
    check();
    pdfjs.GlobalWorkerOptions.workerSrc = '/extraction/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: bytes });
    loadingTask = task;
    task.onPassword = () => {
      void task.destroy();
    };
    pdf = await task.promise;
    check();
    if (pdf.numPages > 20)
      throw new Error('Use a prospectus with 20 pages or fewer.');
    const pages: string[] = [];
    let ocrPages = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      check();
      report(
        `Reading page ${i} of ${pdf.numPages}`,
        Math.round(((i - 1) / pdf.numPages) * 100),
      );
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const tokens: TextToken[] = content.items.flatMap((item) =>
        'str' in item
          ? [
              {
                text: item.str,
                x: item.transform[4],
                y: -item.transform[5],
                width: item.width,
                height: item.height || 10,
              },
            ]
          : [],
      );
      let text = layoutText(tokens);
      // A short/incomplete text layer must not hide a scanned table.
      if (
        text.replace(/\s/g, '').length < 60 ||
        !parseProspectusText(text, file.name, 'pdf-text').rows.length
      ) {
        const raw = page.getViewport({ scale: 1 });
        const scale = Math.min(
          2.4,
          Math.sqrt(12_000_000 / (raw.width * raw.height)),
        );
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('This browser cannot read scanned PDFs.');
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        check();
        text = await recognize(canvas, i, pdf.numPages);
        ocrPages++;
        canvas.width = 0;
        canvas.height = 0;
      }
      pages.push(text);
      page.cleanup();
    }
    const method =
      ocrPages === 0 ? 'pdf-text' : ocrPages === pdf.numPages ? 'ocr' : 'mixed';
    report('Ready to review', 100);
    return parseProspectusText(pages.join('\n'), file.name, method);
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const message =
      error instanceof Error
        ? error.message
        : 'Could not read this prospectus.';
    throw new Error(
      /password|destroyed/i.test(message)
        ? 'Password-protected PDFs are not supported. Upload an unlocked copy.'
        : message,
    );
  } finally {
    signal.removeEventListener('abort', cancel);
    await worker?.terminate().catch(() => {});
    await loadingTask?.destroy().catch(() => {});
  }
}
