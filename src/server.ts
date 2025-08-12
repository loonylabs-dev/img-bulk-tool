import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { ImageProcessor } from './lib/imageProcessor';
import { Compressor } from './lib/compressor';
import { FileManager } from './lib/fileManager';

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      return cb(new Error('Nur Bilddateien sind erlaubt!'));
    }
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, '../output')));

const imageProcessor = new ImageProcessor();
const compressor = new Compressor();
const fileManager = new FileManager(path.join(__dirname, '../output'));

interface ProcessOptions {
  mode: 'split' | 'resize' | 'compress' | 'split-resize';
  quality?: number;
  width?: number;
  height?: number;
  prefix: string;
  smartCrop?: boolean;
  cropPadding?: number;
  cropPaddingTop?: number;
  cropPaddingRight?: number;
  cropPaddingBottom?: number;
  cropPaddingLeft?: number;
  cropTolerance?: number;
  autoTrim?: boolean;
  autoTrimPadding?: number;
  autoTrimTolerance?: number;
  autoTrimFixedSize?: boolean;
  autoTrimTargetWidth?: number;
  autoTrimTargetHeight?: number;
}

interface LayerTransformation {
  visible: boolean;
  scale: number;
  x: number;
  y: number;
  name?: string;
}

interface LayerProcessOptions {
  outputSize: number;
  prefix: string;
  quality: number;
}

app.post('/api/process', upload.array('images', 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const options: ProcessOptions[] = JSON.parse(req.body.options);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Keine Bilder hochgeladen' });
    }

    const results = [];
    let globalCounter = await fileManager.getNextAvailableNumber(options[0]?.prefix || 'image');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const option = options[i] || options[0];
      const processedFiles = [];

      // Debug logging
      console.log('Processing options:', {
        mode: option.mode,
        autoTrim: option.autoTrim,
        autoTrimPadding: option.autoTrimPadding,
        autoTrimTolerance: option.autoTrimTolerance,
        smartCrop: option.smartCrop,
        cropTolerance: option.cropTolerance
      });

      // Create auto-trim options if enabled
      const autoTrimOptions = option.autoTrim ? {
        padding: option.autoTrimPadding || 0,
        tolerance: option.autoTrimTolerance || 100, // Use dedicated auto-trim tolerance
        minContentRatio: 0.01 // Lower threshold for auto-trim
      } : undefined;

      // Create crop options if smart crop is enabled
      const cropOptions = option.smartCrop ? {
        padding: option.cropPadding || 20,
        paddingTop: option.cropPaddingTop,
        paddingRight: option.cropPaddingRight,
        paddingBottom: option.cropPaddingBottom,
        paddingLeft: option.cropPaddingLeft,
        tolerance: option.cropTolerance || 10,
        minContentRatio: 0.1
      } : undefined;

      // Apply auto-trim first if enabled
      let processBuffer = file.buffer;
      if (option.autoTrim && autoTrimOptions) {
        console.log('Applying auto-trim with options:', autoTrimOptions);
        const originalMetadata = await imageProcessor.getImageInfo(file.buffer);
        processBuffer = await imageProcessor.cropToContent(file.buffer, autoTrimOptions);
        const newMetadata = await imageProcessor.getImageInfo(processBuffer);
        console.log('Auto-trim result:', {
          original: { width: originalMetadata.width, height: originalMetadata.height },
          trimmed: { width: newMetadata.width, height: newMetadata.height }
        });
      } else {
        console.log('Auto-trim NOT applied. autoTrim:', option.autoTrim, 'autoTrimOptions:', autoTrimOptions);
      }

      switch (option.mode) {
        case 'split':
          let parts: Buffer[];
          if (option.smartCrop && cropOptions) {
            parts = await imageProcessor.smartCropAndSplit(processBuffer, cropOptions);
          } else {
            parts = await imageProcessor.splitImage(processBuffer);
          }
          
          for (let j = 0; j < parts.length; j++) {
            const filename = await fileManager.getUniqueFilename(option.prefix, globalCounter++);
            const compressed = await compressor.compressPNG(parts[j], option.quality || 100);
            await fileManager.saveFile(compressed, filename);
            processedFiles.push({
              filename,
              url: `/downloads/${filename}`,
              size: compressed.length
            });
          }
          break;

        case 'resize':
          let resized: Buffer;
          if (option.smartCrop && cropOptions) {
            resized = await imageProcessor.smartCropAndResize(
              processBuffer,
              option.width || 512,
              option.height || 512,
              cropOptions
            );
          } else {
            resized = await imageProcessor.resizeImage(
              processBuffer,
              option.width || 512,
              option.height || 512
            );
          }
          
          const filename = await fileManager.getUniqueFilename(option.prefix, globalCounter++);
          const compressed = await compressor.compressPNG(resized, option.quality || 100);
          await fileManager.saveFile(compressed, filename);
          processedFiles.push({
            filename,
            url: `/downloads/${filename}`,
            size: compressed.length
          });
          break;

        case 'compress':
          let bufferToCompress = processBuffer;
          
          // Check if auto-trim with fixed size is enabled
          if (option.autoTrim && option.autoTrimFixedSize && option.autoTrimTargetWidth && option.autoTrimTargetHeight) {
            console.log('Using autoTrimAndResize with target size:', {
              width: option.autoTrimTargetWidth,
              height: option.autoTrimTargetHeight
            });
            bufferToCompress = await imageProcessor.autoTrimAndResize(
              file.buffer, // Use original buffer, not already auto-trimmed one
              option.autoTrimTargetWidth,
              option.autoTrimTargetHeight,
              autoTrimOptions
            );
          } else {
            // Apply smart crop if enabled (after auto-trim if that was enabled)
            if (option.smartCrop && cropOptions) {
              bufferToCompress = await imageProcessor.cropToContent(processBuffer, cropOptions);
            }
          }
          
          const compressedOnly = await compressor.compressPNG(bufferToCompress, option.quality || 100);
          const filenameComp = await fileManager.getUniqueFilename(option.prefix, globalCounter++);
          await fileManager.saveFile(compressedOnly, filenameComp);
          processedFiles.push({
            filename: filenameComp,
            url: `/downloads/${filenameComp}`,
            size: compressedOnly.length
          });
          break;

        case 'split-resize':
          let splitParts: Buffer[];
          if (option.smartCrop && cropOptions) {
            splitParts = await imageProcessor.smartCropAndSplit(processBuffer, cropOptions);
          } else {
            splitParts = await imageProcessor.splitImage(processBuffer);
          }
          
          for (let j = 0; j < splitParts.length; j++) {
            const resizedPart = await imageProcessor.resizeImage(
              splitParts[j],
              option.width || 256,
              option.height || 256
            );
            const filenameSR = await fileManager.getUniqueFilename(option.prefix, globalCounter++);
            const compressedSR = await compressor.compressPNG(resizedPart, option.quality || 100);
            await fileManager.saveFile(compressedSR, filenameSR);
            processedFiles.push({
              filename: filenameSR,
              url: `/downloads/${filenameSR}`,
              size: compressedSR.length
            });
          }
          break;
        default:
          throw new Error(`Unbekannter Modus: ${option.mode}`);
      }

      results.push({
        original: file.originalname,
        originalSize: file.size,
        processed: processedFiles
      });
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Fehler bei der Verarbeitung:', error);
    res.status(500).json({ error: 'Fehler bei der Bildverarbeitung' });
  }
});

app.post('/api/layer-process', upload.array('layers', 3), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const transformations: (LayerTransformation | null)[] = JSON.parse(req.body.transformations);
    const options: LayerProcessOptions = JSON.parse(req.body.options);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Keine Layer-Bilder hochgeladen' });
    }

    const results = [];
    let globalCounter = await fileManager.getNextAvailableNumber(options.prefix);

    // Process each layer individually with correct scale interpretation
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const transformation = transformations[i];
      
      if (!transformation || !transformation.visible) {
        continue; // Skip invisible layers
      }

      // Process layer with corrected transformations
      const processedBuffer = await imageProcessor.processLayerImageCorrected(
        file.buffer,
        transformation,
        options.outputSize
      );

      // Use layer name for filename if provided, otherwise use prefix
      const layerName = transformation.name || `layer${i + 1}`;
      const filename = await fileManager.getUniqueFilename(layerName, globalCounter++);
      const compressed = await compressor.compressPNG(processedBuffer, options.quality || 100);
      await fileManager.saveFile(compressed, filename);

      results.push({
        original: file.originalname,
        filename,
        url: `/downloads/${filename}`,
        size: compressed.length,
        transformation: transformation
      });
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Fehler bei der Layer-Verarbeitung:', error);
    res.status(500).json({ error: 'Fehler bei der Layer-Verarbeitung' });
  }
});

app.get('/api/download/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../output', filename);
  
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).json({ error: 'Datei nicht gefunden' });
  }
});

app.post('/api/cleanup', async (_req: Request, res: Response) => {
  try {
    await fileManager.cleanupOldFiles();
    res.json({ success: true, message: 'Alte Dateien wurden gelöscht' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Aufräumen' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  fs.ensureDirSync(path.join(__dirname, '../uploads'));
  fs.ensureDirSync(path.join(__dirname, '../output'));
});