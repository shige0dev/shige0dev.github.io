import { WORKLET_DSP_CODE } from '../dsp/worklet-code.js';
import { AUDIO_REGISTRY } from './registry.js';
import { AudioHelpers } from './helpers.js';

export class SynthEngine {
    constructor() {
        this.ctx = null;
        this.audioWorkletReady = false;
        this.modules = {};
        this.masterBPM = 120;
        this.isPlaying = false;
        this.silentSink = null;
    }

    async init() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
            this.silentSink = this.ctx.createGain();
            this.silentSink.gain.value = 0.0;
            this.silentSink.connect(this.ctx.destination);

            if (this.ctx.audioWorklet) {
                try {
                    const blob = new Blob([WORKLET_DSP_CODE], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    await this.ctx.audioWorklet.addModule(url);
                    this.audioWorkletReady = true;
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.warn('Worklet load error:', e);
                }
            }
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        return this.audioWorkletReady;
    }

    suspend() {
        if (this.ctx?.state === 'running') this.ctx.suspend();
    }

    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    setBPM(bpm) {
        this.masterBPM = bpm;
        if (this.ctx) {
            Object.values(this.modules).forEach(m => {
                if (m.type === 'CLK' || m.type === 'PAT') {
                    AudioHelpers.set(m.nodes.w?.parameters.get('bpm'), bpm, this.ctx, 0.02);
                } else if (m.type === 'LFO') {
                    m.nodes.w?.port.postMessage({ type: 'SET_CONFIG', bpm: bpm });
                }
            });
        }
    }

    setPlaybackState(isPlaying) {
        this.isPlaying = isPlaying;
        Object.values(this.modules).forEach(m => {
            if (m.type === 'CLK' || m.type === 'PAT') {
                m.nodes.w?.port.postMessage({ type: 'SET_STATE', running: isPlaying });
            }
        });
    }

    resetSequencers() {
        Object.values(this.modules).forEach(m => {
            if (m.type === 'SEQ' || m.type === 'PAT') {
                m.resetStep?.();
                m.nodes.w?.port.postMessage({ type: 'RESET' });
            }
        });
    }

    addModule(id, type, data, patchState) {
        this.removeModule(id);
        if (!this.ctx || (!this.audioWorkletReady && ['CLK','SEQ','PAT','ADSR','LFO','MATH','SH','FOLD'].includes(type))) return;
        const def = AUDIO_REGISTRY[type];
        if (def?.create) {
            const inst = def.create(this.ctx, data, patchState, this);
            inst.type = type;
            inst.data = data;
            this.modules[id] = inst;
            if (type === 'SUB' || type === 'SUB_IO') {
                this.linkSubBridges();
            }
        }
    }

    updateModule(id, data, patchState) {
        const inst = this.modules[id] || this.modules[`0/${id}`];
        if (inst && this.ctx) {
            inst.data = data;
            AUDIO_REGISTRY[inst.type]?.update?.(this.ctx, inst, data, patchState, this);
            if (inst.type === 'SUB') {
                this.linkSubBridges();
            }
        }
    }

    removeModule(id) {
        const fullId = this.modules[id] ? id : (this.modules[`0/${id}`] ? `0/${id}` : null);
        if (fullId && this.modules[fullId]) {
            AudioHelpers.cleanup(this.modules[fullId].nodes);
            delete this.modules[fullId];
        }
    }

    connect(sId, sPort, dId, dPort) {
        const s = this.modules[sId] || this.modules[`0/${sId}`];
        const d = this.modules[dId] || this.modules[`0/${dId}`];
        if (s?.outputs[sPort] && d?.inputs[dPort]) {
            try {
                s.outputs[sPort].connect(d.inputs[dPort]);
            } catch (e) {}
        }
    }

    disconnect(sId, sPort, dId, dPort) {
        const s = this.modules[sId] || this.modules[`0/${sId}`];
        const d = this.modules[dId] || this.modules[`0/${dId}`];
        if (s?.outputs[sPort] && d?.inputs[dPort]) {
            try {
                s.outputs[sPort].disconnect(d.inputs[dPort]);
            } catch (e) {}
        }
    }

    setKeyNote(id, midi, isDown) {
        const inst = this.modules[id] || this.modules[`0/${id}`];
        if (inst?.type === 'KEY') {
            inst.nodes.p.offset.setTargetAtTime((midi - 24) / 12.0, this.ctx.currentTime, 0.005);
            inst.nodes.g.offset.setTargetAtTime(isDown ? 1.0 : 0.0, this.ctx.currentTime, 0.005);
        }
    }

    triggerManualSample(id) {
        const inst = this.modules[id] || this.modules[`0/${id}`];
        inst?.nodes?.w?.port.postMessage({ type: 'TRIG' });
    }

    linkSubBridges() {
        if (!this.ctx) return;
        const pins = ['L1','L2','L3','L4','R1','R2','R3','R4','B1','B2','B3','B4'];
        Object.entries(this.modules).forEach(([subFullId, subInst]) => {
            if (subInst?.type === 'SUB') {
                const targetPage = String(subInst.data?.targetPage ?? subInst.targetPage ?? 1);
                Object.entries(this.modules).forEach(([ioFullId, ioInst]) => {
                    if (ioInst?.type === 'SUB_IO' && ioFullId.startsWith(`${targetPage}/`)) {
                        pins.forEach(pin => {
                            const subPin = subInst.nodes[pin];
                            const ioPin = ioInst.nodes[pin];
                            if (subPin?.in && subPin?.out && ioPin?.in && ioPin?.out) {
                                try {
                                    // Forward bridge: Page 0 SUB In -> Subpage SUB_IO Out
                                    try { subPin.in.disconnect(ioPin.out); } catch (_) {}
                                    subPin.in.connect(ioPin.out);

                                    // Return bridge: Subpage SUB_IO In -> Page 0 SUB Out
                                    try { ioPin.in.disconnect(subPin.out); } catch (_) {}
                                    ioPin.in.connect(subPin.out);
                                } catch (err) {}
                            }
                        });
                    }
                });
            }
        });
    }

    rebuildAll(pagesData, patchResolver) {
        if (!this.ctx) return;
        Object.keys(this.modules).forEach(id => this.removeModule(id));

        const pages = pagesData.pages || pagesData;
        const isMultiPage = pages && (pages["0"] || Object.keys(pages).some(k => !isNaN(parseInt(k))));

        if (isMultiPage) {
            // Instantiate all modules across all pages
            Object.entries(pages).forEach(([pageId, pData]) => {
                const mods = pData.modules || {};
                Object.entries(mods).forEach(([mId, m]) => {
                    const fullId = `${pageId}/${mId}`;
                    if (m) this.addModule(fullId, m.type, m, patchResolver(pageId, mId));
                });
            });

            // Connect intra-page connections
            Object.entries(pages).forEach(([pageId, pData]) => {
                const conns = pData.connections || [];
                conns.forEach(c => {
                    if (!c) return;
                    let fromMod = null, fromPort = null, toMod = null, toPort = null;
                    if (typeof c === 'object' && c.from && c.to) {
                        fromMod = typeof c.from === 'object' ? c.from.moduleId : c.from.split(':')[0];
                        fromPort = typeof c.from === 'object' ? c.from.port : c.from.split(':')[1];
                        toMod = typeof c.to === 'object' ? c.to.moduleId : c.to.split(':')[0];
                        toPort = typeof c.to === 'object' ? c.to.port : c.to.split(':')[1];
                    } else if (typeof c === 'string' && c.includes('>')) {
                        const [f, t] = c.split('>');
                        const [fM, fP] = f.split(':'), [tM, tP] = t.split(':');
                        fromMod = fM?.trim(); fromPort = fP?.trim();
                        toMod = tM?.trim(); toPort = tP?.trim();
                    }
                    if (fromMod && fromPort && toMod && toPort) {
                        this.connect(`${pageId}/${fromMod}`, fromPort, `${pageId}/${toMod}`, toPort);
                    }
                });
            });

            // Connect inter-page bridges (SUB in Page 0 <-> SUB_IO in target subpage)
            this.linkSubBridges();
        }
    }
}
