import * as THREE from 'three';
import { ContactSheet } from './components/ContactSheet.js';

// Create scene
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

// Create renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Initialize contact sheet
const contactSheet = new ContactSheet(scene, camera);
contactSheet.init().catch(console.error);

// Handle window resize
window.addEventListener('resize', () => {
    // Use exact same calculation as initial setup
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
});

// Start render loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate(); 