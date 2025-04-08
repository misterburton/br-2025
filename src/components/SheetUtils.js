import * as THREE from 'three';

// Constants (centralized here instead of duplicated)
export const DOUBLE_TAP_THRESHOLD = 300; // ms
export const SWIPE_VELOCITY_THRESHOLD = 0.3;
export const SWIPE_DISTANCE_THRESHOLD = 50; // pixels
export const DRAG_THRESHOLD = 5; // pixels - distance before a click becomes a drag
export const ANIMATION_DURATIONS = {
    INITIAL_ZOOM: 1,
    SUBSEQUENT_MOVEMENT: 0.3,
    ZOOM_OUT_POSITION: 0.57,
    ZOOM_OUT_FRUSTUM: 0.85,
    ZOOM_OUT_DELAY: 0.25
};

// Event listener management utilities
export function addEventListener(element, type, handler, eventListeners) {
    const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'wheel', 'mousewheel'];
    const options = passiveEvents.includes(type) ? { passive: true } : undefined;
    
    element.addEventListener(type, handler, options);
    eventListeners.push({ element, type, handler });
}

export function removeEventListeners(eventListeners) {
    eventListeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
    });
    return [];
}

// Helper to determine if a given UV coordinate is over an image
export function isOverImage(uv, layout) {
    if (!uv) return false;
    
    const gridX = Math.floor((uv.x * layout.sheetWidth - layout.firstImageX) / (layout.imageWidth + layout.horizontalMargin));
    const gridY = Math.floor(((1 - uv.y) * layout.sheetHeight - layout.firstImageY) / (layout.imageHeight + layout.verticalMargin));
    
    if (gridX < 0 || gridX >= layout.columns || gridY < 0 || gridY >= layout.rows) {
        return false;
    }
    
    const imageX = layout.firstImageX + (gridX * (layout.imageWidth + layout.horizontalMargin));
    const imageY = layout.firstImageY + (gridY * (layout.imageHeight + layout.verticalMargin));
    
    const pixelX = uv.x * layout.sheetWidth;
    const pixelY = (1 - uv.y) * layout.sheetHeight;
    
    return pixelX >= imageX && 
           pixelX <= imageX + layout.imageWidth &&
           pixelY >= imageY && 
           pixelY <= imageY + layout.imageHeight;
}

// Calculate camera bounds for the sheet
export function calculateBounds(layout) {
    const imageDims = layout.getImageDimensions();
    const halfWidth = imageDims.width / 2;
    const halfHeight = imageDims.height / 2;
    
    return {
        left: -halfWidth * (layout.columns - 1),
        right: halfWidth * (layout.columns - 1),
        top: halfHeight * (layout.rows - 1),
        bottom: -halfHeight * (layout.rows - 1)
    };
}

// Find the nearest image to a given position
export function findNearestImage(x, y, layout) {
    let minDist = Infinity;
    let nearestRow = 0;
    let nearestCol = 0;
    
    for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.columns; col++) {
            const pos = layout.getImagePosition(row, col);
            const dist = Math.sqrt(
                Math.pow(x - pos.x, 2) +
                Math.pow(y - pos.y, 2)
            );
            
            if (dist < minDist) {
                minDist = dist;
                nearestRow = row;
                nearestCol = col;
            }
        }
    }
    
    return { row: nearestRow, col: nearestCol };
}

// Simple device type detection utilities
export function isDesktopOrTablet() {
    return window.innerWidth >= 768;
}

export function isMobile() {
    return window.innerWidth < 768;
}

// Calculate zoom frustum for image detail view
export function calculateZoomFrustum() {
    // Zoom level multiplier - adjust this value to change how close the camera zooms:
    // - Higher values (e.g., 0.7, 0.8) will make the image appear smaller (zoomed out)
    // - Lower values (e.g., 0.3, 0.4) will make the image appear larger (zoomed in)
    // - Original value was 0.5
    const zoomMultiplier = 0.7;  // Adjust this value for testing
    
    // Calculate target height based on zoom multiplier
    const targetHeight = window.innerHeight * zoomMultiplier;
    
    // Calculate the frustum size needed to achieve this
    // The image height is 900px, and we want it to be targetHeight pixels tall
    const frustumSize = (targetHeight / 900) * 2; // *2 because frustum is total height
    
    return {
        size: frustumSize,
        aspect: window.innerWidth / window.innerHeight
    };
}

// Update camera projection matrix on resize
export function handleResize(camera, state, originalFrustum) {
    // Always recalculate the correct frustum based on current aspect ratio
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = aspect > 1 ? 4 : 4 / aspect;
    const halfHeight = frustumSize / 2;
    const halfWidth = frustumSize * aspect / 2;
    
    // If we're not zoomed in, update the camera immediately
    if (state !== 'zoomed_in') {
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        
        // Update the stored original frustum
        originalFrustum.left = -halfWidth;
        originalFrustum.right = halfWidth;
        originalFrustum.top = halfHeight;
        originalFrustum.bottom = -halfHeight;
    } else {
        // If zoomed in, we should maintain the zoom level but adjust for the new aspect ratio
        const { size, aspect: newAspect } = calculateZoomFrustum();
        const halfSize = size / 2;
        
        camera.left = -halfSize * newAspect;
        camera.right = halfSize * newAspect;
        camera.top = halfSize;
        camera.bottom = -halfSize;
        camera.updateProjectionMatrix();
        
        // Still update the original frustum for when we zoom out
        originalFrustum.left = -halfWidth;
        originalFrustum.right = halfWidth;
        originalFrustum.top = halfHeight;
        originalFrustum.bottom = -halfHeight;
    }
} 