import * as THREE from 'three';
import { SheetState, ANIMATION_DURATIONS } from './SheetInteraction.js';

export class SheetAnimation {
    constructor(camera, gradientBackground) {
        this.camera = camera;
        this.gradientBackground = gradientBackground;
    }
    
    // Zoom to a specific image
    zoomToImage(imagePos, row, col, state, setCurrentImage, setImageBrightness) {
        const { size, aspect } = this.calculateZoomFrustum();
        const halfSize = size / 2;
        
        const isSubsequentMovement = state === SheetState.ZOOMED_IN;
        state = SheetState.ANIMATING;
        
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
                setCurrentImage(row, col);
                state = SheetState.ZOOMED_IN;
                
                // Set the brightness to highlight the active image
                setImageBrightness(row, col);
            }
        });
        
        // Animate gradient background with parallax effect
        if (this.gradientBackground) {
            const parallaxFactor = 0.15; // Reduced for subtler effect
            gsap.to(this.gradientBackground.position, {
                x: imagePos.x * parallaxFactor,
                y: imagePos.y * parallaxFactor,
                duration: isSubsequentMovement ? 0.7 : 1.8,
                ease: isSubsequentMovement ? "power2.inOut" : "power3.inOut",
                overwrite: false
            });
        }
    }
    
    // Zoom out to show the entire sheet
    zoomOut(state, originalFrustum, resetImageBrightness, onComplete = null) {
        state = SheetState.ANIMATING;
        
        // Reset image brightness as we zoom out
        resetImageBrightness();
        
        gsap.to(this.camera.position, {
            x: 0,
            y: 0,
            duration: ANIMATION_DURATIONS.ZOOM_OUT_POSITION,
            ease: "power3.in",
            overwrite: false
        });
        
        // Recalculate the correct frustum based on current aspect ratio
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = aspect > 1 ? 4 : 4 / aspect;
        const halfHeight = frustumSize / 2;
        const halfWidth = frustumSize * aspect / 2;
        
        gsap.to(this.camera, {
            left: -halfWidth,
            right: halfWidth,
            top: halfHeight,
            bottom: -halfHeight,
            duration: ANIMATION_DURATIONS.ZOOM_OUT_FRUSTUM,
            delay: ANIMATION_DURATIONS.ZOOM_OUT_DELAY,
            ease: "power3.inOut",
            onUpdate: () => {
                this.camera.updateProjectionMatrix();
            },
            onComplete: () => {
                // Update the stored original frustum with the current values
                originalFrustum.left = -halfWidth;
                originalFrustum.right = halfWidth;
                originalFrustum.top = halfHeight;
                originalFrustum.bottom = -halfHeight;
                state = SheetState.IDLE;
                
                // Call the additional callback if provided
                if (onComplete && typeof onComplete === 'function') {
                    onComplete();
                }
            }
        });
        
        // Reset gradient background position
        if (this.gradientBackground) {
            gsap.to(this.gradientBackground.position, {
                x: 0,
                y: 0,
                duration: ANIMATION_DURATIONS.ZOOM_OUT_FRUSTUM * 1.2,
                delay: ANIMATION_DURATIONS.ZOOM_OUT_DELAY * 0.5,
                ease: "power2.out",
                overwrite: false
            });
        }
    }
    
    // Move to an adjacent image
    moveToAdjacentImage(targetImage, layout, currentImage, setCurrentImage, setImageBrightness) {
        const imagePos = layout.getImagePosition(targetImage.row, targetImage.col);
        
        gsap.killTweensOf(this.camera.position);
        
        gsap.to(this.camera.position, {
            x: imagePos.x,
            y: imagePos.y,
            duration: ANIMATION_DURATIONS.SUBSEQUENT_MOVEMENT,
            ease: "power2.out",
            onComplete: () => {
                setCurrentImage(targetImage.row, targetImage.col);
                
                // Update brightness to highlight the new active image
                setImageBrightness(targetImage.row, targetImage.col);
            }
        });
    }
    
    // Helper method to calculate the zoom frustum
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
    
    // Set image brightness to highlight the active image
    setImageBrightness(scene, activeRow, activeCol) {
        // Find all sheet image meshes in the scene
        scene.traverse(object => {
            if (object instanceof THREE.Mesh && 
                object.userData && 
                object.userData.isSheetImage) {
                
                const { row, col } = object.userData;
                
                if (object.material) {
                    // For the active image, ensure full brightness
                    if (row === activeRow && col === activeCol) {
                        // Active image - full brightness
                        gsap.to(object.material.color, {
                            r: 1.0,
                            g: 1.0,
                            b: 1.0,
                            duration: 0.35
                        });
                    } else {
                        // Inactive image - darken by using color as a multiplier
                        // This preserves the image appearance better than opacity
                        gsap.to(object.material.color, {
                            r: 0.1,
                            g: 0.1,
                            b: 0.1,
                            duration: 0.5
                        });
                    }
                }
            }
        });
    }
    
    // Restore all images to full brightness
    resetImageBrightness(scene) {
        scene.traverse(object => {
            if (object instanceof THREE.Mesh && 
                object.userData && 
                object.userData.isSheetImage) {
                
                if (object.material) {
                    // Animate back to full brightness
                    gsap.to(object.material.color, {
                        r: 1.0,
                        g: 1.0,
                        b: 1.0,
                        duration: 0.3
                    });
                }
            }
        });
    }
} 