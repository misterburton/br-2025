# Burton Rast Photography

An interactive photography portfolio site built with Three.js, featuring an immersive contact sheet viewing experience.

## Project Overview

The site presents photography work through an interactive contact sheet interface. Users can:

- View a full contact sheet grid of images
- Click/tap to zoom into individual images
- Smoothly transition between overview and detail states
- Navigate between adjacent images with swipe gestures or single-click (desktop/tablet)

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
- Orthographic camera for consistent view across devices
- Normalized coordinate system (sheet scaled to scene units)
- Dynamic frustum calculation based on viewport size
- Maintains full sheet visibility at all viewport sizes

### File Structure
```
public/
├── images/
│   ├── contact-sheet-placeholder.jpg  (Background sheet)
│   └── 600x900.jpg                    (Placeholder images)
src/
├── components/
│   ├── ContactSheet.js    (Main interaction logic)
│   └── GridLayout.js      (Grid calculations and positioning)
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
- Orthographic camera for consistent viewing
- Dynamic frustum calculation for zooming
- Smooth transitions between states using GSAP
- Z-position management for proper layering of elements

#### Interaction System
- Gesture-based navigation (swipe to navigate between images)
- Single-click navigation for desktop/tablet (click adjacent images)
- Raycasting for precise hit detection on placeholders
- Drag vs. click detection using movement threshold
- State management for preventing interaction during transitions

#### Animation System
- Camera position animations for zooming and panning
- Frustum animations for smooth zoom effects
- Configurable animation durations in constants:
  ```javascript
  const ANIMATION_DURATIONS = {
      INITIAL_ZOOM: 1,
      SUBSEQUENT_MOVEMENT: 0.3,  // Adjacent image navigation speed
      ZOOM_OUT_POSITION: 0.57,
      ZOOM_OUT_FRUSTUM: 0.85,
      ZOOM_OUT_DELAY: 0.25
  };
  ```

#### Image Loading and Rendering
- TextureLoader for loading image assets
- Three.js MeshBasicMaterial for rendering
- Proper Z-ordering:
  - Contact sheet background at z=-3
  - Image placeholders at z=-2

#### Adjacent Image Navigation
- Single-click navigation for desktop and tablet users
- Compatible with existing gestural navigation
- 5-pixel threshold to distinguish between clicks and drags
- Fallback detection for finding nearest image when direct intersection fails

```javascript
// Adjacent image click detection
handleAdjacentImageClick(event) {
    // Find which image was clicked
    // ...
    
    // Check if the clicked image is adjacent to the current one
    const isAdjacent = 
        (Math.abs(clickedImage.row - this.currentImage.row) <= 1 &&
         Math.abs(clickedImage.col - this.currentImage.col) <= 1) &&
        !(clickedImage.row === this.currentImage.row && 
          clickedImage.col === this.currentImage.col);
    
    if (isAdjacent) {
        const imagePos = this.layout.getImagePosition(clickedImage.row, clickedImage.col);
        
        gsap.killTweensOf(this.camera.position);
        
        gsap.to(this.camera.position, {
            x: imagePos.x,
            y: imagePos.y,
            duration: ANIMATION_DURATIONS.SUBSEQUENT_MOVEMENT,
            ease: "power2.out",
            onComplete: () => {
                this.currentImage = clickedImage;
            }
        });
    }
}
```

## Development Setup

1. Clone the repository
2. Serve the project using Live Server or similar
3. Access via http://localhost:8080 (or configured port)

## Asset Configuration
- Ensures image assets are in `public/images/` directory
- Uses relative paths from project root for Live Server

## Debug Mode
- Stats panel for performance monitoring
- Console logging for key operations

## Next Steps
- Create bottom navigation UI
- Add multiple contact sheets for different sections
- Add loading states and transitions
- Implement actual image content to replace placeholders 