import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import net from 'net';
import { ImageProcessor } from './lib/imageProcessor';
import { Compressor } from './lib/compressor';
import { FileManager } from './lib/fileManager';
import { ColorAnalyzer } from './lib/colorAnalyzer';

const app = express();
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3003;

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
      return cb(new Error('Only image files are allowed!'));
    }
  }
});

app.use(cors());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log(`📦 Request body size: ${req.get('Content-Length') || 'unknown'} bytes`);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, '../output')));

const imageProcessor = new ImageProcessor();
const compressor = new Compressor();
const fileManager = new FileManager(path.join(__dirname, '../output'));
const colorAnalyzer = new ColorAnalyzer();

interface ProcessOptions {
  mode: 'split' | 'resize' | 'compress' | 'split-resize' | 'aspect-crop';
  quality?: number;
  width?: number;
  height?: number;
  prefix: string;
  originalName?: string;
  combineWithOriginalName?: boolean;
  useSequentialNumbering?: boolean;
  useOriginalFileNames?: boolean;
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
  // Aspect ratio crop options
  aspectRatio?: string;
  cropPositionX?: number;
  cropPositionY?: number;
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

interface LayerProcessOptions {
  outputSize: number;
  prefix: string;
  quality: number;
  useOriginalNames?: boolean;
}

app.post('/api/process', upload.array('images', 200), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const options: ProcessOptions[] = JSON.parse(req.body.options);

    console.log(`=== Starting batch processing: ${files.length} files ===`);
    console.log('Options:', JSON.stringify(options, null, 2));

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const results = [];
    let globalCounter = await fileManager.getNextAvailableNumber(options[0]?.prefix || 'image');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const option = options[i] || options[0];
      const processedFiles = [];

      try {
        console.log(`=== Processing file ${i + 1}/${files.length}: ${file.originalname} ===`);

      // Determine the actual prefix to use
      let actualPrefix = option.prefix;
      if (option.useOriginalFileNames && option.originalName) {
        // Use 1:1 original filename without any prefix
        actualPrefix = path.parse(option.originalName).name;
      } else if (option.combineWithOriginalName && option.originalName) {
        // Remove file extension from original name
        const nameWithoutExt = path.parse(option.originalName).name;
        actualPrefix = option.prefix ? `${option.prefix}_${nameWithoutExt}` : nameWithoutExt;
      }

      // Debug logging
      console.log('Processing options:', {
        mode: option.mode,
        autoTrim: option.autoTrim,
        autoTrimPadding: option.autoTrimPadding,
        autoTrimTolerance: option.autoTrimTolerance,
        smartCrop: option.smartCrop,
        cropTolerance: option.cropTolerance,
        actualPrefix: actualPrefix,
        useSequentialNumbering: option.useSequentialNumbering,
        combineWithOriginalName: option.combineWithOriginalName,
        useOriginalFileNames: option.useOriginalFileNames,
        originalName: option.originalName
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
            let partToCompress = parts[j];
            
            // Apply auto-trim with fixed size to each part if enabled
            if (option.autoTrim && option.autoTrimFixedSize && option.autoTrimTargetWidth && option.autoTrimTargetHeight) {
              console.log(`Applying autoTrimAndResize to part ${j + 1}/4 with target size:`, {
                width: option.autoTrimTargetWidth,
                height: option.autoTrimTargetHeight
              });
              partToCompress = await imageProcessor.autoTrimAndResize(
                parts[j], // Use the split part, not original buffer
                option.autoTrimTargetWidth,
                option.autoTrimTargetHeight,
                autoTrimOptions
              );
            }
            
            // For split mode without numbering, add part indicator (tl, tr, bl, br)
            const partNames = ['tl', 'tr', 'bl', 'br'];
            const filename = await fileManager.getUniqueFilename(
              actualPrefix, 
              option.useOriginalFileNames || option.useSequentialNumbering === false ? 0 : globalCounter++, 
              option.useOriginalFileNames ? false : option.useSequentialNumbering !== false,
              option.useSequentialNumbering === false && !option.useOriginalFileNames ? partNames[j] : undefined
            );
            const compressed = await compressor.compressPNG(partToCompress, option.quality || 100);
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
          
          const filename = await fileManager.getUniqueFilename(
            actualPrefix, 
            option.useOriginalFileNames || option.useSequentialNumbering === false ? 0 : globalCounter++, 
            option.useOriginalFileNames ? false : option.useSequentialNumbering !== false
          );
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
          const filenameComp = await fileManager.getUniqueFilename(
            actualPrefix, 
            option.useOriginalFileNames || option.useSequentialNumbering === false ? 0 : globalCounter++, 
            option.useOriginalFileNames ? false : option.useSequentialNumbering !== false
          );
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
            // For split-resize mode without numbering, add part indicator (tl, tr, bl, br)
            const partNames = ['tl', 'tr', 'bl', 'br'];
            const filenameSR = await fileManager.getUniqueFilename(
              actualPrefix, 
              option.useOriginalFileNames || option.useSequentialNumbering === false ? 0 : globalCounter++, 
              option.useOriginalFileNames ? false : option.useSequentialNumbering !== false,
              option.useSequentialNumbering === false && !option.useOriginalFileNames ? partNames[j] : undefined
            );
            const compressedSR = await compressor.compressPNG(resizedPart, option.quality || 100);
            await fileManager.saveFile(compressedSR, filenameSR);
            processedFiles.push({
              filename: filenameSR,
              url: `/downloads/${filenameSR}`,
              size: compressedSR.length
            });
          }
          break;

        case 'aspect-crop':
          if (!option.aspectRatio) {
            throw new Error('Aspect ratio is required for aspect-crop mode');
          }

          console.log(`Processing aspect-crop for ${file.originalname}: ${option.aspectRatio} at (${option.cropPositionX || 50}%, ${option.cropPositionY || 50}%)`);

          const aspectRatioCropped = await imageProcessor.cropToAspectRatio(processBuffer, {
            aspectRatio: option.aspectRatio,
            positionX: option.cropPositionX || 50, // Default to center
            positionY: option.cropPositionY || 50  // Default to center
          });

          console.log(`Aspect ratio crop completed for ${file.originalname}`);

          // Validate cropped buffer
          if (!aspectRatioCropped || aspectRatioCropped.length === 0) {
            throw new Error('Cropped image buffer is empty or invalid');
          }
          console.log(`Cropped buffer valid: ${aspectRatioCropped.length} bytes`);

          const filenameAspectCrop = await fileManager.getUniqueFilename(
            actualPrefix,
            option.useOriginalFileNames || option.useSequentialNumbering === false ? 0 : globalCounter++,
            option.useOriginalFileNames ? false : option.useSequentialNumbering !== false
          );
          console.log(`Generated filename: ${filenameAspectCrop}`);

          console.log(`Starting compression with quality: ${option.quality || 100}`);
          const compressedAspectCrop = await compressor.compressPNG(aspectRatioCropped, option.quality || 100);

          // Validate compressed buffer
          if (!compressedAspectCrop || compressedAspectCrop.length === 0) {
            throw new Error('Compressed image buffer is empty or invalid');
          }
          console.log(`Compression completed: ${aspectRatioCropped.length} -> ${compressedAspectCrop.length} bytes`);

          console.log(`Starting file save operation...`);
          await fileManager.saveFile(compressedAspectCrop, filenameAspectCrop);
          console.log(`File saved successfully: ${filenameAspectCrop} (${compressedAspectCrop.length} bytes)`);

          processedFiles.push({
            filename: filenameAspectCrop,
            url: `/downloads/${filenameAspectCrop}`,
            size: compressedAspectCrop.length
          });
          break;
        default:
          throw new Error(`Unbekannter Modus: ${option.mode}`);
      }

        console.log(`Successfully processed file: ${file.originalname} -> ${processedFiles.length} output files`);

        results.push({
          original: file.originalname,
          originalSize: file.size,
          processed: processedFiles
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);

        // Add failed file to results with error information
        results.push({
          original: file.originalname,
          originalSize: file.size,
          processed: [],
          error: fileError instanceof Error ? fileError.message : 'Unknown processing error'
        });
      }
    }

    console.log(`=== Batch processing completed: ${results.length} results ===`);
    console.log('Results summary:', results.map(r => ({ original: r.original, files: r.processed.length })));

    // Ensure response is sent
    console.log('Sending response to client...');

    const response = { success: true, results };
    console.log('Response size:', JSON.stringify(response).length, 'bytes');

    res.status(200).json(response);

    console.log('Response sent successfully');
  } catch (error) {
    console.error('Processing error:', error);

    // Ensure we always return a proper JSON response
    const errorMessage = error instanceof Error ? error.message : 'Unknown image processing error';

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'No stack trace available'
    });
  }
});

app.post('/api/layer-process', upload.array('layers', 3), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const transformations: (LayerTransformation | null)[] = JSON.parse(req.body.transformations);
    const options: LayerProcessOptions = JSON.parse(req.body.options);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No layer images uploaded' });
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
      
      let filename: string;
      if (options.useOriginalNames) {
        // Use original names without numbering (will overwrite existing files)
        filename = await fileManager.getUniqueFilename(layerName, 1, false);
      } else {
        // Use sequential numbering (original behavior)
        filename = await fileManager.getUniqueFilename(layerName, globalCounter++);
      }
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
    console.error('Layer processing error:', error);
    res.status(500).json({ error: 'Layer processing error' });
  }
});

app.get('/api/download/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../output', filename);
  
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/color-match', upload.fields([
  { name: 'reference', maxCount: 1 },
  { name: 'images', maxCount: 200 }
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { reference?: Express.Multer.File[]; images?: Express.Multer.File[] };
    const options = JSON.parse(req.body.options || '{}');
    
    // Extract options with defaults
    const {
      intensity = 100,
      quality = 100,
      saturationBoost = 100,
      brightnessBoost = 100,
      contrastBoost = 100,
      hueShift = 0,
      sharpness = 100,
      noiseReduction = 0,
      gamma = 1.0
    } = options;

    if (!files?.reference || files.reference.length === 0) {
      return res.status(400).json({ error: 'No reference image uploaded' });
    }

    if (!files?.images || files.images.length === 0) {
      return res.status(400).json({ error: 'No images to adjust uploaded' });
    }

    const referenceFile = files.reference[0];
    const imageFiles = files.images;
    
    console.log(`Color matching: ${imageFiles.length} images to reference "${referenceFile.originalname}"`);
    console.log(`Parameters:`, { intensity, quality, saturationBoost, brightnessBoost, contrastBoost, hueShift, sharpness, noiseReduction, gamma });

    const results = [];
    let globalCounter = await fileManager.getNextAvailableNumber('matched');

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      
      try {
        console.log(`Processing image ${i + 1}/${imageFiles.length}: ${imageFile.originalname}`);
        
        // Apply color matching with all parameters
        const matchedBuffer = await colorAnalyzer.matchColorsToReferenceAdvanced(
          imageFile.buffer,
          referenceFile.buffer,
          {
            intensity: parseInt(intensity),
            saturationBoost: parseInt(saturationBoost),
            brightnessBoost: parseInt(brightnessBoost),
            contrastBoost: parseInt(contrastBoost),
            hueShift: parseInt(hueShift),
            sharpness: parseInt(sharpness),
            noiseReduction: parseInt(noiseReduction),
            gamma: parseFloat(gamma)
          }
        );

        // Compress the result
        const compressedBuffer = await compressor.compressPNG(matchedBuffer, parseInt(quality));
        
        // Save to file
        const filename = await fileManager.getUniqueFilename('matched', globalCounter++);
        await fileManager.saveFile(compressedBuffer, filename);
        
        results.push({
          original: imageFile.originalname,
          originalSize: imageFile.size,
          processed: [{
            filename,
            url: `/downloads/${filename}`,
            size: compressedBuffer.length
          }]
        });
        
        console.log(`Image ${i + 1} processed successfully: ${filename}`);
      } catch (error) {
        console.error(`Error processing image ${imageFile.originalname}:`, error);
        // Continue processing other images even if one fails
      }
    }

    console.log(`Color matching complete. Processed ${results.length}/${imageFiles.length} images successfully`);
    res.json({ success: true, results });

  } catch (error) {
    console.error('Color matching error:', error);
    res.status(500).json({ error: 'Color matching error' });
  }
});

app.post('/api/color-preview', upload.fields([
  { name: 'reference', maxCount: 1 },
  { name: 'source', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { reference?: Express.Multer.File[]; source?: Express.Multer.File[] };
    const options = JSON.parse(req.body.options || '{}');
    
    // Extract options with defaults
    const {
      intensity = 100,
      saturationBoost = 100,
      brightnessBoost = 100,
      contrastBoost = 100,
      hueShift = 0,
      sharpness = 100,
      noiseReduction = 0,
      gamma = 1.0
    } = options;

    if (!files?.reference || files.reference.length === 0) {
      return res.status(400).json({ error: 'No reference image uploaded' });
    }

    if (!files?.source || files.source.length === 0) {
      return res.status(400).json({ error: 'No source image uploaded' });
    }

    const referenceFile = files.reference[0];
    const sourceFile = files.source[0];
    
    console.log(`Generating preview with options:`, { intensity, saturationBoost, brightnessBoost, contrastBoost, hueShift, sharpness, noiseReduction, gamma });

    // Generate preview with all parameters (higher resolution)
    const previewBuffer = await colorAnalyzer.generatePreviewAdvanced(
      sourceFile.buffer,
      referenceFile.buffer,
      {
        intensity: parseInt(intensity),
        saturationBoost: parseInt(saturationBoost),
        brightnessBoost: parseInt(brightnessBoost),
        contrastBoost: parseInt(contrastBoost),
        hueShift: parseInt(hueShift),
        sharpness: parseInt(sharpness),
        noiseReduction: parseInt(noiseReduction),
        gamma: parseFloat(gamma)
      },
      800 // Higher preview size for better quality
    );

    // Return preview as base64 encoded image
    const base64Preview = previewBuffer.toString('base64');
    res.json({ 
      success: true, 
      preview: `data:image/png;base64,${base64Preview}` 
    });

  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({ error: 'Preview generation error' });
  }
});

app.post('/api/cleanup', async (_req: Request, res: Response) => {
  try {
    await fileManager.cleanupOldFiles();
    res.json({ success: true, message: 'Old files were deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Cleanup error' });
  }
});

// Function to check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

// Function to find the next available port
async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

// Start server with automatic port fallback
async function startServer() {
  try {
    const availablePort = await findAvailablePort(DEFAULT_PORT);

    app.listen(availablePort, () => {
      if (availablePort !== DEFAULT_PORT) {
        console.log(`⚠️  Port ${DEFAULT_PORT} was in use, server started on http://localhost:${availablePort}`);
      } else {
        console.log(`✅ Server läuft auf http://localhost:${availablePort}`);
      }

      // Ensure directories exist
      fs.ensureDirSync(path.join(__dirname, '../uploads'));
      fs.ensureDirSync(path.join(__dirname, '../output'));
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();