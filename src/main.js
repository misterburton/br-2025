import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { ContactSheet } from './components/ContactSheet.js';

// Initialize the main engine
const engine = new Engine();

// Initialize contact sheet
const contactSheet = new ContactSheet(engine.scene, engine.camera);

// Start the render loop
engine.start(); 