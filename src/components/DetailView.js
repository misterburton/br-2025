// DetailView.js - Component for displaying detailed image information
export class DetailView {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'detail-view';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            color: white;
            opacity: 0;
            pointer-events: none;
            z-index: 1000;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            transform: scale(0.95);
            transition: transform 0.5s ease;
        `;
        
        // Create close button
        this.closeButton = document.createElement('button');
        this.closeButton.className = 'detail-view-close';
        this.closeButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        this.closeButton.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            width: 40px;
            height: 40px;
            padding: 8px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
            color: white;
            cursor: pointer;
            transition: background-color 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1001;
            opacity: 0;
            transform: scale(0.9);
        `;
        
        // Create content container
        this.content = document.createElement('div');
        this.content.className = 'detail-view-content';
        this.content.style.cssText = `
            max-width: 800px;
            width: 100%;
            padding: 2rem;
            margin-top: 4rem;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            transition: opacity 0.5s ease, transform 0.5s ease;
        `;
        
        // Create image container
        this.imageContainer = document.createElement('div');
        this.imageContainer.className = 'detail-view-image';
        this.imageContainer.style.cssText = `
            width: 100%;
            height: 60vh;
            background-size: contain;
            background-position: center;
            background-repeat: no-repeat;
            margin-bottom: 2rem;
        `;
        
        // Create info container
        this.infoContainer = document.createElement('div');
        this.infoContainer.className = 'detail-view-info';
        this.infoContainer.style.cssText = `
            width: 100%;
            padding: 2rem;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            backdrop-filter: blur(8px);
            margin-bottom: 2rem;
        `;
        
        // Create inquire button
        this.inquireButton = document.createElement('button');
        this.inquireButton.className = 'detail-view-inquire';
        this.inquireButton.textContent = 'Inquire About This Image';
        this.inquireButton.style.cssText = `
            display: block;
            width: 100%;
            padding: 1rem;
            margin-top: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: white;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.3s ease;
        `;
        
        // Add elements to DOM
        this.content.appendChild(this.imageContainer);
        this.content.appendChild(this.infoContainer);
        this.infoContainer.appendChild(this.inquireButton);
        this.container.appendChild(this.closeButton);
        this.container.appendChild(this.content);
        document.body.appendChild(this.container);
        
        // Bind events
        this.closeButton.addEventListener('mouseenter', () => {
            this.closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        this.closeButton.addEventListener('mouseleave', () => {
            this.closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        
        this.inquireButton.addEventListener('mouseenter', () => {
            this.inquireButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        this.inquireButton.addEventListener('mouseleave', () => {
            this.inquireButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        
        // Check if mobile
        this.isMobile = window.innerWidth <= 768;
        
        // Store original camera settings
        this.originalCameraSettings = null;
    }
    
    formatTitle(filename) {
        // Remove file extension and path
        let title = filename.split('/').pop().replace(/\.[^/.]+$/, "");
        // Replace hyphens and underscores with spaces
        title = title.replace(/[-_]/g, " ");
        // Capitalize first letter of each word
        title = title.split(" ").map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(" ");
        return title;
    }
    
    show(imageData, camera, onClose) {
        // Store original camera settings
        this.originalCameraSettings = {
            left: camera.left,
            right: camera.right,
            top: camera.top,
            bottom: camera.bottom
        };
        
        // Make container visible but transparent to start animation
        this.container.style.opacity = '1';
        this.container.style.pointerEvents = 'auto';
        this.container.style.background = 'rgba(0, 0, 0, 0)';
        
        // Format title from filename if no title provided
        const title = imageData.title || this.formatTitle(imageData.filename);
        
        // Update content with image data - use the correct image path
        const imagePath = imageData.url || `${imageData.filename}`; // Use the URL directly if provided
        this.imageContainer.style.backgroundImage = `url(${imagePath})`;
        
        this.infoContainer.innerHTML = `
            <h2 style="font-size: 2rem; margin-bottom: 1rem;">${title}</h2>
            ${imageData.description ? `<p style="font-size: 1.1rem; line-height: 1.6;">${imageData.description}</p>` : ''}
            ${imageData.metadata ? `
                <div style="margin-top: 2rem; font-size: 0.9rem; opacity: 0.8;">
                    ${Object.entries(imageData.metadata).map(([key, value]) => `
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${key}:</strong> ${value}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        
        // Store current image data
        this.currentImageData = imageData;
        
        // Create timeline for synchronized animations
        const tl = gsap.timeline();
        
        // Camera zoom out animation
        tl.to(camera, {
            left: camera.left * 1.1,
            right: camera.right * 1.1,
            top: camera.top * 1.1,
            bottom: camera.bottom * 1.1,
            duration: 0.5,
            ease: "power2.inOut",
            onUpdate: () => camera.updateProjectionMatrix()
        }, 0);
        
        // Fade in background
        tl.to(this.container, {
            background: 'rgba(0, 0, 0, 0.75)',
            duration: 0.5,
            ease: "power2.inOut"
        }, 0);
        
        // Scale up container
        tl.to(this.container, {
            transform: 'scale(1)',
            duration: 0.5,
            ease: "power2.out"
        }, 0);
        
        // Fade in and scale up content
        tl.to(this.content, {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
            duration: 0.5,
            ease: "power2.out"
        }, 0.1);
        
        // Fade in and scale up close button
        tl.to(this.closeButton, {
            opacity: 1,
            transform: 'scale(1)',
            duration: 0.4,
            ease: "power2.out"
        }, 0.2);
        
        // Set up close handler
        this.onClose(onClose);
    }
    
    hide(camera, onComplete) {
        // Create timeline for synchronized animations
        const tl = gsap.timeline({
            onComplete: () => {
                this.container.style.opacity = '0';
                this.container.style.pointerEvents = 'none';
                this.container.style.background = 'transparent';
                if (onComplete) onComplete();
            }
        });
        
        // Restore original camera settings
        if (this.originalCameraSettings) {
            tl.to(camera, {
                left: this.originalCameraSettings.left,
                right: this.originalCameraSettings.right,
                top: this.originalCameraSettings.top,
                bottom: this.originalCameraSettings.bottom,
                duration: 0.5,
                ease: "power2.inOut",
                onUpdate: () => camera.updateProjectionMatrix()
            }, 0);
        }
        
        // Fade out and scale down content
        tl.to(this.content, {
            opacity: 0,
            transform: 'translateY(20px) scale(0.95)',
            duration: 0.4,
            ease: "power2.in"
        }, 0);
        
        // Fade out and scale down close button
        tl.to(this.closeButton, {
            opacity: 0,
            transform: 'scale(0.9)',
            duration: 0.3,
            ease: "power2.in"
        }, 0);
        
        // Fade out background and scale down container
        tl.to(this.container, {
            background: 'rgba(0, 0, 0, 0)',
            transform: 'scale(0.95)',
            duration: 0.5,
            ease: "power2.inOut"
        }, 0.1);
        
        this.currentImageData = null;
        this.originalCameraSettings = null;
    }
    
    // Method to add custom close handler
    onClose(handler) {
        // Remove any existing click handlers
        const newButton = this.closeButton.cloneNode(true);
        this.closeButton.parentNode.replaceChild(newButton, this.closeButton);
        this.closeButton = newButton;
        
        // Add hover effects back
        this.closeButton.addEventListener('mouseenter', () => {
            this.closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        this.closeButton.addEventListener('mouseleave', () => {
            this.closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        
        // Add new click handler
        this.closeButton.addEventListener('click', () => {
            handler(this.currentImageData);
        });
    }
} 