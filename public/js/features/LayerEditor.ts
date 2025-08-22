import { BaseComponent } from '../components/BaseComponent.js';
import { ApiService } from '../services/ApiService.js';
import { FileService } from '../services/FileService.js';
import { eventBus } from '../utils/EventBus.js';
import { LayerData, LayerExportOptions, LayerPreset, LayerTransformation } from '../models/index.js';

export class LayerEditor extends BaseComponent {
  private layers: (LayerData | null)[] = [null, null, null];
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private showGuide: boolean = true;
  private guideSize: number = 200;
  private showSecondGuide: boolean = true;
  private secondGuideSize: number = 250;
  private apiService: ApiService;
  private fileService: FileService;

  constructor() {
    super('layer-tab');
    this.apiService = ApiService.getInstance();
    this.fileService = FileService.getInstance();
    this.initializeElements();
  }

  private initializeElements(): void {
    this.canvas = this.$('#layerCanvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Layer canvas not found');
    }
    this.ctx = this.canvas.getContext('2d')!;
  }

  public init(): void {
    this.bindLayerEvents();
    this.bindCanvasEvents();
    this.bindExportEvents();
    this.bindPresetEvents();
    this.setupEventHandlers();
    this.renderCanvas();
    this.checkAndRestorePresets();
    this.loadPresetList();
    this.createDefaultPresets();
  }
  
  private checkAndRestorePresets(): void {
    // Check if there are any backup presets that should be restored
    const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('layerPresets_backup_'));
    
    if (backupKeys.length > 0 && !localStorage.getItem('layerPresets')) {
      // Sort by timestamp (newest first)
      backupKeys.sort((a, b) => {
        const timeA = parseInt(a.split('_').pop() ?? '0');
        const timeB = parseInt(b.split('_').pop() ?? '0');
        return timeB - timeA;
      });
      
      // Try to restore the most recent backup
      const mostRecentBackup = backupKeys[0];
      if (mostRecentBackup) {
        const backupData = localStorage.getItem(mostRecentBackup);
        
        if (backupData) {
          try {
            JSON.parse(backupData); // Test if it's valid JSON
            localStorage.setItem('layerPresets', backupData);
            console.log('Restored presets from backup');
            
            // Clean up old backups (keep only the 3 most recent)
            backupKeys.slice(3).forEach(key => localStorage.removeItem(key));
          } catch (e) {
            console.error('Could not restore backup:', e);
          }
        }
      }
    }
  }

  private bindLayerEvents(): void {
    for (let i = 0; i < 3; i++) {
      const dropZone = this.$(`#layerDropZone${i}`)!;
      const input = this.$(`#layerInput${i}`) as HTMLInputElement;
      const removeBtn = this.$(`#layerRemove${i}`)!;

      const layerListeners = [
        { element: dropZone, event: 'click', handler: () => input.click() },
        { element: dropZone, event: 'dragover', handler: ((e: DragEvent) => this.handleLayerDragOver(e, i)) as EventListener },
        { element: dropZone, event: 'dragleave', handler: ((e: DragEvent) => this.handleLayerDragLeave(e, i)) as EventListener },
        { element: dropZone, event: 'drop', handler: ((e: DragEvent) => this.handleLayerDrop(e, i)) as EventListener },
        { element: input, event: 'change', handler: (e: Event) => this.handleLayerFileSelect(e, i) },
        { element: removeBtn, event: 'click', handler: () => this.removeLayer(i) }
      ];

      this.addEventListeners(`layer${i}`, layerListeners);

      // Control listeners
      this.bindLayerControls(i);
      this.bindLayerNameEdit(i);
    }
  }

  private bindLayerControls(layerIndex: number): void {
    const controls = [
      { id: `layerVisible${layerIndex}`, event: 'change', handler: () => this.updateLayerVisibility(layerIndex) },
      { id: `layerScale${layerIndex}`, event: 'input', handler: () => this.updateLayerScale(layerIndex) },
      { id: `layerScaleInput${layerIndex}`, event: 'input', handler: () => this.updateLayerScaleFromInput(layerIndex) },
      { id: `layerX${layerIndex}`, event: 'input', handler: () => this.updateLayerPosition(layerIndex) },
      { id: `layerXInput${layerIndex}`, event: 'input', handler: () => this.updateLayerPositionFromInput(layerIndex, 'x') },
      { id: `layerY${layerIndex}`, event: 'input', handler: () => this.updateLayerPosition(layerIndex) },
      { id: `layerYInput${layerIndex}`, event: 'input', handler: () => this.updateLayerPositionFromInput(layerIndex, 'y') },
      // Crop controls
      { id: `layerCropEnabled${layerIndex}`, event: 'change', handler: () => this.updateLayerCropEnabled(layerIndex) },
      { id: `layerCropX${layerIndex}`, event: 'input', handler: () => this.updateLayerCrop(layerIndex, 'cropX') },
      { id: `layerCropXInput${layerIndex}`, event: 'input', handler: () => this.updateLayerCropFromInput(layerIndex, 'cropX') },
      { id: `layerCropY${layerIndex}`, event: 'input', handler: () => this.updateLayerCrop(layerIndex, 'cropY') },
      { id: `layerCropYInput${layerIndex}`, event: 'input', handler: () => this.updateLayerCropFromInput(layerIndex, 'cropY') },
      { id: `layerCropWidth${layerIndex}`, event: 'input', handler: () => this.updateLayerCrop(layerIndex, 'cropWidth') },
      { id: `layerCropWidthInput${layerIndex}`, event: 'input', handler: () => this.updateLayerCropFromInput(layerIndex, 'cropWidth') },
      { id: `layerCropHeight${layerIndex}`, event: 'input', handler: () => this.updateLayerCrop(layerIndex, 'cropHeight') },
      { id: `layerCropHeightInput${layerIndex}`, event: 'input', handler: () => this.updateLayerCropFromInput(layerIndex, 'cropHeight') }
    ];

    const controlListeners = controls.map(({ id, event, handler }) => {
      const element = this.$(`#${id}`);
      return element ? { element, event: event as keyof HTMLElementEventMap, handler } : null;
    }).filter(Boolean) as any[];

    this.addEventListeners(`controls${layerIndex}`, controlListeners);
  }

  private bindLayerNameEdit(layerIndex: number): void {
    const editBtn = this.$(`#layerEditBtn${layerIndex}`)!;
    const saveBtn = this.$(`#layerSaveBtn${layerIndex}`)!;
    const cancelBtn = this.$(`#layerCancelBtn${layerIndex}`)!;

    const nameListeners = [
      { element: editBtn, event: 'click', handler: () => this.enterEditMode(layerIndex) },
      { element: saveBtn, event: 'click', handler: () => this.saveLayerName(layerIndex) },
      { element: cancelBtn, event: 'click', handler: () => this.cancelEditMode(layerIndex) }
    ];

    this.addEventListeners(`name${layerIndex}`, nameListeners);
  }

  private bindCanvasEvents(): void {
    const showGuideInput = this.$('#showGuide') as HTMLInputElement;
    const guideSizeSlider = this.$('#guideSize') as HTMLInputElement;
    const guideSizeNumberInput = this.$('#guideSizeInput') as HTMLInputElement;
    const showSecondGuideInput = this.$('#showSecondGuide') as HTMLInputElement;
    const secondGuideSizeSlider = this.$('#secondGuideSize') as HTMLInputElement;
    const secondGuideSizeNumberInput = this.$('#secondGuideSizeInput') as HTMLInputElement;

    const canvasListeners = [
      {
        element: showGuideInput,
        event: 'change' as const,
        handler: () => {
          this.showGuide = showGuideInput.checked;
          this.renderCanvas();
        }
      },
      {
        element: guideSizeSlider,
        event: 'input' as const,
        handler: () => {
          this.guideSize = parseInt(guideSizeSlider.value);
          guideSizeNumberInput.value = this.guideSize.toString();
          this.renderCanvas();
        }
      },
      {
        element: guideSizeNumberInput,
        event: 'input' as const,
        handler: () => {
          const value = parseInt(guideSizeNumberInput.value);
          if (value >= 50 && value <= 300) {
            this.guideSize = value;
            guideSizeSlider.value = value.toString();
            this.renderCanvas();
          }
        }
      },
      {
        element: showSecondGuideInput,
        event: 'change' as const,
        handler: () => {
          this.showSecondGuide = showSecondGuideInput.checked;
          this.renderCanvas();
        }
      },
      {
        element: secondGuideSizeSlider,
        event: 'input' as const,
        handler: () => {
          this.secondGuideSize = parseInt(secondGuideSizeSlider.value);
          secondGuideSizeNumberInput.value = this.secondGuideSize.toString();
          this.renderCanvas();
        }
      },
      {
        element: secondGuideSizeNumberInput,
        event: 'input' as const,
        handler: () => {
          const value = parseInt(secondGuideSizeNumberInput.value);
          if (value >= 50 && value <= 400) {
            this.secondGuideSize = value;
            secondGuideSizeSlider.value = value.toString();
            this.renderCanvas();
          }
        }
      }
    ];

    this.addEventListeners('canvas', canvasListeners);
  }

  private bindExportEvents(): void {
    const exportBtn = this.$('#exportLayers') as HTMLButtonElement;
    const outputSizeSelect = this.$('#outputSize') as HTMLSelectElement;
    const qualitySlider = this.$('#layerQuality') as HTMLInputElement;
    const qualityValue = this.$('#layerQualityValue')!;

    const exportListeners = [
      { element: exportBtn, event: 'click', handler: () => this.exportLayers() },
      { element: outputSizeSelect, event: 'change', handler: () => this.handleOutputSizeChange() },
      {
        element: qualitySlider,
        event: 'input' as const,
        handler: () => {
          qualityValue.textContent = qualitySlider.value + '%';
        }
      }
    ];

    this.addEventListeners('export', exportListeners);
  }

  private bindPresetEvents(): void {
    const loadPresetBtn = this.$('#loadPreset') as HTMLButtonElement;
    const savePresetBtn = this.$('#savePreset') as HTMLButtonElement;
    const deletePresetBtn = this.$('#deletePreset') as HTMLButtonElement;

    const presetListeners = [
      { element: loadPresetBtn, event: 'click', handler: () => this.loadPreset() },
      { element: savePresetBtn, event: 'click', handler: () => this.savePreset() },
      { element: deletePresetBtn, event: 'click', handler: () => this.deletePreset() }
    ];

    this.addEventListeners('presets', presetListeners);
  }

  private setupEventHandlers(): void {
    eventBus.on('layer-export-start', () => {
      console.log('Layer export started');
    });

    eventBus.on('layer-export-complete', (data) => {
      if (data.payload) {
        this.displayLayerResults(data.payload);
      }
    });

    eventBus.on('layer-export-error', (data) => {
      alert('Fehler beim Layer-Export: ' + (data.payload?.message || 'Unbekannter Fehler'));
    });
  }

  private handleLayerDragOver(e: DragEvent, layerIndex: number): void {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = this.$(`#layerDropZone${layerIndex}`)!;
    dropZone.classList.add('drag-over');
  }

  private handleLayerDragLeave(e: DragEvent, layerIndex: number): void {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = this.$(`#layerDropZone${layerIndex}`)!;
    dropZone.classList.remove('drag-over');
  }

  private handleLayerDrop(e: DragEvent, layerIndex: number): void {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = this.$(`#layerDropZone${layerIndex}`)!;
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

  private async loadLayer(file: File, layerIndex: number): Promise<void> {
    try {
      const image = await this.fileService.loadImageElement(file);
      const initialScale = this.calculateInitialScale(image);
      
      this.layers[layerIndex] = {
        file,
        image,
        visible: true,
        scale: initialScale,
        x: 0,
        y: 0,
        cropEnabled: false,
        cropX: 0,
        cropY: 0,
        cropWidth: 100,
        cropHeight: 100
      };

      const preview = await this.fileService.loadImagePreview(file);
      this.updateLayerPreview(layerIndex, preview);
      this.updateLayerControls(layerIndex);
      this.updateExportButton();
      this.renderCanvas();
    } catch (error) {
      console.error('Error loading layer:', error);
      alert('Fehler beim Laden der Datei');
    }
  }

  private calculateInitialScale(img: HTMLImageElement): number {
    const outputSize = parseInt((this.$('#outputSize') as HTMLSelectElement).value);
    const canvasSize = this.canvas.width;
    
    const scaleToOutput = Math.min(outputSize / img.width, outputSize / img.height);
    const canvasToOutputRatio = canvasSize / outputSize;
    const previewScale = scaleToOutput * canvasToOutputRatio;
    
    return Math.round(previewScale * 100) / 100;
  }

  private updateLayerControls(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;

    const scaleSlider = this.$(`#layerScale${layerIndex}`) as HTMLInputElement;
    const scaleInput = this.$(`#layerScaleInput${layerIndex}`) as HTMLInputElement;
    
    scaleSlider.value = layer.scale.toString();
    if (scaleInput) scaleInput.value = layer.scale.toFixed(2);

    const xInput = this.$(`#layerXInput${layerIndex}`) as HTMLInputElement;
    const yInput = this.$(`#layerYInput${layerIndex}`) as HTMLInputElement;
    if (xInput) xInput.value = '0';
    if (yInput) yInput.value = '0';
  }

  private updateLayerPreview(layerIndex: number, src: string): void {
    const dropZone = this.$(`#layerDropZone${layerIndex}`)!;
    const preview = this.$(`#layerPreview${layerIndex}`)!;
    const img = this.$(`#layerImg${layerIndex}`) as HTMLImageElement;

    dropZone.style.display = 'none';
    img.src = src;
    preview.style.display = 'block';
    preview.classList.add('active');
  }

  private removeLayer(layerIndex: number): void {
    this.layers[layerIndex] = null;
    
    const dropZone = this.$(`#layerDropZone${layerIndex}`)!;
    const preview = this.$(`#layerPreview${layerIndex}`)!;

    dropZone.style.display = 'flex';
    preview.style.display = 'none';
    preview.classList.remove('active');

    // Reset controls
    (this.$(`#layerVisible${layerIndex}`) as HTMLInputElement).checked = true;
    (this.$(`#layerScale${layerIndex}`) as HTMLInputElement).value = '1';
    (this.$(`#layerX${layerIndex}`) as HTMLInputElement).value = '0';
    (this.$(`#layerY${layerIndex}`) as HTMLInputElement).value = '0';
    
    const scaleInput = this.$(`#layerScaleInput${layerIndex}`) as HTMLInputElement;
    const xInput = this.$(`#layerXInput${layerIndex}`) as HTMLInputElement;
    const yInput = this.$(`#layerYInput${layerIndex}`) as HTMLInputElement;
    if (scaleInput) scaleInput.value = '1.00';
    if (xInput) xInput.value = '0';
    if (yInput) yInput.value = '0';
    
    // Reset crop controls
    (this.$(`#layerCropEnabled${layerIndex}`) as HTMLInputElement).checked = false;
    (this.$(`#layerCropX${layerIndex}`) as HTMLInputElement).value = '0';
    (this.$(`#layerCropY${layerIndex}`) as HTMLInputElement).value = '0';
    (this.$(`#layerCropWidth${layerIndex}`) as HTMLInputElement).value = '100';
    (this.$(`#layerCropHeight${layerIndex}`) as HTMLInputElement).value = '100';
    this.disableCropControls(layerIndex);
    
    this.updateControlLabels(layerIndex);
    this.updateExportButton();
    this.renderCanvas();
  }

  private updateLayerVisibility(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const visible = (this.$(`#layerVisible${layerIndex}`) as HTMLInputElement).checked;
      this.layers[layerIndex]!.visible = visible;
      this.renderCanvas();
    }
  }

  private updateLayerScale(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const scale = parseFloat((this.$(`#layerScale${layerIndex}`) as HTMLInputElement).value);
      this.layers[layerIndex]!.scale = scale;
      const scaleInput = this.$(`#layerScaleInput${layerIndex}`) as HTMLInputElement;
      if (scaleInput) {
        scaleInput.value = scale.toFixed(2);
      }
      this.renderCanvas();
    }
  }

  private updateLayerScaleFromInput(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const scaleInput = this.$(`#layerScaleInput${layerIndex}`) as HTMLInputElement;
      const scale = parseFloat(scaleInput.value);
      if (!isNaN(scale) && scale >= 0.1 && scale <= 3) {
        this.layers[layerIndex]!.scale = scale;
        const slider = this.$(`#layerScale${layerIndex}`) as HTMLInputElement;
        slider.value = scale.toString();
        this.renderCanvas();
      }
    }
  }

  private updateLayerPosition(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const x = parseInt((this.$(`#layerX${layerIndex}`) as HTMLInputElement).value);
      const y = parseInt((this.$(`#layerY${layerIndex}`) as HTMLInputElement).value);
      
      this.layers[layerIndex]!.x = x;
      this.layers[layerIndex]!.y = y;
      
      const xInput = this.$(`#layerXInput${layerIndex}`) as HTMLInputElement;
      const yInput = this.$(`#layerYInput${layerIndex}`) as HTMLInputElement;
      if (xInput) xInput.value = x.toString();
      if (yInput) yInput.value = y.toString();
      
      this.renderCanvas();
    }
  }

  private updateLayerPositionFromInput(layerIndex: number, axis: 'x' | 'y'): void {
    if (this.layers[layerIndex]) {
      const inputId = axis === 'x' ? `layerXInput${layerIndex}` : `layerYInput${layerIndex}`;
      const sliderId = axis === 'x' ? `layerX${layerIndex}` : `layerY${layerIndex}`;
      
      const input = this.$(`#${inputId}`) as HTMLInputElement;
      const value = parseInt(input.value);
      
      if (!isNaN(value) && value >= -200 && value <= 200) {
        if (axis === 'x') {
          this.layers[layerIndex]!.x = value;
        } else {
          this.layers[layerIndex]!.y = value;
        }
        
        const slider = this.$(`#${sliderId}`) as HTMLInputElement;
        slider.value = value.toString();
        
        this.renderCanvas();
      }
    }
  }

  private updateControlLabels(layerIndex: number): void {
    const scaleInput = this.$(`#layerScaleInput${layerIndex}`) as HTMLInputElement;
    const xInput = this.$(`#layerXInput${layerIndex}`) as HTMLInputElement;
    const yInput = this.$(`#layerYInput${layerIndex}`) as HTMLInputElement;
    if (scaleInput) scaleInput.value = '1.00';
    if (xInput) xInput.value = '0';
    if (yInput) yInput.value = '0';
    
    // Update crop inputs
    const cropXInput = this.$(`#layerCropXInput${layerIndex}`) as HTMLInputElement;
    const cropYInput = this.$(`#layerCropYInput${layerIndex}`) as HTMLInputElement;
    const cropWidthInput = this.$(`#layerCropWidthInput${layerIndex}`) as HTMLInputElement;
    const cropHeightInput = this.$(`#layerCropHeightInput${layerIndex}`) as HTMLInputElement;
    if (cropXInput) cropXInput.value = '0';
    if (cropYInput) cropYInput.value = '0';
    if (cropWidthInput) cropWidthInput.value = '100';
    if (cropHeightInput) cropHeightInput.value = '100';
  }

  private updateLayerCropEnabled(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const enabled = (this.$(`#layerCropEnabled${layerIndex}`) as HTMLInputElement).checked;
      this.layers[layerIndex]!.cropEnabled = enabled;
      
      if (enabled) {
        this.enableCropControls(layerIndex);
      } else {
        this.disableCropControls(layerIndex);
      }
      
      this.renderCanvas();
    }
  }

  private enableCropControls(layerIndex: number): void {
    ['CropX', 'CropY', 'CropWidth', 'CropHeight'].forEach(control => {
      const slider = this.$(`#layer${control}${layerIndex}`) as HTMLInputElement;
      const input = this.$(`#layer${control}Input${layerIndex}`) as HTMLInputElement;
      if (slider) slider.disabled = false;
      if (input) input.disabled = false;
    });
  }

  private disableCropControls(layerIndex: number): void {
    ['CropX', 'CropY', 'CropWidth', 'CropHeight'].forEach(control => {
      const slider = this.$(`#layer${control}${layerIndex}`) as HTMLInputElement;
      const input = this.$(`#layer${control}Input${layerIndex}`) as HTMLInputElement;
      if (slider) slider.disabled = true;
      if (input) input.disabled = true;
    });
  }

  private updateLayerCrop(layerIndex: number, property: 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'): void {
    if (this.layers[layerIndex]) {
      const inputId = `layer${property.charAt(0).toUpperCase() + property.slice(1)}${layerIndex}`;
      const value = parseFloat((this.$(` #${inputId}`) as HTMLInputElement).value);
      
      this.layers[layerIndex]![property] = value;
      
      // Update number input
      const numberInput = this.$(`#${inputId}Input`) as HTMLInputElement;
      if (numberInput) numberInput.value = value.toString();
      
      // Validate crop bounds
      this.validateCropBounds(layerIndex);
      this.renderCanvas();
    }
  }

  private updateLayerCropFromInput(layerIndex: number, property: 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight'): void {
    if (this.layers[layerIndex]) {
      const inputId = `layer${property.charAt(0).toUpperCase() + property.slice(1)}${layerIndex}`;
      const numberInput = this.$(`#${inputId}Input`) as HTMLInputElement;
      const value = parseFloat(numberInput.value);
      
      // Validate value ranges
      let isValid = false;
      if (property === 'cropX' || property === 'cropY') {
        isValid = !isNaN(value) && value >= 0 && value <= 90;
      } else {
        isValid = !isNaN(value) && value >= 10 && value <= 100;
      }
      
      if (isValid) {
        this.layers[layerIndex]![property] = value;
        
        // Update slider
        const slider = this.$(`#${inputId}`) as HTMLInputElement;
        slider.value = value.toString();
        
        this.validateCropBounds(layerIndex);
        this.renderCanvas();
      }
    }
  }

  private validateCropBounds(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;
    
    // Ensure crop doesn't exceed bounds
    const maxX = 100 - (layer.cropWidth ?? 100);
    const maxY = 100 - (layer.cropHeight ?? 100);
    
    if ((layer.cropX ?? 0) > maxX) {
      layer.cropX = maxX;
      (this.$(`#layerCropX${layerIndex}`) as HTMLInputElement).value = maxX.toString();
      (this.$(`#layerCropXInput${layerIndex}`) as HTMLInputElement).value = maxX.toString();
    }
    
    if ((layer.cropY ?? 0) > maxY) {
      layer.cropY = maxY;
      (this.$(`#layerCropY${layerIndex}`) as HTMLInputElement).value = maxY.toString();
      (this.$(`#layerCropYInput${layerIndex}`) as HTMLInputElement).value = maxY.toString();
    }
  }

  private handleOutputSizeChange(): void {
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

    this.ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    this.layers.forEach((layer) => {
      if (layer && layer.visible) {
        if (layer.cropEnabled) {
          // Calculate crop area in pixels
          const cropX = (layer.cropX ?? 0) * layer.image.width / 100;
          const cropY = (layer.cropY ?? 0) * layer.image.height / 100;
          const cropWidth = (layer.cropWidth ?? 100) * layer.image.width / 100;
          const cropHeight = (layer.cropHeight ?? 100) * layer.image.height / 100;
          
          // Calculate scaled dimensions
          const scaledWidth = cropWidth * layer.scale;
          const scaledHeight = cropHeight * layer.scale;
          
          const drawX = centerX + layer.x - scaledWidth / 2;
          const drawY = centerY + layer.y - scaledHeight / 2;
          
          // Draw cropped portion
          this.ctx.drawImage(
            layer.image,
            cropX, cropY, cropWidth, cropHeight,  // Source rectangle (crop area)
            drawX, drawY, scaledWidth, scaledHeight  // Destination rectangle
          );
        } else {
          // Draw full image
          const scaledWidth = layer.image.width * layer.scale;
          const scaledHeight = layer.image.height * layer.scale;
          
          const drawX = centerX + layer.x - scaledWidth / 2;
          const drawY = centerY + layer.y - scaledHeight / 2;
          
          this.ctx.drawImage(layer.image, drawX, drawY, scaledWidth, scaledHeight);
        }
      }
    });

    // Draw second guide first (so it appears behind the first guide)
    if (this.showSecondGuide) {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      this.ctx.lineWidth = 2;
      
      const secondGuideX = centerX - this.secondGuideSize / 2;
      const secondGuideY = centerY - this.secondGuideSize / 2;
      
      this.ctx.fillRect(secondGuideX, secondGuideY, this.secondGuideSize, this.secondGuideSize);
      this.ctx.strokeRect(secondGuideX, secondGuideY, this.secondGuideSize, this.secondGuideSize);
      
      this.ctx.restore();
    }
    
    // Draw first guide on top
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
    const exportBtn = this.$('#exportLayers') as HTMLButtonElement;
    exportBtn.disabled = !hasLayers;
  }

  private enterEditMode(layerIndex: number): void {
    const nameText = this.$(`#layerNameText${layerIndex}`)!;
    const editBtn = this.$(`#layerEditBtn${layerIndex}`)!;
    const editMode = this.$(`#layerEditMode${layerIndex}`)!;
    const nameInput = this.$(`#layerName${layerIndex}`) as HTMLInputElement;

    nameText.style.display = 'none';
    editBtn.style.display = 'none';
    editMode.style.display = 'flex';

    nameInput.focus();
    nameInput.select();
  }

  private saveLayerName(layerIndex: number): void {
    const nameText = this.$(`#layerNameText${layerIndex}`)!;
    const nameInput = this.$(`#layerName${layerIndex}`) as HTMLInputElement;
    const newName = nameInput.value.trim();

    if (!newName) {
      alert('Layer-Name darf nicht leer sein.');
      return;
    }

    nameText.textContent = newName;
    this.exitEditMode(layerIndex);
  }

  private cancelEditMode(layerIndex: number): void {
    const nameText = this.$(`#layerNameText${layerIndex}`)!;
    const nameInput = this.$(`#layerName${layerIndex}`) as HTMLInputElement;

    nameInput.value = nameText.textContent || '';
    this.exitEditMode(layerIndex);
  }

  private exitEditMode(layerIndex: number): void {
    const nameText = this.$(`#layerNameText${layerIndex}`)!;
    const editBtn = this.$(`#layerEditBtn${layerIndex}`)!;
    const editMode = this.$(`#layerEditMode${layerIndex}`)!;

    nameText.style.display = 'block';
    editBtn.style.display = 'inline-block';
    editMode.style.display = 'none';
  }

  private getLayerName(layerIndex: number): string {
    const nameText = this.$(`#layerNameText${layerIndex}`)!;
    return nameText.textContent || `layer${layerIndex + 1}`;
  }

  private async exportLayers(): Promise<void> {
    const activeLayers = this.layers.filter(layer => layer !== null) as LayerData[];
    
    if (activeLayers.length === 0) {
      alert('Keine Layer zum Exportieren vorhanden.');
      return;
    }

    const outputSize = parseInt((this.$('#outputSize') as HTMLSelectElement).value);
    const prefix = (this.$('#layerPrefix') as HTMLInputElement).value || 'layer';
    const quality = parseInt((this.$('#layerQuality') as HTMLInputElement).value);
    const useOriginalNames = (this.$('#useOriginalNames') as HTMLInputElement).checked;

    const layerOptions: LayerExportOptions = { outputSize, prefix, quality, useOriginalNames };
    const files = activeLayers.map(layer => layer.file);

    const transformations = this.layers.map((layer, index) => {
      if (!layer) return null;
      
      let layerName: string;
      if (useOriginalNames && layer.file) {
        // Use original filename without extension
        layerName = layer.file.name.replace(/\.[^/.]+$/, '');
      } else {
        layerName = this.getLayerName(index);
      }
      
      return { 
        visible: layer.visible, 
        scale: layer.scale, 
        x: layer.x, 
        y: layer.y,
        name: layerName,
        cropEnabled: layer.cropEnabled,
        cropX: layer.cropX,
        cropY: layer.cropY,
        cropWidth: layer.cropWidth,
        cropHeight: layer.cropHeight
      } as LayerTransformation;
    });

    eventBus.emit('layer-export-start');

    try {
      const results = await this.apiService.processLayers(files, transformations, layerOptions);
      eventBus.emit('layer-export-complete', results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      eventBus.emit('layer-export-error', { message });
    }
  }

  // Preset Management
  private loadPresetList(): void {
    const presetSelect = this.$('#presetSelect') as HTMLSelectElement;
    const savedPresets = this.getSavedPresets();
    
    presetSelect.innerHTML = '<option value="">-- Preset wählen --</option>';
    
    savedPresets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.name;
      option.textContent = preset.name;
      presetSelect.appendChild(option);
    });
  }

  private savePreset(): void {
    const presetNameInput = this.$('#presetName') as HTMLInputElement;
    const presetName = presetNameInput.value.trim();
    
    if (!presetName) {
      alert('Bitte geben Sie einen Namen für das Preset ein.');
      return;
    }

    const preset: LayerPreset = {
      name: presetName,
      guideSize: this.guideSize,
      showSecondGuide: this.showSecondGuide,
      secondGuideSize: this.secondGuideSize,
      layers: this.layers.map((layer, index) => {
        const layerName = this.getLayerName(index);
        
        return {
          visible: layer?.visible || false,
          scale: layer?.scale || 1.0,
          x: layer?.x || 0,
          y: layer?.y || 0,
          layerName: layerName,
          cropEnabled: layer?.cropEnabled || false,
          cropX: layer?.cropX || 0,
          cropY: layer?.cropY || 0,
          cropWidth: layer?.cropWidth || 100,
          cropHeight: layer?.cropHeight || 100
        };
      })
    };

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
    const presetSelect = this.$('#presetSelect') as HTMLSelectElement;
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

    this.guideSize = preset.guideSize || 200;
    const guideSizeSlider = this.$('#guideSize') as HTMLInputElement;
    const guideSizeNumberInput = this.$('#guideSizeInput') as HTMLInputElement;
    guideSizeSlider.value = this.guideSize.toString();
    guideSizeNumberInput.value = this.guideSize.toString();
    
    // Load second guide settings
    this.showSecondGuide = preset.showSecondGuide !== undefined ? preset.showSecondGuide : true;
    this.secondGuideSize = preset.secondGuideSize || 250;
    const showSecondGuideInput = this.$('#showSecondGuide') as HTMLInputElement;
    const secondGuideSizeSlider = this.$('#secondGuideSize') as HTMLInputElement;
    const secondGuideSizeNumberInput = this.$('#secondGuideSizeInput') as HTMLInputElement;
    showSecondGuideInput.checked = this.showSecondGuide;
    secondGuideSizeSlider.value = this.secondGuideSize.toString();
    secondGuideSizeNumberInput.value = this.secondGuideSize.toString();

    preset.layers.forEach((presetLayer, index) => {
      const nameText = this.$(`#layerNameText${index}`)!;
      const nameInput = this.$(`#layerName${index}`) as HTMLInputElement;
      
      if (nameText && nameInput && presetLayer.layerName) {
        nameText.textContent = presetLayer.layerName;
        nameInput.value = presetLayer.layerName;
      }
      
      if (this.layers[index]) {
        this.layers[index]!.visible = presetLayer.visible;
        this.layers[index]!.scale = presetLayer.scale;
        this.layers[index]!.x = presetLayer.x;
        this.layers[index]!.y = presetLayer.y;
        this.layers[index]!.cropEnabled = presetLayer.cropEnabled || false;
        this.layers[index]!.cropX = presetLayer.cropX || 0;
        this.layers[index]!.cropY = presetLayer.cropY || 0;
        this.layers[index]!.cropWidth = presetLayer.cropWidth || 100;
        this.layers[index]!.cropHeight = presetLayer.cropHeight || 100;
        
        this.updateAllLayerControls(index);
      }
    });

    this.renderCanvas();
    alert(`Preset "${selectedPresetName}" wurde geladen.`);
  }

  private deletePreset(): void {
    const presetSelect = this.$('#presetSelect') as HTMLSelectElement;
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
    try {
      const saved = localStorage.getItem('layerPresets');
      if (!saved) return [];
      
      const presets = JSON.parse(saved);
      
      // Validate that it's an array
      if (!Array.isArray(presets)) {
        console.warn('Invalid presets format, resetting to empty array');
        return [];
      }
      
      // Migrate old preset format if needed
      return presets.map(preset => this.migratePreset(preset));
    } catch (error) {
      console.error('Error loading presets:', error);
      // Backup corrupted data before clearing
      const backup = localStorage.getItem('layerPresets');
      if (backup) {
        localStorage.setItem('layerPresets_backup_' + Date.now(), backup);
      }
      return [];
    }
  }
  
  private migratePreset(preset: any): LayerPreset {
    // Ensure preset has all required fields
    const migrated: LayerPreset = {
      name: preset.name || 'Unnamed Preset',
      guideSize: preset.guideSize || 200,
      showSecondGuide: preset.showSecondGuide !== undefined ? preset.showSecondGuide : true,
      secondGuideSize: preset.secondGuideSize || 250,
      layers: []
    };
    
    // Migrate layers
    if (Array.isArray(preset.layers)) {
      migrated.layers = preset.layers.map((layer: any) => ({
        visible: layer.visible !== undefined ? layer.visible : true,
        scale: layer.scale !== undefined ? layer.scale : 1.0,
        x: layer.x !== undefined ? layer.x : 0,
        y: layer.y !== undefined ? layer.y : 0,
        layerName: layer.layerName || `Layer`
      }));
    } else {
      // Default 3 layers if missing
      migrated.layers = [
        { visible: true, scale: 1.0, x: 0, y: 0, layerName: 'Background' },
        { visible: true, scale: 1.0, x: 0, y: 0, layerName: 'Avatar' },
        { visible: true, scale: 1.0, x: 0, y: 0, layerName: 'Frame' }
      ];
    }
    
    return migrated;
  }

  private updateAllLayerControls(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;

    (this.$(`#layerVisible${layerIndex}`) as HTMLInputElement).checked = layer.visible;
    
    const scaleSlider = this.$(`#layerScale${layerIndex}`) as HTMLInputElement;
    const scaleInput = this.$(`#layerScaleInput${layerIndex}`) as HTMLInputElement;
    scaleSlider.value = layer.scale.toString();
    if (scaleInput) scaleInput.value = layer.scale.toFixed(2);

    const xSlider = this.$(`#layerX${layerIndex}`) as HTMLInputElement;
    const xInput = this.$(`#layerXInput${layerIndex}`) as HTMLInputElement;
    xSlider.value = layer.x.toString();
    if (xInput) xInput.value = layer.x.toString();

    const ySlider = this.$(`#layerY${layerIndex}`) as HTMLInputElement;
    const yInput = this.$(`#layerYInput${layerIndex}`) as HTMLInputElement;
    ySlider.value = layer.y.toString();
    if (yInput) yInput.value = layer.y.toString();
    
    // Update crop controls
    (this.$(`#layerCropEnabled${layerIndex}`) as HTMLInputElement).checked = layer.cropEnabled || false;
    
    const cropX = layer.cropX || 0;
    const cropY = layer.cropY || 0;
    const cropWidth = layer.cropWidth || 100;
    const cropHeight = layer.cropHeight || 100;
    
    (this.$(`#layerCropX${layerIndex}`) as HTMLInputElement).value = cropX.toString();
    (this.$(`#layerCropXInput${layerIndex}`) as HTMLInputElement).value = cropX.toString();
    
    (this.$(`#layerCropY${layerIndex}`) as HTMLInputElement).value = cropY.toString();
    (this.$(`#layerCropYInput${layerIndex}`) as HTMLInputElement).value = cropY.toString();
    
    (this.$(`#layerCropWidth${layerIndex}`) as HTMLInputElement).value = cropWidth.toString();
    (this.$(`#layerCropWidthInput${layerIndex}`) as HTMLInputElement).value = cropWidth.toString();
    
    (this.$(`#layerCropHeight${layerIndex}`) as HTMLInputElement).value = cropHeight.toString();
    (this.$(`#layerCropHeightInput${layerIndex}`) as HTMLInputElement).value = cropHeight.toString();
    
    // Enable/disable crop controls based on cropEnabled
    if (layer.cropEnabled) {
      this.enableCropControls(layerIndex);
    } else {
      this.disableCropControls(layerIndex);
    }
  }

  private createDefaultPresets(): void {
    const savedPresets = this.getSavedPresets();
    
    if (!savedPresets.find(p => p.name === 'Beispiel-Setup')) {
      const examplePreset: LayerPreset = {
        name: 'Beispiel-Setup',
        guideSize: 180,
        showSecondGuide: true,
        secondGuideSize: 280,
        layers: [
          { visible: true, scale: 0.6, x: -4, y: 14, layerName: 'Background' },
          { visible: true, scale: 0.5, x: 0, y: 13, layerName: 'Avatar' },
          { visible: true, scale: 0.4, x: 0, y: 0, layerName: 'Frame' }
        ]
      };
      
      savedPresets.push(examplePreset);
      localStorage.setItem('layerPresets', JSON.stringify(savedPresets));
      this.loadPresetList();
    }
  }

  private displayLayerResults(results: any[]): void {
    const resultsSection = this.$('#layerResults')!;
    const resultsList = this.$('#layerResultsList')!;
    
    resultsList.innerHTML = '';
    
    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item';
      
      resultItem.innerHTML = `
        <h3>${result.original}</h3>
        <div class="processed-files">
          <div class="processed-file">
            <span class="file-name">${result.filename}</span>
            <span class="file-size">${this.fileService.formatFileSize(result.size)}</span>
            <a href="${result.url}" download="${result.filename}" class="download-btn">Download</a>
          </div>
        </div>
      `;
      
      resultsList.appendChild(resultItem);
    });
    
    resultsSection.style.display = 'block';
    
    const downloadAllBtn = this.$('#downloadAllLayersBtn')!;
    downloadAllBtn.onclick = () => this.downloadAllLayers(results);
    
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  private async downloadAllLayers(results: any[]): Promise<void> {
    const files = results.map(result => ({
      url: result.url,
      filename: result.filename
    }));
    
    try {
      await this.apiService.downloadAll(files);
    } catch (error) {
      console.error('Error downloading layer files:', error);
      alert('Fehler beim Download einiger Layer-Dateien');
    }
  }

  public reset(): void {
    this.layers = [null, null, null];
    for (let i = 0; i < 3; i++) {
      this.removeLayer(i);
    }
    this.renderCanvas();
  }
}