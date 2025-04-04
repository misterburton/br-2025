const gsap = {
    to: function(target, {x, y, z, left, right, top, bottom, duration = 1, ease = 'power2.inOut', onUpdate, onComplete}) {
        const startX = target.x;
        const startY = target.y;
        const startZ = target.z;
        const startLeft = target.left;
        const startRight = target.right;
        const startTop = target.top;
        const startBottom = target.bottom;
        const startTime = performance.now();
        const endTime = startTime + (duration * 1000);

        function update() {
            const currentTime = performance.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            
            // Simple easing function (power2.inOut)
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            if (x !== undefined) target.x = startX + (x - startX) * easeProgress;
            if (y !== undefined) target.y = startY + (y - startY) * easeProgress;
            if (z !== undefined) target.z = startZ + (z - startZ) * easeProgress;
            if (left !== undefined) target.left = startLeft + (left - startLeft) * easeProgress;
            if (right !== undefined) target.right = startRight + (right - startRight) * easeProgress;
            if (top !== undefined) target.top = startTop + (top - startTop) * easeProgress;
            if (bottom !== undefined) target.bottom = startBottom + (bottom - startBottom) * easeProgress;

            if (onUpdate) onUpdate();

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (onComplete) onComplete();
            }
        }

        requestAnimationFrame(update);
    }
};

export { gsap }; 