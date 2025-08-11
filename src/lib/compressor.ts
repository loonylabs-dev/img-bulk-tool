// @ts-ignore
import imagemin from 'imagemin';
// @ts-ignore
import imageminPngquant from 'imagemin-pngquant';
// @ts-ignore
import imageminOptipng from 'imagemin-optipng';
import sharp from 'sharp';

export class Compressor {
  async compressPNG(buffer: Buffer, quality: number = 85): Promise<Buffer> {
    try {
      // Erst mit sharp verarbeiten für konsistentes PNG-Format
      const sharpBuffer = await sharp(buffer)
        .png({ compressionLevel: 9 })
        .toBuffer();

      // Dann mit imagemin optimieren
      const minQuality = Math.max(0.3, (quality - 15) / 100);
      const maxQuality = Math.min(1, quality / 100);
      
      const compressed = await imagemin.buffer(sharpBuffer, {
        plugins: [
          imageminPngquant({
            quality: [minQuality, maxQuality],
            speed: 1,
            strip: true,
            dithering: 0.5
          }),
          imageminOptipng({
            optimizationLevel: 3
          })
        ]
      });

      return compressed;
    } catch (error) {
      console.error('Komprimierungsfehler, verwende Original:', error);
      // Fallback: Nur Sharp-Komprimierung verwenden
      return await sharp(buffer)
        .png({ 
          compressionLevel: 9,
          quality: quality
        })
        .toBuffer();
    }
  }

  async compressJPEG(buffer: Buffer, quality: number = 85): Promise<Buffer> {
    return await sharp(buffer)
      .jpeg({ 
        quality: quality,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();
  }

  async estimateCompression(originalSize: number, quality: number): Promise<number> {
    // Schätzung der Komprimierungsrate basierend auf Qualität
    const compressionRate = 1 - (0.6 * (100 - quality) / 100);
    return Math.round(originalSize * compressionRate);
  }
}