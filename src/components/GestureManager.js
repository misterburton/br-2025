export class GestureManager {
    constructor(element, callbacks) {
        this.hammer = new Hammer(element);
        this.callbacks = callbacks;
        
        // Configure recognizers
        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
        this.hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
        
        // Add event listeners
        this.hammer.on('panstart', this.handlePanStart.bind(this));
        this.hammer.on('panmove', this.handlePanMove.bind(this));
        this.hammer.on('panend', this.handlePanEnd.bind(this));
        this.hammer.on('swipe', this.handleSwipe.bind(this));
        this.hammer.on('doubletap', this.handleDoubleTap.bind(this));
        this.hammer.on('tap', this.handleTap.bind(this));
    }
    
    handlePanStart(event) {
        if (this.callbacks.onPanStart) {
            this.callbacks.onPanStart(event);
        }
    }
    
    handlePanMove(event) {
        if (this.callbacks.onPanMove) {
            this.callbacks.onPanMove(event);
        }
    }
    
    handlePanEnd(event) {
        if (this.callbacks.onPanEnd) {
            this.callbacks.onPanEnd(event);
        }
    }
    
    handleSwipe(event) {
        if (this.callbacks.onSwipe) {
            this.callbacks.onSwipe(event);
        }
    }
    
    handleDoubleTap(event) {
        if (this.callbacks.onDoubleTap) {
            this.callbacks.onDoubleTap(event);
        }
    }
    
    handleTap(event) {
        if (this.callbacks.onTap) {
            this.callbacks.onTap(event);
        }
    }
    
    dispose() {
        this.hammer.destroy();
    }
} 