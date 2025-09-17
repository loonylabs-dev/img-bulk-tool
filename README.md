# Image Bulk Processing Tool

A TypeScript-based web application for splitting, compressing, and resizing images with an intuitive drag & drop interface. Features Smart Crop functionality for intelligent content centering and advanced layer-based editing capabilities.

## Table of Contents

- [🚀 Quick Start](#-quick-start)
- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [🎯 Usage](#-usage)
- [🏗️ Architecture](#️-architecture)
- [📁 File Naming](#-file-naming)
- [🛠️ Scripts](#️-scripts)

## 🚀 Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Build the application:**
```bash
npm run build
```

3. **Start the server:**
```bash
npm start
```

4. **Open your browser:**
Go to: `http://localhost:3000`

**Development mode** (with hot reload):
```bash
npm run dev
```

## ✨ Features

### 📦 Bulk Processing Tab
- **Image Splitting**: Split square images into 4 equal parts
- **Compression**: PNG compression (adjustable quality 50-100%, default: 100%)
- **Resizing**: Scale images to any target size
- **Aspect Ratio Crop**: Crop images to specific aspect ratios with interactive preview
  - **Preset Ratios**: 16:9, 16:10, 4:3, 1:1, 9:16, 3:4 + Custom ratios
  - **Multi-Image Preview**: Live canvas preview with individual crop positioning
  - **Interactive Drag & Drop**: Adjust crop position per image with visual feedback
  - **Crop Overlay**: Visual crop area with red border and corner handles
- **Auto-Trim**: Automatically remove transparent areas
  - Configurable minimal padding (0-50px, default: 2px)
  - Adjustable detection tolerance (5-100, default: 100)
  - **Fixed Target Size after Auto-Trim**: Scale trimmed images to exact dimensions while preserving proportions
- **Smart Crop**: Intelligent content detection with configurable padding (uniform or individual sides)
- **Batch Processing**: Process up to 20 images simultaneously
- **Transparency Preservation**: PNG transparency is maintained throughout all operations
- **Intelligent Naming**: Prefix + sequential numbering with collision avoidance

### 🎨 Layer Editor Tab
- **3-Layer System**: Position up to 3 images as layers on top of each other
- **Live Preview**: Real-time canvas rendering with red alignment guide (50% opacity)
- **Layer Controls**: 
  - Visibility toggle
  - Scaling (0.1x - 3.0x in 0.05 increments)
  - X/Y Position (-200px to +200px)
- **Preset System**: Save and load layer configurations (localStorage)
- **Guide Size**: Adjustable alignment guide (50-300px)
- **Export Options**: 
  - Output sizes: 128x128, 256x256, 512x512, 1024x1024
  - Adjustable compression quality (50-100%)
- **Auto-Scaling**: Images automatically scale to fit output size when loaded

### 🎨 Color Matching Tab
- **Reference-based Color Correction**: Match images to a reference image's color characteristics
- **Live Preview**: 3-canvas system (Original, Reference, Adjusted) with real-time updates
- **Advanced Color Controls**:
  - Intensity (0-300%): Strength of color matching
  - Saturation (0-300%): Color vibrancy
  - Brightness (30-200%): Overall brightness
  - Contrast (50-200%): Difference between light and dark areas
  - Hue Shift (-180° to +180°): Color spectrum rotation
  - Sharpness (0-300%): Image sharpness and detail
  - Noise Reduction (0-100%): Smoothing of image artifacts
  - Gamma Correction (0.5-2.0): Tone curve adjustment
- **Batch Processing**: Process multiple images with consistent reference matching
- **Debounced Preview**: Performance-optimized preview with 500ms delay
- **Reset Function**: Reset all settings to default values

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/loonylabs-dev/img-bulk-tool.git
cd img-bulk-tool

# Install dependencies
npm install

# Build the application
npm run build

# Start the production server
npm start
```

## 🎯 Usage

### Bulk Processing

1. **Upload Images**: Drag & drop or file selection (max. 20 images)
2. **Select Mode**:
   - **Split**: Divide image into 4 quadrants
   - **Resize**: Scale to desired dimensions
   - **Compress Only**: Reduce file size without resizing
   - **Split + Resize**: Combine both operations
   - **Aspect Ratio Crop**: Crop to specific aspect ratios with interactive positioning
3. **Configure Options**:
   - Set quality (50-100%, default: 100%)
   - Enable **Auto-Trim** for automatic transparent area removal
     - Optional: "Fixed Target Size after Auto-Trim" for exact dimensions (e.g., 512x512)
     - Works in all modes (Compress, Split, etc.)
   - Enable Smart Crop for intelligent content detection
   - Define prefix for output files
4. Click **"Process Images"**
5. Download individual files or all at once

### Layer Editor

1. Upload up to 3 images as layers (drag & drop or click)
2. Adjust layers individually:
   - Toggle visibility
   - Fine-tune scaling (0.05 increments)
   - Adjust position (X/Y axis)
3. Guide settings:
   - Show/hide red alignment guide
   - Adjust guide size (slider or number input)
4. Use presets:
   - Save/load configurations
   - Pre-installed example setup available
5. Export settings:
   - Choose output size (128x128 to 1024x1024)
   - Set compression quality
   - Enter filename prefix
6. Click **"Export Layers"**

### Color Matching

1. **Upload Reference Image**: First image to define target color characteristics
   - Preview is automatically displayed
2. **Add Target Images**: Images to be adjusted
   - Batch upload of multiple images supported
   - Individual images can be removed
3. **Use Live Preview**: 
   - 3-canvas view: Original, Reference, Adjusted
   - Preview updates automatically with changes
4. **Adjust Color Controls**:
   - **Basic Settings**: Intensity and Quality
   - **Advanced Controls**: Saturation, Brightness, Contrast
   - **Special Effects**: Hue Shift, Sharpness, Noise Reduction
   - **Tone**: Gamma Correction for fine adjustments
5. **Reset Option**: Reset all settings to defaults
6. **Start Processing**: Click "🎨 Start Color Matching"
7. **Download Results**: Individual files or all at once

### Aspect Ratio Crop

1. **Upload Images**: Drag & drop or file selection (max. 20 images)
2. **Select Aspect Ratio Crop Mode**: Choose "🎯 Aspect Ratio Crop" option
3. **Choose Aspect Ratio**:
   - **Preset Options**: 16:9 (Widescreen), 16:10 (Monitor), 4:3 (Classic), 1:1 (Square), 9:16 (Portrait), 3:4 (Portrait Classic)
   - **Custom Ratio**: Define your own width:height ratio
4. **Interactive Crop Preview**:
   - **Multi-Image Grid**: See all uploaded images with crop overlays
   - **Visual Feedback**: Red crop borders with corner handles
   - **Drag to Position**: Click and drag within crop areas to adjust positioning per image
   - **Live Updates**: Instant preview of crop changes
5. **Configure Quality**: Set compression level (50-100%)
6. **Add Filename Prefix**: Optional prefix for output files
7. **Process Images**: Click "Process Images" to apply crops
8. **Download Results**: Individual cropped images or batch download

## 🏗️ Architecture

### Backend (`src/`)
- **server.ts**: Express server with REST API and static file serving
- **lib/imageProcessor.ts**: Core image operations (split, resize, Smart Crop with pixel-level analysis)
- **lib/compressor.ts**: PNG compression using imagemin + pngquant + optipng
- **lib/fileManager.ts**: File naming with collision avoidance and sequential numbering
- **lib/colorAnalyzer.ts**: Advanced color analysis and matching engine

### Frontend (`public/`)
- **index.html**: Single-page app with drag & drop interface
- **js/main.ts**: Application entry point with modular architecture
- **js/components/**: Reusable UI components (BaseComponent, TabComponent)
- **js/features/**: Feature modules (BulkProcessor, LayerEditor, ColorMatcher)
- **js/services/**: Business logic layer (ApiService, FileService)
- **css/**: Responsive styling with grid layouts

### Key Data Flow
1. Frontend uploads files via FormData to `/api/process` (bulk processing with aspect-crop support), `/api/layer-process`, or `/api/color-match`
2. Backend processes images based on mode-specific logic (`split`, `resize`, `compress`, `split-resize`, `aspect-crop`)
3. For aspect-crop mode: Individual crop positions and aspect ratio parameters sent with request
4. Files saved to `output/` with collision-safe naming: `[prefix]_[number].png`
5. Results returned with download URLs and file metadata

## 📁 File Naming

Output files are named as: `[prefix]_[number].png`

- Sequential numbering starts from 1
- Automatic collision avoidance by incrementing
- No additional identifiers

**Examples:**
- 1 image split (prefix: "icon"): `icon_1.png`, `icon_2.png`, `icon_3.png`, `icon_4.png`
- 3 images compressed (prefix: "asset"): `asset_1.png`, `asset_2.png`, `asset_3.png`

## 🛠️ Scripts

- `npm run dev`: Development mode (Backend + Frontend watch)
- `npm run build`: Full build (Backend + Frontend)
- `npm run build:backend`: Compile backend only
- `npm run build:frontend`: Compile frontend only  
- `npm start`: Start production server (requires build)
- `npm run serve`: Preview built frontend
- `npm run type-check`: TypeScript type checking without build

## 🔧 Technical Details

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Modular TypeScript + Vite + ES2022 Modules
- **Architecture**: Event-driven, component-based, Service Layer Pattern
- **Image Processing**: Sharp.js (fast and precise)
- **Compression**: imagemin + pngquant + optipng
- **Upload**: Multer for file processing
- **TypeScript**: Strict mode, full type safety

## 🎯 Use Cases

### Auto-Trim with Fixed Target Size
Perfect for creating consistent dimensions:
- **Icons**: 512x512 app icons with consistent dimensions
- **Sprites**: Uniform sprite sizes for game development
- **Thumbnails**: Consistent preview images for galleries
- **Asset Libraries**: Standardized image sizes for design systems

### Color Matching Applications
- **Product Photography**: Uniform look for e-commerce catalogs
- **Portfolio Optimization**: Harmonious color mood in image galleries
- **Social Media**: Consistent branding across multiple posts
- **Creative Effects**: Vintage looks, film aesthetics, artistic color combinations

---

**Performance**: Utilizes Sharp for ultra-fast image processing, progressive compression with imagemin + pngquant, and Vite for optimized frontend builds.