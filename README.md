# Burton Rast Photography

An interactive photography portfolio site built with Three.js, featuring an immersive contact sheet viewing experience.

## Project Overview

The site presents photography work through an interactive contact sheet interface. Users can:

- View a full contact sheet grid of images
- Click/tap to zoom into individual images
- Swipe/drag between images when zoomed in
- Smoothly transition between overview and detail states

## Technical Architecture

### Core Technologies
- Three.js 0.171.0 for 3D rendering
- ES6+ JavaScript (no framework)
- GSAP for animations
- Live Server for development

### Key Components

#### Contact Sheet Layout
- Sheet dimensions: 5685x6100px
- Individual images: 600x900px
- Grid: 6x6 images
- First image position: x:250px, y:250px
- Horizontal margin between images: 315px
- Vertical margin between images: 40px

#### Viewport Management
- Camera FOV: 75 degrees
- Normalized coordinate system (sheet scaled to scene units)
- Dynamic camera distance calculation based on viewport size
- Maintains full sheet visibility at all viewport sizes

### File Structure
```
src/
├── assets/
│   └── images/
│       └── contact-sheet-placeholder.jpg
├── components/
│   ├── ContactSheet.js    (Main interaction logic)
│   └── GridLayout.js      (Grid calculations and positioning)
├── core/
│   ├── Engine.js          (Three.js setup and rendering)
│   └── AssetLoader.js     (Asset management)
├── styles/
│   └── main.css
└── main.js                (Application entry point)
```

### Module Setup
```html
<script type="importmap">
    {
        "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js",
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/",
            "three/examples/jsm/controls/OrbitControls": "https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/controls/OrbitControls.js",
            "lil-gui": "https://cdn.jsdelivr.net/npm/lil-gui@0.19.1/dist/lil-gui.esm.js"
        }
    }
</script>
```

### Key Features

#### Grid System
- Precise positioning based on pixel measurements
- Normalized coordinate system for Three.js scene
- Maintains aspect ratios across all states

#### Camera Management
- Dynamic distance calculation for full sheet view
- Smooth transitions between states using GSAP
- Maintains proper perspective during transitions

#### Interaction System
- Touch/mouse event handling
- Velocity-based animations
- State management for transitions

#### Debug Tools
- OrbitControls for camera manipulation
- GUI controls for camera position
- Axes and bounding box helpers
- Console logging for key operations

### Implementation Notes

#### Contact Sheet Setup
```javascript
// Scale calculation for fitting sheet to viewport
calculateScale() {
    // Scale everything down so sheet height is 2 units
    this.scale = 2 / this.sheetHeight;
}

// Camera distance calculation
getCameraDistance() {
    const vFov = 75 * Math.PI / 180;
    const aspect = window.innerWidth / window.innerHeight;
    const height = this.sheetHeight * this.scale;
    const width = this.sheetWidth * this.scale;
    
    const heightDistance = height / (2 * Math.tan(vFov / 2));
    const widthDistance = (width / aspect) / (2 * Math.tan(vFov / 2));
    
    return Math.max(heightDistance, widthDistance) * 1.1;
}
```

#### Image Position Calculation
```javascript
getImagePosition(row, col) {
    const pixelX = this.firstImageX + (col * (this.imageWidth + this.horizontalMargin));
    const pixelY = this.firstImageY + (row * (this.imageHeight + this.verticalMargin));
    
    const normalizedX = (pixelX + this.imageWidth/2 - this.sheetWidth/2) * this.scale;
    const normalizedY = -(pixelY + this.imageHeight/2 - this.sheetHeight/2) * this.scale;
    
    return {
        x: normalizedX,
        y: normalizedY,
        width: this.imageWidth * this.scale,
        height: this.imageHeight * this.scale
    };
}
```

## Development Setup

1. Clone the repository
2. Serve the project using a local server (e.g., Live Server)
3. Access via http://localhost:8080 (or configured port)

## Debug Mode
- Camera controls in top-right GUI
- Axes helper for orientation (toggle in Debug panel)
- Stats panel for performance monitoring
- Console logging for key operations

## Next Steps
- Implement click/tap detection for image zoom
- Add swipe navigation when zoomed in
- Create bottom navigation UI
- Add multiple contact sheets for different sections
- Implement touch gesture handling
- Add loading states and transitions 