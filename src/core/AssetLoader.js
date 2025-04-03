import * as THREE from 'three';

export class AssetLoader {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.loadingManager = new THREE.LoadingManager();
        this.cache = new Map();
        
        this.setupLoadingManager();
    }
    
    setupLoadingManager() {
        this.loadingManager.onProgress = (url, loaded, total) => {
            const progress = (loaded / total) * 100;
            // We can add loading UI updates here
        };
        
        this.loadingManager.onLoad = () => {
            // Handle all assets loaded
        };
        
        this.loadingManager.onError = (url) => {
            console.error('Error loading', url);
        };
    }
    
    async loadTexture(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }
        
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    this.cache.set(url, texture);
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }
    
    clearCache() {
        this.cache.forEach(texture => texture.dispose());
        this.cache.clear();
    }
} 