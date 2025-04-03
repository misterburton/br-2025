export class GridLayout {
    constructor() {
        // Contact sheet dimensions
        this.sheetWidth = 5685;
        this.sheetHeight = 6100;
        
        // Individual image dimensions
        this.imageWidth = 600;
        this.imageHeight = 900;
        
        // Grid spacing
        this.horizontalMargin = 315;
        this.verticalMargin = 40;
        
        // First image position
        this.firstImageX = 250;
        this.firstImageY = 250;
        
        // Grid dimensions
        this.rows = 6;
        this.columns = 6;
        
        // Calculate scale factor to normalize coordinates
        this.scale = 1;
        this.calculateScale();
    }
    
    calculateScale() {
        // We'll scale everything down so the sheet height is 2 units in the scene
        this.scale = 2 / this.sheetHeight;
    }
    
    getImagePosition(row, col) {
        // Calculate pixel positions
        const pixelX = this.firstImageX + (col * (this.imageWidth + this.horizontalMargin));
        const pixelY = this.firstImageY + (row * (this.imageHeight + this.verticalMargin));
        
        // Convert to normalized coordinates (centered around origin)
        const normalizedX = (pixelX + this.imageWidth/2 - this.sheetWidth/2) * this.scale;
        const normalizedY = -(pixelY + this.imageHeight/2 - this.sheetHeight/2) * this.scale;
        
        return {
            x: normalizedX,
            y: normalizedY,
            width: this.imageWidth * this.scale,
            height: this.imageHeight * this.scale
        };
    }
    
    getSheetDimensions() {
        return {
            width: this.sheetWidth * this.scale,
            height: this.sheetHeight * this.scale
        };
    }
    
    getCameraDistance() {
        // Calculate distance needed to view entire sheet
        const vFov = 75 * Math.PI / 180; // Convert FOV to radians
        const aspect = window.innerWidth / window.innerHeight;
        
        // Get the larger of width or height based on aspect ratio
        const height = this.sheetHeight * this.scale;
        const width = this.sheetWidth * this.scale;
        
        // Calculate distances needed for both dimensions
        const heightDistance = height / (2 * Math.tan(vFov / 2));
        const widthDistance = (width / aspect) / (2 * Math.tan(vFov / 2));
        
        // Use the larger distance to ensure everything is visible
        return Math.max(heightDistance, widthDistance) * 1.1; // Add 10% margin
    }
} 