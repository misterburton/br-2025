export class GestureManager {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks;
        
        // Configure element for proper touch handling
        this.element.style.touchAction = 'none';
        this.element.style.webkitTouchCallout = 'none';
        this.element.style.webkitUserSelect = 'none';
        this.element.style.userSelect = 'none';
        
        // Configure Hammer.js
        this.hammer = new Hammer(element);
        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
        this.hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
        
        // Enable and configure pinch recognizer
        this.hammer.get('pinch').set({ 
            enable: true,
            threshold: 0.1
        });
        
        // Critical fix: Configure recognizer relationships
        // Make pinch take precedence over pan when pinch is detected
        const pinch = this.hammer.get('pinch');
        const pan = this.hammer.get('pan');
        
        // Recognize pan with pinch, so they can start together
        // but pinch will take precedence once it's recognized
        pinch.recognizeWith(pan);
        
        // Make pan require pinch to fail, so pan won't be recognized
        // during a pinch gesture
        pan.requireFailure(pinch);
        
        // Prevent browsers from natively handling these events
        this.disableNativeTouchBehaviors();
        
        // Add event listeners
        this.hammer.on('panstart', this.handlePanStart.bind(this));
        this.hammer.on('panmove', this.handlePanMove.bind(this));
        this.hammer.on('panend', this.handlePanEnd.bind(this));
        this.hammer.on('swipe', this.handleSwipe.bind(this));
        this.hammer.on('doubletap', this.handleDoubleTap.bind(this));
        this.hammer.on('tap', this.handleTap.bind(this));
        
        // Add pinch event listeners
        this.hammer.on('pinchstart', this.handlePinchStart.bind(this));
        this.hammer.on('pinchin', this.handlePinchIn.bind(this));
        this.hammer.on('pinchout', this.handlePinchOut.bind(this));
        this.hammer.on('pinchend', this.handlePinchEnd.bind(this));
    }
    
    disableNativeTouchBehaviors() {
        // Prevent default touch behaviors, especially double-tap zoom
        const preventDefaultTouch = (e) => e.preventDefault();
        
        this.element.addEventListener('touchstart', preventDefaultTouch, { passive: false });
        this.element.addEventListener('touchmove', preventDefaultTouch, { passive: false });
        this.element.addEventListener('touchend', preventDefaultTouch, { passive: false });
        this.element.addEventListener('gesturestart', preventDefaultTouch, { passive: false });
        this.element.addEventListener('gesturechange', preventDefaultTouch, { passive: false });
        this.element.addEventListener('gestureend', preventDefaultTouch, { passive: false });
        
        // Store event handlers for cleanup
        this.touchHandlers = [
            { event: 'touchstart', handler: preventDefaultTouch },
            { event: 'touchmove', handler: preventDefaultTouch },
            { event: 'touchend', handler: preventDefaultTouch },
            { event: 'gesturestart', handler: preventDefaultTouch },
            { event: 'gesturechange', handler: preventDefaultTouch },
            { event: 'gestureend', handler: preventDefaultTouch }
        ];
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
    
    handlePinchStart(event) {
        if (this.callbacks.onPinchStart) {
            this.callbacks.onPinchStart(event);
        }
    }
    
    handlePinchIn(event) {
        if (this.callbacks.onPinchIn) {
            this.callbacks.onPinchIn(event);
        }
    }
    
    handlePinchOut(event) {
        if (this.callbacks.onPinchOut) {
            this.callbacks.onPinchOut(event);
        }
    }
    
    handlePinchEnd(event) {
        if (this.callbacks.onPinchEnd) {
            this.callbacks.onPinchEnd(event);
        }
    }
    
    dispose() {
        this.hammer.destroy();
        
        // Remove touch event listeners
        if (this.touchHandlers) {
            this.touchHandlers.forEach(({ event, handler }) => {
                this.element.removeEventListener(event, handler);
            });
        }
    }
} 