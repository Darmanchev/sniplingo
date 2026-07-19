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
      return result.data.text.trim();
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

function getAssetDirectoryUrl(
  assetPath:
    | '/tesseract/core/tesseract-core-lstm.wasm.js'
    | '/tesseract/lang/eng.traineddata.gz',
): string {
  return new URL('.', browser.runtime.getURL(assetPath)).href;
}
