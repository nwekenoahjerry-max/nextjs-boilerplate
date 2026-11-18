export type PptxLoadProgress = (progress: number, message: string) => void;

export declare class PptxRenderer {
  readonly slideCount: number;
  load(source: File | Blob | ArrayBuffer | Uint8Array, onProgress?: PptxLoadProgress): Promise<void>;
  renderSlide(slideIndex: number, canvas: HTMLCanvasElement, width?: number): Promise<void>;
  renderAllSlides(width?: number): Promise<HTMLCanvasElement[]>;
  destroy(): void;
}

export default PptxRenderer;
