import * as THREE from 'three';

export class ResourceManager {
    constructor() {
        this.eventListeners = [];
    }
    
    // Add passive option for touch and wheel events
    addEventListener(element, type, handler) {
        const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'wheel', 'mousewheel'];
        const options = passiveEvents.includes(type) ? { passive: true } : undefined;
        
        element.addEventListener(type, handler, options);
        this.eventListeners.push({ element, type, handler });
    }
    
    // Remove all event listeners
    removeEventListeners() {
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
    }
    
    // Dispose THREE.js objects
    disposeThreeJsObjects(scene, sheet, sheetZPosition) {
        // Dispose of sheet mesh
        if (sheet) {
            if (sheet.geometry) sheet.geometry.dispose();
            if (sheet.material) {
                if (sheet.material.map) sheet.material.map.dispose();
                sheet.material.dispose();
            }
            scene.remove(sheet);
        }
        
        // Find and dispose all image meshes
        const imagesToRemove = [];
        scene.traverse(object => {
            if (object instanceof THREE.Mesh && 
                Math.abs(object.position.z - (sheetZPosition + 0.01)) < 0.1 && 
                object !== sheet) {
                imagesToRemove.push(object);
            }
        });
        
        imagesToRemove.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            scene.remove(mesh);
        });
    }
    
    // Kill any active animations
    killAnimations(camera) {
        if (window.gsap) {
            window.gsap.killTweensOf(camera);
            window.gsap.killTweensOf(camera.position);
        }
    }
}

// Utility function to clear existing image meshes
export function clearExistingImageMeshes(scene, sheet, sheetZPosition) {
    // Find and remove all existing image meshes before adding new ones
    const meshesToRemove = [];
    
    scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        
        // Criteria 1: Has isSheetImage flag (newer implementation)
        const hasSheetImageFlag = object.userData && object.userData.isSheetImage;
        
        // Criteria 2: Is at the expected Z position for images (with some tolerance)
        const isAtImageZPosition = Math.abs(object.position.z - (sheetZPosition + 0.01)) < 0.1;
        
        // Criteria 3: Is not the main contact sheet background
        const isNotSheet = object !== sheet;
        
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
        scene.remove(mesh);
    });
} 