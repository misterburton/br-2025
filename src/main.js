import * as THREE from 'three';
import { ContactSheet } from './components/ContactSheet.js';

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Create camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 4;
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
    const aspect = window.innerWidth / window.innerHeight;
    const halfHeight = frustumSize / 2;
    const halfWidth = frustumSize * aspect / 2;
    
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