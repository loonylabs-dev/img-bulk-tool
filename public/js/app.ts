interface ImageFile {
  file: File;
  preview: string;
  prefix: string;
}

interface ProcessOptions {
  mode: 'split' | 'resize' | 'compress' | 'split-resize';
  quality: number;
  width?: number;
  height?: number;
  prefix: string;
  smartCrop?: boolean;
  cropPadding?: number;
  cropPaddingTop?: number;
  cropPaddingRight?: number;
  cropPaddingBottom?: number;
  cropPaddingLeft?: number;
  cropTolerance?: number;
  autoTrim?: boolean;
  autoTrimPadding?: number;
  autoTrimTolerance?: number;
}

interface ProcessResult {
  original: string;
  originalSize: number;
  processed: {
    filename: string;
    url: string;
    size: number;
  }[];
}

interface LayerData {
  file: File;
  image: HTMLImageElement;
  visible: boolean;
  scale: number;
  x: number;
  y: number;
}

interface LayerExportOptions {
  outputSize: number;
  prefix: string;
  quality: number;
}

interface LayerPreset {
  name: string;
  guideSize: number;
  layers: {
    visible: boolean;
    scale: number;
    x: number;
    y: number;
    layerName?: string;
  }[];
}

class ImageProcessor {
  private images: ImageFile[] = [];
  private dropZone: HTMLElement;
  private fileInput: HTMLInputElement;
  private imageList: HTMLElement;
  private processBtn: HTMLButtonElement;
  private progressOverlay: HTMLElement;
  private progressFill: HTMLElement;
  private progressText: HTMLElement;
  private resultsSection: HTMLElement;
  private resultsList: HTMLElement;

  constructor() {
    this.dropZone = document.getElementById('dropZone')!;
    this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
    this.imageList = document.getElementById('imageList')!;
    this.processBtn = document.getElementById('processBtn') as HTMLButtonElement;
    this.progressOverlay = document.getElementById('progressOverlay')!;
    this.progressFill = document.getElementById('progressFill')!;
    this.progressText = document.getElementById('progressText')!;
    this.resultsSection = document.getElementById('results')!;
    this.resultsList = document.getElementById('resultsList')!;

    this.initEventListeners();
    this.initTabSystem();
  }

  private initEventListeners(): void {
    // Prevent default drag behaviors on entire document
    document.addEventListener('dragenter', (e) => e.preventDefault());
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('dragleave', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // Drag & Drop
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
    
    // File Input
    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    
    // Process Button
    this.processBtn.addEventListener('click', this.processImages.bind(this));
    
    // Mode Radio Buttons
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.addEventListener('change', this.handleModeChange.bind(this));
    });
    
    // Quality Slider
    const qualitySlider = document.getElementById('quality') as HTMLInputElement;
    const qualityValue = document.getElementById('qualityValue')!;
    qualitySlider.addEventListener('input', () => {
      qualityValue.textContent = `${qualitySlider.value}%`;
    });

    // Auto-Trim Checkbox
    const autoTrimCheckbox = document.getElementById('autoTrim') as HTMLInputElement;
    autoTrimCheckbox.addEventListener('change', this.handleAutoTrimChange.bind(this));

    // Auto-Trim Padding Slider
    const autoTrimPaddingSlider = document.getElementById('autoTrimPadding') as HTMLInputElement;
    const autoTrimPaddingValue = document.getElementById('autoTrimPaddingValue')!;
    autoTrimPaddingSlider.addEventListener('input', () => {
      autoTrimPaddingValue.textContent = `${autoTrimPaddingSlider.value}px`;
    });

    // Auto-Trim Tolerance Slider
    const autoTrimToleranceSlider = document.getElementById('autoTrimTolerance') as HTMLInputElement;
    const autoTrimToleranceValue = document.getElementById('autoTrimToleranceValue')!;
    autoTrimToleranceSlider.addEventListener('input', () => {
      autoTrimToleranceValue.textContent = autoTrimToleranceSlider.value;
    });

    // Smart Crop Checkbox
    const smartCropCheckbox = document.getElementById('smartCrop') as HTMLInputElement;
    smartCropCheckbox.addEventListener('change', this.handleSmartCropChange.bind(this));

    // Crop Padding Slider
    const paddingSlider = document.getElementById('cropPadding') as HTMLInputElement;
    const paddingValue = document.getElementById('paddingValue')!;
    paddingSlider.addEventListener('input', () => {
      paddingValue.textContent = `${paddingSlider.value}px`;
    });

    // Crop Tolerance Slider
    const toleranceSlider = document.getElementById('cropTolerance') as HTMLInputElement;
    const toleranceValue = document.getElementById('toleranceValue')!;
    toleranceSlider.addEventListener('input', () => {
      toleranceValue.textContent = toleranceSlider.value;
    });

    // Crop Mode Radio Buttons
    document.querySelectorAll('input[name="cropMode"]').forEach(radio => {
      radio.addEventListener('change', this.handleCropModeChange.bind(this));
    });

    // Download All Button
    document.getElementById('downloadAllBtn')?.addEventListener('click', this.downloadAll.bind(this));
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

  private addFiles(files: File[]): void {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.images.push({
          file,
          preview: e.target?.result as string,
          prefix: ''
        });
        this.renderImageList();
      };
      reader.readAsDataURL(file);
    });
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
          <p class="image-size">${this.formatFileSize(img.file.size)}</p>
          <input type="text" 
                 class="prefix-input" 
                 placeholder="Präfix (optional)" 
                 data-index="${index}"
                 value="${img.prefix}">
        </div>
        <button class="remove-btn" data-index="${index}">×</button>
      </div>
    `).join('');

    // Add event listeners for prefix inputs
    this.imageList.querySelectorAll('.prefix-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const index = parseInt(target.dataset.index!);
        this.images[index].prefix = target.value;
      });
    });

    // Add event listeners for remove buttons
    this.imageList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const index = parseInt(target.dataset.index!);
        this.images.splice(index, 1);
        this.renderImageList();
      });
    });
  }

  private handleModeChange(): void {
    const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value;
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
    
    if (autoTrimCheckbox.checked) {
      autoTrimOptions.style.display = 'block';
    } else {
      autoTrimOptions.style.display = 'none';
    }
  }

  private handleSmartCropChange(): void {
    const smartCropCheckbox = document.getElementById('smartCrop') as HTMLInputElement;
    const cropOptions = document.getElementById('cropOptions')!;
    
    if (smartCropCheckbox.checked) {
      cropOptions.style.display = 'block';
    } else {
      cropOptions.style.display = 'none';
    }
  }

  private handleCropModeChange(): void {
    const cropMode = (document.querySelector('input[name="cropMode"]:checked') as HTMLInputElement).value;
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

  private async processImages(): Promise<void> {
    if (this.images.length === 0) return;

    const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as ProcessOptions['mode'];
    const quality = parseInt((document.getElementById('quality') as HTMLInputElement).value);
    const width = parseInt((document.getElementById('width') as HTMLInputElement).value) || 512;
    const height = parseInt((document.getElementById('height') as HTMLInputElement).value) || 512;
    const globalPrefix = (document.getElementById('globalPrefix') as HTMLInputElement).value || 'image';
    
    // Auto-Trim Options
    const autoTrim = (document.getElementById('autoTrim') as HTMLInputElement).checked;
    const autoTrimPadding = parseInt((document.getElementById('autoTrimPadding') as HTMLInputElement).value) || 0;
    const autoTrimTolerance = parseInt((document.getElementById('autoTrimTolerance') as HTMLInputElement).value) || 100;
    
    // Smart Crop Options
    const smartCrop = (document.getElementById('smartCrop') as HTMLInputElement).checked;
    const cropMode = (document.querySelector('input[name="cropMode"]:checked') as HTMLInputElement).value;
    
    // Get padding values based on mode
    let cropPadding: number | undefined;
    let cropPaddingTop: number | undefined;
    let cropPaddingRight: number | undefined;
    let cropPaddingBottom: number | undefined;
    let cropPaddingLeft: number | undefined;
    
    if (cropMode === 'individual') {
      cropPaddingTop = parseInt((document.getElementById('cropPaddingTop') as HTMLInputElement).value) || 20;
      cropPaddingRight = parseInt((document.getElementById('cropPaddingRight') as HTMLInputElement).value) || 20;
      cropPaddingBottom = parseInt((document.getElementById('cropPaddingBottom') as HTMLInputElement).value) || 20;
      cropPaddingLeft = parseInt((document.getElementById('cropPaddingLeft') as HTMLInputElement).value) || 20;
    } else {
      cropPadding = parseInt((document.getElementById('cropPadding') as HTMLInputElement).value) || 20;
    }
    
    const cropTolerance = parseInt((document.getElementById('cropTolerance') as HTMLInputElement).value) || 10;

    const formData = new FormData();
    const options: ProcessOptions[] = [];

    this.images.forEach((img, index) => {
      formData.append('images', img.file);
      options.push({
        mode,
        quality,
        width,
        height,
        prefix: img.prefix || globalPrefix,
        autoTrim,
        autoTrimPadding,
        autoTrimTolerance,
        smartCrop,
        cropPadding,
        cropPaddingTop,
        cropPaddingRight,
        cropPaddingBottom,
        cropPaddingLeft,
        cropTolerance
      });
    });

    formData.append('options', JSON.stringify(options));

    this.showProgress();

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Fehler bei der Verarbeitung');
      }

      const data = await response.json();
      this.showResults(data.results);
    } catch (error) {
      console.error('Fehler:', error);
      alert('Fehler bei der Bildverarbeitung');
    } finally {
      this.hideProgress();
    }
  }

  private showProgress(): void {
    this.progressOverlay.style.display = 'flex';
    this.animateProgress();
  }

  private animateProgress(): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) {
        clearInterval(interval);
        progress = 90;
      }
      this.progressFill.style.width = `${progress}%`;
      this.progressText.textContent = `${Math.round(progress)}%`;
    }, 200);
  }

  private hideProgress(): void {
    this.progressFill.style.width = '100%';
    this.progressText.textContent = '100%';
    setTimeout(() => {
      this.progressOverlay.style.display = 'none';
      this.progressFill.style.width = '0%';
    }, 500);
  }

  private showResults(results: ProcessResult[]): void {
    this.resultsSection.style.display = 'block';
    
    this.resultsList.innerHTML = results.map(result => `
      <div class="result-item">
        <h3>${result.original}</h3>
        <p class="size-info">
          Original: ${this.formatFileSize(result.originalSize)} → 
          Komprimiert: ${this.formatFileSize(result.processed.reduce((sum, p) => sum + p.size, 0))}
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
                <span class="file-size">${this.formatFileSize(file.size)}</span>
              </div>
              <a href="${file.url}" download="${file.filename}" class="download-btn">
                📥 Download
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Scroll to results
    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  private async downloadAll(): Promise<void> {
    const links = this.resultsList.querySelectorAll('.download-btn') as NodeListOf<HTMLAnchorElement>;
    
    for (const link of Array.from(links)) {
      const url = link.href;
      const filename = link.download;
      
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      // Kleine Verzögerung zwischen Downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  private calculateSavings(original: number, compressed: number): number {
    const savings = ((original - compressed) / original) * 100;
    return Math.round(savings);
  }

  private initTabSystem(): void {
    // Wait for DOM to be fully loaded
    const initTabs = () => {
      const tabBtns = document.querySelectorAll('.tab-btn');
      const tabPanels = document.querySelectorAll('.tab-panel');

      if (tabBtns.length === 0) {
        return;
      }

      tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const target = e.target as HTMLButtonElement;
          const tabName = target.dataset.tab;

          // Remove active class from all buttons and panels
          tabBtns.forEach(b => b.classList.remove('active'));
          tabPanels.forEach(p => p.classList.remove('active'));

          // Add active class to clicked button and corresponding panel
          target.classList.add('active');
          const targetPanel = document.getElementById(`${tabName}-tab`);
          if (targetPanel) {
            targetPanel.classList.add('active');
          }
        });
      });
    };

    // Try to initialize immediately, or wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTabs);
    } else {
      initTabs();
    }
  }
}

class LayerEditor {
  private layers: (LayerData | null)[] = [null, null, null];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private showGuide: boolean = true;
  private guideSize: number = 200;

  constructor() {
    this.canvas = document.getElementById('layerCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.initLayerEventListeners();
    this.renderCanvas();
  }

  private initLayerEventListeners(): void {
    // Layer upload event listeners
    for (let i = 0; i < 3; i++) {
      const dropZone = document.getElementById(`layerDropZone${i}`)!;
      const input = document.getElementById(`layerInput${i}`) as HTMLInputElement;
      const removeBtn = document.getElementById(`layerRemove${i}`)!;

      dropZone.addEventListener('click', () => input.click());
      dropZone.addEventListener('dragover', (e) => this.handleLayerDragOver(e, i));
      dropZone.addEventListener('dragleave', (e) => this.handleLayerDragLeave(e, i));
      dropZone.addEventListener('drop', (e) => this.handleLayerDrop(e, i));

      input.addEventListener('change', (e) => this.handleLayerFileSelect(e, i));
      removeBtn.addEventListener('click', () => this.removeLayer(i));

      // Layer control listeners
      const visibleInput = document.getElementById(`layerVisible${i}`) as HTMLInputElement;
      const scaleInput = document.getElementById(`layerScale${i}`) as HTMLInputElement;
      const xInput = document.getElementById(`layerX${i}`) as HTMLInputElement;
      const yInput = document.getElementById(`layerY${i}`) as HTMLInputElement;

      visibleInput.addEventListener('change', () => this.updateLayerVisibility(i));
      scaleInput.addEventListener('input', () => this.updateLayerScale(i));
      xInput.addEventListener('input', () => this.updateLayerPosition(i));
      yInput.addEventListener('input', () => this.updateLayerPosition(i));

      // Layer name edit mode listeners
      const editBtn = document.getElementById(`layerEditBtn${i}`)!;
      const saveBtn = document.getElementById(`layerSaveBtn${i}`)!;
      const cancelBtn = document.getElementById(`layerCancelBtn${i}`)!;

      editBtn.addEventListener('click', () => this.enterEditMode(i));
      saveBtn.addEventListener('click', () => this.saveLayerName(i));
      cancelBtn.addEventListener('click', () => this.cancelEditMode(i));
    }

    // Canvas controls
    const showGuideInput = document.getElementById('showGuide') as HTMLInputElement;
    const guideSizeSlider = document.getElementById('guideSize') as HTMLInputElement;
    const guideSizeNumberInput = document.getElementById('guideSizeInput') as HTMLInputElement;

    showGuideInput.addEventListener('change', () => {
      this.showGuide = showGuideInput.checked;
      this.renderCanvas();
    });

    // Guide size slider
    guideSizeSlider.addEventListener('input', () => {
      this.guideSize = parseInt(guideSizeSlider.value);
      guideSizeNumberInput.value = this.guideSize.toString();
      this.renderCanvas();
    });

    // Guide size number input
    guideSizeNumberInput.addEventListener('input', () => {
      const value = parseInt(guideSizeNumberInput.value);
      if (value >= 50 && value <= 300) {
        this.guideSize = value;
        guideSizeSlider.value = value.toString();
        this.renderCanvas();
      }
    });

    // Export button
    const exportBtn = document.getElementById('exportLayers') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => this.exportLayers());

    // Output size change listener
    const outputSizeSelect = document.getElementById('outputSize') as HTMLSelectElement;
    outputSizeSelect.addEventListener('change', () => this.handleOutputSizeChange());

    // Quality slider listener
    const qualitySlider = document.getElementById('layerQuality') as HTMLInputElement;
    const qualityValue = document.getElementById('layerQualityValue')!;
    qualitySlider.addEventListener('input', () => {
      qualityValue.textContent = qualitySlider.value + '%';
    });

    // Preset event listeners
    const loadPresetBtn = document.getElementById('loadPreset') as HTMLButtonElement;
    const savePresetBtn = document.getElementById('savePreset') as HTMLButtonElement;
    const deletePresetBtn = document.getElementById('deletePreset') as HTMLButtonElement;
    
    loadPresetBtn.addEventListener('click', () => this.loadPreset());
    savePresetBtn.addEventListener('click', () => this.savePreset());
    deletePresetBtn.addEventListener('click', () => this.deletePreset());

    // Load presets on initialization
    this.loadPresetList();
    this.createDefaultPresets();
  }

  private handleLayerDragOver(e: DragEvent, layerIndex: number): void {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById(`layerDropZone${layerIndex}`)!;
    dropZone.classList.add('drag-over');
  }

  private handleLayerDragLeave(e: DragEvent, layerIndex: number): void {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById(`layerDropZone${layerIndex}`)!;
    dropZone.classList.remove('drag-over');
  }

  private handleLayerDrop(e: DragEvent, layerIndex: number): void {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById(`layerDropZone${layerIndex}`)!;
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer?.files || []);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      this.loadLayer(imageFile, layerIndex);
    }
  }

  private handleLayerFileSelect(e: Event, layerIndex: number): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file && file.type.startsWith('image/')) {
      this.loadLayer(file, layerIndex);
    }
  }

  private loadLayer(file: File, layerIndex: number): void {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
      
      img.onload = () => {
        // Calculate initial scale to fit the output size
        const initialScale = this.calculateInitialScale(img);
        
        this.layers[layerIndex] = {
          file,
          image: img,
          visible: true,
          scale: initialScale,
          x: 0,
          y: 0
        };

        this.updateLayerPreview(layerIndex, img.src);
        this.updateLayerControls(layerIndex);
        this.updateExportButton();
        this.renderCanvas();
      };
    };

    reader.readAsDataURL(file);
  }

  private calculateInitialScale(img: HTMLImageElement): number {
    const outputSize = parseInt((document.getElementById('outputSize') as HTMLSelectElement).value);
    const canvasSize = this.canvas.width; // Canvas preview size (400px)
    
    // Calculate scale to fit the larger dimension within the output size
    const scaleToOutput = Math.min(outputSize / img.width, outputSize / img.height);
    
    // Adjust for canvas preview (scale relative to canvas size vs output size)
    const canvasToOutputRatio = canvasSize / outputSize;
    const previewScale = scaleToOutput * canvasToOutputRatio;
    
    return Math.round(previewScale * 100) / 100; // Round to 2 decimal places
  }

  private updateLayerControls(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;

    // Update scale control
    const scaleInput = document.getElementById(`layerScale${layerIndex}`) as HTMLInputElement;
    const scaleValue = document.getElementById(`layerScaleValue${layerIndex}`)!;
    
    scaleInput.value = layer.scale.toString();
    scaleValue.textContent = `${layer.scale.toFixed(2)}x`;

    // Position controls remain at 0
    document.getElementById(`layerXValue${layerIndex}`)!.textContent = '0px';
    document.getElementById(`layerYValue${layerIndex}`)!.textContent = '0px';
  }

  private updateLayerPreview(layerIndex: number, src: string): void {
    const dropZone = document.getElementById(`layerDropZone${layerIndex}`)!;
    const preview = document.getElementById(`layerPreview${layerIndex}`)!;
    const img = document.getElementById(`layerImg${layerIndex}`) as HTMLImageElement;

    dropZone.style.display = 'none';
    img.src = src;
    preview.style.display = 'block';
    preview.classList.add('active');
  }

  private removeLayer(layerIndex: number): void {
    this.layers[layerIndex] = null;
    
    const dropZone = document.getElementById(`layerDropZone${layerIndex}`)!;
    const preview = document.getElementById(`layerPreview${layerIndex}`)!;

    dropZone.style.display = 'flex';
    preview.style.display = 'none';
    preview.classList.remove('active');

    // Reset controls
    (document.getElementById(`layerVisible${layerIndex}`) as HTMLInputElement).checked = true;
    (document.getElementById(`layerScale${layerIndex}`) as HTMLInputElement).value = '1';
    (document.getElementById(`layerX${layerIndex}`) as HTMLInputElement).value = '0';
    (document.getElementById(`layerY${layerIndex}`) as HTMLInputElement).value = '0';
    
    this.updateControlLabels(layerIndex);
    this.updateExportButton();
    this.renderCanvas();
  }

  private updateLayerVisibility(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const visible = (document.getElementById(`layerVisible${layerIndex}`) as HTMLInputElement).checked;
      this.layers[layerIndex]!.visible = visible;
      this.renderCanvas();
    }
  }

  private updateLayerScale(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const scale = parseFloat((document.getElementById(`layerScale${layerIndex}`) as HTMLInputElement).value);
      this.layers[layerIndex]!.scale = scale;
      document.getElementById(`layerScaleValue${layerIndex}`)!.textContent = `${scale.toFixed(2)}x`;
      this.renderCanvas();
    }
  }

  private updateLayerPosition(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const x = parseInt((document.getElementById(`layerX${layerIndex}`) as HTMLInputElement).value);
      const y = parseInt((document.getElementById(`layerY${layerIndex}`) as HTMLInputElement).value);
      
      this.layers[layerIndex]!.x = x;
      this.layers[layerIndex]!.y = y;
      
      document.getElementById(`layerXValue${layerIndex}`)!.textContent = `${x}px`;
      document.getElementById(`layerYValue${layerIndex}`)!.textContent = `${y}px`;
      
      this.renderCanvas();
    }
  }

  private updateControlLabels(layerIndex: number): void {
    document.getElementById(`layerScaleValue${layerIndex}`)!.textContent = '1.00x';
    document.getElementById(`layerXValue${layerIndex}`)!.textContent = '0px';
    document.getElementById(`layerYValue${layerIndex}`)!.textContent = '0px';
  }

  private handleOutputSizeChange(): void {
    // Recalculate scales for all existing layers
    this.layers.forEach((layer, index) => {
      if (layer) {
        const newScale = this.calculateInitialScale(layer.image);
        layer.scale = newScale;
        this.updateLayerControls(index);
      }
    });
    
    this.renderCanvas();
  }

  private renderCanvas(): void {
    const canvasSize = this.canvas.width;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // Render layers
    this.layers.forEach((layer) => {
      if (layer && layer.visible) {
        const scaledWidth = layer.image.width * layer.scale;
        const scaledHeight = layer.image.height * layer.scale;
        
        const drawX = centerX + layer.x - scaledWidth / 2;
        const drawY = centerY + layer.y - scaledHeight / 2;
        
        this.ctx.drawImage(layer.image, drawX, drawY, scaledWidth, scaledHeight);
      }
    });

    // Render guide
    if (this.showGuide) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      this.ctx.lineWidth = 2;
      
      const guideX = centerX - this.guideSize / 2;
      const guideY = centerY - this.guideSize / 2;
      
      this.ctx.fillRect(guideX, guideY, this.guideSize, this.guideSize);
      this.ctx.strokeRect(guideX, guideY, this.guideSize, this.guideSize);
      
      this.ctx.restore();
    }
  }

  private updateExportButton(): void {
    const hasLayers = this.layers.some(layer => layer !== null);
    const exportBtn = document.getElementById('exportLayers') as HTMLButtonElement;
    exportBtn.disabled = !hasLayers;
  }

  private enterEditMode(layerIndex: number): void {
    const nameText = document.getElementById(`layerNameText${layerIndex}`)!;
    const editBtn = document.getElementById(`layerEditBtn${layerIndex}`)!;
    const editMode = document.getElementById(`layerEditMode${layerIndex}`)!;
    const nameInput = document.getElementById(`layerName${layerIndex}`) as HTMLInputElement;

    // Hide display mode, show edit mode
    nameText.style.display = 'none';
    editBtn.style.display = 'none';
    editMode.style.display = 'flex';

    // Focus the input
    nameInput.focus();
    nameInput.select();
  }

  private saveLayerName(layerIndex: number): void {
    const nameText = document.getElementById(`layerNameText${layerIndex}`)!;
    const nameInput = document.getElementById(`layerName${layerIndex}`) as HTMLInputElement;
    const newName = nameInput.value.trim();

    if (!newName) {
      alert('Layer-Name darf nicht leer sein.');
      return;
    }

    // Update display text (h4 is now the nameText)
    nameText.textContent = newName;
    
    // Exit edit mode
    this.exitEditMode(layerIndex);
  }

  private cancelEditMode(layerIndex: number): void {
    const nameText = document.getElementById(`layerNameText${layerIndex}`)!;
    const nameInput = document.getElementById(`layerName${layerIndex}`) as HTMLInputElement;

    // Reset input to current display text
    nameInput.value = nameText.textContent || '';
    
    // Exit edit mode
    this.exitEditMode(layerIndex);
  }

  private exitEditMode(layerIndex: number): void {
    const nameText = document.getElementById(`layerNameText${layerIndex}`)!;
    const editBtn = document.getElementById(`layerEditBtn${layerIndex}`)!;
    const editMode = document.getElementById(`layerEditMode${layerIndex}`)!;

    // Show display mode, hide edit mode
    nameText.style.display = 'block';
    editBtn.style.display = 'inline-block';
    editMode.style.display = 'none';
  }

  private getLayerName(layerIndex: number): string {
    const nameText = document.getElementById(`layerNameText${layerIndex}`)!;
    return nameText.textContent || `layer${layerIndex + 1}`;
  }

  private async exportLayers(): Promise<void> {
    const activeLayers = this.layers.filter(layer => layer !== null) as LayerData[];
    
    if (activeLayers.length === 0) {
      alert('Keine Layer zum Exportieren vorhanden.');
      return;
    }

    const outputSize = parseInt((document.getElementById('outputSize') as HTMLSelectElement).value);
    const prefix = (document.getElementById('layerPrefix') as HTMLInputElement).value || 'layer';
    const quality = parseInt((document.getElementById('layerQuality') as HTMLInputElement).value);

    const formData = new FormData();
    const layerOptions: LayerExportOptions = { outputSize, prefix, quality };

    activeLayers.forEach((layer, index) => {
      formData.append('layers', layer.file);
    });

    // Add layer transformations with names
    const transformations = this.layers.map((layer, index) => {
      if (!layer) return null;
      
      const layerName = this.getLayerName(index);
      
      return { 
        visible: layer.visible, 
        scale: layer.scale, 
        x: layer.x, 
        y: layer.y,
        name: layerName
      };
    });

    formData.append('transformations', JSON.stringify(transformations));
    formData.append('options', JSON.stringify(layerOptions));

    try {
      const response = await fetch('/api/layer-process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Fehler beim Layer-Export');
      }

      const data = await response.json();
      console.log('Layer Export erfolgreich:', data);
      
      // Display download UI
      this.displayLayerResults(data.results);
    } catch (error) {
      console.error('Export-Fehler:', error);
      alert('Fehler beim Layer-Export');
    }
  }

  // Preset Management Methods
  private loadPresetList(): void {
    const presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
    const savedPresets = this.getSavedPresets();
    
    // Clear existing options except the first one
    presetSelect.innerHTML = '<option value="">-- Preset wählen --</option>';
    
    // Add saved presets
    savedPresets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.name;
      option.textContent = preset.name;
      presetSelect.appendChild(option);
    });
  }

  private savePreset(): void {
    const presetNameInput = document.getElementById('presetName') as HTMLInputElement;
    const presetName = presetNameInput.value.trim();
    
    if (!presetName) {
      alert('Bitte geben Sie einen Namen für das Preset ein.');
      return;
    }

    // Create preset from current layer settings
    const preset: LayerPreset = {
      name: presetName,
      guideSize: this.guideSize,
      layers: this.layers.map((layer, index) => {
        const layerName = this.getLayerName(index);
        
        return {
          visible: layer?.visible || false,
          scale: layer?.scale || 1.0,
          x: layer?.x || 0,
          y: layer?.y || 0,
          layerName: layerName
        };
      })
    };

    // Save to localStorage
    const savedPresets = this.getSavedPresets();
    const existingIndex = savedPresets.findIndex(p => p.name === presetName);
    
    if (existingIndex >= 0) {
      if (!confirm(`Preset "${presetName}" existiert bereits. Überschreiben?`)) {
        return;
      }
      savedPresets[existingIndex] = preset;
    } else {
      savedPresets.push(preset);
    }

    localStorage.setItem('layerPresets', JSON.stringify(savedPresets));
    this.loadPresetList();
    presetNameInput.value = '';
    alert(`Preset "${presetName}" wurde gespeichert.`);
  }

  private loadPreset(): void {
    const presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
    const selectedPresetName = presetSelect.value;
    
    if (!selectedPresetName) {
      alert('Bitte wählen Sie ein Preset aus.');
      return;
    }

    const savedPresets = this.getSavedPresets();
    const preset = savedPresets.find(p => p.name === selectedPresetName);
    
    if (!preset) {
      alert('Preset nicht gefunden.');
      return;
    }

    // Apply guide size
    this.guideSize = preset.guideSize || 200;
    const guideSizeSlider = document.getElementById('guideSize') as HTMLInputElement;
    const guideSizeNumberInput = document.getElementById('guideSizeInput') as HTMLInputElement;
    guideSizeSlider.value = this.guideSize.toString();
    guideSizeNumberInput.value = this.guideSize.toString();

    // Apply preset to existing layers
    preset.layers.forEach((presetLayer, index) => {
      // Apply layer name regardless of whether layer exists
      const nameText = document.getElementById(`layerNameText${index}`)!;
      const nameInput = document.getElementById(`layerName${index}`) as HTMLInputElement;
      
      if (nameText && nameInput && presetLayer.layerName) {
        nameText.textContent = presetLayer.layerName;
        nameInput.value = presetLayer.layerName;
      }
      
      if (this.layers[index]) {
        // Only apply to existing layers
        this.layers[index]!.visible = presetLayer.visible;
        this.layers[index]!.scale = presetLayer.scale;
        this.layers[index]!.x = presetLayer.x;
        this.layers[index]!.y = presetLayer.y;
        
        // Update UI controls
        this.updateAllLayerControls(index);
      }
    });

    this.renderCanvas();
    alert(`Preset "${selectedPresetName}" wurde geladen.`);
  }

  private deletePreset(): void {
    const presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
    const selectedPresetName = presetSelect.value;
    
    if (!selectedPresetName) {
      alert('Bitte wählen Sie ein Preset zum Löschen aus.');
      return;
    }

    if (!confirm(`Preset "${selectedPresetName}" wirklich löschen?`)) {
      return;
    }

    const savedPresets = this.getSavedPresets();
    const filteredPresets = savedPresets.filter(p => p.name !== selectedPresetName);
    
    localStorage.setItem('layerPresets', JSON.stringify(filteredPresets));
    this.loadPresetList();
    alert(`Preset "${selectedPresetName}" wurde gelöscht.`);
  }

  private getSavedPresets(): LayerPreset[] {
    const saved = localStorage.getItem('layerPresets');
    return saved ? JSON.parse(saved) : [];
  }

  private updateAllLayerControls(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;

    // Update visibility
    (document.getElementById(`layerVisible${layerIndex}`) as HTMLInputElement).checked = layer.visible;
    
    // Update scale
    const scaleInput = document.getElementById(`layerScale${layerIndex}`) as HTMLInputElement;
    const scaleValue = document.getElementById(`layerScaleValue${layerIndex}`)!;
    scaleInput.value = layer.scale.toString();
    scaleValue.textContent = `${layer.scale.toFixed(2)}x`;

    // Update position X
    const xInput = document.getElementById(`layerX${layerIndex}`) as HTMLInputElement;
    const xValue = document.getElementById(`layerXValue${layerIndex}`)!;
    xInput.value = layer.x.toString();
    xValue.textContent = `${layer.x}px`;

    // Update position Y
    const yInput = document.getElementById(`layerY${layerIndex}`) as HTMLInputElement;
    const yValue = document.getElementById(`layerYValue${layerIndex}`)!;
    yInput.value = layer.y.toString();
    yValue.textContent = `${layer.y}px`;
  }

  private createDefaultPresets(): void {
    const savedPresets = this.getSavedPresets();
    
    // Create your example preset if it doesn't exist
    if (!savedPresets.find(p => p.name === 'Beispiel-Setup')) {
      const examplePreset: LayerPreset = {
        name: 'Beispiel-Setup',
        guideSize: 180,  // Kleinere Guide-Größe für dein Setup
        layers: [
          { visible: true, scale: 0.6, x: -4, y: 14, layerName: 'Background' },  // Layer 1
          { visible: true, scale: 0.5, x: 0, y: 13, layerName: 'Avatar' },   // Layer 2
          { visible: true, scale: 0.4, x: 0, y: 0, layerName: 'Frame' }     // Layer 3
        ]
      };
      
      savedPresets.push(examplePreset);
      localStorage.setItem('layerPresets', JSON.stringify(savedPresets));
      this.loadPresetList();
    }
  }

  private displayLayerResults(results: any[]): void {
    const resultsSection = document.getElementById('layerResults')!;
    const resultsList = document.getElementById('layerResultsList')!;
    
    // Clear previous results
    resultsList.innerHTML = '';
    
    // Create result items
    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item';
      
      resultItem.innerHTML = `
        <h3>${result.original}</h3>
        <div class="processed-files">
          <div class="processed-file">
            <span class="file-name">${result.filename}</span>
            <span class="file-size">${this.formatFileSize(result.size)}</span>
            <a href="${result.url}" download="${result.filename}" class="download-btn">Download</a>
          </div>
        </div>
      `;
      
      resultsList.appendChild(resultItem);
    });
    
    // Show results section
    resultsSection.style.display = 'block';
    
    // Setup download all button
    const downloadAllBtn = document.getElementById('downloadAllLayersBtn')!;
    downloadAllBtn.onclick = () => this.downloadAllLayers(results);
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  private async downloadAllLayers(results: any[]): Promise<void> {
    for (const result of results) {
      const a = document.createElement('a');
      a.href = result.url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ImageProcessor();
  new LayerEditor();
});