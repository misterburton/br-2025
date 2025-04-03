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
        this.longPressDuration = 500; // 500ms for long press
        this.isLongPressing = false;
        
        // Raycaster for pointer intersection
        this.raycaster = new THREE.Raycaster();
        // Store pointer coordinates
        this.pointer = new THREE.Vector2();
        
        this.setupSheet();
        this.setupTouchHandling();
        this.setupInteraction();
    }
    
    async setupSheet() {
        try {
            console.log('Loading contact sheet texture...');
            // Load the contact sheet texture
            const textureLoader = new THREE.TextureLoader();
            const sheetTexture = await new Promise((resolve, reject) => {
                textureLoader.load(
                    './src/assets/images/contact-sheet-placeholder.jpg',
                    (texture) => {
                        console.log('Texture loaded successfully', {
                            image: texture.image,
                            dimensions: `${texture.image.width}x${texture.image.height}`
                        });
                        texture.repeat.set(1, 1);
                        texture.offset.set(0, 0);
                        resolve(texture);
                    },
                    (progress) => {
                        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                    },
                    (error) => {
                        console.error('Error loading texture:', error);
                        reject(error);
                    }
                );
            });
            
            console.log('Creating contact sheet plane...');
            const dimensions = this.layout.getSheetDimensions();
            console.log('Sheet dimensions:', dimensions);
            
            const geometry = new THREE.PlaneGeometry(dimensions.width, dimensions.height);
            const material = new THREE.MeshBasicMaterial({
                map: sheetTexture,
                side: THREE.DoubleSide,
                transparent: false,
                opacity: 1,
                color: 0xffffff
            });
            
            this.sheet = new THREE.Mesh(geometry, material);
            
            // Center the sheet at origin
            this.sheet.position.set(0, 0, 0);
            
            // Add wireframe for debugging
            const wireframe = new THREE.WireframeGeometry(geometry);
            const line = new THREE.LineSegments(wireframe);
            line.material.color.setHex(0x00ff00);
            this.sheet.add(line);
            
            // Ensure sheet is behind other elements
            this.sheet.position.z = -0.1;
            this.scene.add(this.sheet);
            console.log('Contact sheet added to scene', {
                position: this.sheet.position,
                geometry: {
                    width: geometry.parameters.width,
                    height: geometry.parameters.height
                }
            });
            
            // Position camera to see full sheet
            const distance = this.layout.getCameraDistance();
            this.camera.position.z = distance;
            // Ensure camera is looking at center
            this.camera.lookAt(0, 0, 0);
            console.log('Camera setup', {
                position: this.camera.position,
                distance: distance,
                fov: this.camera.fov,
                aspect: this.camera.aspect
            });
            
            // Add debug helpers
            const box = new THREE.Box3().setFromObject(this.sheet);
            const boxHelper = new THREE.Box3Helper(box, 0xff0000);
            this.scene.add(boxHelper);
            
            this.renderer = this.scene.renderer || this.camera.parent?.renderer;
            
        } catch (error) {
            console.error('Failed to setup contact sheet:', error);
        }
    }
    
    setupTouchHandling() {
        let startX = 0;
        let startY = 0;
        let isDragging = false;
        
        document.addEventListener('touchstart', (e) => {
            if (this.isTransitioning) return;
            
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging || this.isTransitioning) return;
            
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            
            // Handle drag logic here
        });
        
        document.addEventListener('touchend', () => {
            isDragging = false;
        });
    }
    
    isOverImage(uv) {
        if (!uv) return false;
        
        // Convert UV to sheet coordinates
        const pixelX = uv.x * this.layout.sheetWidth;
        const pixelY = (1 - uv.y) * this.layout.sheetHeight;
        
        // Get grid position using exact same math as grid creation
        const gridX = Math.floor((pixelX - this.layout.firstImageX) / (this.layout.imageWidth + this.layout.horizontalMargin));
        const gridY = Math.floor((pixelY - this.layout.firstImageY) / (this.layout.imageHeight + this.layout.verticalMargin));
        
        // Get exact image position using same math as grid creation
        const imageX = this.layout.firstImageX + (gridX * (this.layout.imageWidth + this.layout.horizontalMargin));
        const imageY = this.layout.firstImageY + (gridY * (this.layout.imageHeight + this.layout.verticalMargin));
        
        // Simple hit test against exact image bounds
        const isHit = 
            pixelX >= imageX && 
            pixelX <= imageX + this.layout.imageWidth &&
            pixelY >= imageY && 
            pixelY <= imageY + this.layout.imageHeight;
        
        // When zoomed in, only respond to current image
        if (this.isZoomedIn) {
            return isHit && gridX === this.currentGridX && gridY === this.currentGridY;
        }
        
        return isHit && gridX >= 0 && gridX < this.layout.columns && gridY >= 0 && gridY < this.layout.rows;
    }
    
    calculateZoomScale() {
        // Get viewport dimensions
        const viewportAspect = window.innerWidth / window.innerHeight;
        
        // Base scale for mobile (portrait)
        const baseScale = 9;
        
        // For landscape/desktop views, adjust scale based on viewport aspect ratio
        if (viewportAspect > 1) {
            // Wide viewport - scale down proportionally but not as aggressively
            return baseScale * 0.7; // Reduce base scale by a fixed amount for landscape
        }
        
        // Tall/narrow viewport - use base scale
        return baseScale;
    }

    zoomToImage(gridX, gridY) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        // Store the current image coordinates
        this.currentGridX = gridX;
        this.currentGridY = gridY;
        
        // Get position for the target image
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
            overwrite: false,
            onComplete: () => {
                this.isTransitioning = false;
                this.isZoomedIn = true;
            }
        });
    }
    
    zoomOut() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        // Scale down with Cubic.easeInOut
        gsap.to(this.sheet.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.85,
            ease: "power3.inOut",
            delay: 0.25,
            onComplete: () => {
                this.isTransitioning = false;
                this.isZoomedIn = false;
            }
        });
        
        // Quick return to center with Cubic.easeIn
        gsap.to(this.sheet.position, {
            x: 0,
            y: 0,
            z: -0.1,
            duration: 0.57, // 2/3 of 0.85
            ease: "power3.in",
            overwrite: false
        });
    }
    
    setupInteraction() {
        const canvas = this.renderer?.domElement || document.querySelector('canvas');
        if (!canvas) return;
        
        // Prevent text selection on long press
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.webkitTouchCallout = 'none';
        
        // Pointer move for hover state
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
        
        // Prevent context menu on long press
        canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // Pointer down event
        canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            
            this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObject(this.sheet);
            
            if (intersects.length > 0 && this.isOverImage(intersects[0].uv)) {
                const intersect = intersects[0];
                const uv = intersect.uv;
                const gridX = Math.floor(uv.x * this.layout.columns);
                const gridY = Math.floor((1 - uv.y) * this.layout.rows);
                
                if (this.isZoomedIn) {
                    // Start long press timer only if on the current image
                    if (gridX === this.currentGridX && gridY === this.currentGridY) {
                        this.isLongPressing = true;
                        this.longPressTimer = setTimeout(() => {
                            if (this.isLongPressing) {
                                this.zoomOut();
                            }
                        }, this.longPressDuration);
                    }
                } else {
                    // Store the clicked image coordinates
                    this.currentGridX = gridX;
                    this.currentGridY = gridY;
                    this.zoomToImage(gridX, gridY);
                }
            }
        });
        
        // Pointer up event
        canvas.addEventListener('pointerup', () => {
            this.isLongPressing = false;
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
        
        // Pointer leave event
        canvas.addEventListener('pointerleave', () => {
            this.isLongPressing = false;
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
    }
} 