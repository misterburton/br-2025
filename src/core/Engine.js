import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GUI } from 'lil-gui';

export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 1);
        document.body.appendChild(this.renderer.domElement);
        
        // Add axes helper
        this.axesHelper = new THREE.AxesHelper(5);
        this.scene.add(this.axesHelper);
        
        // Add orbit controls for debugging
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // Initialize debug tools
        this.setupDebugTools();
        
        // Handle window resize
        window.addEventListener('resize', this.onResize.bind(this));
        
        // Set initial camera position
        this.camera.position.z = 5;
    }

    async setupDebugTools() {
        try {
            // Dynamically import Stats.js
            const statsScript = document.createElement('script');
            statsScript.src = 'https://mrdoob.github.io/stats.js/build/stats.min.js';
            document.head.appendChild(statsScript);

            await new Promise(resolve => statsScript.onload = resolve);

            // Now we can use the global Stats object
            this.stats = new window.Stats();
            this.stats.showPanel(0);
            document.body.appendChild(this.stats.dom);
            
            // Setup GUI
            this.gui = new GUI();
            const cameraFolder = this.gui.addFolder('Camera');
            cameraFolder.add(this.camera.position, 'x', -10, 10).listen();
            cameraFolder.add(this.camera.position, 'y', -10, 10).listen();
            cameraFolder.add(this.camera.position, 'z', 0, 20).listen();
            cameraFolder.open();
            
            const debugFolder = this.gui.addFolder('Debug');
            debugFolder.add(this.axesHelper, 'visible').name('Show Axes');
            debugFolder.open();
            
        } catch (error) {
            console.warn('Debug tools failed to load:', error);
        }
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    start() {
        this.renderer.setAnimationLoop(() => {
            if (this.stats) this.stats.begin();
            
            // Update controls
            this.controls.update();
            
            this.renderer.render(this.scene, this.camera);
            
            if (this.stats) this.stats.end();
        });
    }
} 