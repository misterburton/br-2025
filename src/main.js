import * as THREE from 'three';
import { ContactSheet } from './components/ContactSheet.js';

// Create scene with optimization flags
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

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
    precision: 'mediump', // Good balance between quality and performance
    stencil: false, // Disable features we don't need
    depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance

// CRITICAL: Set correct color management for photography
// The colorSpace property is the modern replacement for outputEncoding
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

// Initialize contact sheet
let contactSheet;
try {
    contactSheet = new ContactSheet(scene, camera, 'sheet_one');
    // Store renderer in scene for texture optimization access
    scene.renderer = renderer;
    contactSheet.init().catch(console.error);
} catch (error) {
    console.error('Error creating contact sheet:', error);
}

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

// Optimize resize handler with throttling
let resizeTimeout;
const throttledResize = () => {
    if (resizeTimeout) return;
    
    resizeTimeout = setTimeout(() => {
        const aspect = window.innerWidth / window.innerHeight;
        const newFrustumSize = aspect > 1 ? 4 : 4 / aspect;
        const halfHeight = newFrustumSize / 2;
        const halfWidth = newFrustumSize * aspect / 2;
        
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        resizeTimeout = null;
    }, 100); // Throttle to max 10 updates per second
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

// Implement proper cleanup for page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations when tab is not visible
        cancelAnimationFrame(frameId);
    } else {
        // Resume animations when tab becomes visible again
        lastFrameTime = performance.now();
        frameId = requestAnimationFrame(animate);
    }
});

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
    
    // Dispose renderer
    if (renderer) {
        renderer.dispose();
    }
});

// Reference to the visibility change handler for removal
function onVisibilityChange() {
    if (document.hidden) {
        cancelAnimationFrame(frameId);
    } else {
        lastFrameTime = performance.now();
        frameId = requestAnimationFrame(animate);
    }
} 