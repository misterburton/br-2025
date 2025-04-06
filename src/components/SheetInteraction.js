import * as THREE from 'three';

// Constants
const DOUBLE_TAP_THRESHOLD = 300; // ms
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const SWIPE_DISTANCE_THRESHOLD = 50; // pixels
const DRAG_THRESHOLD = 5; // pixels - distance before a click becomes a drag
const ANIMATION_DURATIONS = {
    INITIAL_ZOOM: 1,
    SUBSEQUENT_MOVEMENT: 0.3,
    ZOOM_OUT_POSITION: 0.57,
    ZOOM_OUT_FRUSTUM: 0.85,
    ZOOM_OUT_DELAY: 0.25
};

// State enum
const SheetState = {
    IDLE: 'idle',
    ZOOMED_IN: 'zoomed_in',
    ANIMATING: 'animating'
};

export function setupSheetInteraction(sheet) {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    // Add click flag to track if we've dragged past threshold
    sheet.hasMovedBeyondThreshold = false;
    
    // Handle cursor style based on hover
    sheet.addEventListener(canvas, 'mousemove', (event) => {
        if (sheet.state === SheetState.ANIMATING) return;
        
        sheet.updatePointerPosition(event);
        const intersects = sheet.raycaster.intersectObject(sheet.sheet);
        
        canvas.style.cursor = (intersects.length > 0 && sheet.isOverImage(intersects[0].uv)) 
            ? 'pointer' 
            : 'default';
    });
    
    sheet.addEventListener(canvas, 'mouseleave', () => {
        canvas.style.cursor = 'default';
    });
    
    // Handle pointer down for initial zoom
    sheet.addEventListener(canvas, 'pointerdown', (event) => {
        if (sheet.state === SheetState.ANIMATING) return;
        
        // Reset move threshold flag on pointer down
        sheet.hasMovedBeyondThreshold = false;
        
        if (sheet.state === SheetState.ZOOMED_IN) {
            sheet.startDragging(event);
        } else {
            sheet.handleInitialZoom(event);
        }
    });
    
    // Handle pointer move for dragging
    sheet.addEventListener(canvas, 'pointermove', (event) => {
        if (!sheet.isDragging || sheet.state !== SheetState.ZOOMED_IN || sheet.state === SheetState.ANIMATING) return;
        
        // Calculate distance moved to distinguish between click and drag
        if (!sheet.hasMovedBeyondThreshold) {
            const deltaX = Math.abs(event.clientX - sheet.startX);
            const deltaY = Math.abs(event.clientY - sheet.startY);
            
            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                sheet.hasMovedBeyondThreshold = true;
            }
        }
        
        sheet.handleDragging(event);
    });
    
    // Handle pointer up for drag end or click
    sheet.addEventListener(canvas, 'pointerup', (event) => {
        if (sheet.state !== SheetState.ZOOMED_IN || sheet.state === SheetState.ANIMATING) return;
        
        // Only consider as a drag if we moved beyond threshold
        if (sheet.isDragging) {
            if (sheet.hasMovedBeyondThreshold) {
                sheet.handleDragEnd(event);
            } else {
                // If we didn't move beyond threshold, treat as a click instead
                sheet.isDragging = false;
                
                // Reset cursor
                if (canvas) {
                    canvas.style.cursor = 'default';
                }
                
                // Handle as a click regardless of device type
                sheet.handleAdjacentImageClick(event);
            }
        }
    });
    
    // Handle double click/tap to zoom out
    let lastTapTime = 0;
    let tapTimeout;
    
    const handleZoomOut = (event) => {
        if (sheet.state !== SheetState.ZOOMED_IN || sheet.state === SheetState.ANIMATING || sheet.isDragging) return;
        event.preventDefault();
        sheet.zoomOut();
    };
    
    sheet.addEventListener(canvas, 'dblclick', handleZoomOut);
    
    sheet.addEventListener(canvas, 'touchend', (event) => {
        if (sheet.state !== SheetState.ZOOMED_IN || sheet.state === SheetState.ANIMATING || sheet.isDragging) return;
        
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        clearTimeout(tapTimeout);
        
        if (tapLength < DOUBLE_TAP_THRESHOLD && tapLength > 0) {
            handleZoomOut(event);
        }
        
        lastTapTime = currentTime;
    });
    
    // Handle resize for zoomed state
    sheet.addEventListener(window, 'resize', () => {
        if (sheet.state === SheetState.ZOOMED_IN) {
            const { size, aspect } = sheet.calculateZoomFrustum();
            const halfSize = size / 2;
            
            sheet.camera.left = -halfSize * aspect;
            sheet.camera.right = halfSize * aspect;
            sheet.camera.top = halfSize;
            sheet.camera.bottom = -halfSize;
            sheet.camera.updateProjectionMatrix();
        } else {
            // If not zoomed in, handle the resize normally
            sheet.handleResize();
        }
    });
}

// Export constants for use in other files
export { DOUBLE_TAP_THRESHOLD, SWIPE_VELOCITY_THRESHOLD, SWIPE_DISTANCE_THRESHOLD, DRAG_THRESHOLD, ANIMATION_DURATIONS, SheetState }; 