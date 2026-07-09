import { S } from './state.js';
import { escapeHtml } from './utils.js';

// This module is mostly used by courses.js, but we export functions for external calls.

export function loadInteractiveMaterials(lessonId) {
    // Implementation is in courses.js, but we re-export for clarity
    return import('./courses.js').then(({ loadInteractiveMaterials }) => loadInteractiveMaterials(lessonId));
}

export function renderInteractiveMaterial(material) {
    return import('./courses.js').then(({ renderInteractiveMaterial }) => renderInteractiveMaterial(material));
}

export function switchCodeTab(tab, id) {
    return import('./courses.js').then(({ switchCodeTab }) => switchCodeTab(tab, id));
}

export function runCode(id) {
    return import('./courses.js').then(({ runCode }) => runCode(id));
}

export function calcPress(val, id) {
    return import('./courses.js').then(({ calcPress }) => calcPress(val, id));
}

export function calcClear(id) {
    return import('./courses.js').then(({ calcClear }) => calcClear(id));
}

export function calcEquals(id) {
    return import('./courses.js').then(({ calcEquals }) => calcEquals(id));
}

// Expose to window
window.switchCodeTab = switchCodeTab;
window.runCode = runCode;
window.calcPress = calcPress;
window.calcClear = calcClear;
window.calcEquals = calcEquals;
