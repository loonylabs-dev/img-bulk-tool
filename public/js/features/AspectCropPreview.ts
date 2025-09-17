import { BaseComponent } from '../components/BaseComponent.js';
import { ImageFile } from '../models/index.js';

interface CanvasInfo {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageFile: ImageFile;
  loadedImage: HTMLImageElement | null;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartPositionX: number;
  dragStartPositionY: number;
}

export class AspectCropPreview extends BaseComponent {
  private container!: HTMLElement;
  private images: ImageFile[] = [];
  private canvases: Map<string, CanvasInfo> = new Map();
  private aspectRatio: string = '1:1';

  constructor() {
    super('aspectCropOptions');
    this.initializeElements();
  }

  private initializeElements(): void {
    this.container = this.$('#multiPreviewContainer') as HTMLElement;
    if (!this.container) {
      throw new Error('Multi-preview container not found');
    }
  }

  public init(): void {
    this.renderContainer();
  }

  public updateImages(imageFiles: ImageFile[]): void {
    this.images = imageFiles.map(img => ({
      ...img,
      cropPositionX: img.cropPositionX || 50,
      cropPositionY: img.cropPositionY || 50
    }));
    this.renderContainer();
  }

  public updateAspectRatio(aspectRatio: string): void {
    this.aspectRatio = aspectRatio;
    this.renderAllCanvases();
  }

  private renderContainer(): void {
    if (this.images.length === 0) {
      this.container.innerHTML = '<div class="preview-info"><p>Select images to see crop preview</p></div>';
      return;
    }

    // Clear existing canvases
    this.canvases.clear();
    this.removeEventListeners('canvas');

    // Create grid layout
    this.container.innerHTML = '';
    this.container.className = 'multi-preview-container';

    this.images.forEach((imageFile, index) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'preview-item';

      const label = document.createElement('div');
      label.className = 'preview-label';
      label.textContent = imageFile.file.name;

      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      canvas.className = 'crop-preview-canvas';
      canvas.dataset['imageIndex'] = index.toString();

      const ctx = canvas.getContext('2d')!;

      previewItem.appendChild(label);
      previewItem.appendChild(canvas);
      this.container.appendChild(previewItem);

      // Store canvas info
      const canvasInfo: CanvasInfo = {
        canvas,
        ctx,
        imageFile,
        loadedImage: null,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartPositionX: 0,
        dragStartPositionY: 0
      };

      const canvasKey = `canvas_${index}`;
      this.canvases.set(canvasKey, canvasInfo);

      // Load and render image
      this.loadImageAndRender(canvasKey, imageFile);

      // Bind events for this canvas
      this.bindCanvasEvents(canvasKey);
    });
  }

  private loadImageAndRender(canvasKey: string, imageFile: ImageFile): void {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    const img = new Image();
    img.onload = () => {
      // Store the loaded image in canvasInfo
      canvasInfo.loadedImage = img;
      this.renderCanvas(canvasKey, img, imageFile);
    };
    img.src = URL.createObjectURL(imageFile.file);
  }

  private renderCanvas(canvasKey: string, image: HTMLImageElement, imageFile: ImageFile): void {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    const { canvas, ctx } = canvasInfo;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate crop dimensions based on aspect ratio
    const { cropWidth, cropHeight, cropX, cropY } = this.calculateCropDimensions(image, imageFile);

    // Scale image to fit canvas while maintaining aspect ratio
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    // Draw original image
    ctx.drawImage(
      image,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    );

    // Calculate crop rectangle position on canvas
    const cropCanvasX = offsetX + (cropX / image.width) * scaledWidth;
    const cropCanvasY = offsetY + (cropY / image.height) * scaledHeight;
    const cropCanvasWidth = (cropWidth / image.width) * scaledWidth;
    const cropCanvasHeight = (cropHeight / image.height) * scaledHeight;

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

  private renderAllCanvases(): void {
    this.canvases.forEach((canvasInfo, canvasKey) => {
      if (canvasInfo.loadedImage) {
        // Use already loaded image
        this.renderCanvas(canvasKey, canvasInfo.loadedImage, canvasInfo.imageFile);
      } else {
        // Load image if not already loaded
        const img = new Image();
        img.onload = () => {
          canvasInfo.loadedImage = img;
          this.renderCanvas(canvasKey, img, canvasInfo.imageFile);
        };
        img.src = URL.createObjectURL(canvasInfo.imageFile.file);
      }
    });
  }

  private calculateCropDimensions(image: HTMLImageElement, imageFile: ImageFile): { cropWidth: number; cropHeight: number; cropX: number; cropY: number } {
    if (!image) {
      return { cropWidth: 0, cropHeight: 0, cropX: 0, cropY: 0 };
    }

    // Parse aspect ratio
    const [ratioWidthStr, ratioHeightStr] = this.aspectRatio.split(':');
    const ratioWidth = parseFloat(ratioWidthStr || '1');
    const ratioHeight = parseFloat(ratioHeightStr || '1');

    if (!ratioWidth || !ratioHeight || ratioWidth <= 0 || ratioHeight <= 0) {
      return { cropWidth: image.width, cropHeight: image.height, cropX: 0, cropY: 0 };
    }

    const targetRatio = ratioWidth / ratioHeight;
    const sourceRatio = image.width / image.height;

    let cropWidth: number;
    let cropHeight: number;

    // Calculate crop dimensions to fit target aspect ratio
    if (sourceRatio > targetRatio) {
      // Source is wider than target ratio - crop width
      cropHeight = image.height;
      cropWidth = Math.round(cropHeight * targetRatio);
    } else {
      // Source is taller than target ratio - crop height
      cropWidth = image.width;
      cropHeight = Math.round(cropWidth / targetRatio);
    }

    // Calculate crop position based on percentage from imageFile
    const positionX = imageFile.cropPositionX || 50;
    const positionY = imageFile.cropPositionY || 50;

    const maxX = image.width - cropWidth;
    const maxY = image.height - cropHeight;

    const cropX = Math.round(maxX * (positionX / 100));
    const cropY = Math.round(maxY * (positionY / 100));

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
    this.images = [];
    this.aspectRatio = '1:1';
    this.canvases.clear();
    this.renderContainer();
  }

  public getImagePositions(): { file: File; cropPositionX: number; cropPositionY: number }[] {
    return this.images.map(img => ({
      file: img.file,
      cropPositionX: img.cropPositionX || 50,
      cropPositionY: img.cropPositionY || 50
    }));
  }

  private bindCanvasEvents(canvasKey: string): void {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    const { canvas } = canvasInfo;

    const canvasListeners = [
      { element: canvas, event: 'mousedown', handler: ((e: Event) => this.handleMouseDown(e, canvasKey)) as EventListener },
      { element: canvas, event: 'mousemove', handler: ((e: Event) => this.handleMouseMove(e, canvasKey)) as EventListener },
      { element: canvas, event: 'mouseup', handler: ((e: Event) => this.handleMouseUp(e, canvasKey)) as EventListener },
      { element: canvas, event: 'mouseleave', handler: ((e: Event) => this.handleMouseLeave(e, canvasKey)) as EventListener }
    ];

    this.addEventListeners('canvas', canvasListeners);
  }

  private handleMouseDown(e: Event, canvasKey: string): void {
    const mouseEvent = e as MouseEvent;
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    const rect = canvasInfo.canvas.getBoundingClientRect();
    const mouseX = mouseEvent.clientX - rect.left;
    const mouseY = mouseEvent.clientY - rect.top;

    if (this.isInsideCropArea(mouseX, mouseY, canvasKey)) {
      canvasInfo.isDragging = true;
      canvasInfo.dragStartX = mouseX;
      canvasInfo.dragStartY = mouseY;
      canvasInfo.dragStartPositionX = canvasInfo.imageFile.cropPositionX || 50;
      canvasInfo.dragStartPositionY = canvasInfo.imageFile.cropPositionY || 50;
      canvasInfo.canvas.style.cursor = 'grabbing';
    }
  }

  private handleMouseMove(e: Event, canvasKey: string): void {
    const mouseEvent = e as MouseEvent;
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    const rect = canvasInfo.canvas.getBoundingClientRect();
    const mouseX = mouseEvent.clientX - rect.left;
    const mouseY = mouseEvent.clientY - rect.top;

    if (canvasInfo.isDragging) {
      // Calculate drag delta
      const deltaX = mouseX - canvasInfo.dragStartX;
      const deltaY = mouseY - canvasInfo.dragStartY;

      // Convert delta to percentage of crop area movement
      const newPosition = this.calculateNewPosition(deltaX, deltaY, canvasKey);

      // Update position in the imageFile and render
      canvasInfo.imageFile.cropPositionX = newPosition.x;
      canvasInfo.imageFile.cropPositionY = newPosition.y;

      // Update the images array as well
      const imageIndex = parseInt(canvasInfo.canvas.dataset['imageIndex'] || '0');
      if (this.images[imageIndex]) {
        this.images[imageIndex]!.cropPositionX = newPosition.x;
        this.images[imageIndex]!.cropPositionY = newPosition.y;
      }

      // Re-render this specific canvas using the stored loaded image
      if (canvasInfo.loadedImage) {
        this.renderCanvas(canvasKey, canvasInfo.loadedImage, canvasInfo.imageFile);
      }
    } else {
      // Update cursor based on hover position
      if (this.isInsideCropArea(mouseX, mouseY, canvasKey)) {
        canvasInfo.canvas.style.cursor = 'grab';
      } else {
        canvasInfo.canvas.style.cursor = 'default';
      }
    }
  }

  private handleMouseUp(_e: Event, canvasKey: string): void {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    if (canvasInfo.isDragging) {
      canvasInfo.isDragging = false;
      canvasInfo.canvas.style.cursor = 'grab';
    }
  }

  private handleMouseLeave(_e: Event, canvasKey: string): void {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return;

    if (canvasInfo.isDragging) {
      canvasInfo.isDragging = false;
      canvasInfo.canvas.style.cursor = 'default';
    }
  }

  private isInsideCropArea(mouseX: number, mouseY: number, canvasKey: string): boolean {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo) return false;

    const { cropX, cropY, cropWidth, cropHeight } = this.getCropAreaOnCanvas(canvasKey);

    return mouseX >= cropX &&
           mouseX <= cropX + cropWidth &&
           mouseY >= cropY &&
           mouseY <= cropY + cropHeight;
  }

  private calculateNewPosition(deltaX: number, deltaY: number, canvasKey: string): { x: number; y: number } {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo || !canvasInfo.loadedImage) return { x: 50, y: 50 };

    // Use the stored loaded image
    const img = canvasInfo.loadedImage;

    // Get image and crop dimensions on canvas
    const scale = Math.min(canvasInfo.canvas.width / img.width, canvasInfo.canvas.height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Convert pixel delta to percentage delta
    const percentDeltaX = (deltaX / scaledWidth) * 100;
    const percentDeltaY = (deltaY / scaledHeight) * 100;

    // Calculate new position
    const newX = Math.max(0, Math.min(100, canvasInfo.dragStartPositionX + percentDeltaX));
    const newY = Math.max(0, Math.min(100, canvasInfo.dragStartPositionY + percentDeltaY));

    return { x: newX, y: newY };
  }

  private getCropAreaOnCanvas(canvasKey: string): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
    const canvasInfo = this.canvases.get(canvasKey);
    if (!canvasInfo || !canvasInfo.loadedImage) {
      return { cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 };
    }

    // Use the stored loaded image
    const img = canvasInfo.loadedImage;

    // Calculate crop dimensions based on aspect ratio
    const { cropWidth, cropHeight, cropX, cropY } = this.calculateCropDimensions(img, canvasInfo.imageFile);

    // Scale image to fit canvas while maintaining aspect ratio
    const scale = Math.min(canvasInfo.canvas.width / img.width, canvasInfo.canvas.height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = (canvasInfo.canvas.width - scaledWidth) / 2;
    const offsetY = (canvasInfo.canvas.height - scaledHeight) / 2;

    // Calculate crop rectangle position on canvas
    const cropCanvasX = offsetX + (cropX / img.width) * scaledWidth;
    const cropCanvasY = offsetY + (cropY / img.height) * scaledHeight;
    const cropCanvasWidth = (cropWidth / img.width) * scaledWidth;
    const cropCanvasHeight = (cropHeight / img.height) * scaledHeight;

    return {
      cropX: cropCanvasX,
      cropY: cropCanvasY,
      cropWidth: cropCanvasWidth,
      cropHeight: cropCanvasHeight
    };
  }
}