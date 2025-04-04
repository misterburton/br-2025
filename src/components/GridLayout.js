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
        // Calculate aspect ratios
        const sheetAspect = this.sheetWidth / this.sheetHeight;
        const viewportAspect = window.innerWidth / window.innerHeight;
        
        // Base scale on the more constrained dimension
        if (viewportAspect < sheetAspect) {
            // Width-constrained viewport (tall/narrow)
            this.scale = 3.5 / this.sheetWidth;
        } else {
            // Height-constrained viewport (short/wide)
            this.scale = 3.5 / this.sheetHeight;
        }
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
} 