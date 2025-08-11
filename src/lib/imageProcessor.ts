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
  padding: number;
  tolerance: number; // Alpha threshold (0-255)
  minContentRatio: number; // Minimum content vs total image ratio
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

    // Calculate new dimensions with padding
    const newWidth = contentBounds.width + (options.padding * 2);
    const newHeight = contentBounds.height + (options.padding * 2);
    
    // Calculate crop position to center the content
    const cropLeft = Math.max(0, contentBounds.left - options.padding);
    const cropTop = Math.max(0, contentBounds.top - options.padding);
    const cropWidth = Math.min(newWidth, originalWidth - cropLeft);
    const cropHeight = Math.min(newHeight, originalHeight - cropTop);

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
}