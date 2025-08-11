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
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Bildabmessungen konnten nicht ermittelt werden');
    }

    // Ensure image has alpha channel
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasContent = false;

    // Analyze pixel by pixel for content
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * channels;
        const alpha = data[pixelIndex + 3]; // Alpha channel
        
        if (alpha > tolerance) { // Pixel is not transparent
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

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

  async cropToContent(buffer: Buffer, options: CropOptions = { padding: 20, tolerance: 10, minContentRatio: 0.1 }): Promise<Buffer> {
    const contentBounds = await this.analyzeImageContent(buffer, options.tolerance);
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height || !contentBounds.hasContent) {
      return buffer; // Return original if no content found
    }

    const { width: originalWidth, height: originalHeight } = metadata;
    const contentRatio = (contentBounds.width * contentBounds.height) / (originalWidth * originalHeight);
    
    // If content is too small compared to image, don't crop aggressively
    if (contentRatio < options.minContentRatio) {
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
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Bildabmessungen konnten nicht ermittelt werden');
    }

    // The transformation.scale from frontend is already adjusted for preview
    // We need to reverse-calculate the actual intended scale for the output size
    
    const canvasSize = 400; // Canvas preview size from frontend
    
    // Calculate the canvas to output ratio (same as frontend)
    const canvasToOutputRatio = canvasSize / outputSize;
    
    // The transformation.scale is relative to this preview scale
    // To get the final scale for output, we need to reverse the canvas adjustment
    const finalScaleForOutput = (transformation.scale / canvasToOutputRatio);
    
    // Calculate final dimensions
    const finalWidth = Math.max(1, Math.min(outputSize, Math.round(metadata.width * finalScaleForOutput)));
    const finalHeight = Math.max(1, Math.min(outputSize, Math.round(metadata.height * finalScaleForOutput)));
    
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
}