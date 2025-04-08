import * as THREE from 'three';
import { GridLayout } from './GridLayout.js';
import { SheetState } from './SheetInteraction.js';
import { ImageLoader } from './ImageLoader.js';
import { SheetAnimation } from './SheetAnimation.js';
import { ResourceManager, clearExistingImageMeshes } from './ResourceManagement.js';
import { GestureManager } from './GestureManager.js';
import { 
    DOUBLE_TAP_THRESHOLD, 
    SWIPE_VELOCITY_THRESHOLD, 
    SWIPE_DISTANCE_THRESHOLD, 
    DRAG_THRESHOLD, 
    ANIMATION_DURATIONS,
    isOverImage,
    calculateBounds,
    findNearestImage,
    isDesktopOrTablet,
    isMobile,
    calculateZoomFrustum,
    handleResize as utilsHandleResize,
    addEventListener as addEventListenerUtil,
    removeEventListeners as removeEventListenersUtil
} from './SheetUtils.js';
import { DetailView } from './DetailView.js';

export class ContactSheet {
    constructor(scene, camera, sheetId = 'sheet_one', gradientBackground = null) {
        this.scene = scene;
        this.camera = camera;
        this.layout = new GridLayout();
        this.state = SheetState.IDLE;
        this.sheetId = sheetId;
        this.gradientBackground = gradientBackground;
        
        // Initialize ResourceManager
        this.resourceManager = new ResourceManager();
        
        // Create a reusable texture loader
        this.textureLoader = new THREE.TextureLoader();
        
        // Calculate and store current frustum settings - this will be recalculated on resize
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = aspect > 1 ? 4 : 4 / aspect;
        const halfHeight = frustumSize / 2;
        const halfWidth = frustumSize * aspect / 2;
        
        // Store original camera settings
        this.originalFrustum = {
            left: -halfWidth,
            right: halfWidth,
            top: halfHeight,
            bottom: -halfHeight
        };
        
        // Interaction state
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.currentImage = { row: 0, col: 0 };
        
        // Touch state
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTime = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.swipeDirection = null;
        this.hasMovedBeyondThreshold = false;
        
        // Event listeners to be cleaned up
        this.eventListeners = [];
        
        // Initialize helper classes
        this.imageLoader = new ImageLoader();
        this.animation = new SheetAnimation(camera, gradientBackground);
        this.detailView = new DetailView();
        
        // Sheet Z position constant
        this.SHEET_Z_POSITION = -2.5;

        // Add touch point tracking with robust multi-touch protection
        this.activeTouchCount = 0;
        this.lastTouchStartTime = 0;
        this.multiTouchActive = false;  // Explicit flag for multi-touch state
    }
    
    // Main initialization method
    async init() {
        try {
            await this.setupSheet();
            await this.createImagesFromSheet();
            this.resetImageBrightness();
            this.setupGestureManager();
            this.setupResizeHandling();
        } catch (error) {
            // Failed to initialize contact sheet
            throw error;
        }
    }
    
    async setupSheet() {
        try {
            const sheetTexture = await this.imageLoader.loadTextureWithProperEncoding('images/contact-sheet-placeholder.jpg');
            
            const dimensions = this.layout.getSheetDimensions();
            const geometry = new THREE.PlaneGeometry(dimensions.width, dimensions.height);
            
            const material = new THREE.MeshBasicMaterial({
                map: sheetTexture,
                side: THREE.FrontSide
            });
            
            this.sheet = new THREE.Mesh(geometry, material);
            this.sheet.position.z = -2.5;
            this.SHEET_Z_POSITION = -2.5;
            this.scene.add(this.sheet);
            
        } catch (error) {
            // Failed to setup contact sheet
            throw error;
        }
    }
    
    setupGestureManager() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        // Direct system-level touch monitoring
        this.touchStartHandler = (e) => {
            const touchCount = e.touches.length;
            
            // If going from single to multi-touch, force cancel any ongoing pan
            if (touchCount > 1) {
                // Immediately cancel any drag operation
                this.isDragging = false;
                this.hasMovedBeyondThreshold = false;
                
                // Clear any pending pan timers
                if (this.panDelayTimer) {
                    clearTimeout(this.panDelayTimer);
                    this.panDelayTimer = null;
                }
                
                // Reset camera position if needed to prevent visual glitches
                if (this.state === SheetState.ZOOMED_IN && this.currentImage) {
                    // Force snap back to centered on current image
                    const imagePos = this.layout.getImagePosition(this.currentImage.row, this.currentImage.col);
                    gsap.killTweensOf(this.camera.position);
                    gsap.to(this.camera.position, {
                        x: imagePos.x,
                        y: imagePos.y,
                        duration: 0.1,
                        ease: "power1.out"
                    });
                }
                
                // Set explicit flag to block any pan processing
                this.multiTouchActive = true;
            } else {
                this.multiTouchActive = false;
            }
            
            // Update the touch count
            this.activeTouchCount = touchCount;
            this.lastTouchStartTime = Date.now();
        };
        
        this.touchMoveHandler = (e) => {
            // Update touch count on move (catches fingers added during move)
            const touchCount = e.touches.length;
            
            // If multi-touch detected during move, cancel any drag
            if (touchCount > 1 && !this.multiTouchActive) {
                this.isDragging = false;
                this.hasMovedBeyondThreshold = false;
                this.multiTouchActive = true;
            }
            
            this.activeTouchCount = touchCount;
        };
        
        this.touchEndHandler = (e) => {
            this.activeTouchCount = e.touches.length;
            
            // Reset multi-touch flag only when all fingers are lifted
            if (e.touches.length === 0) {
                this.multiTouchActive = false;
            }
        };
        
        this.touchCancelHandler = (e) => {
            this.activeTouchCount = e.touches.length;
            
            // Reset multi-touch flag only when all fingers are lifted
            if (e.touches.length === 0) {
                this.multiTouchActive = false;
            }
        };
        
        // Add system event listeners with proper cleanup tracking
        canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
        canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
        canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
        canvas.addEventListener('touchcancel', this.touchCancelHandler, { passive: false });
        
        // Add specific handler for Safari's gesturechange event
        this.gestureChangeHandler = (e) => {
            // Force cancel any pan operation
            this.isDragging = false;
            this.hasMovedBeyondThreshold = false;
            this.multiTouchActive = true;
            e.preventDefault();
        };
        
        canvas.addEventListener('gesturestart', this.gestureChangeHandler, { passive: false });
        canvas.addEventListener('gesturechange', this.gestureChangeHandler, { passive: false });
        canvas.addEventListener('gestureend', this.gestureChangeHandler, { passive: false });
        
        this.gestureManager = new GestureManager(canvas, {
            onPanStart: this.handlePanStart.bind(this),
            onPanMove: this.handlePanMove.bind(this),
            onPanEnd: this.handlePanEnd.bind(this),
            onSwipe: this.handleSwipe.bind(this),
            onTap: this.handleTap.bind(this),
            onPinchStart: this.handlePinchStart.bind(this),
            onPinchIn: this.handlePinchIn.bind(this),
            onPinchOut: this.handlePinchOut.bind(this),
            onPinchEnd: this.handlePinchEnd.bind(this)
        });
        
        // Set cursor styles
        this.setupCursorStyles(canvas);
    }
    
    setupCursorStyles(canvas) {
        // Handle cursor style based on hover
        addEventListenerUtil(canvas, 'mousemove', (event) => {
            if (this.state === SheetState.ANIMATING) return;
            
            this.updatePointerPosition(event);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            canvas.style.cursor = (intersects.length > 0 && this.isOverImage(intersects[0].uv)) 
                ? 'pointer' 
                : 'default';
        }, this.eventListeners);
        
        addEventListenerUtil(canvas, 'mouseleave', () => {
            canvas.style.cursor = 'default';
        }, this.eventListeners);
    }
    
    setupResizeHandling() {
        // Handle resize events for camera adjustment
        addEventListenerUtil(window, 'resize', () => {
            this.handleResize();
        }, this.eventListeners);
    }
    
    handleTap(event) {
        if (this.state === SheetState.ANIMATING) return;
        
        // Convert touch coordinates to Three.js coordinates
        this.updatePointerFromTouch(event.center);
        
        if (this.state === SheetState.IDLE) {
            // When in idle state, tapping zooms in to an image
            this.handleInitialZoom(event);
        } else if (this.state === SheetState.ZOOMED_IN) {
            // When zoomed in, tap handles image interactions
            this.handleImageTap(event);
        }
    }
    
    handlePanStart(event) {
        // Immediately block pan if multi-touch is active
        if (this.activeTouchCount > 1 || this.multiTouchActive) return;
        
        if (this.state === SheetState.ANIMATING) return;
        
        if (this.state === SheetState.ZOOMED_IN) {
            // Trigger pan immediately for single touch
            this.isDragging = true;
            this.hasMovedBeyondThreshold = false;
            this.startX = event.center.x;
            this.startY = event.center.y;
            this.lastX = this.startX;
            this.lastY = this.startY;
            this.lastTime = performance.now();
            this.velocityX = 0;
            this.velocityY = 0;
            this.swipeDirection = null;
            
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.cursor = 'grabbing';
            }
        }
    }
    
    handlePanMove(event) {
        // Strictly block pan during multi-touch
        if (this.activeTouchCount > 1 || this.multiTouchActive) {
            this.isDragging = false;
            return;
        }
        
        if (!this.isDragging || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
        
        // Calculate distance moved to distinguish between click and drag
        if (!this.hasMovedBeyondThreshold) {
            const deltaX = Math.abs(event.center.x - this.startX);
            const deltaY = Math.abs(event.center.y - this.startY);
            
            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                this.hasMovedBeyondThreshold = true;
            }
        }
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        
        this.velocityX = (event.center.x - this.lastX) / deltaTime;
        this.velocityY = (event.center.y - this.lastY) / deltaTime;
        
        if (!this.swipeDirection) {
            const deltaX = Math.abs(event.center.x - this.startX);
            const deltaY = Math.abs(event.center.y - this.startY);
            this.swipeDirection = deltaX > deltaY ? 'horizontal' : 'vertical';
        }
        
        const scale = (this.camera.top - this.camera.bottom) / window.innerHeight;
        const deltaX = (event.center.x - this.lastX) * scale;
        const deltaY = (event.center.y - this.lastY) * scale;
        
        if (this.swipeDirection === 'horizontal') {
            this.camera.position.x -= deltaX;
            
            if (this.gradientBackground) {
                const parallaxFactor = 0.15;
                this.gradientBackground.position.x -= deltaX * parallaxFactor;
            }
        } else {
            this.camera.position.y += deltaY;
            
            if (this.gradientBackground) {
                const parallaxFactor = 0.15;
                this.gradientBackground.position.y += deltaY * parallaxFactor;
            }
        }
        
        this.lastX = event.center.x;
        this.lastY = event.center.y;
        this.lastTime = currentTime;
    }
    
    handlePanEnd(event) {
        // Strictly block pan end during multi-touch
        if (this.activeTouchCount > 1 || this.multiTouchActive) {
            this.isDragging = false;
            return;
        }
        
        if (!this.isDragging || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
        
        if (this.isPinching) return;
        
        this.isDragging = false;
        
        const canvas = document.querySelector('canvas');
        if (canvas) {
            this.updatePointerFromTouch(event.center);
            const intersects = this.raycaster.intersectObject(this.sheet);
            canvas.style.cursor = (intersects.length > 0 && this.isOverImage(intersects[0].uv)) 
                ? 'pointer' 
                : 'default';
        }
        
        if (!this.hasMovedBeyondThreshold) {
            return;
        }
        
        const totalDeltaX = event.center.x - this.startX;
        const totalDeltaY = event.center.y - this.startY;
        
        let targetImage = { ...this.currentImage };
        
        if (this.swipeDirection === 'horizontal') {
            const shouldMove = Math.abs(this.velocityX) > SWIPE_VELOCITY_THRESHOLD || Math.abs(totalDeltaX) > SWIPE_DISTANCE_THRESHOLD;
            if (shouldMove) {
                if (this.velocityX > 0 || totalDeltaX > 0) {
                    targetImage.col = Math.max(0, this.currentImage.col - 1);
                } else {
                    targetImage.col = Math.min(this.layout.columns - 1, this.currentImage.col + 1);
                }
            }
        } else {
            const shouldMove = Math.abs(this.velocityY) > SWIPE_VELOCITY_THRESHOLD || Math.abs(totalDeltaY) > SWIPE_DISTANCE_THRESHOLD;
            if (shouldMove) {
                if (this.velocityY > 0 || totalDeltaY > 0) {
                    targetImage.row = Math.max(0, this.currentImage.row - 1);
                } else {
                    targetImage.row = Math.min(this.layout.rows - 1, this.currentImage.row + 1);
                }
            }
        }
        
        this.moveToImage(targetImage);
    }
    
    handleSwipe(event) {
        // The Pan handlers already handle this behavior more precisely
    }
    
    moveToImage(targetImage) {
        const imagePos = this.layout.getImagePosition(targetImage.row, targetImage.col);
        
        gsap.killTweensOf(this.camera.position);
        
        this.state = SheetState.ANIMATING;
        
        this.setImageBrightness(targetImage.row, targetImage.col);
        
        gsap.to(this.camera.position, {
            x: imagePos.x,
            y: imagePos.y,
            duration: ANIMATION_DURATIONS.SUBSEQUENT_MOVEMENT,
            ease: "power2.out",
            onComplete: () => {
                this.currentImage = targetImage;
                
                setTimeout(() => {
                    this.state = SheetState.ZOOMED_IN;
                }, 150);
            }
        });
    }
    
    // Handle tapping an image when zoomed in
    handleImageTap(event) {
        const image = this.getImageAtPointer();
        if (!image) return;
        
        // If tapping the current image, show detail view
        if (image.row === this.currentImage.row && image.col === this.currentImage.col) {
            this.showDetailView();
            return;
        }
        
        // Allow clicking on any visible image, not just adjacent ones
        this.moveToImage(image);
    }
    
    // Update pointer position from a touch event (for Hammer.js)
    updatePointerFromTouch(touchPoint) {
        this.pointer.x = (touchPoint.x / window.innerWidth) * 2 - 1;
        this.pointer.y = -(touchPoint.y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
    }
    
    // Handle initial zoom into an image
    handleInitialZoom(event) {
        const image = this.getImageAtPointer();
        if (image) {
            const imagePos = this.layout.getImagePosition(image.row, image.col);
            this.zoomToImage(imagePos, image.row, image.col);
            
            setTimeout(() => {
                if (this.state === SheetState.ANIMATING) {
                    this.setImageBrightness(image.row, image.col);
                }
            }, 250);
        }
    }
    
    // Consolidated cleanup/dispose method
    dispose() {
        this.removeEventListeners();
        
        if (this.panDelayTimer) {
            clearTimeout(this.panDelayTimer);
            this.panDelayTimer = null;
        }
        
        if (this.gestureManager) {
            this.gestureManager.dispose();
        }
        
        // Remove specific gesture event listener
        const canvas = document.querySelector('canvas');
        if (canvas) {
            // Clean up system-level touch handlers
            if (this.touchStartHandler) {
                canvas.removeEventListener('touchstart', this.touchStartHandler);
            }
            if (this.touchMoveHandler) {
                canvas.removeEventListener('touchmove', this.touchMoveHandler);
            }
            if (this.touchEndHandler) {
                canvas.removeEventListener('touchend', this.touchEndHandler);
            }
            if (this.touchCancelHandler) {
                canvas.removeEventListener('touchcancel', this.touchCancelHandler);
            }
            
            // Clean up gesture handlers
            if (this.gestureChangeHandler) {
                canvas.removeEventListener('gesturestart', this.gestureChangeHandler);
                canvas.removeEventListener('gesturechange', this.gestureChangeHandler);
                canvas.removeEventListener('gestureend', this.gestureChangeHandler);
            }
        }
        
        this.resourceManager.disposeThreeJsObjects(this.scene, this.sheet, this.SHEET_Z_POSITION);
        
        if (window.gsap) {
            window.gsap.killTweensOf(this.camera);
            window.gsap.killTweensOf(this.camera.position);
        }

        if (this.detailView) {
            this.detailView.dispose();
        }
    }
    
    // Split out event listener cleanup for clarity
    removeEventListeners() {
        this.eventListeners = removeEventListenersUtil(this.eventListeners);
    }
    
    // Add passive option for touch and wheel events
    addEventListener(element, type, handler) {
        addEventListenerUtil(element, type, handler, this.eventListeners);
    }
    
    updatePointerPosition(event) {
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
    }
    
    getImageAtPointer() {
        const intersects = this.raycaster.intersectObject(this.sheet);
        if (intersects.length === 0) return null;
        
        const uv = intersects[0].uv;
        if (!this.isOverImage(uv)) return null;
        
        const gridX = Math.floor((uv.x * this.layout.sheetWidth - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
        const gridY = Math.floor(((1 - uv.y) * this.layout.sheetHeight - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
        
        return { row: gridY, col: gridX };
    }
    
    // Start dragging the sheet
    startDragging(event) {
        this.isDragging = true;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.lastX = this.startX;
        this.lastY = this.startY;
        this.lastTime = performance.now();
        this.velocityX = 0;
        this.velocityY = 0;
        this.swipeDirection = null;
        event.preventDefault();
        
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.cursor = 'grabbing';
        }
    }
    
    // Handle dragging while zoomed in
    handleDragging(event) {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        
        this.velocityX = (event.clientX - this.lastX) / deltaTime;
        this.velocityY = (event.clientY - this.lastY) / deltaTime;
        
        if (!this.swipeDirection) {
            const deltaX = Math.abs(event.clientX - this.startX);
            const deltaY = Math.abs(event.clientY - this.startY);
            this.swipeDirection = deltaX > deltaY ? 'horizontal' : 'vertical';
        }
        
        const scale = (this.camera.top - this.camera.bottom) / window.innerHeight;
        const deltaX = (event.clientX - this.lastX) * scale;
        const deltaY = (event.clientY - this.lastY) * scale;
        
        if (this.swipeDirection === 'horizontal') {
            this.camera.position.x -= deltaX;
            
            if (this.gradientBackground) {
                const parallaxFactor = 0.15;
                this.gradientBackground.position.x -= deltaX * parallaxFactor;
            }
        } else {
            this.camera.position.y += deltaY;
            
            if (this.gradientBackground) {
                const parallaxFactor = 0.15;
                this.gradientBackground.position.y += deltaY * parallaxFactor;
            }
        }
        
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        this.lastTime = currentTime;
    }
    
    // Handle drag end, possibly transitioning to next image
    handleDragEnd(event) {
        this.isDragging = false;
        
        const canvas = document.querySelector('canvas');
        if (canvas) {
            this.updatePointerPosition(event);
            const intersects = this.raycaster.intersectObject(this.sheet);
            canvas.style.cursor = (intersects.length > 0 && this.isOverImage(intersects[0].uv)) 
                ? 'pointer' 
                : 'default';
        }
        
        if (!this.hasMovedBeyondThreshold) {
            return;
        }
        
        const totalDeltaX = event.clientX - this.startX;
        const totalDeltaY = event.clientY - this.startY;
        
        let targetImage = { ...this.currentImage };
        
        if (this.swipeDirection === 'horizontal') {
            const shouldMove = Math.abs(this.velocityX) > SWIPE_VELOCITY_THRESHOLD || Math.abs(totalDeltaX) > SWIPE_DISTANCE_THRESHOLD;
            if (shouldMove) {
                if (this.velocityX > 0 || totalDeltaX > 0) {
                    targetImage.col = Math.max(0, this.currentImage.col - 1);
                } else {
                    targetImage.col = Math.min(this.layout.columns - 1, this.currentImage.col + 1);
                }
            }
        } else {
            const shouldMove = Math.abs(this.velocityY) > SWIPE_VELOCITY_THRESHOLD || Math.abs(totalDeltaY) > SWIPE_DISTANCE_THRESHOLD;
            if (shouldMove) {
                if (this.velocityY > 0 || totalDeltaY > 0) {
                    targetImage.row = Math.max(0, this.currentImage.row - 1);
                } else {
                    targetImage.row = Math.min(this.layout.rows - 1, this.currentImage.row + 1);
                }
            }
        }
        
        const imagePos = this.layout.getImagePosition(targetImage.row, targetImage.col);
        
        gsap.killTweensOf(this.camera.position);
        
        this.state = SheetState.ANIMATING;
        
        this.setImageBrightness(targetImage.row, targetImage.col);
        
        gsap.to(this.camera.position, {
            x: imagePos.x,
            y: imagePos.y,
            duration: ANIMATION_DURATIONS.SUBSEQUENT_MOVEMENT,
            ease: "power2.out",
            onComplete: () => {
                this.currentImage = targetImage;
                
                setTimeout(() => {
                    this.state = SheetState.ZOOMED_IN;
                }, 150);
            }
        });
    }
    
    // Handle clicking on an image when zoomed in
    handleAdjacentImageClick(event) {
        this.updatePointerPosition(event);
        
        const image = this.getImageAtPointer();
        if (!image) return;
        
        // If clicking the current image, show detail view
        if (image.row === this.currentImage.row && image.col === this.currentImage.col) {
            this.showDetailView();
            return;
        }
        
        // Allow clicking on any visible image, not just adjacent ones
        this.moveToImage(image);
    }
    
    showDetailView() {
        if (this.state !== SheetState.ZOOMED_IN) return;

        const filename = this.imageMapping[this.currentImage.row][this.currentImage.col];
        const imageData = {
            filename: filename,
            url: `images/${this.sheetId}/${filename}`,
        };

        this.detailView.show(imageData, this.camera, () => {});
    }
    
    // Maintain backward compatibility
    cleanup() {
        this.dispose();
    }
    
    // Use the utility function for isOverImage
    isOverImage(uv) {
        return isOverImage(uv, this.layout);
    }
    
    // Use the utility function for calculateZoomFrustum
    calculateZoomFrustum() {
        return calculateZoomFrustum();
    }
    
    // Use the utility function for calculateBounds
    calculateBounds() {
        return calculateBounds(this.layout);
    }
    
    // Use the utility function for findNearestImage
    findNearestImage(x, y) {
        return findNearestImage(x, y, this.layout);
    }
    
    // Delegate to the utility functions for device detection
    isDesktopOrTablet() {
        return isDesktopOrTablet();
    }
    
    isMobile() {
        return isMobile();
    }
    
    // Delegate to the utility function for handleResize
    handleResize() {
        utilsHandleResize(this.camera, this.state, this.originalFrustum, this.calculateZoomFrustum.bind(this));
    }
    
    // Set image brightness to highlight the active image
    setImageBrightness(activeRow, activeCol) {
        this.animation.setImageBrightness(this.scene, activeRow, activeCol);
    }
    
    // Restore all images to full brightness
    resetImageBrightness() {
        this.animation.resetImageBrightness(this.scene);
    }
    
    // Zoom to a specific image
    zoomToImage(imagePos, row, col) {
        // Define the callback for when animation is complete
        const onZoomComplete = () => {
            this.currentImage = { row, col };
            this.state = SheetState.ZOOMED_IN;
        };
        
        // Use SheetAnimation to handle the zoom animation
        this.animation.zoomToImage(
            imagePos,
            row,
            col,
            this.state,
            onZoomComplete,
            () => this.setImageBrightness(row, col)
        );
        
        // Set the state to animating
        this.state = SheetState.ANIMATING;
    }
    
    // Create images from sheet
    async createImagesFromSheet() {
        try {
            // Get list of image filenames for the current sheet
            const imageFiles = await this.imageLoader.getSheetImageFiles(this.sheetId);
            
            // Create a reusable geometry for all images
            const imageDimensions = {
                width: this.layout.imageWidth * this.layout.scale,
                height: this.layout.imageHeight * this.layout.scale
            };
            const geometry = new THREE.PlaneGeometry(imageDimensions.width, imageDimensions.height);
            
            // Mapping to track which row/col has which image
            this.imageMapping = [];
            
            // Clear existing meshes to prevent overlapping
            clearExistingImageMeshes(this.scene, this.sheet, this.SHEET_Z_POSITION);
            
            // Load and create images in grid
            const loadingPromises = [];
            let imageIndex = 0;
            let successCount = 0;
            let errorCount = 0;
            
            for (let row = 0; row < this.layout.rows; row++) {
                this.imageMapping[row] = [];
                
                for (let col = 0; col < this.layout.columns; col++) {
                    // If we've run out of images, stop creating more
                    if (imageIndex >= imageFiles.length) break;
                    
                    const filename = imageFiles[imageIndex];
                    this.imageMapping[row][col] = filename;
                    
                    const texturePath = `images/${this.sheetId}/${filename}`;
                    
                    // Create a promise for loading this image with correct settings
                    const loadPromise = this.imageLoader.loadTextureWithProperEncoding(texturePath)
                        .then(texture => {
                            // Create simple material with no special settings
                            const material = new THREE.MeshBasicMaterial({ 
                                map: texture,
                                side: THREE.FrontSide,
                                transparent: true, // Keep this for other potential uses
                                color: new THREE.Color(1, 1, 1) // Start with white color multiplier
                            });
                            
                            const mesh = new THREE.Mesh(geometry, material);
                            
                            // Position the mesh
                            const position = this.layout.getImagePosition(row, col);
                            mesh.position.set(
                                position.x, 
                                position.y, 
                                this.SHEET_Z_POSITION + 0.01
                            );
                            
                            // Store reference to row/col in the mesh for later use
                            mesh.userData = { row, col, filename, isSheetImage: true };
                            
                            // Add to scene
                            this.scene.add(mesh);
                            successCount++;
                        })
                        .catch(error => {
                            // Failed to load image, create a fallback
                            errorCount++;
                            
                            // Create a fallback colored material instead
                            const fallbackMaterial = new THREE.MeshBasicMaterial({ 
                                color: 0x333333,
                                transparent: true,
                                opacity: 0.8 
                            });
                            
                            const mesh = new THREE.Mesh(geometry, fallbackMaterial);
                            const position = this.layout.getImagePosition(row, col);
                            mesh.position.set(position.x, position.y, this.SHEET_Z_POSITION + 0.01);
                            mesh.userData = { row, col, filename, isPlaceholder: true, isSheetImage: true };
                            this.scene.add(mesh);
                        });
                    
                    loadingPromises.push(loadPromise);
                    imageIndex++;
                }
            }
            
            // Wait for all images to load
            await Promise.all(loadingPromises);
            
            // If all images failed, throw an error to be caught
            if (successCount === 0 && errorCount > 0) {
                throw new Error(`Failed to load any images for sheet "${this.sheetId}"`);
            }
            
        } catch (error) {
            // Failed to create images
            throw error;
        }
    }
    
    // Zoom out to show the entire sheet
    zoomOut() {
        // Define callback for when zoom out is complete
        const onZoomOutComplete = () => {
            // Add a small cooldown period after animation completes
            // to prevent accidental clicks
            setTimeout(() => {
                this.state = SheetState.IDLE;
            }, 150); // 150ms cooldown after animation ends
        };
        
        // Use SheetAnimation to handle the zoom out animation
        this.animation.zoomOut(
            this.state,
            this.originalFrustum,
            () => this.resetImageBrightness(),
            onZoomOutComplete
        );
        
        // Set the state to animating
        this.state = SheetState.ANIMATING;
    }
    
    // Keep the old method name for backward compatibility but have it call the new method
    async createPlaceholderImages() {
        // DEPRECATED: This method is kept for backward compatibility
        // The programmatically generated placeholder rectangles are no longer used
        // as we're loading actual JPG images instead
        return this.createImagesFromSheet();
    }
    
    // Pinch gesture handlers
    handlePinchStart(event) {
        if (this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
        
        // Direct fix: Force cancel any ongoing pan gesture immediately
        this.isPinching = true;
        this.initialPinchScale = event.scale;
        
        // Force reset any ongoing drag state
        if (this.isDragging) {
            this.isDragging = false;
            
            // Reset camera position if it was moved by panning
            if (this.hasMovedBeyondThreshold) {
                const imagePos = this.layout.getImagePosition(this.currentImage.row, this.currentImage.col);
                gsap.killTweensOf(this.camera.position);
                gsap.to(this.camera.position, {
                    x: imagePos.x,
                    y: imagePos.y,
                    duration: 0.1,
                    ease: "power1.out"
                });
            }
            
            // Reset cursor style
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.cursor = 'pointer';
            }
        }
        
        // Update pointer to center of pinch
        this.updatePointerFromTouch(event.center);
        
        // Verify we're over the current active image
        const image = this.getImageAtPointer();
        if (!image || image.row !== this.currentImage.row || image.col !== this.currentImage.col) {
            this.isPinching = false;
        }
    }
    
    handlePinchOut(event) {
        if (!this.isPinching || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
        
        // Calculate pinch change relative to initial scale
        const pinchChange = event.scale / this.initialPinchScale;
        
        // Only show detail view if pinch is significant enough
        if (pinchChange > 1.3) {
            this.isPinching = false; // Reset to prevent multiple triggers
            
            // Ensure any pan operation is completely stopped
            this.isDragging = false;
            this.hasMovedBeyondThreshold = false;
            
            // Use the exact same method as tap to show detail view
            this.showDetailView();
        }
    }
    
    handlePinchEnd() {
        this.isPinching = false;
    }
    
    // Add pinch-in handler to zoom out
    handlePinchIn(event) {
        if (!this.isPinching || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
        
        // Calculate pinch change relative to initial scale
        const pinchChange = event.scale / this.initialPinchScale;
        
        // Only trigger zoom out if pinch is significant enough
        if (pinchChange < 0.7) {
            this.isPinching = false; // Reset to prevent multiple triggers
            
            // Ensure any pan operation is completely stopped
            this.isDragging = false;
            this.hasMovedBeyondThreshold = false;
            
            // Use the same zoom out method that's used elsewhere
            this.zoomOut();
        }
    }
} 