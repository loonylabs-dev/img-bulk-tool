export class FileService {
  private static instance: FileService | null = null;

  private constructor() {}

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  public isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  public filterImageFiles(files: File[]): File[] {
    return files.filter(file => this.isImageFile(file));
  }

  public async loadImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  public async loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  public validateFileSize(file: File, maxSizeMB: number = 50): boolean {
    return file.size <= maxSizeMB * 1024 * 1024;
  }

  public validateImageType(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(file.type);
  }

  public async validateFiles(files: File[]): Promise<{ valid: File[]; invalid: File[] }> {
    const valid: File[] = [];
    const invalid: File[] = [];

    for (const file of files) {
      if (this.isImageFile(file) && this.validateFileSize(file)) {
        valid.push(file);
      } else {
        invalid.push(file);
      }
    }

    return { valid, invalid };
  }
}