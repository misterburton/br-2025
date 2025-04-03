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
        
        // Convert UV to grid coordinates
        const gridX = Math.floor(uv.x * this.layout.columns);
        const gridY = Math.floor((1 - uv.y) * this.layout.rows);
        
        // Calculate UV space for a single image including margins
        const totalWidth = this.layout.sheetWidth;
        const totalHeight = this.layout.sheetHeight;
        const imageWidth = this.layout.imageWidth;
        const imageHeight = this.layout.imageHeight;
        const marginX = this.layout.horizontalMargin;
        const marginY = this.layout.verticalMargin;
        
        // Calculate normalized margins
        const normalizedMarginX = marginX / totalWidth;
        const normalizedMarginY = marginY / totalHeight;
        
        // Calculate local UV within the grid cell
        const localU = (uv.x * this.layout.columns) % 1;
        const localV = ((1 - uv.y) * this.layout.rows) % 1;
        
        // Calculate image bounds within cell, accounting for edge positions
        const cellWidth = 1 / this.layout.columns;
        const cellHeight = 1 / this.layout.rows;
        
        // Adjust margins based on position in grid
        const isLeftEdge = gridX === 0;
        const isRightEdge = gridX === this.layout.columns - 1;
        const isTopEdge = gridY === 0;
        const isBottomEdge = gridY === this.layout.rows - 1;
        
        // Calculate start/end positions with edge-aware margins
        const imageStartX = isLeftEdge ? normalizedMarginX / cellWidth : (marginX / 2) / (totalWidth * cellWidth);
        const imageEndX = isRightEdge ? 1 - (normalizedMarginX / cellWidth) : 1 - (marginX / 2) / (totalWidth * cellWidth);
        const imageStartY = isTopEdge ? normalizedMarginY / cellHeight : (marginY / 2) / (totalHeight * cellHeight);
        const imageEndY = isBottomEdge ? 1 - (normalizedMarginY / cellHeight) : 1 - (marginY / 2) / (totalHeight * cellHeight);
        
        return (
            gridX >= 0 && gridX < this.layout.columns &&
            gridY >= 0 && gridY < this.layout.rows &&
            localU >= imageStartX && localU <= imageEndX &&
            localV >= imageStartY && localV <= imageEndY
        );
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
                    this.zoomOut();
                } else {
                    this.zoomToImage(gridX, gridY);
                }
                
                console.log('Image clicked/tapped at:', {
                    point: {
                        x: intersect.point.x.toFixed(4),
                        y: intersect.point.y.toFixed(4),
                        z: intersect.point.z.toFixed(4)
                    },
                    uv: {
                        u: uv.x.toFixed(4),
                        v: uv.y.toFixed(4)
                    },
                    grid: {
                        x: gridX,
                        y: gridY
                    }
                });
            }
        });
    }
} 