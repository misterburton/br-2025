import * as THREE from 'three';
import { GridLayout } from './GridLayout.js';

export class ContactSheet {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.layout = new GridLayout();
        this.isZoomedIn = false;
        
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
        this.swipeDirection = null; // 'horizontal' or 'vertical'
    }
    
    async init() {
        await this.setupSheet();
        this.setupInteraction();
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
    
    zoomToImage(imagePos, row, col) {
        const { size, aspect } = this.calculateZoomFrustum();
        const halfSize = size / 2;
        
        // If we're already zoomed in, use faster animations for image-to-image movement
        const isSubsequentMovement = this.isZoomedIn;
        
        // Animate camera frustum
        gsap.to(this.camera, {
            left: -halfSize * aspect,
            right: halfSize * aspect,
            top: halfSize,
            bottom: -halfSize,
            duration: isSubsequentMovement ? 0.3 : 0.75,
            ease: isSubsequentMovement ? "power2.inOut" : "power2.in",
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
            }
        });
        
        this.isZoomedIn = true;
    }
    
    zoomOut() {
        // Animate camera back to center with a quick initial movement
        gsap.to(this.camera.position, {
            x: 0,
            y: 0,
            duration: 0.57,
            ease: "power3.in",
            overwrite: false
        });
        
        // Animate frustum back to original size with a slight delay
        gsap.to(this.camera, {
            left: this.originalFrustum.left,
            right: this.originalFrustum.right,
            top: this.originalFrustum.top,
            bottom: this.originalFrustum.bottom,
            duration: 0.85,
            delay: 0.25,
            ease: "power3.inOut",
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            }
        });
        
        this.isZoomedIn = false;
    }
    
    setupInteraction() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        // Handle pointer down for initial zoom
        canvas.addEventListener('pointerdown', (event) => {
            if (this.isZoomedIn) {
                // Start dragging
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
            } else {
                // Handle zoom
                event.preventDefault();
                
                this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
                this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                this.raycaster.setFromCamera(this.pointer, this.camera);
                const intersects = this.raycaster.intersectObject(this.sheet);
                
                if (intersects.length > 0 && this.isOverImage(intersects[0].uv)) {
                    const uv = intersects[0].uv;
                    const gridX = Math.floor((uv.x * this.layout.sheetWidth - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
                    const gridY = Math.floor(((1 - uv.y) * this.layout.sheetHeight - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
                    
                    const imagePos = this.layout.getImagePosition(gridY, gridX);
                    this.zoomToImage(imagePos, gridY, gridX);
                }
            }
        });
        
        // Handle pointer move for dragging
        canvas.addEventListener('pointermove', (event) => {
            if (!this.isDragging || !this.isZoomedIn) return;
            
            const currentTime = performance.now();
            const deltaTime = currentTime - this.lastTime;
            
            // Calculate velocity
            this.velocityX = (event.clientX - this.lastX) / deltaTime;
            this.velocityY = (event.clientY - this.lastY) / deltaTime;
            
            // Determine swipe direction on first move
            if (!this.swipeDirection) {
                const deltaX = Math.abs(event.clientX - this.startX);
                const deltaY = Math.abs(event.clientY - this.startY);
                this.swipeDirection = deltaX > deltaY ? 'horizontal' : 'vertical';
            }
            
            // Convert screen coordinates to world coordinates
            const scale = (this.camera.top - this.camera.bottom) / window.innerHeight;
            const deltaX = (event.clientX - this.lastX) * scale;
            const deltaY = (event.clientY - this.lastY) * scale;
            
            // Update camera position based on swipe direction
            if (this.swipeDirection === 'horizontal') {
                this.camera.position.x -= deltaX;
            } else {
                this.camera.position.y += deltaY;
            }
            
            // Store last position and time
            this.lastX = event.clientX;
            this.lastY = event.clientY;
            this.lastTime = currentTime;
        });
        
        // Handle pointer up for drag end
        canvas.addEventListener('pointerup', (event) => {
            if (!this.isDragging || !this.isZoomedIn) return;
            
            this.isDragging = false;
            
            // Calculate total swipe distance
            const totalDeltaX = event.clientX - this.startX;
            const totalDeltaY = event.clientY - this.startY;
            
            // Find target image - only move one image at a time
            let targetImage = { ...this.currentImage };
            
            if (this.swipeDirection === 'horizontal') {
                // Check velocity and distance to determine direction
                const shouldMove = Math.abs(this.velocityX) > 0.3 || Math.abs(totalDeltaX) > 50;
                if (shouldMove) {
                    if (this.velocityX > 0 || totalDeltaX > 0) { // Swipe right
                        targetImage.col = Math.max(0, this.currentImage.col - 1);
                    } else { // Swipe left
                        targetImage.col = Math.min(this.layout.columns - 1, this.currentImage.col + 1);
                    }
                }
            } else {
                // Check velocity and distance to determine direction
                const shouldMove = Math.abs(this.velocityY) > 0.3 || Math.abs(totalDeltaY) > 50;
                if (shouldMove) {
                    if (this.velocityY > 0 || totalDeltaY > 0) { // Swipe down
                        targetImage.row = Math.max(0, this.currentImage.row - 1);
                    } else { // Swipe up
                        targetImage.row = Math.min(this.layout.rows - 1, this.currentImage.row + 1);
                    }
                }
            }
            
            const imagePos = this.layout.getImagePosition(targetImage.row, targetImage.col);
            
            // Animate to target image with momentum
            const duration = 0.3;
            const ease = "power2.out";
            
            // Kill any existing animations
            gsap.killTweensOf(this.camera.position);
            
            gsap.to(this.camera.position, {
                x: imagePos.x,
                y: imagePos.y,
                duration: duration,
                ease: ease,
                onComplete: () => {
                    this.currentImage = targetImage;
                }
            });
        });
        
        // Handle double click to zoom out
        canvas.addEventListener('dblclick', (event) => {
            event.preventDefault();
            this.zoomOut();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.isZoomedIn) {
                const { size, aspect } = this.calculateZoomFrustum();
                const halfSize = size / 2;
                
                this.camera.left = -halfSize * aspect;
                this.camera.right = halfSize * aspect;
                this.camera.top = halfSize;
                this.camera.bottom = -halfSize;
                this.camera.updateProjectionMatrix();
            } else {
                const aspect = window.innerWidth / window.innerHeight;
                const halfHeight = 2;
                const halfWidth = halfHeight * aspect;
                
                this.camera.left = -halfWidth;
                this.camera.right = halfWidth;
                this.camera.top = halfHeight;
                this.camera.bottom = -halfHeight;
                this.camera.updateProjectionMatrix();
            }
        });
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