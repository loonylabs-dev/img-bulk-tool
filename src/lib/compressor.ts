// @ts-ignore
import imagemin from 'imagemin';
// @ts-ignore
import imageminPngquant from 'imagemin-pngquant';
// @ts-ignore
import imageminOptipng from 'imagemin-optipng';
import sharp from 'sharp';

export class Compressor {
  async compressPNG(buffer: Buffer, quality: number = 85): Promise<Buffer> {
    console.log(`Compressor: Starting PNG compression with quality ${quality}, input size: ${buffer.length} bytes`);

    try {
      // Validate input buffer
      if (!buffer || buffer.length === 0) {
        throw new Error('Input buffer is empty or invalid');
      }

      // Erst mit sharp verarbeiten für konsistentes PNG-Format
      console.log('Compressor: Processing with Sharp...');
      const sharpBuffer = await sharp(buffer)
        .png({ compressionLevel: 9 })
        .toBuffer();

      console.log(`Compressor: Sharp processing completed: ${buffer.length} -> ${sharpBuffer.length} bytes`);

      // Dann mit imagemin optimieren
      const minQuality = Math.max(0.3, (quality - 15) / 100);
      const maxQuality = Math.min(1, quality / 100);

      console.log(`Compressor: Starting imagemin optimization with quality range [${minQuality}, ${maxQuality}]`);
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

      console.log(`Compressor: Compression completed successfully: ${sharpBuffer.length} -> ${compressed.length} bytes`);
      return compressed;
    } catch (error) {
      console.error('Compressor: Error during compression, using fallback:', error);
      // Fallback: Nur Sharp-Komprimierung verwenden
      try {
        const fallbackResult = await sharp(buffer)
          .png({
            compressionLevel: 9,
            quality: quality
          })
          .toBuffer();

        console.log(`Compressor: Fallback compression completed: ${buffer.length} -> ${fallbackResult.length} bytes`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error('Compressor: Fallback compression also failed:', fallbackError);
        throw new Error(`Compression failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
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