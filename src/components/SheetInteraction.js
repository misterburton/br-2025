import * as THREE from 'three';

// State enum
export const SheetState = {
    IDLE: 'idle',
    ZOOMED_IN: 'zoomed_in',
    ANIMATING: 'animating'
};

// This file is kept for backward compatibility
// The interaction functionality has been migrated to use the GestureManager
// with Hammer.js for more consistent gesture handling 