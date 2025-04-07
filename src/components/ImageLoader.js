import * as THREE from 'three';

export class ImageLoader {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
    }
    
    // Helper method to load textures with proper encoding
    loadTextureWithProperEncoding(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // Use modern colorSpace property instead of encoding
                    texture.colorSpace = THREE.SRGBColorSpace;
                    
                    resolve(texture);
                },
                undefined,
                (error) => {
                    // Error occurred during texture loading
                    reject(error);
                }
            );
        });
    }
    
    // Get image files for a specific sheet
    async getSheetImageFiles(sheetId) {
        // For now, return hardcoded list of files based on sheet ID
        if (sheetId === 'sheet_one') {
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
    
    // Create an image mesh with the given parameters
    createImageMesh(texture, width, height, position, userData) {
        const geometry = new THREE.PlaneGeometry(width, height);
        
        const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.FrontSide,
            transparent: true,
            color: new THREE.Color(1, 1, 1)
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.userData = userData;
        
        return mesh;
    }
    
    // Create a fallback mesh for when texture loading fails
    createFallbackMesh(width, height, position, userData) {
        const geometry = new THREE.PlaneGeometry(width, height);
        const fallbackMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.8 
        });
        
        const mesh = new THREE.Mesh(geometry, fallbackMaterial);
        mesh.position.set(position.x, position.y, position.z);
        mesh.userData = userData;
        
        return mesh;
    }
} 