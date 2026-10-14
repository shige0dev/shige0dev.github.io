import { AUDIO_REGISTRY } from './registry.js';
import { AudioHelpers } from './helpers.js';
import { parseConn, normalizeSubPort } from '../core/utils.js';

export const WORKLET_MODULE_TYPES = ['CLK', 'SEQ', 'PAT', 'ADSR', 'LFO', 'MATH1', 'MATH2', 'SH', 'FOLD', 'CVDELAY', 'SCOPE', 'MARKOV', 'CHORD', 'FM', 'FM3OP', 'FMx3', 'FMCORE'];

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
                    const workletUrl = new URL('../dsp/worklet-processors.js?v=45', import.meta.url).href;
                    await this.ctx.audioWorklet.addModule(workletUrl);
                    this.audioWorkletReady = true;
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
            if (m.type === 'SEQ' || m.type === 'PAT' || m.type === 'MARKOV') {
                m.resetStep?.();
                m.nodes.w?.port.postMessage({ type: 'RESET' });
            }
            m.clear?.();
            if (m.type === 'CVDELAY' || m.type === 'ADSR') {
                m.nodes.w?.port?.postMessage({ type: 'RESET' });
            }
        });
    }

    clearAllBuffers() {
        Object.values(this.modules).forEach(m => {
            m.clear?.();
            m.nodes?.w?.port?.postMessage({ type: 'RESET' });
            if (m.type === 'ADSR') m.resetStage?.();
        });
    }

    addModule(id, type, data, patchState) {
        this.removeModule(id);
        if (!this.ctx || (!this.audioWorkletReady && WORKLET_MODULE_TYPES.includes(type))) return;
        const def = AUDIO_REGISTRY[type];
        if (def?.create) {
            const inst = def.create(this.ctx, data, patchState, this);
            inst.type = type;
            inst.data = data;
            inst.manifest = data?.manifest;
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
            inst.manifest = data?.manifest || inst.manifest;
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
        const sNorm = (s?.type === 'SUB' || s?.type === 'SUB_IO') ? normalizeSubPort(sPort, s?.type, s?.manifest) : sPort;
        const dNorm = (d?.type === 'SUB' || d?.type === 'SUB_IO') ? normalizeSubPort(dPort, d?.type, d?.manifest) : dPort;
        const sOut = s?.outputs[sNorm] || s?.outputs[sPort];
        const dIn = d?.inputs[dNorm] || d?.inputs[dPort];
        if (sOut && dIn) {
            try {
                sOut.connect(dIn);
            } catch (e) {}
        }
    }

    disconnect(sId, sPort, dId, dPort) {
        const s = this.modules[sId] || this.modules[`0/${sId}`];
        const d = this.modules[dId] || this.modules[`0/${dId}`];
        const sNorm = (s?.type === 'SUB' || s?.type === 'SUB_IO') ? normalizeSubPort(sPort, s?.type, s?.manifest) : sPort;
        const dNorm = (d?.type === 'SUB' || d?.type === 'SUB_IO') ? normalizeSubPort(dPort, d?.type, d?.manifest) : dPort;
        const sOut = s?.outputs[sNorm] || s?.outputs[sPort];
        const dIn = d?.inputs[dNorm] || d?.inputs[dPort];
        if (sOut && dIn) {
            try {
                sOut.disconnect(dIn);
            } catch (e) {}
        }
    }

    isRunning() {
        return this.ctx?.state === 'running';
    }

    hasModules() {
        return Object.keys(this.modules).length > 0;
    }

    sendControlEvent(id, event) {
        if (!event || !event.type) return;
        const inst = this.modules[id] || this.modules[`0/${id}`];
        if (!inst) return;

        switch (event.type) {
            case 'NOTE':
            case 'NOTE_ON':
            case 'NOTE_OFF': {
                const isDown = event.isDown ?? (event.type !== 'NOTE_OFF');
                const midi = event.midi ?? 60;
                if (inst.type === 'KEY' && inst.nodes?.p && inst.nodes?.g && this.ctx) {
                    inst.nodes.p.offset.setTargetAtTime((midi - 24) / 12.0, this.ctx.currentTime, 0.005);
                    inst.nodes.g.offset.setTargetAtTime(isDown ? 1.0 : 0.0, this.ctx.currentTime, 0.005);
                }
                break;
            }
            case 'TRIG': {
                inst.nodes?.w?.port?.postMessage({ type: 'TRIG' });
                break;
            }
            case 'DIAL':
            case 'VAL': {
                if (event.param && inst.nodes?.w?.parameters?.get(event.param)) {
                    AudioHelpers.set(inst.nodes.w.parameters.get(event.param), event.value, this.ctx, 0.02);
                } else if (inst.nodes?.w?.port) {
                    inst.nodes.w.port.postMessage({ type: 'SET_DIAL', ...event });
                }
                break;
            }
            case 'BUTTON': {
                inst.nodes?.w?.port?.postMessage({ type: 'SET_BUTTON', ...event });
                break;
            }
            default: {
                inst.nodes?.w?.port?.postMessage(event);
                break;
            }
        }
    }

    setKeyNote(id, midi, isDown) {
        this.sendControlEvent(id, { type: 'NOTE', midi, isDown });
    }

    triggerManualSample(id) {
        this.sendControlEvent(id, { type: 'TRIG' });
    }

    linkSubBridges() {
        if (!this.ctx) return;
        Object.entries(this.modules).forEach(([subFullId, subInst]) => {
            if (subInst?.type === 'SUB') {
                const targetPage = String(subInst.data?.targetPage ?? subInst.targetPage ?? 1);
                Object.entries(this.modules).forEach(([ioFullId, ioInst]) => {
                    if (ioInst?.type === 'SUB_IO' && ioFullId.startsWith(`${targetPage}/`)) {
                        // Forward bridge: Parent -> Child (Slots 1..6)
                        // SUB (Parent) PINn_in -> SUB_IO (Child) PINn_out
                        for (let i = 1; i <= 6; i++) {
                            const subIn = subInst.inputs[`PIN${i}_in`];
                            const ioOut = ioInst.outputs[`PIN${i}_out`];
                            if (subIn && ioOut) {
                                try { subIn.disconnect(ioOut); } catch (_) {}
                                try { subIn.connect(ioOut); } catch (err) {}
                            }
                        }
                        // Return bridge: Child -> Parent (Slots 7..12)
                        // SUB_IO (Child) PINn_in -> SUB (Parent) PINn_out
                        for (let i = 7; i <= 12; i++) {
                            const ioIn = ioInst.inputs[`PIN${i}_in`];
                            const subOut = subInst.outputs[`PIN${i}_out`];
                            if (ioIn && subOut) {
                                try { ioIn.disconnect(subOut); } catch (_) {}
                                try { ioIn.connect(subOut); } catch (err) {}
                            }
                        }
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
                    const parsed = parseConn(c);
                    if (parsed) {
                        this.connect(`${pageId}/${parsed.from.moduleId}`, parsed.from.port, `${pageId}/${parsed.to.moduleId}`, parsed.to.port);
                    }
                });
            });

            // Connect inter-page bridges (SUB in Page 0 <-> SUB_IO in target subpage)
            this.linkSubBridges();
        }
    }
}
