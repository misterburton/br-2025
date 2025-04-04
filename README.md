# Burton Rast Photography

An interactive photography portfolio site built with Three.js, featuring an immersive contact sheet viewing experience.

## Project Overview

The site presents photography work through an interactive contact sheet interface. Users can:

- View a full contact sheet grid of images
- Click/tap to zoom into individual images
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
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/"
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
- Precise hit detection using exact grid coordinates
- Long press to zoom out when viewing individual images
- Distinct zoom in/out animations with wingsuit-like motion
- State management for preventing interaction during transitions

#### Animation System
- Zoom In:
  - Quick initial scale (0.75s, Quad.easeIn)
  - Graceful position transition (1.5s, Quint.easeInOut)
  - Coordinated animations with overwrite prevention
- Zoom Out:
  - Delayed scale down (0.85s, Cubic.easeInOut, 0.25s delay)
  - Quick position return (0.57s, Cubic.easeIn)
  - Maintains visual continuity

#### Hit Detection
```javascript
// Precise hit detection using exact grid coordinates
isOverImage(uv) {
    // Convert UV to sheet coordinates
    const pixelX = uv.x * this.layout.sheetWidth;
    const pixelY = (1 - uv.y) * this.layout.sheetHeight;
    
    // Get grid position using exact same math as grid creation
    const gridX = Math.floor((pixelX - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
    const gridY = Math.floor((pixelY - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
    
    // Get exact image position
    const imageX = this.layout.firstImageX + (gridX * (this.layout.imageWidth + this.layout.horizontalMargin));
    const imageY = this.layout.firstImageY + (gridY * (this.layout.imageHeight + this.layout.verticalMargin));
    
    // Test against exact image bounds
    const isHit = 
        pixelX >= imageX && 
        pixelX <= imageX + this.layout.imageWidth &&
        pixelY >= imageY && 
        pixelY <= imageY + this.layout.imageHeight;
        
    return this.isZoomedIn 
        ? (isHit && gridX === this.currentGridX && gridY === this.currentGridY)
        : (isHit && gridX >= 0 && gridX < this.layout.columns && gridY >= 0 && gridY < this.layout.rows);
}
```

#### Animation Implementation
```javascript
// Zoom in animation
zoomToImage(gridX, gridY) {
    const imagePos = this.layout.getImagePosition(gridY, gridX);
    const zoomScale = this.calculateZoomScale();
    
    // Quick initial zoom with Quad.easeIn
    gsap.to(this.sheet.scale, {
        x: zoomScale,
        y: zoomScale,
        z: 1,
        duration: 0.75,
        ease: "power2.in"
    });
    
    // Graceful arc to position with Quint.easeInOut
    gsap.to(this.sheet.position, {
        x: imagePos.x * -zoomScale,
        y: imagePos.y * -zoomScale,
        z: 0.5,
        duration: 1.5,
        ease: "power4.inOut",
        overwrite: false
    });
}

// Zoom out animation
zoomOut() {
    // Scale down with Cubic.easeInOut
    gsap.to(this.sheet.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.85,
        ease: "power3.inOut",
        delay: 0.25
    });
    
    // Quick return to center with Cubic.easeIn
    gsap.to(this.sheet.position, {
        x: 0,
        y: 0,
        z: -0.1,
        duration: 0.57,
        ease: "power3.in",
        overwrite: false
    });
}
```

## Development Setup

1. Clone the repository
2. Serve the project using a local server (e.g., Live Server)
3. Access via http://localhost:8080 (or configured port)

## Debug Mode
- Stats panel for performance monitoring
- Console logging for key operations

## Next Steps
- Create bottom navigation UI
- Add multiple contact sheets for different sections
- Add loading states and transitions 