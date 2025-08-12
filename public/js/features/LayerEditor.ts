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
    this.loadPresetList();
    this.createDefaultPresets();
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
      { id: `layerX${layerIndex}`, event: 'input', handler: () => this.updateLayerPosition(layerIndex) },
      { id: `layerY${layerIndex}`, event: 'input', handler: () => this.updateLayerPosition(layerIndex) }
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
        y: 0
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

    const scaleInput = this.$(`#layerScale${layerIndex}`) as HTMLInputElement;
    const scaleValue = this.$(`#layerScaleValue${layerIndex}`)!;
    
    scaleInput.value = layer.scale.toString();
    scaleValue.textContent = `${layer.scale.toFixed(2)}x`;

    this.$(`#layerXValue${layerIndex}`)!.textContent = '0px';
    this.$(`#layerYValue${layerIndex}`)!.textContent = '0px';
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
      this.$(`#layerScaleValue${layerIndex}`)!.textContent = `${scale.toFixed(2)}x`;
      this.renderCanvas();
    }
  }

  private updateLayerPosition(layerIndex: number): void {
    if (this.layers[layerIndex]) {
      const x = parseInt((this.$(`#layerX${layerIndex}`) as HTMLInputElement).value);
      const y = parseInt((this.$(`#layerY${layerIndex}`) as HTMLInputElement).value);
      
      this.layers[layerIndex]!.x = x;
      this.layers[layerIndex]!.y = y;
      
      this.$(`#layerXValue${layerIndex}`)!.textContent = `${x}px`;
      this.$(`#layerYValue${layerIndex}`)!.textContent = `${y}px`;
      
      this.renderCanvas();
    }
  }

  private updateControlLabels(layerIndex: number): void {
    this.$(`#layerScaleValue${layerIndex}`)!.textContent = '1.00x';
    this.$(`#layerXValue${layerIndex}`)!.textContent = '0px';
    this.$(`#layerYValue${layerIndex}`)!.textContent = '0px';
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
        const scaledWidth = layer.image.width * layer.scale;
        const scaledHeight = layer.image.height * layer.scale;
        
        const drawX = centerX + layer.x - scaledWidth / 2;
        const drawY = centerY + layer.y - scaledHeight / 2;
        
        this.ctx.drawImage(layer.image, drawX, drawY, scaledWidth, scaledHeight);
      }
    });

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

    const layerOptions: LayerExportOptions = { outputSize, prefix, quality };
    const files = activeLayers.map(layer => layer.file);

    const transformations = this.layers.map((layer, index) => {
      if (!layer) return null;
      
      const layerName = this.getLayerName(index);
      
      return { 
        visible: layer.visible, 
        scale: layer.scale, 
        x: layer.x, 
        y: layer.y,
        name: layerName
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
    const saved = localStorage.getItem('layerPresets');
    return saved ? JSON.parse(saved) : [];
  }

  private updateAllLayerControls(layerIndex: number): void {
    const layer = this.layers[layerIndex];
    if (!layer) return;

    (this.$(`#layerVisible${layerIndex}`) as HTMLInputElement).checked = layer.visible;
    
    const scaleInput = this.$(`#layerScale${layerIndex}`) as HTMLInputElement;
    const scaleValue = this.$(`#layerScaleValue${layerIndex}`)!;
    scaleInput.value = layer.scale.toString();
    scaleValue.textContent = `${layer.scale.toFixed(2)}x`;

    const xInput = this.$(`#layerX${layerIndex}`) as HTMLInputElement;
    const xValue = this.$(`#layerXValue${layerIndex}`)!;
    xInput.value = layer.x.toString();
    xValue.textContent = `${layer.x}px`;

    const yInput = this.$(`#layerY${layerIndex}`) as HTMLInputElement;
    const yValue = this.$(`#layerYValue${layerIndex}`)!;
    yInput.value = layer.y.toString();
    yValue.textContent = `${layer.y}px`;
  }

  private createDefaultPresets(): void {
    const savedPresets = this.getSavedPresets();
    
    if (!savedPresets.find(p => p.name === 'Beispiel-Setup')) {
      const examplePreset: LayerPreset = {
        name: 'Beispiel-Setup',
        guideSize: 180,
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