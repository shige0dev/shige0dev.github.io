import { SynthEngine } from './audio/engine.js';
import { UIController } from './ui/controller.js';
import { initExternalAPI } from './core/api.js';

document.addEventListener('DOMContentLoaded', () => {
    const synth = new SynthEngine();
    const ui = new UIController(synth);
    initExternalAPI(ui, synth);

    const ro = new ResizeObserver(() => setTimeout(() => ui.renderCables(), 50));
    const frame = document.getElementById('phone-frame');
    if (frame) ro.observe(frame);
});
