import { BaseComponent } from '../components/BaseComponent.js';
import { ApiService } from '../services/ApiService.js';
import { FileService } from '../services/FileService.js';
import { eventBus } from '../utils/EventBus.js';
import { ImageFile, ProcessOptions, ProcessResult } from '../models/index.js';

export class BulkProcessor extends BaseComponent {
  private images: ImageFile[] = [];
  private apiService: ApiService;
  private fileService: FileService;
  private dropZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private imageList!: HTMLElement;
  private processBtn!: HTMLButtonElement;
  private resultsSection!: HTMLElement;
  private resultsList!: HTMLElement;

  constructor() {
    super('bulk-tab');
    this.apiService = ApiService.getInstance();
    this.fileService = FileService.getInstance();
    this.initializeElements();
  }

  private initializeElements(): void {
    this.dropZone = this.$('#dropZone')!;
    this.fileInput = this.$('#fileInput') as HTMLInputElement;
    this.imageList = this.$('#imageList')!;
    this.processBtn = this.$('#processBtn') as HTMLButtonElement;
    this.resultsSection = this.$('#results')!;
    this.resultsList = this.$('#resultsList')!;
  }

  public init(): void {
    this.bindEvents();
    this.bindFormEvents();
    this.setupProgressHandling();
  }

  private bindEvents(): void {
    // Drag & Drop events
    const dropListeners = [
      { element: this.dropZone, event: 'click', handler: () => this.fileInput.click() },
      { element: this.dropZone, event: 'dragover', handler: this.handleDragOver.bind(this) as EventListener },
      { element: this.dropZone, event: 'dragleave', handler: this.handleDragLeave.bind(this) as EventListener },
      { element: this.dropZone, event: 'drop', handler: this.handleDrop.bind(this) as EventListener }
    ];

    // File input events
    const fileListeners = [
      { element: this.fileInput, event: 'change', handler: this.handleFileSelect.bind(this) },
      { element: this.processBtn, event: 'click', handler: this.processImages.bind(this) }
    ];

    this.addEventListeners('drop', dropListeners);
    this.addEventListeners('file', fileListeners);

    // Download all button
    const downloadAllBtn = this.$('#downloadAllBtn');
    if (downloadAllBtn) {
      const downloadListeners = [
        { element: downloadAllBtn, event: 'click', handler: this.downloadAll.bind(this) }
      ];
      this.addEventListeners('download', downloadListeners);
    }
  }

  private bindFormEvents(): void {
    // Mode change handlers - use document since these are outside the tab
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const modeListeners = Array.from(modeRadios).map(radio => ({
      element: radio,
      event: 'change' as const,
      handler: this.handleModeChange.bind(this)
    }));

    // Slider events
    const sliderElements = [
      { id: 'quality', valueId: 'qualityValue', suffix: '%' },
      { id: 'autoTrimPadding', valueId: 'autoTrimPaddingValue', suffix: 'px' },
      { id: 'autoTrimTolerance', valueId: 'autoTrimToleranceValue', suffix: '' },
      { id: 'cropPadding', valueId: 'paddingValue', suffix: 'px' },
      { id: 'cropTolerance', valueId: 'toleranceValue', suffix: '' }
    ];

    const sliderListeners = sliderElements
      .map(({ id, valueId, suffix }) => {
        const slider = document.getElementById(id) as HTMLInputElement;
        const valueSpan = document.getElementById(valueId);
        if (!slider || !valueSpan) return null;

        return {
          element: slider,
          event: 'input' as const,
          handler: () => {
            valueSpan.textContent = `${slider.value}${suffix}`;
          }
        };
      })
      .filter(Boolean) as any[];

    // Checkbox events
    const checkboxes = [
      { id: 'autoTrim', handler: this.handleAutoTrimChange.bind(this) },
      { id: 'smartCrop', handler: this.handleSmartCropChange.bind(this) },
      { id: 'autoTrimFixedSize', handler: this.handleAutoTrimFixedSizeChange.bind(this) }
    ];

    const checkboxListeners = checkboxes
      .map(({ id, handler }) => {
        const checkbox = document.getElementById(id);
        return checkbox ? { element: checkbox, event: 'change' as const, handler } : null;
      })
      .filter(Boolean) as any[];

    // Crop mode radio buttons
    const cropModeRadios = document.querySelectorAll('input[name="cropMode"]');
    const cropModeListeners = Array.from(cropModeRadios).map(radio => ({
      element: radio,
      event: 'change' as const,
      handler: this.handleCropModeChange.bind(this)
    }));

    this.addEventListeners('form', [
      ...modeListeners,
      ...sliderListeners,
      ...checkboxListeners,
      ...cropModeListeners
    ]);
  }

  private setupProgressHandling(): void {
    eventBus.on('bulk-processing-start', () => {
      this.showProgress();
    });

    eventBus.on('bulk-processing-complete', (data) => {
      this.hideProgress();
      if (data.payload) {
        this.showResults(data.payload);
      }
    });

    eventBus.on('bulk-processing-error', (data) => {
      this.hideProgress();
      alert('Fehler bei der Bildverarbeitung: ' + (data.payload?.message || 'Unbekannter Fehler'));
    });
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('drag-over');
  }

  private handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer?.files || []);
    this.addFiles(files);
  }

  private handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.addFiles(files);
  }

  private async addFiles(files: File[]): Promise<void> {
    const { valid } = await this.fileService.validateFiles(files);
    
    for (const file of valid) {
      try {
        const preview = await this.fileService.loadImagePreview(file);
        this.images.push({
          file,
          preview,
          prefix: ''
        });
      } catch (error) {
        console.error('Error loading file:', error);
      }
    }
    
    this.renderImageList();
  }

  private renderImageList(): void {
    if (this.images.length === 0) {
      this.imageList.innerHTML = '';
      this.processBtn.disabled = true;
      return;
    }

    this.processBtn.disabled = false;
    
    this.imageList.innerHTML = this.images.map((img, index) => `
      <div class="image-item" data-index="${index}">
        <img src="${img.preview}" alt="${img.file.name}">
        <div class="image-info">
          <p class="image-name">${img.file.name}</p>
          <p class="image-size">${this.fileService.formatFileSize(img.file.size)}</p>
          <input type="text" 
                 class="prefix-input" 
                 placeholder="Präfix (optional)" 
                 data-index="${index}"
                 value="${img.prefix}">
        </div>
        <button class="remove-btn" data-index="${index}">×</button>
      </div>
    `).join('');

    this.bindImageListEvents();
  }

  private bindImageListEvents(): void {
    const prefixInputs = this.imageList.querySelectorAll('.prefix-input');
    const removeButtons = this.imageList.querySelectorAll('.remove-btn');

    const listeners = [
      ...Array.from(prefixInputs).map(input => ({
        element: input,
        event: 'input' as const,
        handler: (e: Event) => {
          const target = e.target as HTMLInputElement;
          const indexStr = target.dataset['index'];
          if (indexStr) {
            const index = parseInt(indexStr);
            this.images[index]!.prefix = target.value;
          }
        }
      })),
      ...Array.from(removeButtons).map(btn => ({
        element: btn,
        event: 'click' as const,
        handler: (e: Event) => {
          const target = e.target as HTMLElement;
          const indexStr = target.dataset['index'];
          if (indexStr) {
            const index = parseInt(indexStr);
            this.images.splice(index, 1);
            this.renderImageList();
          }
        }
      }))
    ];

    this.removeEventListeners('imageList');
    this.addEventListeners('imageList', listeners);
  }

  private handleModeChange(): void {
    const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value;
    const sizeOptions = document.getElementById('sizeOptions')!;
    
    if (mode === 'resize' || mode === 'split-resize') {
      sizeOptions.style.display = 'block';
    } else {
      sizeOptions.style.display = 'none';
    }
  }

  private handleAutoTrimChange(): void {
    const autoTrimCheckbox = document.getElementById('autoTrim') as HTMLInputElement;
    const autoTrimOptions = document.getElementById('autoTrimOptions')!;
    
    autoTrimOptions.style.display = autoTrimCheckbox.checked ? 'block' : 'none';
  }

  private handleSmartCropChange(): void {
    const smartCropCheckbox = document.getElementById('smartCrop') as HTMLInputElement;
    const cropOptions = document.getElementById('cropOptions')!;
    
    cropOptions.style.display = smartCropCheckbox.checked ? 'block' : 'none';
  }

  private handleCropModeChange(): void {
    const cropMode = (document.querySelector('input[name="cropMode"]:checked') as HTMLInputElement)?.value;
    const uniformSettings = document.getElementById('uniformCropSettings')!;
    const individualSettings = document.getElementById('individualCropSettings')!;
    
    if (cropMode === 'individual') {
      uniformSettings.style.display = 'none';
      individualSettings.style.display = 'block';
    } else {
      uniformSettings.style.display = 'block';
      individualSettings.style.display = 'none';
    }
  }

  private handleAutoTrimFixedSizeChange(): void {
    const autoTrimFixedSizeCheckbox = document.getElementById('autoTrimFixedSize') as HTMLInputElement;
    const autoTrimSizeOptions = document.getElementById('autoTrimSizeOptions')!;
    
    autoTrimSizeOptions.style.display = autoTrimFixedSizeCheckbox.checked ? 'block' : 'none';
  }

  private getProcessOptions(): ProcessOptions[] {
    const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value as ProcessOptions['mode'];
    const quality = parseInt((document.getElementById('quality') as HTMLInputElement)?.value || '100');
    const width = parseInt((document.getElementById('width') as HTMLInputElement)?.value || '512');
    const height = parseInt((document.getElementById('height') as HTMLInputElement)?.value || '512');
    const globalPrefix = (document.getElementById('globalPrefix') as HTMLInputElement)?.value || 'image';
    
    const autoTrim = (document.getElementById('autoTrim') as HTMLInputElement)?.checked || false;
    const autoTrimPadding = parseInt((document.getElementById('autoTrimPadding') as HTMLInputElement)?.value || '2');
    const autoTrimTolerance = parseInt((document.getElementById('autoTrimTolerance') as HTMLInputElement)?.value || '100');
    
    const autoTrimFixedSize = (document.getElementById('autoTrimFixedSize') as HTMLInputElement)?.checked || false;
    const autoTrimTargetWidth = parseInt((document.getElementById('autoTrimTargetWidth') as HTMLInputElement)?.value || '512');
    const autoTrimTargetHeight = parseInt((document.getElementById('autoTrimTargetHeight') as HTMLInputElement)?.value || '512');
    
    const smartCrop = (document.getElementById('smartCrop') as HTMLInputElement)?.checked || false;
    const cropMode = (document.querySelector('input[name="cropMode"]:checked') as HTMLInputElement)?.value || 'uniform';
    
    let cropPadding: number | undefined;
    let cropPaddingTop: number | undefined;
    let cropPaddingRight: number | undefined;
    let cropPaddingBottom: number | undefined;
    let cropPaddingLeft: number | undefined;
    
    if (cropMode === 'individual') {
      cropPaddingTop = parseInt((document.getElementById('cropPaddingTop') as HTMLInputElement)?.value || '20');
      cropPaddingRight = parseInt((document.getElementById('cropPaddingRight') as HTMLInputElement)?.value || '20');
      cropPaddingBottom = parseInt((document.getElementById('cropPaddingBottom') as HTMLInputElement)?.value || '20');
      cropPaddingLeft = parseInt((document.getElementById('cropPaddingLeft') as HTMLInputElement)?.value || '20');
    } else {
      cropPadding = parseInt((document.getElementById('cropPadding') as HTMLInputElement)?.value || '20');
    }
    
    const cropTolerance = parseInt((document.getElementById('cropTolerance') as HTMLInputElement)?.value || '10');

    return this.images.map(img => ({
      mode,
      quality,
      width,
      height,
      prefix: img.prefix || globalPrefix,
      autoTrim,
      autoTrimPadding,
      autoTrimTolerance,
      autoTrimFixedSize,
      autoTrimTargetWidth,
      autoTrimTargetHeight,
      smartCrop,
      cropPadding,
      cropPaddingTop,
      cropPaddingRight,
      cropPaddingBottom,
      cropPaddingLeft,
      cropTolerance
    }));
  }

  private async processImages(): Promise<void> {
    if (this.images.length === 0) return;

    const options = this.getProcessOptions();
    const files = this.images.map(img => img.file);

    eventBus.emit('bulk-processing-start');

    try {
      const results = await this.apiService.processImages(files, options);
      eventBus.emit('bulk-processing-complete', results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      eventBus.emit('bulk-processing-error', { message });
    }
  }

  private showProgress(): void {
    const progressOverlay = document.getElementById('progressOverlay')!;
    progressOverlay.style.display = 'flex';
    this.animateProgress();
  }

  private animateProgress(): void {
    const progressFill = document.getElementById('progressFill')!;
    const progressText = document.getElementById('progressText')!;
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) {
        clearInterval(interval);
        progress = 90;
      }
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.round(progress)}%`;
    }, 200);
  }

  private hideProgress(): void {
    const progressOverlay = document.getElementById('progressOverlay')!;
    const progressFill = document.getElementById('progressFill')!;
    const progressText = document.getElementById('progressText')!;
    
    progressFill.style.width = '100%';
    progressText.textContent = '100%';
    setTimeout(() => {
      progressOverlay.style.display = 'none';
      progressFill.style.width = '0%';
    }, 500);
  }

  private showResults(results: ProcessResult[]): void {
    this.resultsSection.style.display = 'block';
    
    this.resultsList.innerHTML = results.map(result => `
      <div class="result-item">
        <h3>${result.original}</h3>
        <p class="size-info">
          Original: ${this.fileService.formatFileSize(result.originalSize)} → 
          Komprimiert: ${this.fileService.formatFileSize(result.processed.reduce((sum, p) => sum + p.size, 0))}
          <span class="savings">
            (${this.calculateSavings(result.originalSize, result.processed.reduce((sum, p) => sum + p.size, 0))}% gespart)
          </span>
        </p>
        <div class="processed-files">
          ${result.processed.map(file => `
            <div class="processed-file">
              <img src="${file.url}" alt="${file.filename}" class="result-preview" 
                   onerror="this.style.display='none';" />
              <div class="file-info">
                <span class="file-name">${file.filename}</span>
                <span class="file-size">${this.fileService.formatFileSize(file.size)}</span>
              </div>
              <a href="${file.url}" download="${file.filename}" class="download-btn">
                📥 Download
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  private calculateSavings(original: number, compressed: number): number {
    const savings = ((original - compressed) / original) * 100;
    return Math.round(savings);
  }

  private async downloadAll(): Promise<void> {
    const links = this.resultsList.querySelectorAll('.download-btn') as NodeListOf<HTMLAnchorElement>;
    const files = Array.from(links).map(link => ({
      url: link.href,
      filename: link.download
    }));
    
    try {
      await this.apiService.downloadAll(files);
    } catch (error) {
      console.error('Error downloading files:', error);
      alert('Fehler beim Download einiger Dateien');
    }
  }

  public reset(): void {
    this.images = [];
    this.renderImageList();
    this.resultsSection.style.display = 'none';
  }
}