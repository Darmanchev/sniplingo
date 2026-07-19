import { createWorker, OEM } from 'tesseract.js';

export interface OcrProgress {
  progress: number;
  status: string;
}

type ProgressListener = (progress: OcrProgress) => void;

export class OcrService {
  private workerPromise: ReturnType<typeof createWorker> | null = null;
  private progressListener: ProgressListener | null = null;

  async recognize(
    image: string,
    onProgress?: ProgressListener,
  ): Promise<string> {
    this.progressListener = onProgress ?? null;

    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(image);
      return sanitizeOcrText(result.data.text);
    } finally {
      this.progressListener = null;
    }
  }

  private getWorker(): ReturnType<typeof createWorker> {
    if (this.workerPromise === null) {
      this.workerPromise = createWorker(['eng', 'rus'], OEM.LSTM_ONLY, {
        workerPath: browser.runtime.getURL('/tesseract/worker.min.js'),
        corePath: getAssetDirectoryUrl(
          '/tesseract/core/tesseract-core-lstm.wasm.js',
        ),
        langPath: getAssetDirectoryUrl('/tesseract/lang/eng.traineddata.gz'),
        workerBlobURL: false,
        logger: ({ progress, status }) => {
          this.progressListener?.({ progress, status });
        },
      });

      void this.workerPromise.catch(() => {
        this.workerPromise = null;
      });
    }

    return this.workerPromise;
  }
}

export function sanitizeOcrText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\r\n\t ]+/gu, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\r?\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getAssetDirectoryUrl(
  assetPath:
    | '/tesseract/core/tesseract-core-lstm.wasm.js'
    | '/tesseract/lang/eng.traineddata.gz',
): string {
  return new URL('.', browser.runtime.getURL(assetPath)).href;
}
