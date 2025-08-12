import { ProcessOptions, ProcessResult, LayerExportOptions, LayerTransformation, ApiResponse } from '../models/index.js';

export class ApiService {
  private static instance: ApiService | null = null;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public async processImages(files: File[], options: ProcessOptions[]): Promise<ProcessResult[]> {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('images', file);
    });
    
    formData.append('options', JSON.stringify(options));

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<ProcessResult[]> = await response.json();
      
      if (!data.success || !data.results) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      return data.results;
    } catch (error) {
      console.error('Error processing images:', error);
      throw error;
    }
  }

  public async processLayers(
    files: File[], 
    transformations: (LayerTransformation | null)[], 
    options: LayerExportOptions
  ): Promise<any[]> {
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('layers', file);
    });
    
    formData.append('transformations', JSON.stringify(transformations));
    formData.append('options', JSON.stringify(options));

    try {
      const response = await fetch('/api/layer-process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      
      if (!data.success || !data.results) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      return data.results;
    } catch (error) {
      console.error('Error processing layers:', error);
      throw error;
    }
  }

  public async downloadFile(url: string, filename: string): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  public async downloadAll(files: { url: string; filename: string }[]): Promise<void> {
    for (const file of files) {
      await this.downloadFile(file.url, file.filename);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  public async colorMatchImages(
    referenceFile: File, 
    imageFiles: File[], 
    options: any
  ): Promise<ProcessResult[]> {
    const formData = new FormData();
    
    formData.append('reference', referenceFile);
    imageFiles.forEach(file => {
      formData.append('images', file);
    });
    formData.append('options', JSON.stringify(options));

    try {
      const response = await fetch('/api/color-match', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<ProcessResult[]> = await response.json();
      
      if (!data.success || !data.results) {
        throw new Error(data.error || 'Color matching failed');
      }

      return data.results;
    } catch (error) {
      console.error('Error in color matching:', error);
      throw error;
    }
  }

  public async generateColorPreview(
    referenceFile: File, 
    sourceFile: File, 
    options: any
  ): Promise<string> {
    const formData = new FormData();
    
    formData.append('reference', referenceFile);
    formData.append('source', sourceFile);
    formData.append('options', JSON.stringify(options));

    try {
      const response = await fetch('/api/color-preview', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.preview) {
        throw new Error(data.error || 'Preview generation failed');
      }

      return data.preview; // Base64 encoded image
    } catch (error) {
      console.error('Error generating color preview:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      const response = await fetch('/api/cleanup', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Cleanup failed');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}