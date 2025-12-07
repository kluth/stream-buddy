import { Injectable, signal } from '@angular/core';

export interface ImageSource {
  id: string;
  element: HTMLImageElement;
  src: string;
  label: string;
}

@Injectable({
  providedIn: 'root',
})
export class ImageSourceService {
  private sources = new Map<string, ImageSource>();
  readonly activeSources = signal<ImageSource[]>([]);

  async createImageSource(file: File | string, label: string): Promise<ImageSource> {
    const id = crypto.randomUUID();
    const img = new Image();
    const url = typeof file === 'string' ? file : URL.createObjectURL(file);

    img.src = url;
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });

    const source: ImageSource = {
      id,
      element: img,
      src: url,
      label,
    };

    this.sources.set(id, source);
    this.updateSignal();
    return source;
  }

  getImageElement(id: string): HTMLImageElement | undefined {
    return this.sources.get(id)?.element;
  }

  removeSource(id: string) {
    const source = this.sources.get(id);
    if (source) {
      if (source.src.startsWith('blob:')) {
        URL.revokeObjectURL(source.src);
      }
      this.sources.delete(id);
      this.updateSignal();
    }
  }

  private updateSignal() {
    this.activeSources.set(Array.from(this.sources.values()));
  }
}
