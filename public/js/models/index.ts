// Main data interfaces
export interface ImageFile {
  file: File;
  preview: string;
  prefix: string;
}

export interface ProcessOptions {
  mode: 'split' | 'resize' | 'compress' | 'split-resize' | 'aspect-crop';
  quality: number;
  width?: number;
  height?: number;
  prefix: string;
  originalName?: string;
  combineWithOriginalName?: boolean;
  useSequentialNumbering?: boolean;
  useOriginalFileNames?: boolean;
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
  autoTrimFixedSize?: boolean;
  autoTrimTargetWidth?: number;
  autoTrimTargetHeight?: number;
  // Aspect ratio crop options
  aspectRatio?: string; // e.g., "16:9", "4:3", "1:1"
  cropPositionX?: number; // 0-100%
  cropPositionY?: number; // 0-100%
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
  // Crop properties (as percentages 0-100)
  cropEnabled?: boolean;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface LayerExportOptions {
  outputSize: number;
  prefix: string;
  quality: number;
  useOriginalNames?: boolean;
}

export interface LayerPreset {
  name: string;
  guideSize: number;
  showSecondGuide?: boolean;
  secondGuideSize?: number;
  layers: LayerPresetData[];
}

export interface LayerPresetData {
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  layerName?: string;
  // Crop properties
  cropEnabled?: boolean;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface LayerTransformation {
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  name?: string;
  // Crop properties
  cropEnabled?: boolean;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
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