import * as THREE from 'three';
import { GridLayout } from './GridLayout.js';

// Constants
const DOUBLE_TAP_THRESHOLD = 300; // ms
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const SWIPE_DISTANCE_THRESHOLD = 50; // pixels
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

export class ContactSheet {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.layout = new GridLayout();
        this.state = SheetState.IDLE;
        
        // Store original camera settings
        this.originalFrustum = {
            left: camera.left,
            right: camera.right,
            top: camera.top,
            bottom: camera.bottom
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
        
        // Event listeners to be cleaned up
        this.eventListeners = [];
    }
    
    async init() {
        try {
            await this.setupSheet();
            this.setupInteraction();
        } catch (error) {
            console.error('Failed to initialize contact sheet:', error);
            throw error;
        }
    }
    
    cleanup() {
        // Remove all event listeners
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
    }
    
    addEventListener(element, type, handler) {
        element.addEventListener(type, handler);
        this.eventListeners.push({ element, type, handler });
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
    
    setupInteraction() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        // Handle cursor style based on hover
        this.addEventListener(canvas, 'mousemove', (event) => {
            if (this.state === SheetState.ANIMATING) return;
            
            this.updatePointerPosition(event);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            canvas.style.cursor = (intersects.length > 0 && this.isOverImage(intersects[0].uv)) 
                ? 'pointer' 
                : 'default';
        });
        
        this.addEventListener(canvas, 'mouseleave', () => {
            canvas.style.cursor = 'default';
        });
        
        // Handle pointer down for initial zoom
        this.addEventListener(canvas, 'pointerdown', (event) => {
            if (this.state === SheetState.ANIMATING) return;
            
            if (this.state === SheetState.ZOOMED_IN) {
                this.startDragging(event);
            } else {
                this.handleInitialZoom(event);
            }
        });
        
        // Handle pointer move for dragging
        this.addEventListener(canvas, 'pointermove', (event) => {
            if (!this.isDragging || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
            this.handleDragging(event);
        });
        
        // Handle pointer up for drag end
        this.addEventListener(canvas, 'pointerup', (event) => {
            if (!this.isDragging || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
            this.handleDragEnd(event);
        });
        
        // Handle double click/tap to zoom out
        let lastTapTime = 0;
        let tapTimeout;
        
        const handleZoomOut = (event) => {
            if (this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING || this.isDragging) return;
            event.preventDefault();
            this.zoomOut();
        };
        
        this.addEventListener(canvas, 'dblclick', handleZoomOut);
        
        this.addEventListener(canvas, 'touchend', (event) => {
            if (this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING || this.isDragging) return;
            
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;
            
            clearTimeout(tapTimeout);
            
            if (tapLength < DOUBLE_TAP_THRESHOLD && tapLength > 0) {
                handleZoomOut(event);
            }
            
            lastTapTime = currentTime;
        });
        
        // Handle resize for zoomed state
        this.addEventListener(window, 'resize', () => {
            if (this.state === SheetState.ZOOMED_IN) {
                const { size, aspect } = this.calculateZoomFrustum();
                const halfSize = size / 2;
                
                this.camera.left = -halfSize * aspect;
                this.camera.right = halfSize * aspect;
                this.camera.top = halfSize;
                this.camera.bottom = -halfSize;
                this.camera.updateProjectionMatrix();
            }
        });
    }
    
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
        
        // Set grabbing cursor
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.cursor = 'grabbing';
        }
    }
    
    handleInitialZoom(event) {
        event.preventDefault();
        this.updatePointerPosition(event);
        
        const image = this.getImageAtPointer();
        if (image) {
            const imagePos = this.layout.getImagePosition(image.row, image.col);
            this.zoomToImage(imagePos, image.row, image.col);
        }
    }
    
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
        } else {
            this.camera.position.y += deltaY;
        }
        
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        this.lastTime = currentTime;
    }
    
    handleDragEnd(event) {
        this.isDragging = false;
        
        // Reset cursor based on whether we're over an image
        const canvas = document.querySelector('canvas');
        if (canvas) {
            this.updatePointerPosition(event);
            const intersects = this.raycaster.intersectObject(this.sheet);
            canvas.style.cursor = (intersects.length > 0 && this.isOverImage(intersects[0].uv)) 
                ? 'pointer' 
                : 'default';
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
        
        gsap.to(this.camera.position, {
            x: imagePos.x,
            y: imagePos.y,
            duration: ANIMATION_DURATIONS.SUBSEQUENT_MOVEMENT,
            ease: "power2.out",
            onComplete: () => {
                this.currentImage = targetImage;
            }
        });
    }
    
    zoomToImage(imagePos, row, col) {
        const { size, aspect } = this.calculateZoomFrustum();
        const halfSize = size / 2;
        
        const isSubsequentMovement = this.state === SheetState.ZOOMED_IN;
        this.state = SheetState.ANIMATING;
        
        // Animate camera frustum
        gsap.to(this.camera, {
            left: -halfSize * aspect,
            right: halfSize * aspect,
            top: halfSize,
            bottom: -halfSize,
            duration: isSubsequentMovement ? 0.3 : 1,
            ease: isSubsequentMovement ? "power2.inOut" : "power2.inOut",
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            }
        });
        
        // Animate camera position
        gsap.to(this.camera.position, {
            x: imagePos.x,
            y: imagePos.y,
            duration: isSubsequentMovement ? 0.5 : 1.5,
            ease: isSubsequentMovement ? "power2.inOut" : "power4.inOut",
            overwrite: false,
            onComplete: () => {
                this.currentImage = { row, col };
                this.state = SheetState.ZOOMED_IN;
            }
        });
    }
    
    zoomOut() {
        this.state = SheetState.ANIMATING;
        
        gsap.to(this.camera.position, {
            x: 0,
            y: 0,
            duration: ANIMATION_DURATIONS.ZOOM_OUT_POSITION,
            ease: "power3.in",
            overwrite: false
        });
        
        gsap.to(this.camera, {
            left: this.originalFrustum.left,
            right: this.originalFrustum.right,
            top: this.originalFrustum.top,
            bottom: this.originalFrustum.bottom,
            duration: ANIMATION_DURATIONS.ZOOM_OUT_FRUSTUM,
            delay: ANIMATION_DURATIONS.ZOOM_OUT_DELAY,
            ease: "power3.inOut",
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            },
            onComplete: () => {
                this.state = SheetState.IDLE;
            }
        });
    }
    
    async setupSheet() {
        try {
            const textureLoader = new THREE.TextureLoader();
            const sheetTexture = await new Promise((resolve, reject) => {
                textureLoader.load(
                    './src/assets/images/contact-sheet-placeholder.jpg',
                    (texture) => {
                        texture.repeat.set(1, 1);
                        texture.offset.set(0, 0);
                        resolve(texture);
                    },
                    undefined,
                    reject
                );
            });
            
            const dimensions = this.layout.getSheetDimensions();
            const geometry = new THREE.PlaneGeometry(dimensions.width, dimensions.height);
            const material = new THREE.MeshBasicMaterial({
                map: sheetTexture,
                side: THREE.DoubleSide,
                transparent: false,
                opacity: 1,
                color: 0xffffff
            });
            
            this.sheet = new THREE.Mesh(geometry, material);
            this.sheet.position.set(0, 0, -0.1);
            this.scene.add(this.sheet);
            
        } catch (error) {
            console.error('Failed to setup contact sheet:', error);
        }
    }
    
    isOverImage(uv) {
        if (!uv) return false;
        
        const gridX = Math.floor((uv.x * this.layout.sheetWidth - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
        const gridY = Math.floor(((1 - uv.y) * this.layout.sheetHeight - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
        
        if (gridX < 0 || gridX >= this.layout.columns || gridY < 0 || gridY >= this.layout.rows) {
            return false;
        }
        
        const imageX = this.layout.firstImageX + (gridX * (this.layout.imageWidth + this.layout.horizontalMargin));
        const imageY = this.layout.firstImageY + (gridY * (this.layout.imageHeight + this.layout.verticalMargin));
        
        const pixelX = uv.x * this.layout.sheetWidth;
        const pixelY = (1 - uv.y) * this.layout.sheetHeight;
        
        return pixelX >= imageX && 
               pixelX <= imageX + this.layout.imageWidth &&
               pixelY >= imageY && 
               pixelY <= imageY + this.layout.imageHeight;
    }
    
    calculateZoomFrustum() {
        // We want the image to take up 50% of the viewport height
        const targetHeight = window.innerHeight * 0.5;
        
        // Calculate the frustum size needed to achieve this
        // The image height is 900px, and we want it to be targetHeight pixels tall
        const frustumSize = (targetHeight / 900) * 2; // *2 because frustum is total height
        
        return {
            size: frustumSize,
            aspect: window.innerWidth / window.innerHeight
        };
    }
    
    calculateBounds() {
        const imageDims = this.layout.getImageDimensions();
        const halfWidth = imageDims.width / 2;
        const halfHeight = imageDims.height / 2;
        
        return {
            left: -halfWidth * (this.layout.columns - 1),
            right: halfWidth * (this.layout.columns - 1),
            top: halfHeight * (this.layout.rows - 1),
            bottom: -halfHeight * (this.layout.rows - 1)
        };
    }
    
    findNearestImage(x, y) {
        let minDist = Infinity;
        let nearestPos = null;
        let nearestRow = 0;
        let nearestCol = 0;
        
        for (let row = 0; row < this.layout.rows; row++) {
            for (let col = 0; col < this.layout.columns; col++) {
                const pos = this.layout.getImagePosition(row, col);
                const dist = Math.sqrt(
                    Math.pow(x - pos.x, 2) +
                    Math.pow(y - pos.y, 2)
                );
                
                if (dist < minDist) {
                    minDist = dist;
                    nearestPos = pos;
                    nearestRow = row;
                    nearestCol = col;
                }
            }
        }
        
        return { row: nearestRow, col: nearestCol };
    }
} 