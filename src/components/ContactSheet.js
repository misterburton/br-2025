import * as THREE from 'three';
import { gsap } from '../libs/gsap.js';
import { GridLayout } from './GridLayout.js';

export class ContactSheet {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.layout = new GridLayout();
        this.images = [];
        this.currentIndex = 0;
        this.isTransitioning = false;
        this.isZoomedIn = false;
        this.currentGridX = -1;
        this.currentGridY = -1;
        
        // Long press handling
        this.longPressTimer = null;
        this.longPressDuration = 500;
        this.isLongPressing = false;
        
        // Raycaster for pointer intersection
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        
        this.setupSheet();
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
            
            const distance = this.layout.getCameraDistance();
            this.camera.position.z = distance;
            this.camera.lookAt(0, 0, 0);
            
            this.renderer = this.scene.renderer || this.camera.parent?.renderer;
            
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
    
    calculateZoomScale() {
        const viewportAspect = window.innerWidth / window.innerHeight;
        const baseScale = 9;
        return viewportAspect > 1 ? baseScale * 0.7 : baseScale;
    }

    zoomToImage(gridX, gridY) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        this.currentGridX = gridX;
        this.currentGridY = gridY;
        
        const imagePos = this.layout.getImagePosition(gridY, gridX);
        const zoomScale = this.calculateZoomScale();
        
        gsap.to(this.sheet.scale, {
            x: zoomScale,
            y: zoomScale,
            duration: 0.75,
            ease: "power2.in"
        });
        
        gsap.to(this.sheet.position, {
            x: imagePos.x * -zoomScale,
            y: imagePos.y * -zoomScale,
            duration: 1.5,
            ease: "power4.inOut",
            onComplete: () => {
                this.isTransitioning = false;
                this.isZoomedIn = true;
            }
        });
    }
    
    zoomOut() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        gsap.to(this.sheet.scale, {
            x: 1,
            y: 1,
            duration: 0.85,
            ease: "power3.inOut",
            delay: 0.25,
            onComplete: () => {
                this.isTransitioning = false;
                this.isZoomedIn = false;
            }
        });
        
        gsap.to(this.sheet.position, {
            x: 0,
            y: 0,
            duration: 0.57,
            ease: "power3.in"
        });
    }
    
    setupInteraction() {
        const canvas = this.renderer?.domElement || document.querySelector('canvas');
        if (!canvas) return;
        
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.webkitTouchCallout = 'none';
        
        canvas.addEventListener('pointermove', (event) => {
            this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            if (intersects.length > 0 && this.isOverImage(intersects[0].uv)) {
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = 'default';
            }
        });
        
        canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            
            this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            if (intersects.length > 0) {
                const intersect = intersects[0];
                const uv = intersect.uv;
                
                if (this.isZoomedIn) {
                    // Get the grid position of the click
                    const gridX = Math.floor((uv.x * this.layout.sheetWidth - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
                    const gridY = Math.floor(((1 - uv.y) * this.layout.sheetHeight - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
                    
                    // If clicking current image, start long press timer
                    if (gridX === this.currentGridX && gridY === this.currentGridY) {
                        this.isLongPressing = true;
                        this.longPressTimer = setTimeout(() => {
                            if (this.isLongPressing) {
                                this.zoomOut();
                            }
                        }, this.longPressDuration);
                    } else if (!this.isTransitioning) {
                        // Calculate relative position to current image
                        const relativeX = gridX - this.currentGridX;
                        const relativeY = gridY - this.currentGridY;
                        
                        // If we're clicking in the general area of an adjacent image
                        if (Math.abs(relativeX) <= 1 && Math.abs(relativeY) <= 1) {
                            const targetX = this.currentGridX + relativeX;
                            const targetY = this.currentGridY + relativeY;
                            
                            // Only navigate if target is within grid bounds
                            if (targetX >= 0 && targetX < this.layout.columns && 
                                targetY >= 0 && targetY < this.layout.rows) {
                                this.slideToImage(targetX, targetY);
                            }
                        }
                    }
                } else {
                    // Not zoomed in - use normal hit detection
                    const gridX = Math.floor((uv.x * this.layout.sheetWidth - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
                    const gridY = Math.floor(((1 - uv.y) * this.layout.sheetHeight - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
                    
                    if (this.isOverImage(uv)) {
                        this.currentGridX = gridX;
                        this.currentGridY = gridY;
                        this.zoomToImage(gridX, gridY);
                    }
                }
            }
        });
        
        canvas.addEventListener('pointerup', () => {
            this.isLongPressing = false;
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
        
        canvas.addEventListener('pointerleave', () => {
            this.isLongPressing = false;
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
    }
    
    slideToImage(gridX, gridY) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        const imagePos = this.layout.getImagePosition(gridY, gridX);
        const zoomScale = this.calculateZoomScale();
        
        gsap.to(this.sheet.position, {
            x: imagePos.x * -zoomScale,
            y: imagePos.y * -zoomScale,
            duration: 0.6,
            ease: "power2.out",
            onComplete: () => {
                this.currentGridX = gridX;
                this.currentGridY = gridY;
                this.isTransitioning = false;
            }
        });
    }
} 