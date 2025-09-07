import { BaseComponent } from '../components/BaseComponent.js';
import { ApiService } from '../services/ApiService.js';
import { FileService } from '../services/FileService.js';
import { eventBus } from '../utils/EventBus.js';
import { ImageFile } from '../models/index.js';

interface ColorMatchOptions {
  intensity: number; // 0-300
  quality: number;   // 50-100
  saturationBoost: number; // 0-300
  brightnessBoost: number; // 30-200
  contrastBoost: number;   // 50-200
  hueShift: number;        // -180 to +180
  sharpness: number;       // 0-300
  noiseReduction: number;  // 0-100
  gamma: number;           // 0.5-2.0
}

export class ColorMatcher extends BaseComponent {
  private referenceImage: ImageFile | null = null;
  private bulkImages: ImageFile[] = [];
  private apiService: ApiService;
  private fileService: FileService;
  
  // UI Elements
  private referenceDropZone!: HTMLElement;
  private referenceFileInput!: HTMLInputElement;
  private referencePreview!: HTMLElement;
  private referenceImageEl!: HTMLImageElement;
  private removeReferenceBtn!: HTMLButtonElement;
  
  private colorBulkDropZone!: HTMLElement;
  private colorBulkFileInput!: HTMLInputElement;
  private colorBulkFileBtn!: HTMLButtonElement;
  private colorImageList!: HTMLElement;
  
  private previewSection!: HTMLElement;
  private originalCanvas!: HTMLCanvasElement;
  private referenceCanvas!: HTMLCanvasElement;
  private adjustedCanvas!: HTMLCanvasElement;
  private colorIntensitySlider!: HTMLInputElement;
  private colorIntensityValue!: HTMLSpanElement;
  private colorQualitySlider!: HTMLInputElement;
  private colorQualityValue!: HTMLSpanElement;
  
  // Extended controls
  private saturationBoostSlider!: HTMLInputElement;
  private saturationBoostValue!: HTMLSpanElement;
  private brightnessBoostSlider!: HTMLInputElement;
  private brightnessBoostValue!: HTMLSpanElement;
  private contrastBoostSlider!: HTMLInputElement;
  private contrastBoostValue!: HTMLSpanElement;
  private hueShiftSlider!: HTMLInputElement;
  private hueShiftValue!: HTMLSpanElement;
  private sharpnessSlider!: HTMLInputElement;
  private sharpnessValue!: HTMLSpanElement;
  private noiseReductionSlider!: HTMLInputElement;
  private noiseReductionValue!: HTMLSpanElement;
  private gammaSlider!: HTMLInputElement;
  private gammaValue!: HTMLSpanElement;
  private resetBtn!: HTMLButtonElement;
  
  private processBtn!: HTMLButtonElement;
  
  private resultsSection!: HTMLElement;
  private resultsList!: HTMLElement;
  private downloadAllBtn!: HTMLButtonElement;
  
  constructor() {
    super('color-tab');
    this.apiService = ApiService.getInstance();
    this.fileService = FileService.getInstance();
    this.initializeElements();
  }

  private initializeElements(): void {
    // Reference upload elements
    this.referenceDropZone = this.$('#referenceDropZone')!;
    this.referenceFileInput = this.$('#referenceFileInput') as HTMLInputElement;
    this.referencePreview = this.$('#referencePreview')!;
    this.referenceImageEl = this.$('#referenceImage') as HTMLImageElement;
    this.removeReferenceBtn = this.$('#removeReference') as HTMLButtonElement;
    
    // Bulk upload elements
    this.colorBulkDropZone = this.$('#colorBulkDropZone')!;
    this.colorBulkFileInput = this.$('#colorBulkFileInput') as HTMLInputElement;
    this.colorBulkFileBtn = this.$('#colorBulkFileBtn') as HTMLButtonElement;
    this.colorImageList = this.$('#colorImageList')!;
    
    // Preview elements
    this.previewSection = this.$('#colorPreviewSection')!;
    this.originalCanvas = this.$('#originalCanvas') as HTMLCanvasElement;
    this.referenceCanvas = this.$('#referenceCanvas') as HTMLCanvasElement;
    this.adjustedCanvas = this.$('#adjustedCanvas') as HTMLCanvasElement;
    this.colorIntensitySlider = this.$('#colorIntensity') as HTMLInputElement;
    this.colorIntensityValue = this.$('#colorIntensityValue')!;
    this.colorQualitySlider = this.$('#colorQuality') as HTMLInputElement;
    this.colorQualityValue = this.$('#colorQualityValue')!;
    
    // Extended controls
    this.saturationBoostSlider = this.$('#saturationBoost') as HTMLInputElement;
    this.saturationBoostValue = this.$('#saturationBoostValue')!;
    this.brightnessBoostSlider = this.$('#brightnessBoost') as HTMLInputElement;
    this.brightnessBoostValue = this.$('#brightnessBoostValue')!;
    this.contrastBoostSlider = this.$('#contrastBoost') as HTMLInputElement;
    this.contrastBoostValue = this.$('#contrastBoostValue')!;
    this.hueShiftSlider = this.$('#hueShift') as HTMLInputElement;
    this.hueShiftValue = this.$('#hueShiftValue')!;
    this.sharpnessSlider = this.$('#sharpness') as HTMLInputElement;
    this.sharpnessValue = this.$('#sharpnessValue')!;
    this.noiseReductionSlider = this.$('#noiseReduction') as HTMLInputElement;
    this.noiseReductionValue = this.$('#noiseReductionValue')!;
    this.gammaSlider = this.$('#gamma') as HTMLInputElement;
    this.gammaValue = this.$('#gammaValue')!;
    this.resetBtn = this.$('#resetControls') as HTMLButtonElement;
    
    this.processBtn = this.$('#processColorBtn') as HTMLButtonElement;
    
    // Results elements
    this.resultsSection = this.$('#colorResults')!;
    this.resultsList = this.$('#colorResultsList')!;
    this.downloadAllBtn = this.$('#downloadAllColorBtn') as HTMLButtonElement;
  }

  public init(): void {
    this.bindReferenceEvents();
    this.bindBulkEvents();
    this.bindControlEvents();
    this.setupProgressHandling();
  }

  private bindReferenceEvents(): void {
    const referenceListeners = [
      { element: this.referenceDropZone, event: 'click', handler: () => this.referenceFileInput.click() },
      { element: this.referenceDropZone, event: 'dragover', handler: this.handleReferenceDragOver.bind(this) as EventListener },
      { element: this.referenceDropZone, event: 'dragleave', handler: this.handleReferenceDragLeave.bind(this) as EventListener },
      { element: this.referenceDropZone, event: 'drop', handler: this.handleReferenceDrop.bind(this) as EventListener },
      { element: this.referenceFileInput, event: 'change', handler: this.handleReferenceFileSelect.bind(this) },
      { element: this.removeReferenceBtn, event: 'click', handler: this.removeReference.bind(this) }
    ];

    this.addEventListeners('reference', referenceListeners);
  }

  private bindBulkEvents(): void {
    const bulkListeners = [
      { element: this.colorBulkDropZone, event: 'click', handler: () => this.colorBulkFileInput.click() },
      { element: this.colorBulkDropZone, event: 'dragover', handler: this.handleBulkDragOver.bind(this) as EventListener },
      { element: this.colorBulkDropZone, event: 'dragleave', handler: this.handleBulkDragLeave.bind(this) as EventListener },
      { element: this.colorBulkDropZone, event: 'drop', handler: this.handleBulkDrop.bind(this) as EventListener },
      { element: this.colorBulkFileBtn, event: 'click', handler: (e: Event) => { e.stopPropagation(); this.colorBulkFileInput.click(); }},
      { element: this.colorBulkFileInput, event: 'change', handler: this.handleBulkFileSelect.bind(this) }
    ];

    this.addEventListeners('bulk', bulkListeners);
  }

  private bindControlEvents(): void {
    const controlListeners = [
      // Basic controls
      { element: this.colorIntensitySlider, event: 'input', handler: this.handleIntensityChange.bind(this) },
      { element: this.colorQualitySlider, event: 'input', handler: this.handleQualityChange.bind(this) },
      
      // Extended controls
      { element: this.saturationBoostSlider, event: 'input', handler: this.handleSaturationChange.bind(this) },
      { element: this.brightnessBoostSlider, event: 'input', handler: this.handleBrightnessChange.bind(this) },
      { element: this.contrastBoostSlider, event: 'input', handler: this.handleContrastChange.bind(this) },
      { element: this.hueShiftSlider, event: 'input', handler: this.handleHueChange.bind(this) },
      { element: this.sharpnessSlider, event: 'input', handler: this.handleSharpnessChange.bind(this) },
      { element: this.noiseReductionSlider, event: 'input', handler: this.handleNoiseReductionChange.bind(this) },
      { element: this.gammaSlider, event: 'input', handler: this.handleGammaChange.bind(this) },
      { element: this.resetBtn, event: 'click', handler: this.resetControls.bind(this) },
      
      // Action buttons
      { element: this.processBtn, event: 'click', handler: this.processImages.bind(this) },
      { element: this.downloadAllBtn, event: 'click', handler: this.downloadAll.bind(this) }
    ];

    this.addEventListeners('controls', controlListeners);
  }

  private setupProgressHandling(): void {
    eventBus.on('color-processing-start', () => {
      this.showProgress();
    });

    eventBus.on('color-processing-complete', async (data) => {
      this.hideProgress();
      if (data.payload) {
        await this.showResults(data.payload);
      }
    });

    eventBus.on('color-processing-error', (data) => {
      this.hideProgress();
      alert('Color matching error: ' + (data.payload?.message || 'Unknown error'));
    });
  }

  // Reference Image Handlers
  private handleReferenceDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.referenceDropZone.classList.add('drag-over');
  }

  private handleReferenceDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.referenceDropZone.classList.remove('drag-over');
  }

  private handleReferenceDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.referenceDropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0 && files[0]) {
      this.setReferenceImage(files[0]);
    }
  }

  private handleReferenceFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length > 0 && files[0]) {
      this.setReferenceImage(files[0]);
    }
  }

  private async setReferenceImage(file: File): Promise<void> {
    try {
      const { valid, invalid } = await this.fileService.validateFiles([file]);
      if (invalid.length > 0 && invalid[0]) {
        alert(`Invalid file: ${invalid[0].name} is not a supported image format`);
        return;
      }

      if (valid.length === 0) {
        alert('No valid images found');
        return;
      }

      const validFile = valid[0];
      if (!validFile) {
        alert('Error loading file');
        return;
      }

      const preview = await this.fileService.loadImagePreview(validFile);
      this.referenceImage = {
        file: validFile,
        preview,
        prefix: 'reference'
      };

      // Show reference image preview
      this.referenceImageEl.src = preview;
      this.referenceDropZone.style.display = 'none';
      this.referencePreview.style.display = 'block';

      this.updateUI();
    } catch (error) {
      console.error('Error setting reference image:', error);
      alert('Error loading reference image');
    }
  }

  private removeReference(): void {
    this.referenceImage = null;
    this.referenceDropZone.style.display = 'block';
    this.referencePreview.style.display = 'none';
    this.previewSection.style.display = 'none';
    this.updateUI();
  }

  // Bulk Images Handlers
  private handleBulkDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.colorBulkDropZone.classList.add('drag-over');
  }

  private handleBulkDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.colorBulkDropZone.classList.remove('drag-over');
  }

  private handleBulkDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.colorBulkDropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer?.files || []);
    this.addBulkFiles(files);
  }

  private handleBulkFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length > 0) {
      this.addBulkFiles(files);
    }
  }

  private async addBulkFiles(files: File[]): Promise<void> {
    const { valid } = await this.fileService.validateFiles(files);
    
    for (const file of valid) {
      try {
        const preview = await this.fileService.loadImagePreview(file);
        this.bulkImages.push({
          file,
          preview,
          prefix: 'matched'
        });
      } catch (error) {
        console.error('Error loading file:', error);
      }
    }
    
    this.renderBulkImageList();
    this.updateUI();
  }

  private renderBulkImageList(): void {
    if (this.bulkImages.length === 0) {
      this.colorImageList.innerHTML = '';
      return;
    }

    this.colorImageList.innerHTML = this.bulkImages.map((img, index) => `
      <div class="image-item" data-index="${index}">
        <img src="${img.preview}" alt="${img.file.name}">
        <div class="image-info">
          <p class="image-name">${img.file.name}</p>
          <p class="image-size">${this.fileService.formatFileSize(img.file.size)}</p>
        </div>
        <button class="remove-btn" data-index="${index}">×</button>
      </div>
    `).join('');

    this.bindBulkListEvents();
  }

  private bindBulkListEvents(): void {
    const removeButtons = this.colorImageList.querySelectorAll('.remove-btn');
    
    const listeners = Array.from(removeButtons).map(btn => ({
      element: btn,
      event: 'click' as const,
      handler: (e: Event) => {
        const target = e.target as HTMLElement;
        const indexStr = target.dataset['index'];
        if (indexStr) {
          const index = parseInt(indexStr);
          this.bulkImages.splice(index, 1);
          this.renderBulkImageList();
          this.updateUI();
        }
      }
    }));

    this.removeEventListeners('bulkList');
    this.addEventListeners('bulkList', listeners);
  }

  // Control Handlers
  private handleIntensityChange(): void {
    const value = this.colorIntensitySlider.value;
    this.colorIntensityValue.textContent = `${value}%`;
    this.updatePreview();
  }

  private handleQualityChange(): void {
    const value = this.colorQualitySlider.value;
    this.colorQualityValue.textContent = `${value}%`;
  }

  private handleSaturationChange(): void {
    const value = this.saturationBoostSlider.value;
    this.saturationBoostValue.textContent = `${value}%`;
    this.updatePreview();
  }

  private handleBrightnessChange(): void {
    const value = this.brightnessBoostSlider.value;
    this.brightnessBoostValue.textContent = `${value}%`;
    this.updatePreview();
  }

  private handleContrastChange(): void {
    const value = this.contrastBoostSlider.value;
    this.contrastBoostValue.textContent = `${value}%`;
    this.updatePreview();
  }

  private handleHueChange(): void {
    const value = this.hueShiftSlider.value;
    this.hueShiftValue.textContent = `${value}°`;
    this.updatePreview();
  }

  private handleSharpnessChange(): void {
    const value = this.sharpnessSlider.value;
    this.sharpnessValue.textContent = `${value}%`;
    this.updatePreview();
  }

  private handleNoiseReductionChange(): void {
    const value = this.noiseReductionSlider.value;
    this.noiseReductionValue.textContent = `${value}%`;
    this.updatePreview();
  }

  private handleGammaChange(): void {
    const value = parseInt(this.gammaSlider.value);
    const gammaValue = (value / 100).toFixed(1);
    this.gammaValue.textContent = gammaValue;
    this.updatePreview();
  }

  private resetControls(): void {
    // Reset all sliders to default values
    this.colorIntensitySlider.value = '100';
    this.colorIntensityValue.textContent = '100%';
    
    this.saturationBoostSlider.value = '100';
    this.saturationBoostValue.textContent = '100%';
    
    this.brightnessBoostSlider.value = '100';
    this.brightnessBoostValue.textContent = '100%';
    
    this.contrastBoostSlider.value = '100';
    this.contrastBoostValue.textContent = '100%';
    
    this.hueShiftSlider.value = '0';
    this.hueShiftValue.textContent = '0°';
    
    this.sharpnessSlider.value = '100';
    this.sharpnessValue.textContent = '100%';
    
    this.noiseReductionSlider.value = '0';
    this.noiseReductionValue.textContent = '0%';
    
    this.gammaSlider.value = '100';
    this.gammaValue.textContent = '1.0';
    
    this.colorQualitySlider.value = '100';
    this.colorQualityValue.textContent = '100%';
    
    // Update preview with reset values
    this.updatePreview();
  }

  private debounceTimeout: NodeJS.Timeout | null = null;

  private async updatePreview(): Promise<void> {
    if (!this.referenceImage || this.bulkImages.length === 0) return;

    // Debounce the preview updates to avoid too many API calls
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(async () => {
      try {
        const firstImage = this.bulkImages[0];

        if (!firstImage || !this.referenceImage) {
          return;
        }

        // Draw original image to original canvas
        await this.drawImageToCanvas(firstImage.preview, this.originalCanvas);
        
        // Draw reference image to reference canvas
        await this.drawImageToCanvas(this.referenceImage.preview, this.referenceCanvas);

        // Collect all current parameters
        const options = this.getCurrentOptions();
        
        // Request preview from backend API  
        console.log(`Requesting preview with options:`, options);
        
        const previewDataUrl = await this.apiService.generateColorPreview(
          this.referenceImage.file,
          firstImage.file,
          options
        );

        // Draw the adjusted preview to the adjusted canvas
        await this.drawBase64ImageToCanvas(previewDataUrl, this.adjustedCanvas);

        console.log('Preview updated successfully');
      } catch (error) {
        console.error('Error updating preview:', error);
        // On error, show original in both canvases
        const firstImage = this.bulkImages[0];
        if (firstImage) {
          await this.drawImageToCanvas(firstImage.preview, this.adjustedCanvas);
        }
      }
    }, 500); // 500ms debounce
  }

  private drawImageToCanvas(imageSrc: string, canvas: HTMLCanvasElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d')!;
        
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratio and center the image
        const aspectRatio = img.width / img.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
          drawHeight = canvas.width / aspectRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawWidth = canvas.height * aspectRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        resolve();
      };
      img.onerror = reject;
      img.src = imageSrc;
    });
  }

  private drawBase64ImageToCanvas(base64DataUrl: string, canvas: HTMLCanvasElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d')!;
        
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratio and center the image
        const aspectRatio = img.width / img.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
          drawHeight = canvas.width / aspectRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawWidth = canvas.height * aspectRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        resolve();
      };
      img.onerror = reject;
      img.src = base64DataUrl;
    });
  }

  private updateUI(): void {
    const hasReference = this.referenceImage !== null;
    const hasBulkImages = this.bulkImages.length > 0;
    const canShowPreview = hasReference && hasBulkImages;

    // Show/hide preview section
    this.previewSection.style.display = canShowPreview ? 'block' : 'none';
    
    // Enable/disable process button
    this.processBtn.disabled = !canShowPreview;

    // Update preview if both are available
    if (canShowPreview) {
      this.updatePreview();
    }
  }

  private getCurrentOptions(): ColorMatchOptions {
    return {
      intensity: parseInt(this.colorIntensitySlider.value),
      quality: parseInt(this.colorQualitySlider.value),
      saturationBoost: parseInt(this.saturationBoostSlider.value),
      brightnessBoost: parseInt(this.brightnessBoostSlider.value),
      contrastBoost: parseInt(this.contrastBoostSlider.value),
      hueShift: parseInt(this.hueShiftSlider.value),
      sharpness: parseInt(this.sharpnessSlider.value),
      noiseReduction: parseInt(this.noiseReductionSlider.value),
      gamma: parseInt(this.gammaSlider.value) / 100
    };
  }

  private async processImages(): Promise<void> {
    if (!this.referenceImage || this.bulkImages.length === 0) return;

    const options = this.getCurrentOptions();

    eventBus.emit('color-processing-start');

    try {
      console.log(`Starting color matching for ${this.bulkImages.length} images with options:`, options);
      
      // Extract file objects for API call
      const imageFiles = this.bulkImages.map(img => img.file);
      
      // Call the color matching API
      const results = await this.apiService.colorMatchImages(
        this.referenceImage.file,
        imageFiles,
        options
      );
      
      console.log('Color matching completed successfully:', results);
      eventBus.emit('color-processing-complete', results);
    } catch (error) {
      console.error('Error during color matching:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      eventBus.emit('color-processing-error', { message });
    }
  }

  private showProgress(): void {
    const progressOverlay = document.getElementById('progressOverlay')!;
    progressOverlay.style.display = 'flex';
  }

  private hideProgress(): void {
    const progressOverlay = document.getElementById('progressOverlay')!;
    progressOverlay.style.display = 'none';
  }

  private async showResults(results: any[]): Promise<void> {
    if (!results || results.length === 0) {
      console.log('No results to display');
      return;
    }

    this.resultsSection.style.display = 'block';
    
    // Create result items with thumbnails
    const resultItems = await Promise.all(results.map(async (result) => {
      const processedFile = result.processed[0]; // First processed file
      
      // Generate thumbnail preview
      const thumbnailHtml = await this.createResultThumbnail(processedFile.url, processedFile.filename);
      
      return `
        <div class="result-item">
          ${thumbnailHtml}
          <div class="result-info">
            <h4>${result.original}</h4>
            <p>Original: ${this.fileService.formatFileSize(result.originalSize)}</p>
            <p>Angepasst: ${this.fileService.formatFileSize(processedFile.size)}</p>
          </div>
          <div class="result-actions">
            <a href="${processedFile.url}" download="${processedFile.filename}" class="download-btn">
              📥 Download
            </a>
          </div>
        </div>
      `;
    }));

    this.resultsList.innerHTML = `
      <div class="results-header">
        <h3>🎨 Color Matching Ergebnisse (${results.length} Bilder)</h3>
        <p>All processed images were successfully created.</p>
      </div>
      <div class="results-grid">
        ${resultItems.join('')}
      </div>
    `;

    // Enable download all button
    this.downloadAllBtn.disabled = false;
    this.downloadAllBtn.textContent = `📥 Download All (${results.length})`;
  }

  private async createResultThumbnail(url: string, filename: string): Promise<string> {
    try {
      // Create a unique ID for this thumbnail
      const thumbnailId = `thumbnail-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      // Return HTML with placeholder that will be loaded after DOM insertion
      setTimeout(() => {
        this.loadThumbnailImage(url, thumbnailId);
      }, 100);
      
      return `
        <div class="result-thumbnail">
          <canvas id="${thumbnailId}" width="100" height="100" style="background: #f0f0f0; border: 1px solid #ddd; border-radius: 6px;"></canvas>
        </div>
      `;
    } catch (error) {
      console.error('Error creating thumbnail:', error);
      return `
        <div class="result-thumbnail">
          <div class="thumbnail-placeholder">🖼️</div>
        </div>
      `;
    }
  }

  private async loadThumbnailImage(url: string, canvasId: string): Promise<void> {
    try {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratio and center the image
        const aspectRatio = img.width / img.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
          drawHeight = canvas.width / aspectRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawWidth = canvas.height * aspectRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      };
      
      img.onerror = () => {
        // Show placeholder on error
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🖼️', canvas.width / 2, canvas.height / 2 + 8);
      };
      
      img.src = url;
    } catch (error) {
      console.error('Error loading thumbnail:', error);
    }
  }

  private async downloadAll(): Promise<void> {
    // Get all download links from the results
    const downloadLinks = this.resultsList.querySelectorAll('.download-btn');
    
    if (downloadLinks.length === 0) {
      alert('No files available for download');
      return;
    }

    try {
      // Collect all download info
      const files = Array.from(downloadLinks).map(link => {
        const anchor = link as HTMLAnchorElement;
        return {
          url: anchor.href,
          filename: anchor.download
        };
      });

      console.log(`Downloading ${files.length} files...`);
      await this.apiService.downloadAll(files);
      console.log('All downloads completed');
    } catch (error) {
      console.error('Error downloading files:', error);
      alert('Error downloading files');
    }
  }

  public reset(): void {
    this.referenceImage = null;
    this.bulkImages = [];
    this.removeReference();
    this.renderBulkImageList();
    this.resultsSection.style.display = 'none';
  }
}