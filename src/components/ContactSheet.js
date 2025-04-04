import * as THREE from 'three';
import { gsap } from '../libs/gsap.js';
import { GridLayout } from './GridLayout.js';

export class ContactSheet {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.layout = new GridLayout();
        this.currentGridX = -1;
        this.currentGridY = -1;
        this.isTransitioning = false;
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
        
        // Long press handling
        this.longPressTimer = null;
        this.longPressDuration = 500;
        this.isLongPressing = false;
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

    zoomToImage(gridX, gridY) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        this.currentGridX = gridX;
        this.currentGridY = gridY;
        
        const imagePos = this.layout.getImagePosition(gridY, gridX);
        const zoomScale = this.calculateZoomScale();
        
        // Move camera closer to zoom in
        gsap.to(this.camera.position, {
            z: 5 / zoomScale,
            duration: 0.75,
            ease: "power2.in"
        });
        
        // Move camera to center on image
        gsap.to(this.camera.position, {
            x: -imagePos.x,
            y: -imagePos.y,
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
        
        // Move camera back to original position
        gsap.to(this.camera.position, {
            z: 5,
            duration: 0.85,
            ease: "power3.inOut",
            delay: 0.25
        });
        
        // Return camera to center
        gsap.to(this.camera.position, {
            x: 0,
            y: 0,
            duration: 0.57,
            ease: "power3.in",
            onComplete: () => {
                this.isTransitioning = false;
                this.isZoomedIn = false;
            }
        });
    }
    
    setupInteraction() {
        const canvas = this.renderer?.domElement || document.querySelector('canvas');
        if (!canvas) return;
        
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.webkitTouchCallout = 'none';
        
        // Handle pointer down
        canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            
            // Handle click/tap
            this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            if (intersects.length > 0) {
                const intersect = intersects[0];
                const uv = intersect.uv;
                
                // Get grid position of clicked image
                const gridX = Math.floor((uv.x * this.layout.sheetWidth - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
                const gridY = Math.floor(((1 - uv.y) * this.layout.sheetHeight - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
                
                if (this.isOverImage(uv)) {
                    // Get image position
                    const imagePos = this.layout.getImagePosition(gridY, gridX);
                    
                    // Calculate precise zoom frustum
                    const { size, aspect } = this.calculateZoomFrustum();
                    const halfSize = size / 2;
                    
                    // Animate camera frustum
                    gsap.to(this.camera, {
                        left: -halfSize * aspect,
                        right: halfSize * aspect,
                        top: halfSize,
                        bottom: -halfSize,
                        duration: 0.75,
                        ease: "power2.inOut",
                        onUpdate: () => {
                            this.camera.updateProjectionMatrix();
                        }
                    });
                    
                    // Animate camera position
                    gsap.to(this.camera.position, {
                        x: imagePos.x,
                        y: imagePos.y,
                        duration: 0.75,
                        ease: "power2.inOut"
                    });
                    
                    this.isZoomedIn = true;
                }
            }
        });
        
        // Handle double click to zoom out
        canvas.addEventListener('dblclick', (event) => {
            event.preventDefault();
            
            // Animate camera back to center
            gsap.to(this.camera.position, {
                x: 0,
                y: 0,
                duration: 0.75,
                ease: "power2.inOut"
            });
            
            // Animate frustum back to original size
            gsap.to(this.camera, {
                left: this.originalFrustum.left,
                right: this.originalFrustum.right,
                top: this.originalFrustum.top,
                bottom: this.originalFrustum.bottom,
                duration: 0.75,
                ease: "power2.inOut",
                onUpdate: () => {
                    this.camera.updateProjectionMatrix();
                }
            });
            
            this.isZoomedIn = false;
        });
        
        // Handle pointer up
        canvas.addEventListener('pointerup', () => {
            this.isLongPressing = false;
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
        
        // Handle hover
        canvas.addEventListener('pointermove', (event) => {
            this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            canvas.style.cursor = (intersects.length > 0 && this.isOverImage(intersects[0].uv)) ? 'pointer' : 'default';
        });
        
        canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.isZoomedIn) {
                // If zoomed in, recalculate and update the frustum
                const { size, aspect } = this.calculateZoomFrustum();
                const halfSize = size / 2;
                
                this.camera.left = -halfSize * aspect;
                this.camera.right = halfSize * aspect;
                this.camera.top = halfSize;
                this.camera.bottom = -halfSize;
                this.camera.updateProjectionMatrix();
            } else {
                // If not zoomed in, reset to original frustum
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
} 