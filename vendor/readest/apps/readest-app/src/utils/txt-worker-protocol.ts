export interface TxtConverterWorkerRequest {
  type: 'convert';
  payload: {
    file: File;
    author?: string;
    language?: string;
    prefetchText?: boolean;
  };
}

export interface TxtConverterWorkerSuccess {
  type: 'success';
  payload: {
    epubBuffer: ArrayBuffer;
    name: string;
    bookTitle: string;
    chapterCount: number;
    language: string;
    prefetchedText?: Record<string, string>;
  };
}

export interface TxtConverterWorkerError {
  type: 'error';
  payload: {
    message: string;
  };
}

export interface TxtConversionProgress {
  completed: number;
  total: number;
}

export interface TxtConverterWorkerProgress {
  type: 'progress';
  payload: TxtConversionProgress;
}

export type TxtConverterWorkerResponse = TxtConverterWorkerSuccess | TxtConverterWorkerError | TxtConverterWorkerProgress;
