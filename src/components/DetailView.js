export class DetailView {
    constructor() {
        // Create container - make it transparent to allow contact sheet to show through
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transform: scale(1.4);
            transform-origin: center center;
            overscroll-behavior: contain;
            background-color: transparent;
        `;
        
        // Track visibility state
        this.isVisible = false;

        // Create background overlay
        this.background = document.createElement('div');
        this.background.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            opacity: 0;
        `;

        // Create close button
        this.closeButton = document.createElement('button');
        this.closeButton.innerHTML = '×';
        this.closeButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            font-size: 24px;
            font-family: "Helvetica Neue", Arial, sans-serif;
            cursor: pointer;
            z-index: 1002;
            opacity: 0;
            transform: scale(0.9);
        `;

        // Create content wrapper
        this.content = document.createElement('div');
        this.content.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            opacity: 0;
            z-index: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-y;
            overscroll-behavior: contain;
            -webkit-tap-highlight-color: rgba(0,0,0,0);
            -ms-touch-action: pan-y;
            user-select: none;
            -webkit-user-select: none;
            background-color: black;
        `;

        // Create image
        this.image = document.createElement('img');
        this.image.style.cssText = `
            width: 100%;
            height: auto;
            display: block;
        `;

        // Create title
        this.title = document.createElement('h2');
        this.title.style.cssText = `
            color: white;
            font-size: 24px;
            margin: 20px 20px 10px;
            font-family: "Source Code Pro", Menlo, Monaco, Consolas, monospace, monospace;
        `;

        // Create description
        this.description = document.createElement('p');
        this.description.style.cssText = `
            color: white;
            margin: 0 20px 20px;
            line-height: 1.5;
            font-family: "Source Code Pro", Menlo, Monaco, Consolas, monospace, monospace;
        `;
        this.description.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae justo vel metus gravida tincidunt. Nullam eget felis non nunc varius venenatis. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec lacinia magna sit amet dolor volutpat, non mollis nulla consequat.';

        // Create inquire button
        this.inquireButton = document.createElement('button');
        this.inquireButton.textContent = 'Inquire About This Image';
        this.inquireButton.style.cssText = `
            background: #333;
            color: white;
            border: none;
            padding: 15px 30px;
            margin: 0 20px 40px;
            cursor: pointer;
            font-size: 16px;
            font-family: "Source Code Pro", Menlo, Monaco, Consolas, monospace, monospace;
        `;

        // Assemble the DOM
        this.content.appendChild(this.image);
        this.content.appendChild(this.title);
        this.content.appendChild(this.description);
        this.content.appendChild(this.inquireButton);
        this.container.appendChild(this.background);
        this.container.appendChild(this.content);
        document.body.appendChild(this.container);
        document.body.appendChild(this.closeButton);

        // Event handlers
        this.closeButton.addEventListener('click', () => this.hide());

        // Add enhanced pinch gesture handler
        this.hammer = new Hammer(this.container);
        
        // Configure Hammer recognizers for better performance
        this.hammer.get('pinch').set({
            enable: true,
            threshold: 0.1,  // Make it more sensitive to pinch
            pointers: 2      // Require exactly 2 pointers for pinch
        });
        
        // Prevent Safari default behaviors without breaking scrolling
        this.container.style.webkitTouchCallout = 'none';
        this.container.style.webkitUserSelect = 'none';
        this.container.style.webkitTapHighlightColor = 'rgba(0,0,0,0)';
        
        // Allow content to scroll vertically
        this.content.style.touchAction = 'pan-y';
        
        // Listen for pinch gesture with more explicit tracking
        let initialPinchScale = 1;
        let isPinching = false;
        
        this.hammer.on('pinchstart', (event) => {
            isPinching = true;
            initialPinchScale = event.scale;
        });
        
        this.hammer.on('pinchin', (event) => {
            if (!isPinching) return;
            
            // Calculate pinch change relative to initial scale
            const pinchChange = event.scale / initialPinchScale;
            
            // Only trigger if the scale is significantly smaller
            if (pinchChange < 0.8) {
                event.preventDefault();
                isPinching = false;  // Reset to prevent multiple triggers
                this.hide();
            }
        });
        
        this.hammer.on('pinchend', () => {
            isPinching = false;
        });
        
        // Store instance references to event handlers for proper cleanup
        this.multiTouchHandler = (e) => {
            if (e.touches && e.touches.length >= 2) {
                e.preventDefault();
            }
        };
        
        this.gestureHandler = (e) => {
            e.preventDefault();
        };
        
        // Add handlers using stored references
        this.container.addEventListener('touchstart', this.multiTouchHandler, { passive: false });
        this.container.addEventListener('gesturechange', this.gestureHandler, { passive: false });
        
        // Create resize handler to adjust view on window resize
        this.resizeHandler = () => {
            if (!this.container || this.container.style.display === 'none') return;
            
            if (window.innerWidth >= 1440) {
                // Large desktop view (>= 1440px)
                const maxContentWidth = Math.min(1000, window.innerWidth * 0.6);
                this.content.style.width = `${maxContentWidth}px`;
                this.content.style.margin = '0 auto';
                this.content.style.maxHeight = '90vh';
                this.content.style.borderRadius = '8px';
                this.content.style.overflow = 'hidden auto';
                this.content.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.5)';
                
                // Set semi-transparent background to let contact sheet show through
                this.background.style.opacity = '1';
                this.background.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
            } else if (window.innerWidth >= 1024) {
                // Desktop/small desktop view (1024px-1439px)
                const maxContentWidth = Math.min(900, window.innerWidth * 0.7);
                this.content.style.width = `${maxContentWidth}px`;
                this.content.style.margin = '0 auto';
                this.content.style.maxHeight = '90vh';
                this.content.style.borderRadius = '8px';
                this.content.style.overflow = 'hidden auto';
                this.content.style.boxShadow = '0 0 25px rgba(0, 0, 0, 0.5)';
                
                // Set semi-transparent background to let contact sheet show through
                this.background.style.opacity = '1';
                this.background.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            } else if (window.innerWidth >= 768) {
                // Tablet view (768px-1023px)
                const maxContentWidth = Math.min(700, window.innerWidth * 0.8);
                this.content.style.width = `${maxContentWidth}px`;
                this.content.style.margin = '0 auto';
                this.content.style.maxHeight = '90vh';
                this.content.style.borderRadius = '8px';
                this.content.style.overflow = 'hidden auto';
                this.content.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
                
                // Set semi-transparent background to let contact sheet show through
                this.background.style.opacity = '1';
                this.background.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            } else {
                // Mobile view (<768px)
                this.content.style.width = '100%';
                this.content.style.margin = '0';
                this.content.style.maxHeight = 'none';
                this.content.style.borderRadius = '0';
                this.content.style.overflow = 'auto';
                this.content.style.boxShadow = 'none';
                
                // Set opaque background on mobile - no contact sheet showing
                this.background.style.opacity = '1';
                this.background.style.backgroundColor = 'rgba(0, 0, 0, 1)';
            }
        };
    }
    
    formatTitle(filename) {
        return filename
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/-/g, ' ') // Replace hyphens with spaces
            .replace(/([A-Z])/g, ' $1') // Add space before capitals
            .trim();
    }
    
    show(imageData, camera, onClose) {
        this.onClose = onClose;
        this.camera = camera;
        this.isVisible = true;
        
        // Store original camera settings
        this.originalSettings = {
            left: camera.left,
            right: camera.right,
            top: camera.top,
            bottom: camera.bottom
        };
        
        // Adjust container width based on screen size - use the shared resize handler
        this.resizeHandler();
        
        // Add resize listener
        window.addEventListener('resize', this.resizeHandler);
        
        // Update content - use preloaded image if available
        if (imageData.domImage) {
            // Replace the existing image with the preloaded one to avoid loading delay
            if (this.image.parentNode) {
                const newImage = imageData.domImage.cloneNode(true);
                newImage.style.cssText = this.image.style.cssText;
                this.content.replaceChild(newImage, this.image);
                this.image = newImage;
            } else {
                this.image = imageData.domImage.cloneNode(true);
                this.image.style.cssText = `
                    width: 100%;
                    height: auto;
                    display: block;
                `;
                this.content.prepend(this.image);
            }
        } else {
            // Fallback to standard image loading
            this.image.src = imageData.url;
        }
        
        this.title.textContent = this.formatTitle(imageData.filename);
        
        // Enable interaction
        this.container.style.pointerEvents = 'auto';
        
        // Create master timeline
        const tl = gsap.timeline();
        
        // Calculate zoom amounts
        const zoomFactor = window.innerWidth <= 768 ? 1.15 : 1.1;
        const startScale = window.innerWidth <= 768 ? 0.5 : 0.6; // Start small and grow
        
        // Initial states
        gsap.set(this.container, {
            display: 'block',
            opacity: 0,
            transform: `scale(${startScale})`,
            transformOrigin: 'center center'
        });
        gsap.set([this.closeButton, this.content], { opacity: 0 });
        gsap.set(this.background, { opacity: 0 });
        
        // Start camera zoom and detail view scale simultaneously
        tl.to(camera, {
            left: this.originalSettings.left / zoomFactor,
            right: this.originalSettings.right / zoomFactor,
            top: this.originalSettings.top / zoomFactor,
            bottom: this.originalSettings.bottom / zoomFactor,
            duration: 0.65,
            ease: 'power2.inOut',
            onUpdate: () => camera.updateProjectionMatrix()
        })
        .to(this.container, {
            opacity: 1,
            transform: 'scale(1)',
            duration: 0.65,
            ease: 'power2.inOut'
        }, 0)
        .to(this.background, {
            opacity: 1,
            duration: 0.5,
            ease: 'power2.inOut'
        }, 0)
        .to([this.closeButton, this.content], {
            opacity: 1,
            duration: 0.3,
            ease: 'power2.out'
        }, '-=0.2');

        // Add escape key handler
        this.escHandler = (e) => {
            if (e.key === 'Escape') this.hide();
        };
        document.addEventListener('keydown', this.escHandler);
    }

    // Update image without restarting the animation
    updateImage(newImage) {
        if (!this.isVisible || !this.image || !this.image.parentNode) return;
        
        const newImageElement = newImage.cloneNode(true);
        newImageElement.style.cssText = this.image.style.cssText;
        this.content.replaceChild(newImageElement, this.image);
        this.image = newImageElement;
    }

    hide() {
        this.isVisible = false;
        
        const endScale = window.innerWidth <= 768 ? 0.5 : 0.6; // End small
        
        const tl = gsap.timeline({
            onComplete: () => {
                this.container.style.pointerEvents = 'none';
                if (this.onClose) this.onClose();
            }
        });
        
        // First fade out content and close button
        tl.to([this.closeButton, this.content], {
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in'
        })
        // Scale down detail view while zooming camera back
        .to(this.container, {
            opacity: 0,
            transform: `scale(${endScale})`,
            duration: 0.65,
            ease: 'power2.inOut'
        }, 0)
        .to(this.background, {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.inOut'
        }, 0)
        // Zoom camera back in
        .to(this.camera, {
            left: this.originalSettings.left,
            right: this.originalSettings.right,
            top: this.originalSettings.top,
            bottom: this.originalSettings.bottom,
            duration: 0.65,
            ease: 'power2.inOut',
            onUpdate: () => this.camera.updateProjectionMatrix()
        }, 0);
        
        document.removeEventListener('keydown', this.escHandler);
        window.removeEventListener('resize', this.resizeHandler);
    }

    dispose() {
        this.isVisible = false;
        
        // Clean up Hammer instance
        if (this.hammer) {
            this.hammer.destroy();
        }
        
        // Remove event listeners
        if (this.container) {
            this.container.removeEventListener('touchstart', this.multiTouchHandler);
            this.container.removeEventListener('gesturechange', this.gestureHandler);
            
            if (this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
        }
        
        if (this.closeButton && this.closeButton.parentNode) {
            this.closeButton.parentNode.removeChild(this.closeButton);
        }
        
        document.removeEventListener('keydown', this.escHandler);
        window.removeEventListener('resize', this.resizeHandler);
    }
}
