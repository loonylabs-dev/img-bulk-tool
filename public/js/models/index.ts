// Main data interfaces
export interface ImageFile {
  file: File;
  preview: string;
  prefix: string;
}

export interface ProcessOptions {
  mode: 'split' | 'resize' | 'compress' | 'split-resize';
  quality: number;
  width?: number;
  height?: number;
  prefix: string;
  smartCrop?: boolean;
  cropPadding?: number | undefined;
  cropPaddingTop?: number | undefined;
  cropPaddingRight?: number | undefined;
  cropPaddingBottom?: number | undefined;
  cropPaddingLeft?: number | undefined;
  cropTolerance?: number;
  autoTrim?: boolean;
  autoTrimPadding?: number;
  autoTrimTolerance?: number;
}

export interface ProcessResult {
  original: string;
  originalSize: number;
  processed: ProcessedFile[];
}

export interface ProcessedFile {
  filename: string;
  url: string;
  size: number;
}

// Layer Editor interfaces
export interface LayerData {
  file: File;
  image: HTMLImageElement;
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  name?: string;
}

export interface LayerExportOptions {
  outputSize: number;
  prefix: string;
  quality: number;
}

export interface LayerPreset {
  name: string;
  guideSize: number;
  layers: LayerPresetData[];
}

export interface LayerPresetData {
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  layerName?: string;
}

export interface LayerTransformation {
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  name?: string;
}

// Form validation
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  results?: T;
  error?: string;
}

// Event system
export interface EventData {
  type: string;
  payload?: any;
  timestamp: number;
}