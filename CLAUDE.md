# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript-based image processing web application that splits, compresses, and resizes images with a drag & drop interface. Features Smart Crop functionality for intelligent content centering with individual side padding controls.

## Key Commands

### Development
- `npm run dev` - Full development mode (TypeScript watch + nodemon + Vite dev server)
- `npm run build` - Production build (TypeScript compilation + Vite build)
- `npm start` - Start production server (requires build first)
- `npm run serve` - Preview built frontend

### Build Process
1. TypeScript compiles `src/` → `dist/`
2. Vite compiles `public/` → `dist/public/`
3. Server serves from `dist/public/` with API on `/api/*`

## Architecture

### Backend (`src/`)
- **server.ts**: Express server with REST API and static file serving
- **lib/imageProcessor.ts**: Core image operations (split, resize, Smart Crop with pixel-level analysis)
- **lib/compressor.ts**: PNG compression using imagemin + pngquant + optipng
- **lib/fileManager.ts**: File naming with collision avoidance and sequential numbering

### Frontend (`public/`)
- **index.html**: Single-page app with drag & drop interface
- **js/app.ts**: Main TypeScript class `ImageProcessor` with event handling
- **css/**: Responsive styling with grid layouts for padding controls

### Smart Crop Feature
The Smart Crop algorithm analyzes image content by:
1. Pixel-by-pixel alpha channel inspection to detect content bounds
2. Calculating content center and optimal crop area
3. Applying configurable padding (uniform or individual sides)
4. Supporting both legacy uniform padding and new individual side controls

### Key Data Flow
1. Frontend uploads files via FormData to `/api/process`
2. Backend processes images based on `ProcessOptions` with mode-specific logic
3. Files saved to `output/` with collision-safe naming: `[prefix]_[number].png`
4. Results returned with download URLs and file metadata

## File Naming System
- Sequential numbering starting from next available number
- Collision detection scans existing files
- Format: `[prefix]_[number].png` (e.g., `icon_1.png`, `icon_2.png`)

## Layer Editor Feature (Tab-Based)
Added sophisticated layer-based image editing with tab-separated UI:

### Tab System Architecture
- **Tab Navigation**: `<nav class="tab-navigation">` with `data-tab` attributes
- **Tab Content**: `.tab-panel` containers with corresponding IDs (`bulk-tab`, `layer-tab`)
- **JavaScript**: `initTabSystem()` handles tab switching with robust DOM-ready checking

### Layer Editor Components
- **3-Layer System**: Individual upload slots with drag & drop support
- **Canvas Preview**: HTML5 Canvas with real-time rendering and red alignment guide (50% opacity)
- **Layer Controls**: Per-layer visibility, scale (0.1x-3.0x), position (-200px to +200px)
- **Export System**: Server-side layer composition with Sharp.js, configurable output sizes (128x128 to 1024x1024)

### Backend Layer Processing
- **API Route**: `/api/layer-process` with `LayerTransformation` interface
- **Image Processing**: `processLayerImage()` method handles scaling, positioning, and canvas composition
- **Sharp Integration**: Layer composition with transparency preservation

## Color Matching Feature (Tab-Based)
Advanced color correction system for matching images to a reference image's color characteristics:

### Color Matching Components
- **Reference Image Upload**: Single drag & drop zone for target color characteristics
- **Bulk Image Upload**: Multiple image selection for batch color matching
- **3-Canvas Preview System**: Original, Reference, and Adjusted images with real-time updates
- **Extended Color Controls**: 9 precision sliders for comprehensive color adjustment
- **Debounced Preview**: Performance-optimized live preview with 500ms debounce

### Color Control System
- **Intensity Control**: Strength of color matching (0-300%)
- **Saturation Boost**: Color vividness adjustment (0-300%)
- **Brightness/Contrast**: Luminosity and range controls (30-200%, 50-200%)
- **Hue Shift**: Color spectrum rotation (-180° to +180°)
- **Sharpness**: Detail enhancement (0-300%)
- **Noise Reduction**: Artifact smoothing (0-100%)
- **Gamma Correction**: Tone curve adjustment (0.5-2.0)
- **Quality**: Compression level (50-100%)

### Backend Color Processing
- **API Route**: `/api/color-match` with `ColorMatchOptions` interface
- **Preview API**: `/api/color-preview` for real-time canvas updates
- **Image Processing**: Color analysis and transformation using Sharp.js color operations
- **Batch Processing**: Multiple images processed with consistent reference matching

### ColorAnalyzer Module (`src/lib/colorAnalyzer.ts`)
Advanced color analysis and matching engine:
- **Color Statistics**: HSV-based analysis (saturation, brightness, contrast, RGB averages)
- **Smart Sampling**: Performance-optimized pixel sampling (max 10k samples per image)
- **Adjustment Calculation**: Non-linear scaling with intensity amplification for dramatic effects
- **Advanced Processing**: Multi-step color transformation with gamma, noise reduction, sharpening
- **Batch Operations**: Efficient processing of multiple images with single reference analysis
- **Preview Generation**: Real-time preview with customizable size constraints

## Important Notes
- Always run `npm run build` before testing changes in production mode
- Development uses Vite dev server on port 3001 with API proxy to 3000
- Smart Crop UI visibility controlled by `handleSmartCropChange()` and `handleCropModeChange()` handlers
- Image processing supports PNG transparency preservation throughout the pipeline
- Layer Editor accessible via "🎨 Layer Editor" tab, bulk processing via "📦 Bulk Verarbeitung"
- Color Matching accessible via "🎨 Color Matching" tab for reference-based color correction

## Lessons Learned & Best Practices

### Build System & Vite Integration
⚠️ **Critical**: Avoid `type="module"` on script tags when using Vite build process
- **Issue**: `<script src="/js/app.js" type="module">` caused Vite to create separate `main.js` with incomplete functionality
- **Solution**: Use `<script src="/js/app.js">` without module type for proper bundling
- **Debug**: Check `dist/public/js/` directory for multiple JS files indicating build conflicts

### JavaScript Event Handling & DOM Timing
🔧 **Robust DOM Loading**: Always handle different document ready states
```typescript
// GOOD: Handles both immediate and deferred loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFunction);
} else {
  initFunction();
}

// BAD: May miss elements if DOM already loaded
document.addEventListener('DOMContentLoaded', initFunction);
```

### Tab System Implementation
📋 **Tab Architecture Pattern**:
- Use `data-tab` attributes for semantic tab association
- Implement robust element checking with fallback error handling
- Add debug logging during development for troubleshooting
- Clear active states before setting new ones to prevent conflicts

### Sharp.js Platform Dependencies
🖼️ **Image Processing Library Issues**:
- Sharp has platform-specific binaries that may fail on WSL/Windows
- Always run `npm install` after cloning/pulling to ensure correct platform binaries
- Use `npm install --include=optional sharp` if installation issues persist

### TypeScript Build Process
🏗️ **Development Workflow**:
- TSC compiles TypeScript → JavaScript first
- Vite then processes HTML and static assets
- Both processes must complete successfully for full functionality
- Use `npm run build` to test production builds during development

### UI/UX Design Patterns
🎨 **User Interface Best Practices**:
- Separate complex functionality into distinct tabs to avoid user confusion
- Implement consistent visual feedback (hover states, active indicators, drag-over effects)
- Use meaningful icons and labels (📦 Bulk, 🎨 Layer Editor)
- Provide real-time preview and control feedback (canvas updates, slider values)

### Error Handling & Debugging
🐛 **Development Debugging Strategy**:
- Add console.log statements for critical initialization steps
- Implement graceful error handling with user-friendly messages
- Check browser console for JavaScript errors before assuming backend issues
- Verify HTML element existence before attaching event listeners

### Backend API Design
🔌 **API Endpoint Patterns**:
- Use descriptive endpoint names (`/api/layer-process` vs generic `/api/process`)
- Implement consistent error response format
- Support both individual and bulk operations
- Validate file types and size limits early in request pipeline

### File Organization & Structure
📁 **Project Structure Best Practices**:
- Keep related functionality grouped (Layer Editor components together)
- Use consistent naming conventions across HTML IDs, CSS classes, and JavaScript references
- Maintain clear separation between tabs/features to enable independent development

### Server Restart & Route Updates
🔄 **New API Routes Require Server Restart**:
- **Issue**: 404 errors on new routes even after `npm run build`
- **Solution**: Always kill old server process and restart with `npm start`
- **Commands**: `killall node` then `npm start` or use `pkill -f "node dist/server.js"`
- **Why**: Node.js loads compiled JS into memory; new routes aren't available until restart

### Default Compression Settings
💎 **Quality Defaults Matter**:
- **Practice**: Set compression quality to 100% by default
- **Rationale**: Users can always reduce quality, but shouldn't lose quality unexpectedly
- **Implementation**: Both tabs should have consistent default quality settings

### Layout & Responsive Design
📐 **2-Column Layout Pattern**:
- **Structure**: Use CSS Grid with `grid-template-columns: 1fr 1fr` for desktop
- **Mobile**: Add media query for `grid-template-columns: 1fr` on small screens
- **Grouping**: Related UI elements together (preview + presets, all controls)
- **Space Usage**: Utilize vertical space efficiently (presets under preview)

### Layer Auto-Scaling
🎯 **Intuitive Scale Behavior**:
- **Feature**: Images auto-scale to fit output size when loaded
- **Implementation**: Calculate initial scale = outputSize / max(imageWidth, imageHeight)
- **UX Benefit**: Scale 1.0 means "fitted to output" - intuitive for users
- **Dynamic**: Recalculate when output size changes

### Preset System Design
💾 **Comprehensive State Saving**:
- **Include All State**: Guide size, all layer transforms, visibility settings
- **localStorage**: Simple persistence without backend complexity
- **Default Presets**: Provide example presets to demonstrate functionality
- **Clear Naming**: Use descriptive preset names for user clarity

### Step Size for Sliders
🎚️ **Precision Control**:
- **Scale Sliders**: Use step="0.05" for fine control (not 0.1)
- **Display**: Show 2 decimal places with `toFixed(2)` for scale values
- **Number Inputs**: Provide both slider and number input for critical values
- **Bidirectional Sync**: Keep slider and number input synchronized

### Color Matching Performance
🎨 **Real-time Preview Optimization**:
- **Debounced Updates**: 500ms delay prevents excessive API calls during slider adjustments
- **Canvas Rendering**: Hardware-accelerated with `imageSmoothingQuality: 'high'`
- **Smart Sampling**: ColorAnalyzer samples max 10k pixels for fast analysis
- **Preview Sizing**: Automatic resize to 400px max dimension for responsive previews
- **Error Handling**: Graceful fallback to original image on processing errors

### Modular Architecture Refactoring
🏗️ **Frontend Monolith → Modular Architecture Best Practices**:
- **Clean Build Required**: Always `rm -rf dist` when switching architectures to prevent cached conflicts
- **Old JS Files Interference**: Remove old compiled JS files (`app.js`, `main.js`) before build - they interfere with new module loading
- **DOM Element IDs**: Ensure all components have correct element selectors - TabComponent needs `<main id="main">` not just `<main>`
- **Global vs Scoped Selectors**: BulkProcessor form elements are global - use `document.getElementById()` not scoped `this.$()`
- **TypeScript Module Structure**: ES2022 modules with strict mode require proper import/export chains
- **Vite Cache Issues**: Vite can cache old entry points - clear `node_modules/.cache` if build fails
- **Module Resolution**: Use relative imports `./components/Component.js` not absolute `/js/components/`
- **Element Context**: Components extending BaseComponent must match their DOM container scope correctly
- **Event Listener Binding**: Form elements outside component scope need global selectors, not scoped ones