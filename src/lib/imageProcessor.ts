import sharp from 'sharp';

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
}