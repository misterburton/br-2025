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
        
        this.setupSheet();
        this.setupTouchHandling();
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
                        // Ensure texture dimensions match our layout
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
            // Create the background plane
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
    
    zoomToImage(row, col) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        const position = this.layout.getImagePosition(row, col);
        
        gsap.to(this.camera.position, {
            x: position.x,
            y: position.y,
            z: position.width * 1.5, // Adjust this value to control zoom level
            duration: 1,
            ease: 'power2.inOut',
            onComplete: () => {
                this.isTransitioning = false;
                this.currentIndex = row * this.layout.columns + col;
            }
        });
    }
    
    zoomOut() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        gsap.to(this.camera.position, {
            x: 0,
            y: 0,
            z: this.layout.getCameraDistance(),
            duration: 1,
            ease: 'power2.inOut',
            onComplete: () => {
                this.isTransitioning = false;
            }
        });
    }
} 