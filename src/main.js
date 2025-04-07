import * as THREE from 'three';
import { ContactSheet } from './components/ContactSheet.js';

// Create scene with optimization flags
const scene = new THREE.Scene();
// Make scene background transparent to let CSS gradient show through
scene.background = null;

// Create camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = aspect > 1 ? 4 : 4 / aspect; // Adjust for portrait viewports
const halfHeight = frustumSize / 2;
const halfWidth = frustumSize * aspect / 2;

const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    1000
);
camera.position.z = 5;

// Create optimized renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    precision: 'mediump',
    stencil: false,
    depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Clear with transparent background to let CSS show through
renderer.setClearColor(0x000000, 0);

// Set correct color management
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

// Clear inline background styles to ensure CSS is used
document.body.style.backgroundColor = '';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

// Helper function to show error messages to the user
function showErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.style.position = 'fixed';
    errorContainer.style.top = '50%';
    errorContainer.style.left = '50%';
    errorContainer.style.transform = 'translate(-50%, -50%)';
    errorContainer.style.background = 'rgba(0,0,0,0.8)';
    errorContainer.style.color = 'white';
    errorContainer.style.padding = '20px';
    errorContainer.style.borderRadius = '5px';
    errorContainer.style.zIndex = '9999';
    errorContainer.textContent = message;
    document.body.appendChild(errorContainer);
}

// Initialize contact sheet
let contactSheet;
try {
    contactSheet = new ContactSheet(scene, camera, 'sheet_one');
    scene.renderer = renderer;
    contactSheet.init().catch(console.error);
} catch (error) {
    console.error('Error creating contact sheet:', error);
    showErrorMessage('Failed to initialize contact sheet. Please refresh the page.');
}

// Optimize resize handler with throttling
let resizeTimeout;
const throttledResize = () => {
    if (resizeTimeout) return;
    
    resizeTimeout = setTimeout(() => {
        // Let the contact sheet handle the camera aspects
        if (contactSheet) {
            contactSheet.handleResize();
        } else {
            // Fallback if contact sheet isn't initialized yet
            const aspect = window.innerWidth / window.innerHeight;
            const newFrustumSize = aspect > 1 ? 4 : 4 / aspect;
            const halfHeight = newFrustumSize / 2;
            const halfWidth = newFrustumSize * aspect / 2;
            
            camera.left = -halfWidth;
            camera.right = halfWidth;
            camera.top = halfHeight;
            camera.bottom = -halfHeight;
            camera.updateProjectionMatrix();
        }
        
        // Resize renderer
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        resizeTimeout = null;
    }, 100);
};

window.addEventListener('resize', throttledResize);

// Use RAF for render loop with performance optimizations
let frameId;
let lastFrameTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

function animate(timestamp) {
    frameId = requestAnimationFrame(animate);
    
    // Throttle rendering to target FPS
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < frameInterval) return;
    
    // Update last frame time, accounting for the frame interval
    lastFrameTime = timestamp - (elapsed % frameInterval);
    
    // Render the scene
    renderer.render(scene, camera);
}

// Start animation loop
animate();

// Handle visibility changes to pause/resume animations
function onVisibilityChange() {
    if (document.hidden) {
        // Pause animations when tab is not visible
        cancelAnimationFrame(frameId);
    } else {
        // Resume animations when tab becomes visible again
        lastFrameTime = performance.now();
        frameId = requestAnimationFrame(animate);
    }
}

// Add event listeners with proper cleanup
document.addEventListener('visibilitychange', onVisibilityChange);

// Add proper cleanup on page unload
window.addEventListener('beforeunload', () => {
    // Cancel animation frame if it exists
    if (typeof frameId !== 'undefined') {
        cancelAnimationFrame(frameId);
    }
    
    // Clean up contact sheet resources
    if (contactSheet && typeof contactSheet.dispose === 'function') {
        contactSheet.dispose();
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', throttledResize);
    
    // Dispose renderer
    if (renderer) {
        renderer.dispose();
    }
}); 