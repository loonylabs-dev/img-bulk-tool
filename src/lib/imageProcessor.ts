import sharp from 'sharp';

interface ContentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  hasContent: boolean;
}

interface CropOptions {
  padding?: number; // Uniform padding (legacy)
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  tolerance: number; // Alpha threshold (0-255)
  minContentRatio: number; // Minimum content vs total image ratio
}

interface LayerTransformation {
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  name?: string;
  cropEnabled?: boolean;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

interface AspectRatioCropOptions {
  aspectRatio: string; // e.g., "16:9", "4:3", "1:1"
  positionX: number; // 0-100% horizontal position
  positionY: number; // 0-100% vertical position
}

export class ImageProcessor {
  async splitImage(buffer: Buffer): Promise<Buffer[]> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Bildabmessungen konnten nicht ermittelt werden');
    }

    const halfWidth = Math.floor(metadata.width / 2);
    const halfHeight = Math.floor(metadata.height / 2);
    
    const parts: Buffer[] = [];
    
    // Oben links (1)
    parts.push(await sharp(buffer)
      .extract({ left: 0, top: 0, width: halfWidth, height: halfHeight })
      .png()
      .toBuffer());
    
    // Oben rechts (2)
    parts.push(await sharp(buffer)
      .extract({ left: halfWidth, top: 0, width: halfWidth, height: halfHeight })
      .png()
      .toBuffer());
    
    // Unten links (3)
    parts.push(await sharp(buffer)
      .extract({ left: 0, top: halfHeight, width: halfWidth, height: halfHeight })
      .png()
      .toBuffer());
    
    // Unten rechts (4)
    parts.push(await sharp(buffer)
      .extract({ left: halfWidth, top: halfHeight, width: halfWidth, height: halfHeight })
      .png()
      .toBuffer());
    
    return parts;
  }

  async resizeImage(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    return await sharp(buffer)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
  }

  async getImageInfo(buffer: Buffer): Promise<sharp.Metadata> {
    return await sharp(buffer).metadata();
  }

  async analyzeImageContent(buffer: Buffer, tolerance: number = 10): Promise<ContentBounds> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    console.log('Original image metadata:', metadata);
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Bildabmessungen konnten nicht ermittelt werden');
    }

    // Strategy 1: Try alpha-based detection first if image has alpha
    if (metadata.hasAlpha) {
      console.log('Using alpha-based detection');
      return this.analyzeAlphaContent(image, metadata, tolerance);
    }
    
    // Strategy 2: Try indexed color detection for palette-based PNGs
    if (metadata.format === 'png' && metadata.channels && metadata.channels <= 2) {
      console.log('Detected possible indexed color PNG, trying palette analysis');
      try {
        return await this.analyzeIndexedContent(image, metadata, tolerance);
      } catch (e) {
        console.log('Indexed analysis failed, falling back to color-based');
      }
    }
    
    // Strategy 3: Color-based detection (white/black/uniform background)
    console.log('Using color-based detection');
    return this.analyzeColorContent(image, metadata, tolerance);
  }

  private async analyzeAlphaContent(image: sharp.Sharp, _metadata: sharp.Metadata, tolerance: number): Promise<ContentBounds> {
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    console.log('Raw image info after ensureAlpha:', info);

    const { width, height, channels } = info;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasContent = false;
    
    // Debug: count different alpha levels
    let fullyTransparent = 0;
    let partiallyTransparent = 0;
    let fullyOpaque = 0;

    // Analyze pixel by pixel for content
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * channels;
        const alpha = data[pixelIndex + 3]; // Alpha channel
        
        // Debug counting
        if (alpha === 0) fullyTransparent++;
        else if (alpha === 255) fullyOpaque++;
        else partiallyTransparent++;
        
        if (alpha > tolerance) { // Pixel is not transparent
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    console.log('Alpha analysis:', {
      totalPixels: width * height,
      fullyTransparent,
      partiallyTransparent,
      fullyOpaque,
      tolerance,
      percentTransparent: Math.round((fullyTransparent / (width * height)) * 100)
    });
    
    // Sample some alpha values for debugging
    const sampleAlpha = [];
    for (let i = 0; i < Math.min(20, width * height); i++) {
      const pixelIndex = i * channels;
      sampleAlpha.push(data[pixelIndex + 3]);
    }
    console.log('Sample alpha values (first 20 pixels):', sampleAlpha);

    if (!hasContent) {
      return {
        left: 0,
        top: 0,
        width: width,
        height: height,
        centerX: width / 2,
        centerY: height / 2,
        hasContent: false
      };
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    return {
      left: minX,
      top: minY,
      width: contentWidth,
      height: contentHeight,
      centerX,
      centerY,
      hasContent: true
    };
  }

  private async analyzeIndexedContent(image: sharp.Sharp, _metadata: sharp.Metadata, tolerance: number): Promise<ContentBounds> {
    // For indexed PNGs, convert to RGBA first to get proper alpha values
    const { data, info } = await image
      .png({ palette: false }) // Expand palette to full color
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * channels;
        const alpha = data[pixelIndex + 3];
        
        if (alpha > tolerance) {
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasContent) {
      return { left: 0, top: 0, width, height, centerX: width/2, centerY: height/2, hasContent: false };
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    
    return {
      left: minX,
      top: minY,
      width: contentWidth,
      height: contentHeight,
      centerX: minX + contentWidth / 2,
      centerY: minY + contentHeight / 2,
      hasContent: true
    };
  }

  private async analyzeColorContent(image: sharp.Sharp, metadata: sharp.Metadata, tolerance: number): Promise<ContentBounds> {
    const { width, height } = metadata;
    if (!width || !height) {
      throw new Error('Invalid image dimensions');
    }

    // Get RGB data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { channels } = info;
    console.log('Color analysis - channels:', channels);

    // Detect background color by sampling corners
    const cornerSamples = [
      this.getPixelColor(data, 0, 0, width, channels),                    // top-left
      this.getPixelColor(data, width-1, 0, width, channels),             // top-right
      this.getPixelColor(data, 0, height-1, width, channels),            // bottom-left
      this.getPixelColor(data, width-1, height-1, width, channels)       // bottom-right
    ];

    console.log('Corner samples:', cornerSamples);

    // Find most common corner color as background
    const bgColor = this.findBackgroundColor(cornerSamples);
    console.log('Detected background color:', bgColor);

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasContent = false;

    // Scan for pixels that differ from background by more than tolerance
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelColor = this.getPixelColor(data, x, y, width, channels);
        const colorDiff = this.getColorDistance(pixelColor, bgColor);
        
        if (colorDiff > tolerance) {
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasContent) {
      return { left: 0, top: 0, width, height, centerX: width/2, centerY: height/2, hasContent: false };
    }

    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    
    console.log('Color-based content bounds:', { minX, maxX, minY, maxY, contentWidth, contentHeight });

    return {
      left: minX,
      top: minY,
      width: contentWidth,
      height: contentHeight,
      centerX: minX + contentWidth / 2,
      centerY: minY + contentHeight / 2,
      hasContent: true
    };
  }

  private getPixelColor(data: Buffer, x: number, y: number, width: number, channels: number): number[] {
    const pixelIndex = (y * width + x) * channels;
    const color = [];
    for (let c = 0; c < Math.min(channels, 3); c++) {
      color.push(data[pixelIndex + c]);
    }
    // Pad with 0s if less than 3 channels
    while (color.length < 3) color.push(0);
    return color;
  }

  private findBackgroundColor(cornerSamples: number[][]): number[] {
    // Simple approach: use top-left corner as background
    // Could be enhanced with more sophisticated detection
    return cornerSamples[0];
  }

  private getColorDistance(color1: number[], color2: number[]): number {
    // Euclidean distance in RGB space
    const rDiff = color1[0] - color2[0];
    const gDiff = color1[1] - color2[1];
    const bDiff = color1[2] - color2[2];
    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  }

  async cropToContent(buffer: Buffer, options: CropOptions = { padding: 20, tolerance: 10, minContentRatio: 0.1 }): Promise<Buffer> {
    console.log('cropToContent called with options:', options);
    const contentBounds = await this.analyzeImageContent(buffer, options.tolerance);
    console.log('Content bounds detected:', contentBounds);
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height || !contentBounds.hasContent) {
      console.log('No content found or invalid metadata, returning original');
      return buffer; // Return original if no content found
    }

    const { width: originalWidth, height: originalHeight } = metadata;
    const contentRatio = (contentBounds.width * contentBounds.height) / (originalWidth * originalHeight);
    console.log('Content ratio:', contentRatio, 'Min ratio:', options.minContentRatio);
    
    // If content is too small compared to image, don't crop aggressively
    if (contentRatio < options.minContentRatio) {
      console.log('Content ratio too small, returning original');
      return buffer;
    }

    // Get individual padding values (fallback to uniform padding)
    const paddingTop = options.paddingTop ?? options.padding ?? 20;
    const paddingRight = options.paddingRight ?? options.padding ?? 20;
    const paddingBottom = options.paddingBottom ?? options.padding ?? 20;
    const paddingLeft = options.paddingLeft ?? options.padding ?? 20;

    // Calculate crop position with individual padding
    const cropLeft = Math.max(0, contentBounds.left - paddingLeft);
    const cropTop = Math.max(0, contentBounds.top - paddingTop);
    const cropWidth = Math.min(
      contentBounds.width + paddingLeft + paddingRight,
      originalWidth - cropLeft
    );
    const cropHeight = Math.min(
      contentBounds.height + paddingTop + paddingBottom,
      originalHeight - cropTop
    );

    console.log('Cropping with dimensions:', {
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
      padding: { top: paddingTop, right: paddingRight, bottom: paddingBottom, left: paddingLeft }
    });

    return await sharp(buffer)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight
      })
      .png()
      .toBuffer();
  }

  async findContentCenter(buffer: Buffer, tolerance: number = 10): Promise<{x: number, y: number}> {
    const contentBounds = await this.analyzeImageContent(buffer, tolerance);
    return {
      x: contentBounds.centerX,
      y: contentBounds.centerY
    };
  }

  async smartCropAndResize(buffer: Buffer, width: number, height: number, cropOptions?: CropOptions): Promise<Buffer> {
    // First crop to content
    const croppedBuffer = await this.cropToContent(buffer, cropOptions);
    
    // Then resize to target dimensions
    return await this.resizeImage(croppedBuffer, width, height);
  }

  async smartCropAndSplit(buffer: Buffer, cropOptions?: CropOptions): Promise<Buffer[]> {
    // First crop to content
    const croppedBuffer = await this.cropToContent(buffer, cropOptions);
    
    // Then split into 4 parts
    return await this.splitImage(croppedBuffer);
  }

  async autoTrimAndResize(buffer: Buffer, targetWidth: number, targetHeight: number, autoTrimOptions?: CropOptions): Promise<Buffer> {
    console.log('autoTrimAndResize called with target size:', { targetWidth, targetHeight });
    
    // First, apply auto-trim to remove transparent areas
    const trimmedBuffer = await this.cropToContent(buffer, autoTrimOptions);
    const trimmedMetadata = await sharp(trimmedBuffer).metadata();
    
    console.log('After auto-trim:', { width: trimmedMetadata.width, height: trimmedMetadata.height });
    
    if (!trimmedMetadata.width || !trimmedMetadata.height) {
      throw new Error('Could not get dimensions after auto-trim');
    }

    // Calculate the scale factor to fit the trimmed content into target size while maintaining aspect ratio
    const scaleX = targetWidth / trimmedMetadata.width;
    const scaleY = targetHeight / trimmedMetadata.height;
    const scale = Math.min(scaleX, scaleY); // Use the smaller scale to ensure it fits

    // Calculate the scaled dimensions
    const scaledWidth = Math.round(trimmedMetadata.width * scale);
    const scaledHeight = Math.round(trimmedMetadata.height * scale);

    console.log('Calculated scale and dimensions:', { scale, scaledWidth, scaledHeight });

    // Resize the trimmed image to fit within target dimensions
    const scaledBuffer = await sharp(trimmedBuffer)
      .resize(scaledWidth, scaledHeight, {
        fit: 'fill' // We already calculated exact dimensions, so fill is appropriate
      })
      .png()
      .toBuffer();

    // Create a new image with exact target dimensions and transparent background
    const targetCanvas = sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Center the scaled image on the target canvas
    const offsetX = Math.round((targetWidth - scaledWidth) / 2);
    const offsetY = Math.round((targetHeight - scaledHeight) / 2);

    console.log('Centering with offsets:', { offsetX, offsetY });

    // Composite the scaled image onto the target canvas
    const result = await targetCanvas
      .composite([{
        input: scaledBuffer,
        left: offsetX,
        top: offsetY
      }])
      .png()
      .toBuffer();

    // Verify final dimensions
    const finalMetadata = await sharp(result).metadata();
    console.log('Final result dimensions:', { width: finalMetadata.width, height: finalMetadata.height });

    return result;
  }

  async processLayerImage(buffer: Buffer, transformation: LayerTransformation, outputSize: number): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Bildabmessungen konnten nicht ermittelt werden');
    }

    // The scale from frontend now represents the final size relative to output size
    // We need to calculate the actual pixel dimensions
    
    // First, calculate what the image would be at "fit-to-output" scale (scale = 1.0 equivalent)
    const baseScaleToFit = Math.min(outputSize / metadata.width, outputSize / metadata.height);
    const baseFitWidth = Math.round(metadata.width * baseScaleToFit);
    const baseFitHeight = Math.round(metadata.height * baseScaleToFit);
    
    // Apply the user's scale factor on top of the fit-to-output scale
    const finalWidth = Math.round(baseFitWidth * transformation.scale);
    const finalHeight = Math.round(baseFitHeight * transformation.scale);
    
    // Create output canvas
    const outputCanvas = sharp({
      create: {
        width: outputSize,
        height: outputSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Position the scaled image on the canvas
    const centerX = Math.round(outputSize / 2);
    const centerY = Math.round(outputSize / 2);
    const left = Math.round(centerX + transformation.x - finalWidth / 2);
    const top = Math.round(centerY + transformation.y - finalHeight / 2);

    // First resize the image to final dimensions
    const scaledImageBuffer = await image
      .resize(finalWidth, finalHeight, {
        fit: 'fill'
      })
      .png()
      .toBuffer();

    // Composite the scaled image onto the canvas
    const result = await outputCanvas
      .composite([{
        input: scaledImageBuffer,
        left: left,
        top: top
      }])
      .png()
      .toBuffer();

    return result;
  }

  async composeLayerImage(
    layers: { buffer: Buffer; transformation: LayerTransformation; filename: string }[],
    outputSize: number
  ): Promise<Buffer> {
    // Create output canvas
    const outputCanvas = sharp({
      create: {
        width: outputSize,
        height: outputSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const compositeInputs = [];

    // Process each layer
    for (const layer of layers) {
      const image = sharp(layer.buffer);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        console.warn(`Skipping layer ${layer.filename}: Could not get dimensions`);
        continue;
      }

      // Calculate dimensions - same logic as processLayerImage
      const baseScaleToFit = Math.min(outputSize / metadata.width, outputSize / metadata.height);
      const baseFitWidth = Math.round(metadata.width * baseScaleToFit);
      const baseFitHeight = Math.round(metadata.height * baseScaleToFit);
      
      const finalWidth = Math.round(baseFitWidth * layer.transformation.scale);
      const finalHeight = Math.round(baseFitHeight * layer.transformation.scale);
      
      // Position calculation - same logic as processLayerImage
      const centerX = Math.round(outputSize / 2);
      const centerY = Math.round(outputSize / 2);
      const left = Math.round(centerX + layer.transformation.x - finalWidth / 2);
      const top = Math.round(centerY + layer.transformation.y - finalHeight / 2);

      // Scale the image
      const scaledImageBuffer = await image
        .resize(finalWidth, finalHeight, {
          fit: 'fill'
        })
        .png()
        .toBuffer();

      // Add to composite inputs
      compositeInputs.push({
        input: scaledImageBuffer,
        left: left,
        top: top
      });
    }

    // Compose all layers
    const result = await outputCanvas
      .composite(compositeInputs)
      .png()
      .toBuffer();

    return result;
  }

  async processLayerImageCorrected(buffer: Buffer, transformation: LayerTransformation, outputSize: number): Promise<Buffer> {
    let processedBuffer = buffer;
    let actualWidth: number;
    let actualHeight: number;
    
    // Get initial metadata
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Bildabmessungen konnten nicht ermittelt werden');
    }
    
    actualWidth = metadata.width;
    actualHeight = metadata.height;
    
    // Apply cropping if enabled
    if (transformation.cropEnabled) {
      const cropX = transformation.cropX ?? 0;
      const cropY = transformation.cropY ?? 0;
      const cropWidth = transformation.cropWidth ?? 100;
      const cropHeight = transformation.cropHeight ?? 100;
      
      // Calculate crop area in pixels
      const cropXPixels = Math.round(cropX * metadata.width / 100);
      const cropYPixels = Math.round(cropY * metadata.height / 100);
      const cropWidthPixels = Math.round(cropWidth * metadata.width / 100);
      const cropHeightPixels = Math.round(cropHeight * metadata.height / 100);
      
      // Ensure crop doesn't exceed image bounds
      const finalCropWidth = Math.min(cropWidthPixels, metadata.width - cropXPixels);
      const finalCropHeight = Math.min(cropHeightPixels, metadata.height - cropYPixels);
      
      // Apply crop
      processedBuffer = await sharp(buffer)
        .extract({
          left: cropXPixels,
          top: cropYPixels,
          width: finalCropWidth,
          height: finalCropHeight
        })
        .toBuffer();
      
      // Update dimensions after crop
      actualWidth = finalCropWidth;
      actualHeight = finalCropHeight;
    }

    // The transformation.scale from frontend is already adjusted for preview
    // We need to reverse-calculate the actual intended scale for the output size
    
    const canvasSize = 400; // Canvas preview size from frontend
    
    // Calculate the canvas to output ratio (same as frontend)
    const canvasToOutputRatio = canvasSize / outputSize;
    
    // The transformation.scale is relative to this preview scale
    // To get the final scale for output, we need to reverse the canvas adjustment
    const finalScaleForOutput = (transformation.scale / canvasToOutputRatio);
    
    // Calculate final dimensions using actual (possibly cropped) dimensions
    const finalWidth = Math.max(1, Math.min(outputSize, Math.round(actualWidth * finalScaleForOutput)));
    const finalHeight = Math.max(1, Math.min(outputSize, Math.round(actualHeight * finalScaleForOutput)));
    
    // Create output canvas
    const outputCanvas = sharp({
      create: {
        width: outputSize,
        height: outputSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Position calculation - scale position same way
    const positionScaleAdjustment = outputSize / canvasSize;
    const centerX = Math.round(outputSize / 2);
    const centerY = Math.round(outputSize / 2);
    const left = Math.max(0, Math.min(outputSize - finalWidth, Math.round(centerX + (transformation.x * positionScaleAdjustment) - finalWidth / 2)));
    const top = Math.max(0, Math.min(outputSize - finalHeight, Math.round(centerY + (transformation.y * positionScaleAdjustment) - finalHeight / 2)));

    // First resize the image to final dimensions
    const scaledImageBuffer = await sharp(processedBuffer)
      .resize(finalWidth, finalHeight, {
        fit: 'fill'
      })
      .png()
      .toBuffer();

    // Composite the scaled image onto the canvas
    const result = await outputCanvas
      .composite([{
        input: scaledImageBuffer,
        left: left,
        top: top
      }])
      .png()
      .toBuffer();

    return result;
  }

  async cropToAspectRatio(buffer: Buffer, options: AspectRatioCropOptions): Promise<Buffer> {
    try {
      console.log(`Starting cropToAspectRatio with options:`, options);

      const image = sharp(buffer);
      const metadata = await image.metadata();

      console.log(`Image metadata:`, { width: metadata.width, height: metadata.height, format: metadata.format });

      if (!metadata.width || !metadata.height) {
        throw new Error('Could not determine image dimensions');
      }

      // Validate input parameters
      if (!options.aspectRatio || typeof options.aspectRatio !== 'string') {
        throw new Error('Invalid aspect ratio format');
      }

      if (typeof options.positionX !== 'number' || typeof options.positionY !== 'number') {
        throw new Error('Invalid position parameters');
      }

      if (options.positionX < 0 || options.positionX > 100 || options.positionY < 0 || options.positionY > 100) {
        throw new Error('Position parameters must be between 0 and 100');
      }

      // Parse aspect ratio
      const aspectParts = options.aspectRatio.split(':');
      if (aspectParts.length !== 2) {
        throw new Error('Aspect ratio must be in format "width:height"');
      }

      const [ratioWidthStr, ratioHeightStr] = aspectParts;
      const ratioWidth = parseFloat(ratioWidthStr);
      const ratioHeight = parseFloat(ratioHeightStr);

      if (!ratioWidth || !ratioHeight || ratioWidth <= 0 || ratioHeight <= 0 || isNaN(ratioWidth) || isNaN(ratioHeight)) {
        throw new Error('Invalid aspect ratio values');
      }

      console.log(`Parsed aspect ratio: ${ratioWidth}:${ratioHeight}`);

      const targetRatio = ratioWidth / ratioHeight;
      const sourceRatio = metadata.width / metadata.height;

      console.log(`Target ratio: ${targetRatio}, Source ratio: ${sourceRatio}`);

      let cropWidth: number;
      let cropHeight: number;

      // Calculate crop dimensions to fit target aspect ratio
      if (sourceRatio > targetRatio) {
        // Source is wider than target ratio - crop width
        cropHeight = metadata.height;
        cropWidth = Math.round(cropHeight * targetRatio);
      } else {
        // Source is taller than target ratio - crop height
        cropWidth = metadata.width;
        cropHeight = Math.round(cropWidth / targetRatio);
      }

      // Validate crop dimensions
      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error('Calculated crop dimensions are invalid');
      }

      if (cropWidth > metadata.width || cropHeight > metadata.height) {
        throw new Error('Calculated crop dimensions exceed image size');
      }

      console.log(`Calculated crop dimensions: ${cropWidth}x${cropHeight}`);

      // Calculate crop position based on percentage
      const maxX = metadata.width - cropWidth;
      const maxY = metadata.height - cropHeight;

      // Ensure maxX and maxY are not negative
      if (maxX < 0 || maxY < 0) {
        throw new Error('Image is too small for the requested aspect ratio');
      }

      const cropX = Math.round(maxX * (options.positionX / 100));
      const cropY = Math.round(maxY * (options.positionY / 100));

      // Ensure crop area is within bounds
      const finalCropX = Math.max(0, Math.min(cropX, maxX));
      const finalCropY = Math.max(0, Math.min(cropY, maxY));

      console.log(`Final crop coordinates: x=${finalCropX}, y=${finalCropY}, width=${cropWidth}, height=${cropHeight}`);

      // Validate final coordinates
      if (finalCropX + cropWidth > metadata.width || finalCropY + cropHeight > metadata.height) {
        throw new Error('Final crop coordinates exceed image boundaries');
      }

      // Apply crop with error handling
      const croppedBuffer = await image
        .extract({
          left: finalCropX,
          top: finalCropY,
          width: cropWidth,
          height: cropHeight
        })
        .png()
        .toBuffer();

      console.log(`Crop operation completed successfully. Output size: ${croppedBuffer.length} bytes`);

      return croppedBuffer;
    } catch (error) {
      console.error('Error in cropToAspectRatio:', error);

      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Aspect ratio crop failed: ${error.message}`);
      } else {
        throw new Error('Aspect ratio crop failed: Unknown error');
      }
    }
  }
}