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
              <span class="file-name">${file.filename}</span>
              <span class="file-size">${this.formatFileSize(file.size)}</span>
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ImageProcessor();
});