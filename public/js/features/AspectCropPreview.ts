import { BaseComponent } from '../components/BaseComponent.js';

export class AspectCropPreview extends BaseComponent {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private currentImage: HTMLImageElement | null = null;
  private aspectRatio: string = '1:1';
  private positionX: number = 50;
  private positionY: number = 50;

  // Drag & Drop state
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartPositionX: number = 0;
  private dragStartPositionY: number = 0;

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
    this.bindCanvasEvents();
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
    this.isDragging = false;
    this.renderCanvas();
  }

  private bindCanvasEvents(): void {
    const canvas = this.canvas;

    const canvasListeners = [
      { element: canvas, event: 'mousedown', handler: this.handleMouseDown.bind(this) as EventListener },
      { element: canvas, event: 'mousemove', handler: this.handleMouseMove.bind(this) as EventListener },
      { element: canvas, event: 'mouseup', handler: this.handleMouseUp.bind(this) as EventListener },
      { element: canvas, event: 'mouseleave', handler: this.handleMouseLeave.bind(this) as EventListener }
    ];

    this.addEventListeners('canvas', canvasListeners);
  }

  private handleMouseDown(e: Event): void {
    const mouseEvent = e as MouseEvent;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = mouseEvent.clientX - rect.left;
    const mouseY = mouseEvent.clientY - rect.top;

    if (this.isInsideCropArea(mouseX, mouseY)) {
      this.isDragging = true;
      this.dragStartX = mouseX;
      this.dragStartY = mouseY;
      this.dragStartPositionX = this.positionX;
      this.dragStartPositionY = this.positionY;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  private handleMouseMove(e: Event): void {
    const mouseEvent = e as MouseEvent;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = mouseEvent.clientX - rect.left;
    const mouseY = mouseEvent.clientY - rect.top;

    if (this.isDragging) {
      // Calculate drag delta
      const deltaX = mouseX - this.dragStartX;
      const deltaY = mouseY - this.dragStartY;

      // Convert delta to percentage of crop area movement
      const newPosition = this.calculateNewPosition(deltaX, deltaY);

      // Update position and render
      this.positionX = newPosition.x;
      this.positionY = newPosition.y;
      this.renderCanvas();
      this.updateSliderValues();
    } else {
      // Update cursor based on hover position
      if (this.isInsideCropArea(mouseX, mouseY)) {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  private handleMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    }
  }

  private handleMouseLeave(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
    }
  }

  private isInsideCropArea(mouseX: number, mouseY: number): boolean {
    if (!this.currentImage) return false;

    const { cropX, cropY, cropWidth, cropHeight } = this.getCropAreaOnCanvas();

    return mouseX >= cropX &&
           mouseX <= cropX + cropWidth &&
           mouseY >= cropY &&
           mouseY <= cropY + cropHeight;
  }

  private calculateNewPosition(deltaX: number, deltaY: number): { x: number; y: number } {
    if (!this.currentImage) return { x: this.positionX, y: this.positionY };

    // Get image and crop dimensions on canvas
    const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height);
    const scaledWidth = this.currentImage.width * scale;
    const scaledHeight = this.currentImage.height * scale;

    // Convert pixel delta to percentage delta
    const percentDeltaX = (deltaX / scaledWidth) * 100;
    const percentDeltaY = (deltaY / scaledHeight) * 100;

    // Calculate new position
    const newX = Math.max(0, Math.min(100, this.dragStartPositionX + percentDeltaX));
    const newY = Math.max(0, Math.min(100, this.dragStartPositionY + percentDeltaY));

    return { x: newX, y: newY };
  }

  private getCropAreaOnCanvas(): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
    if (!this.currentImage) {
      return { cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 };
    }

    // Calculate crop dimensions based on aspect ratio
    const { cropWidth, cropHeight, cropX, cropY } = this.calculateCropDimensions();

    // Scale image to fit canvas while maintaining aspect ratio
    const scale = Math.min(this.canvas.width / this.currentImage.width, this.canvas.height / this.currentImage.height);
    const scaledWidth = this.currentImage.width * scale;
    const scaledHeight = this.currentImage.height * scale;
    const offsetX = (this.canvas.width - scaledWidth) / 2;
    const offsetY = (this.canvas.height - scaledHeight) / 2;

    // Calculate crop rectangle position on canvas
    const cropCanvasX = offsetX + (cropX / this.currentImage.width) * scaledWidth;
    const cropCanvasY = offsetY + (cropY / this.currentImage.height) * scaledHeight;
    const cropCanvasWidth = (cropWidth / this.currentImage.width) * scaledWidth;
    const cropCanvasHeight = (cropHeight / this.currentImage.height) * scaledHeight;

    return {
      cropX: cropCanvasX,
      cropY: cropCanvasY,
      cropWidth: cropCanvasWidth,
      cropHeight: cropCanvasHeight
    };
  }

  private updateSliderValues(): void {
    // Update the slider values to match the current position
    const cropPositionX = document.getElementById('cropPositionX') as HTMLInputElement;
    const cropPositionY = document.getElementById('cropPositionY') as HTMLInputElement;
    const cropPositionXValue = document.getElementById('cropPositionXValue');
    const cropPositionYValue = document.getElementById('cropPositionYValue');

    if (cropPositionX) {
      cropPositionX.value = this.positionX.toString();
    }
    if (cropPositionY) {
      cropPositionY.value = this.positionY.toString();
    }
    if (cropPositionXValue) {
      cropPositionXValue.textContent = `${Math.round(this.positionX)}%`;
    }
    if (cropPositionYValue) {
      cropPositionYValue.textContent = `${Math.round(this.positionY)}%`;
    }
  }
}