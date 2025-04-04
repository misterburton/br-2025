import * as THREE from 'three';
import { GridLayout } from './GridLayout.js';

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

export class ContactSheet {
    constructor(scene, camera, sheetId = 'sheet_one') {
        this.scene = scene;
        this.camera = camera;
        this.layout = new GridLayout();
        this.state = SheetState.IDLE;
        this.sheetId = sheetId;
        
        // Create a reusable texture loader
        this.textureLoader = new THREE.TextureLoader();
        
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
            // Use only the image files, not additional placeholder rectangles
            await this.createImagesFromSheet();
            this.setupInteraction();
        } catch (error) {
            console.error('Failed to initialize contact sheet:', error);
            throw error;
        }
    }
    
    // Consolidated cleanup/dispose method
    dispose() {
        // First clean up event listeners
        this.removeEventListeners();
        
        // Dispose of THREE.js objects to prevent memory leaks
        this.disposeThreeJsObjects();
        
        // Kill any active animations
        if (window.gsap) {
            window.gsap.killTweensOf(this.camera);
            window.gsap.killTweensOf(this.camera.position);
        }
    }
    
    // Split out event listener cleanup for clarity
    removeEventListeners() {
        // Remove all event listeners
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
    }
    
    // Properly dispose THREE.js objects
    disposeThreeJsObjects() {
        // Dispose of sheet mesh
        if (this.sheet) {
            if (this.sheet.geometry) this.sheet.geometry.dispose();
            if (this.sheet.material) {
                if (this.sheet.material.map) this.sheet.material.map.dispose();
                this.sheet.material.dispose();
            }
            this.scene.remove(this.sheet);
        }
        
        // Find and dispose all image meshes
        const imagesToRemove = [];
        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh && 
                Math.abs(object.position.z - (this.SHEET_Z_POSITION + 0.01)) < 0.1 && 
                object !== this.sheet) {
                imagesToRemove.push(object);
            }
        });
        
        imagesToRemove.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            this.scene.remove(mesh);
        });
    }
    
    // Maintain backward compatibility
    cleanup() {
        this.dispose();
    }
    
    // Add passive option for touch and wheel events
    addEventListener(element, type, handler) {
        const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'wheel', 'mousewheel'];
        const options = passiveEvents.includes(type) ? { passive: true } : undefined;
        
        element.addEventListener(type, handler, options);
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
        
        // Add click flag to track if we've dragged past threshold
        this.hasMovedBeyondThreshold = false;
        
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
            
            // Reset move threshold flag on pointer down
            this.hasMovedBeyondThreshold = false;
            
            if (this.state === SheetState.ZOOMED_IN) {
                this.startDragging(event);
            } else {
                this.handleInitialZoom(event);
            }
        });
        
        // Handle pointer move for dragging
        this.addEventListener(canvas, 'pointermove', (event) => {
            if (!this.isDragging || this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
            
            // Calculate distance moved to distinguish between click and drag
            if (!this.hasMovedBeyondThreshold) {
                const deltaX = Math.abs(event.clientX - this.startX);
                const deltaY = Math.abs(event.clientY - this.startY);
                
                if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                    this.hasMovedBeyondThreshold = true;
                }
            }
            
            this.handleDragging(event);
        });
        
        // Handle pointer up for drag end or click
        this.addEventListener(canvas, 'pointerup', (event) => {
            if (this.state !== SheetState.ZOOMED_IN || this.state === SheetState.ANIMATING) return;
            
            // Only consider as a drag if we moved beyond threshold
            if (this.isDragging) {
                if (this.hasMovedBeyondThreshold) {
                    this.handleDragEnd(event);
                } else {
                    // If we didn't move beyond threshold, treat as a click instead
                    this.isDragging = false;
                    
                    // Reset cursor
                    if (canvas) {
                        canvas.style.cursor = 'default';
                    }
                    
                    // Handle as a click if we're on desktop/tablet
                    if (this.isDesktopOrTablet()) {
                        this.handleAdjacentImageClick(event);
                    }
                }
            }
        });
        
        // Add separate direct click handler to ensure clicking works reliably
        this.addEventListener(canvas, 'click', (event) => {
            if (this.state !== SheetState.ZOOMED_IN || 
                this.state === SheetState.ANIMATING || 
                this.hasMovedBeyondThreshold) return;
            
            // Handle as a click on desktop/tablet
            if (this.isDesktopOrTablet()) {
                this.handleAdjacentImageClick(event);
            }
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
        
        // Don't handle as swipe if we didn't move beyond the drag threshold
        if (!this.hasMovedBeyondThreshold) return;
        
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
    
    // Helper method to load textures with proper encoding
    loadTextureWithProperEncoding(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // Use modern colorSpace property instead of encoding
                    texture.colorSpace = THREE.SRGBColorSpace;
                    
                    console.log(`Successfully loaded texture: ${url}`);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load texture: ${url}`, error);
                    reject(error);
                }
            );
        });
    }
    
    async setupSheet() {
        try {
            // Improved texture loading with better error handling
            const sheetTexture = await this.loadTextureWithProperEncoding('images/contact-sheet-placeholder.jpg');
            
            const dimensions = this.layout.getSheetDimensions();
            const geometry = new THREE.PlaneGeometry(dimensions.width, dimensions.height);
            
            // Create the background plane with simple material settings
            const material = new THREE.MeshBasicMaterial({
                map: sheetTexture,
                side: THREE.FrontSide
            });
            
            this.sheet = new THREE.Mesh(geometry, material);
            // Use consistent Z position of -2.5 for all sheet elements
            this.sheet.position.z = -2.5;
            // Store this Z position as a constant for other components to reference
            this.SHEET_Z_POSITION = -2.5;
            this.scene.add(this.sheet);
            
        } catch (error) {
            console.error('Failed to setup contact sheet:', error);
            throw error;
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
    
    async createImagesFromSheet() {
        try {
            // Get list of image filenames for the current sheet
            const imageFiles = await this.getSheetImageFiles();
            
            // Create a reusable geometry for all images
            const imageDimensions = {
                width: this.layout.imageWidth * this.layout.scale,
                height: this.layout.imageHeight * this.layout.scale
            };
            const geometry = new THREE.PlaneGeometry(imageDimensions.width, imageDimensions.height);
            
            // Mapping to track which row/col has which image
            this.imageMapping = [];
            
            // Clear existing meshes to prevent overlapping
            this.clearExistingImageMeshes();
            
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
                    const loadPromise = this.loadTextureWithProperEncoding(texturePath)
                        .then(texture => {
                            // Create simple material with no special settings
                            const material = new THREE.MeshBasicMaterial({ 
                                map: texture,
                                side: THREE.FrontSide
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
                            console.error(`Failed to load image: ${texturePath}`, error);
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
            console.log(`Loaded ${successCount} images for sheet "${this.sheetId}" (${errorCount} failed)`);
            
            // If all images failed, throw an error to be caught
            if (successCount === 0 && errorCount > 0) {
                throw new Error(`Failed to load any images for sheet "${this.sheetId}"`);
            }
            
        } catch (error) {
            console.error('Failed to create images:', error);
            throw error;
        }
    }
    
    // Keep the old method name for backward compatibility but have it call the new method
    async createPlaceholderImages() {
        // DEPRECATED: This method is kept for backward compatibility
        // The programmatically generated placeholder rectangles are no longer used
        // as we're loading actual JPG images instead
        return this.createImagesFromSheet();
    }
    
    // Helper method to get image files for the current sheet
    async getSheetImageFiles() {
        // For now, return hardcoded list of files based on sheet ID
        if (this.sheetId === 'sheet_one') {
            return [
                'Admiralteyskaya.jpg',
                'Andel.jpg',  // Renamed from Andĕl.jpg
                'Avtovo.jpg',
                'Bikás park-portrait.jpg',
                'Bukharestskaya-portrait.jpg',
                'Florenc.jpg',
                'Fővám tér.jpg',
                'II. János Pál pápa tér-portrait.jpg',
                'Kálvin tér átszállóalagút-1.jpg',
                'Kálvin tér átszállóalagút-2.jpg',
                'Kálvin tér M3 átszállóalagút-portrait.jpg',
                'Kálvin tér M3.jpg',
                'Kálvin tér M4.jpg',
                'Karlovo náměstí.jpg',
                'Keleti pályaudvar.jpg',
                'Kirovsky Zavod-portrait.jpg',
                'Komendantsky Prospekt.jpg',
                'Krestovsky Ostrov.jpg',
                'Malostranská.jpg',
                'Mezhdunarodnaya.jpg',
                'Nagyvárad tér-portrait.jpg',
                'Národní třída-1.jpg',
                'Národní třída-2.jpg',
                'Narvskaya.jpg',
                'Obvodny Kanal-portrait.jpg',
                'Rådhuset.jpg',
                'Staraya Derevnya.jpg',
                'Staroměstská-1.jpg',
                'Staroměstská-2.jpg',
                'Szent Gellért tér-1.jpg',
                'Szent Gellért tér-2.jpg',
                'T-Centralen.jpg',
                'Újbuda-központ-1.jpg',
                'Ujbuda-kozpont-2.jpg',  // Renamed from Újbuda-központ-2.jpg
                'Volkovskaya.jpg',
                'Zvenigorodskaya.jpg'
            ];
        }
        
        // In a real application, this could fetch from an API or dynamically from the server
        return [];
    }
    
    isDesktopOrTablet() {
        // Simple check for desktop or tablet based on screen size
        return window.innerWidth >= 768;
    }
    
    handleAdjacentImageClick(event) {
        this.updatePointerPosition(event);
        
        // First try raycasting specifically for the placeholder image objects
        const allIntersects = this.raycaster.intersectObjects(this.scene.children);
        
        // Get all image meshes - update the Z position check to match our new position
        const imageMeshes = this.scene.children.filter(child => 
            child instanceof THREE.Mesh && 
            Math.abs(child.position.z - (this.SHEET_Z_POSITION + 0.01)) < 0.1 &&
            child.material && 
            child.material.map
        );
        
        // Check for clicks on image meshes - update Z position check
        const imageIntersects = allIntersects.filter(intersect => 
            intersect.object instanceof THREE.Mesh &&
            Math.abs(intersect.object.position.z - (this.SHEET_Z_POSITION + 0.01)) < 0.1 && 
            intersect.object.material && 
            intersect.object.material.map
        );
        
        let clickedImage = null;
        
        if (imageIntersects.length > 0) {
            // Find which image was clicked based on the position
            const clickedObject = imageIntersects[0].object;
            const clickedPosition = clickedObject.position;
            
            // Find row and col of the clicked image
            clickedImage = this.findNearestImage(clickedPosition.x, clickedPosition.y);
        } 
        else {
            // Fallback: Use screen position to determine nearest image
            // Convert screen to world coordinates
            const vector = new THREE.Vector3();
            vector.set(this.pointer.x, this.pointer.y, 0.5);
            vector.unproject(this.camera);
            
            // Find the nearest image to this position
            clickedImage = this.findNearestImage(vector.x, vector.y);
        }
        
        if (!clickedImage) return;
        
        // Check if the clicked image is adjacent to the current one
        const isAdjacent = 
            (Math.abs(clickedImage.row - this.currentImage.row) <= 1 &&
             Math.abs(clickedImage.col - this.currentImage.col) <= 1) &&
            // Exclude clicking on the current image
            !(clickedImage.row === this.currentImage.row && 
              clickedImage.col === this.currentImage.col);
        
        if (isAdjacent) {
            const imagePos = this.layout.getImagePosition(clickedImage.row, clickedImage.col);
            
            gsap.killTweensOf(this.camera.position);
            
            gsap.to(this.camera.position, {
                x: imagePos.x,
                y: imagePos.y,
                duration: ANIMATION_DURATIONS.SUBSEQUENT_MOVEMENT,
                ease: "power2.out",
                onComplete: () => {
                    this.currentImage = clickedImage;
                }
            });
        }
    }
    
    // Clear existing image meshes to prevent overlapping when reloading
    clearExistingImageMeshes() {
        // Find and remove all existing image meshes before adding new ones
        const meshesToRemove = [];
        
        this.scene.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            
            // Criteria 1: Has isSheetImage flag (newer implementation)
            const hasSheetImageFlag = object.userData && object.userData.isSheetImage;
            
            // Criteria 2: Is at the expected Z position for images (with some tolerance)
            const isAtImageZPosition = Math.abs(object.position.z - (this.SHEET_Z_POSITION + 0.01)) < 0.1;
            
            // Criteria 3: Is not the main contact sheet background
            const isNotSheet = object !== this.sheet;
            
            // Criteria 4: Has a material and texture (likely an image)
            const hasImageMaterial = object.material && 
                                    (object.material.map || 
                                     (object.material.color && object.material.transparent));
            
            // Remove if it meets criteria that indicate it's an image from any implementation
            if (isNotSheet && 
                ((hasSheetImageFlag) || 
                 (isAtImageZPosition && hasImageMaterial))) {
                meshesToRemove.push(object);
                
                // Log found objects for debugging
                console.log(`Removing mesh: z=${object.position.z.toFixed(2)}, isSheetImage=${hasSheetImageFlag}`);
            }
        });
        
        console.log(`Found ${meshesToRemove.length} image meshes to remove`);
        
        // Properly dispose of all resources to prevent memory leaks
        meshesToRemove.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            this.scene.remove(mesh);
        });
    }
} 