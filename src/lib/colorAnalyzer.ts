import sharp from 'sharp';

export interface ColorStats {
  saturation: number;
  brightness: number; 
  contrast: number;
  avgRed: number;
  avgGreen: number;
  avgBlue: number;
}

export interface ColorAdjustment {
  saturationMultiplier: number;
  brightnessMultiplier: number;
  hueRotation: number; // degrees
}

export interface AdvancedColorOptions {
  intensity: number;
  saturationBoost: number;
  brightnessBoost: number;
  contrastBoost: number;
  hueShift: number;
  sharpness: number;
  noiseReduction: number;
  gamma: number;
}

export class ColorAnalyzer {
  /**
   * Analyzes the color characteristics of an image
   * @param buffer Image buffer to analyze
   * @returns ColorStats object with image statistics
   */
  async analyzeImage(buffer: Buffer): Promise<ColorStats> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not get image dimensions');
    }

    // Get image statistics using Sharp's stats() method (for potential future use)
    // const stats = await image.stats();
    
    // Calculate HSV-based statistics for more accurate color analysis
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const pixelCount = width * height;
    
    let totalSaturation = 0;
    let totalBrightness = 0;
    let totalContrast = 0;
    let avgRed = 0;
    let avgGreen = 0;
    let avgBlue = 0;

    // Sample pixels for HSV analysis (sample every 10th pixel for performance)
    const sampleStep = Math.max(1, Math.floor(pixelCount / 10000)); // Max 10k samples
    
    for (let i = 0; i < pixelCount; i += sampleStep) {
      const pixelIndex = i * channels;
      const r = data[pixelIndex] / 255;
      const g = data[pixelIndex + 1] / 255;
      const b = data[pixelIndex + 2] / 255;
      
      avgRed += r;
      avgGreen += g;
      avgBlue += b;
      
      // Convert RGB to HSV for saturation calculation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      
      // Saturation
      const saturation = max === 0 ? 0 : delta / max;
      totalSaturation += saturation;
      
      // Brightness (Value in HSV)
      const brightness = max;
      totalBrightness += brightness;
      
      // Contrast (simple approximation using local variation)
      const contrast = delta;
      totalContrast += contrast;
    }
    
    const sampleCount = Math.ceil(pixelCount / sampleStep);
    
    return {
      saturation: totalSaturation / sampleCount,
      brightness: totalBrightness / sampleCount,
      contrast: totalContrast / sampleCount,
      avgRed: avgRed / sampleCount,
      avgGreen: avgGreen / sampleCount,
      avgBlue: avgBlue / sampleCount
    };
  }

  /**
   * Calculates the adjustment needed to match target color characteristics
   * @param sourceStats Color stats of the image to adjust
   * @param targetStats Color stats of the reference image
   * @param intensity Adjustment intensity (0-300, where 100 = full match)
   * @returns ColorAdjustment parameters
   */
  calculateAdjustment(sourceStats: ColorStats, targetStats: ColorStats, intensity: number = 100): ColorAdjustment {
    const intensityFactor = intensity / 100;
    
    // Calculate saturation multiplier with enhanced sensitivity
    let saturationMultiplier = 1.0;
    if (sourceStats.saturation > 0.01) { // Avoid division by very small numbers
      const targetRatio = targetStats.saturation / sourceStats.saturation;
      const baseDifference = targetRatio - 1;
      
      // Apply non-linear scaling for more dramatic changes at higher intensities
      const enhancedDifference = baseDifference * intensityFactor;
      
      // For intensity > 100%, amplify the effect exponentially
      if (intensity > 100) {
        const extraIntensity = (intensity - 100) / 100;
        const amplification = 1 + (extraIntensity * 1.5); // 1.5x amplification factor
        saturationMultiplier = 1 + (enhancedDifference * amplification);
      } else {
        saturationMultiplier = 1 + enhancedDifference;
      }
    }
    
    // Calculate brightness multiplier with enhanced sensitivity
    let brightnessMultiplier = 1.0;
    if (sourceStats.brightness > 0.01) {
      const targetRatio = targetStats.brightness / sourceStats.brightness;
      const baseDifference = targetRatio - 1;
      
      const enhancedDifference = baseDifference * intensityFactor;
      
      // For intensity > 100%, amplify the effect
      if (intensity > 100) {
        const extraIntensity = (intensity - 100) / 100;
        const amplification = 1 + (extraIntensity * 1.2); // 1.2x amplification for brightness
        brightnessMultiplier = 1 + (enhancedDifference * amplification);
      } else {
        brightnessMultiplier = 1 + enhancedDifference;
      }
    }
    
    // Add contrast-based adjustment for more dramatic results
    let contrastBoost = 1.0;
    if (intensity > 150 && targetStats.contrast > sourceStats.contrast) {
      const contrastRatio = targetStats.contrast / Math.max(sourceStats.contrast, 0.01);
      contrastBoost = 1 + ((contrastRatio - 1) * (intensity - 150) / 150) * 0.3;
      
      // Apply contrast boost to saturation for more vivid colors
      saturationMultiplier *= contrastBoost;
    }
    
    // Simple hue adjustment - still 0 for this version
    const hueRotation = 0;
    
    // Clamp values to expanded but safe ranges for higher intensities
    saturationMultiplier = Math.max(0.1, Math.min(5.0, saturationMultiplier));
    brightnessMultiplier = Math.max(0.2, Math.min(3.0, brightnessMultiplier));
    
    return {
      saturationMultiplier,
      brightnessMultiplier,
      hueRotation
    };
  }

  /**
   * Applies color adjustments to an image using Sharp
   * @param buffer Source image buffer
   * @param adjustment Color adjustment parameters
   * @returns Adjusted image buffer
   */
  async applyColorAdjustment(buffer: Buffer, adjustment: ColorAdjustment): Promise<Buffer> {
    const image = sharp(buffer);
    
    // Apply adjustments using Sharp's modulate function
    // Note: Only include hue if it's a valid number and not 0
    const modulateOptions: any = {
      brightness: adjustment.brightnessMultiplier,
      saturation: adjustment.saturationMultiplier
    };
    
    // Only add hue if it's a valid number and not zero
    if (typeof adjustment.hueRotation === 'number' && adjustment.hueRotation !== 0) {
      modulateOptions.hue = adjustment.hueRotation;
    }
    
    const result = await image
      .modulate(modulateOptions)
      .png()
      .toBuffer();
    
    return result;
  }

  /**
   * Convenience method to match one image to another's color characteristics
   * @param sourceBuffer Image to adjust
   * @param referenceBuffer Reference image
   * @param intensity Adjustment intensity (0-200)
   * @returns Adjusted image buffer
   */
  async matchColorsToReference(sourceBuffer: Buffer, referenceBuffer: Buffer, intensity: number = 100): Promise<Buffer> {
    console.log('Analyzing reference image for color matching...');
    const referenceStats = await this.analyzeImage(referenceBuffer);
    
    console.log('Analyzing source image...');
    const sourceStats = await this.analyzeImage(sourceBuffer);
    
    console.log('Reference stats:', {
      saturation: referenceStats.saturation.toFixed(3),
      brightness: referenceStats.brightness.toFixed(3),
      contrast: referenceStats.contrast.toFixed(3)
    });
    
    console.log('Source stats:', {
      saturation: sourceStats.saturation.toFixed(3),
      brightness: sourceStats.brightness.toFixed(3),
      contrast: sourceStats.contrast.toFixed(3)
    });
    
    const adjustment = this.calculateAdjustment(sourceStats, referenceStats, intensity);
    
    console.log('Applying adjustment:', {
      saturationMultiplier: adjustment.saturationMultiplier.toFixed(3),
      brightnessMultiplier: adjustment.brightnessMultiplier.toFixed(3),
      intensity: intensity
    });
    
    return await this.applyColorAdjustment(sourceBuffer, adjustment);
  }

  /**
   * Generates a preview-sized version of color-matched image
   * @param sourceBuffer Source image buffer
   * @param referenceBuffer Reference image buffer
   * @param intensity Adjustment intensity
   * @param previewSize Maximum dimension for preview (default: 400)
   * @returns Preview-sized adjusted image buffer
   */
  async generatePreview(
    sourceBuffer: Buffer, 
    referenceBuffer: Buffer, 
    intensity: number = 100, 
    previewSize: number = 400
  ): Promise<Buffer> {
    // First apply color matching
    const matchedBuffer = await this.matchColorsToReference(sourceBuffer, referenceBuffer, intensity);
    
    // Then resize for preview
    const image = sharp(matchedBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not get image dimensions for preview');
    }
    
    // Calculate resize dimensions maintaining aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    let newWidth: number;
    let newHeight: number;
    
    if (aspectRatio > 1) {
      newWidth = Math.min(previewSize, metadata.width);
      newHeight = Math.round(newWidth / aspectRatio);
    } else {
      newHeight = Math.min(previewSize, metadata.height);
      newWidth = Math.round(newHeight * aspectRatio);
    }
    
    return await image
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();
  }

  /**
   * Batch process multiple images to match reference
   * @param sourceBuffers Array of source image buffers
   * @param referenceBuffer Reference image buffer
   * @param intensity Adjustment intensity
   * @returns Array of adjusted image buffers
   */
  async batchMatchColors(
    sourceBuffers: Buffer[], 
    referenceBuffer: Buffer, 
    intensity: number = 100
  ): Promise<Buffer[]> {
    console.log(`Starting batch color matching for ${sourceBuffers.length} images...`);
    
    // Analyze reference once
    const referenceStats = await this.analyzeImage(referenceBuffer);
    console.log('Reference analysis complete');
    
    const results: Buffer[] = [];
    
    for (let i = 0; i < sourceBuffers.length; i++) {
      console.log(`Processing image ${i + 1}/${sourceBuffers.length}`);
      
      try {
        const sourceStats = await this.analyzeImage(sourceBuffers[i]);
        const adjustment = this.calculateAdjustment(sourceStats, referenceStats, intensity);
        const adjustedBuffer = await this.applyColorAdjustment(sourceBuffers[i], adjustment);
        
        results.push(adjustedBuffer);
        
        console.log(`Image ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        // In case of error, return original image
        results.push(sourceBuffers[i]);
      }
    }
    
    console.log('Batch color matching complete');
    return results;
  }

  /**
   * Advanced color matching with individual parameter control
   * @param sourceBuffer Image to adjust
   * @param referenceBuffer Reference image
   * @param options Advanced color options
   * @returns Adjusted image buffer
   */
  async matchColorsToReferenceAdvanced(sourceBuffer: Buffer, referenceBuffer: Buffer, options: AdvancedColorOptions): Promise<Buffer> {
    console.log('Advanced color matching with options:', options);
    
    // Start with basic color matching if intensity > 0
    let processedBuffer = sourceBuffer;
    
    if (options.intensity > 0) {
      processedBuffer = await this.matchColorsToReference(sourceBuffer, referenceBuffer, options.intensity);
    }
    
    // Apply individual adjustments
    processedBuffer = await this.applyAdvancedAdjustments(processedBuffer, options);
    
    return processedBuffer;
  }

  /**
   * Advanced preview generation with all parameters
   * @param sourceBuffer Source image buffer
   * @param referenceBuffer Reference image buffer
   * @param options Advanced color options
   * @param previewSize Maximum dimension for preview
   * @returns Preview-sized adjusted image buffer
   */
  async generatePreviewAdvanced(
    sourceBuffer: Buffer, 
    referenceBuffer: Buffer, 
    options: AdvancedColorOptions,
    previewSize: number = 400
  ): Promise<Buffer> {
    // Apply advanced color matching
    const matchedBuffer = await this.matchColorsToReferenceAdvanced(sourceBuffer, referenceBuffer, options);
    
    // Resize for preview
    const image = sharp(matchedBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not get image dimensions for preview');
    }
    
    // Calculate resize dimensions maintaining aspect ratio
    const aspectRatio = metadata.width / metadata.height;
    let newWidth: number;
    let newHeight: number;
    
    if (aspectRatio > 1) {
      newWidth = Math.min(previewSize, metadata.width);
      newHeight = Math.round(newWidth / aspectRatio);
    } else {
      newHeight = Math.min(previewSize, metadata.height);
      newWidth = Math.round(newHeight * aspectRatio);
    }
    
    return await image
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();
  }

  /**
   * Apply advanced adjustments using Sharp.js features
   * @param buffer Image buffer to process
   * @param options Advanced color options
   * @returns Processed image buffer
   */
  private async applyAdvancedAdjustments(buffer: Buffer, options: AdvancedColorOptions): Promise<Buffer> {
    let image = sharp(buffer);
    
    // Apply individual color adjustments if they differ from 100% (default)
    const needsColorAdjustment = 
      options.saturationBoost !== 100 || 
      options.brightnessBoost !== 100 || 
      options.hueShift !== 0;
    
    if (needsColorAdjustment) {
      const saturationMult = options.saturationBoost / 100;
      const brightnessMult = options.brightnessBoost / 100;
      
      const modulateOptions: any = {
        brightness: brightnessMult,
        saturation: saturationMult
      };
      
      if (options.hueShift !== 0) {
        modulateOptions.hue = options.hueShift;
      }
      
      image = image.modulate(modulateOptions);
    }
    
    // Apply contrast adjustment
    if (options.contrastBoost !== 100) {
      const contrastFactor = options.contrastBoost / 100;
      
      // Use linear() for contrast adjustment
      const a = contrastFactor;
      const b = (1 - contrastFactor) * 127.5; // Center point adjustment
      
      image = image.linear(a, b);
    }
    
    // Apply gamma correction
    if (options.gamma !== 1.0) {
      image = image.gamma(options.gamma);
    }
    
    // Apply sharpening
    if (options.sharpness !== 100) {
      if (options.sharpness > 100) {
        // Sharpen more than default
        const sigma = Math.max(0.5, 2 - (options.sharpness - 100) / 100);
        const flat = Math.min(2, (options.sharpness - 100) / 50);
        const jagged = Math.min(3, (options.sharpness - 100) / 50);
        
        image = image.sharpen(sigma, flat, jagged);
      } else if (options.sharpness < 100) {
        // Apply slight blur for sharpness < 100%
        const blurAmount = (100 - options.sharpness) / 100 * 2;
        image = image.blur(blurAmount);
      }
    }
    
    // Apply noise reduction
    if (options.noiseReduction > 0) {
      // Use median filter for noise reduction
      const medianSize = Math.max(1, Math.min(5, Math.floor(options.noiseReduction / 20)));
      image = image.median(medianSize);
    }
    
    // Ensure PNG output
    return await image.png().toBuffer();
  }
}