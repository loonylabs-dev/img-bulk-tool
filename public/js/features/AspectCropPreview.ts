import { BaseComponent } from '../components/BaseComponent.js';

export class AspectCropPreview extends BaseComponent {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private currentImage: HTMLImageElement | null = null;
  private aspectRatio: string = '1:1';
  private positionX: number = 50;
  private positionY: number = 50;

  constructor() {
    super('aspectCropOptions');
    this.initializeElements();
  }

  private initializeElements(): void {
    this.canvas = this.$('#aspectCropCanvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Aspect crop canvas not found');
    }
    this.ctx = this.canvas.getContext('2d')!;
  }

  public init(): void {
    this.renderCanvas();
  }

  public updateImage(imageFile: File): void {
    if (!imageFile) return;

    const img = new Image();
    img.onload = () => {
      this.currentImage = img;
      this.renderCanvas();
    };
    img.src = URL.createObjectURL(imageFile);
  }

  public updateAspectRatio(aspectRatio: string): void {
    this.aspectRatio = aspectRatio;
    this.renderCanvas();
  }

  public updatePosition(x: number, y: number): void {
    this.positionX = x;
    this.positionY = y;
    this.renderCanvas();
  }

  private renderCanvas(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!this.currentImage) {
      // Draw placeholder text
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select an image to see preview', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Calculate crop dimensions based on aspect ratio
    const { cropWidth, cropHeight, cropX, cropY } = this.calculateCropDimensions();

    // Scale image to fit canvas while maintaining aspect ratio
    const scale = Math.min(canvas.width / this.currentImage.width, canvas.height / this.currentImage.height);
    const scaledWidth = this.currentImage.width * scale;
    const scaledHeight = this.currentImage.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Draw original image
    ctx.drawImage(
      this.currentImage,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    );

    // Calculate crop rectangle position on canvas
    const cropCanvasX = offsetX + (cropX / this.currentImage.width) * scaledWidth;
    const cropCanvasY = offsetY + (cropY / this.currentImage.height) * scaledHeight;
    const cropCanvasWidth = (cropWidth / this.currentImage.width) * scaledWidth;
    const cropCanvasHeight = (cropHeight / this.currentImage.height) * scaledHeight;

    // Draw crop overlay (darken areas outside crop)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

    // Top rectangle
    ctx.fillRect(offsetX, offsetY, scaledWidth, cropCanvasY - offsetY);

    // Bottom rectangle
    ctx.fillRect(offsetX, cropCanvasY + cropCanvasHeight, scaledWidth, scaledHeight - (cropCanvasY + cropCanvasHeight - offsetY));

    // Left rectangle
    ctx.fillRect(offsetX, cropCanvasY, cropCanvasX - offsetX, cropCanvasHeight);

    // Right rectangle
    ctx.fillRect(cropCanvasX + cropCanvasWidth, cropCanvasY, scaledWidth - (cropCanvasX + cropCanvasWidth - offsetX), cropCanvasHeight);

    // Draw crop rectangle border
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);

    // Draw corner handles
    this.drawCornerHandles(ctx, cropCanvasX, cropCanvasY, cropCanvasWidth, cropCanvasHeight);
  }

  private calculateCropDimensions(): { cropWidth: number; cropHeight: number; cropX: number; cropY: number } {
    if (!this.currentImage) {
      return { cropWidth: 0, cropHeight: 0, cropX: 0, cropY: 0 };
    }

    // Parse aspect ratio
    const [ratioWidthStr, ratioHeightStr] = this.aspectRatio.split(':');
    const ratioWidth = parseFloat(ratioWidthStr || '1');
    const ratioHeight = parseFloat(ratioHeightStr || '1');

    if (!ratioWidth || !ratioHeight || ratioWidth <= 0 || ratioHeight <= 0) {
      return { cropWidth: this.currentImage.width, cropHeight: this.currentImage.height, cropX: 0, cropY: 0 };
    }

    const targetRatio = ratioWidth / ratioHeight;
    const sourceRatio = this.currentImage.width / this.currentImage.height;

    let cropWidth: number;
    let cropHeight: number;

    // Calculate crop dimensions to fit target aspect ratio
    if (sourceRatio > targetRatio) {
      // Source is wider than target ratio - crop width
      cropHeight = this.currentImage.height;
      cropWidth = Math.round(cropHeight * targetRatio);
    } else {
      // Source is taller than target ratio - crop height
      cropWidth = this.currentImage.width;
      cropHeight = Math.round(cropWidth / targetRatio);
    }

    // Calculate crop position based on percentage
    const maxX = this.currentImage.width - cropWidth;
    const maxY = this.currentImage.height - cropHeight;

    const cropX = Math.round(maxX * (this.positionX / 100));
    const cropY = Math.round(maxY * (this.positionY / 100));

    return {
      cropWidth,
      cropHeight,
      cropX: Math.max(0, Math.min(cropX, maxX)),
      cropY: Math.max(0, Math.min(cropY, maxY))
    };
  }

  private drawCornerHandles(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    const handleSize = 8;
    ctx.fillStyle = '#ff4444';

    // Top-left
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);

    // Top-right
    ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize);

    // Bottom-left
    ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);

    // Bottom-right
    ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
  }

  public reset(): void {
    this.currentImage = null;
    this.aspectRatio = '1:1';
    this.positionX = 50;
    this.positionY = 50;
    this.renderCanvas();
  }
}