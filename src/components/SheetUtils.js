import * as THREE from 'three';

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

// Simple check for desktop or tablet based on screen size
export function isDesktopOrTablet() {
    return window.innerWidth >= 768;
}

// Update camera projection matrix on resize
export function handleResize(camera, state, originalFrustum, calculateZoomFrustum) {
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