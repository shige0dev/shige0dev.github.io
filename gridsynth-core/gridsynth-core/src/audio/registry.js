import { AudioHelpers } from './helpers.js';
import { MultiOscGroup } from './multi-osc.js';
import { CHORD_TYPES, CHORD_VOICINGS, CHORD_ORDER, VOICING_ORDER } from '../core/musical.js';
import { parseStrudelPattern, parseStrudelPatternCycles } from '../core/strudel-parser.js';

let _softClipCurve = null;
const getSoftClipCurve = () => {
    if (!_softClipCurve) {
        _softClipCurve = new Float32Array(512);
        for (let i = 0; i < 512; i++) {
            const x = (i * 2) / 511 - 1;
            _softClipCurve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25);
        }
    }
    return _softClipCurve;
};

const createMathAudio = (ctx, d, patch, eng, hasTwoInputs) => {
    const gA = ctx.createGain(), out = ctx.createGain(), an = ctx.createAnalyser();
    const gB = hasTwoInputs ? ctx.createGain() : null;
    an.fftSize = 256; out.connect(an);
    if (eng?.silentSink) out.connect(eng.silentSink);
    const w = new AudioWorkletNode(ctx, 'math-processor', { numberOfInputs: 2, numberOfOutputs: 1 });
    w.port.postMessage({
        type: 'SET_PARAMS',
        mode: d.mode || (hasTwoInputs ? 'ADD' : 'ABS'),
        valA: d.valA ?? 0.0,
        valB: hasTwoInputs ? (d.valB ?? 1.0) : 0.0,
        hasA: patch?.has('a') || false,
        hasB: hasTwoInputs ? (patch?.has('b') || false) : false
    });
    gA.connect(w, 0, 0);
    if (gB) gB.connect(w, 0, 1);
    w.connect(out);
    const buf = new Float32Array(an.frequencyBinCount);
    const nodes = { gA, out, an, w };
    const inputs = { a: gA };
    if (gB) { nodes.gB = gB; inputs.b = gB; }
    return { nodes, inputs, outputs: { cv_out: out }, read: () => { an.getFloatTimeDomainData(buf); return { values: [buf[0] || 0] }; } };
};

const updateMathAudio = (inst, d, patch, hasTwoInputs) => {
    inst.nodes.w.port.postMessage({
        type: 'SET_PARAMS',
        mode: d.mode || (hasTwoInputs ? 'ADD' : 'ABS'),
        valA: d.valA ?? 0.0,
        valB: hasTwoInputs ? (d.valB ?? 1.0) : 0.0,
        hasA: patch?.has('a') || false,
        hasB: hasTwoInputs ? (patch?.has('b') || false) : false
    });
};

export const AUDIO_REGISTRY = {
    VCO: {
        create: (ctx, d, patch) => {
            const ch = Math.min(4, Math.max(1, d.channels || 1));
            const out = ctx.createGain();
            out.gain.value = 0.75 / Math.sqrt(ch);
            const { oscs, cvGains, inputs } = MultiOscGroup.create(ctx, d, patch, out);
            return {
                nodes: { oscs, cvGains, out },
                inputs,
                outputs: { wave_out: out }
            };
        },
        update: (ctx, inst, d, patch) => {
            const ch = Math.min(4, Math.max(1, d.channels || 1));
            AudioHelpers.set(inst.nodes.out.gain, 0.75 / Math.sqrt(ch), ctx);
            MultiOscGroup.update(ctx, inst.nodes.oscs, d, patch);
        }
    },
    VCF: {
        create: (ctx, d, patch) => {
            const f = ctx.createBiquadFilter(), cv = ctx.createGain();
            f.type = (d.filterType || 'lowpass').toLowerCase(); f.frequency.value = d.cutoff || 1800; f.Q.value = d.q || 2.5;
            cv.gain.value = d.modDepth !== undefined ? d.modDepth : 1200; cv.connect(f.detune);
            return { nodes: { f, cv }, inputs: { wave_in: f, cv_in: cv }, outputs: { wave_out: f } };
        },
        update: (ctx, inst, d, patch) => {
            AudioHelpers.set(inst.nodes.f.frequency, d.cutoff || 1800, ctx); AudioHelpers.set(inst.nodes.f.Q, d.q || 2.5, ctx);
            inst.nodes.f.type = (d.filterType || 'lowpass').toLowerCase();
            AudioHelpers.set(inst.nodes.cv.gain, d.modDepth !== undefined ? d.modDepth : 1200, ctx);
        }
    },
    VCA: {
        create: (ctx, d, patch) => {
            const vca = ctx.createGain(), cv = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 256;
            vca.gain.value = patch.has('cv_in') ? 0.0 : (d.level ?? 1.0); cv.gain.value = d.cvDepth ?? 1.0;
            cv.connect(vca.gain); cv.connect(an);
            const buf = new Float32Array(an.frequencyBinCount);
            return { nodes: { vca, cv, an }, inputs: { wave_in: vca, cv_in: cv }, outputs: { wave_out: vca }, read: () => { an.getFloatTimeDomainData(buf); return { values: [buf[0] || 0], hasCvIn: patch.has('cv_in') }; } };
        },
        update: (ctx, inst, d, patch) => {
            AudioHelpers.set(inst.nodes.vca.gain, patch.has('cv_in') ? 0.0 : (d.level ?? 1.0), ctx);
            AudioHelpers.set(inst.nodes.cv.gain, d.cvDepth ?? 1.0, ctx);
        }
    },
    FOLD: {
        create: (ctx, d, patch) => {
            const ch = Math.min(4, Math.max(1, d.channels || 1));
            const oscMix = ctx.createGain();
            oscMix.gain.value = 0.75 / Math.sqrt(ch);

            const out = ctx.createGain();
            out.gain.value = 0.75;

            const fCv = ctx.createGain();
            const w = new AudioWorkletNode(ctx, 'fold-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                parameterData: {
                    fold: patch.has('fold_cv') ? 0.0 : (d.fold ?? 1.5),
                    bias: d.bias || 0.0
                }
            });

            fCv.gain.value = 3.0;
            fCv.connect(w.parameters.get('fold'));

            oscMix.connect(w);
            w.connect(out);

            const { oscs, cvGains, inputs } = MultiOscGroup.create(ctx, d, patch, oscMix);
            inputs.fold_cv = fCv;

            return {
                nodes: { oscs, oscMix, w, out, cvGains, fCv },
                inputs,
                outputs: { wave_out: out }
            };
        },
        update: (ctx, inst, d, patch) => {
            const ch = Math.min(4, Math.max(1, d.channels || 1));
            AudioHelpers.set(inst.nodes.oscMix.gain, 0.75 / Math.sqrt(ch), ctx);
            AudioHelpers.set(inst.nodes.w.parameters.get('fold'), patch.has('fold_cv') ? 0.0 : (d.fold ?? 1.5), ctx);
            AudioHelpers.set(inst.nodes.w.parameters.get('bias'), d.bias || 0.0, ctx);
            MultiOscGroup.update(ctx, inst.nodes.oscs, d, patch);
        }
    },
    ADSR: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'adsr-processor', { numberOfInputs: 1, numberOfOutputs: 1 });
            w.port.postMessage({
                type: 'SET_PARAMS',
                attack: d.attack ?? 0.02,
                attackCurve: d.attackCurve ?? 0.0,
                decay: d.decay ?? 0.2,
                decayCurve: d.decayCurve ?? 0.0,
                sustain: d.sustain ?? 0.6,
                release: d.release ?? 0.4,
                releaseCurve: d.releaseCurve ?? 0.0
            });
            const an = ctx.createAnalyser();
            an.fftSize = 256;
            w.connect(an);
            if (eng?.silentSink) w.connect(eng.silentSink);
            const buf = new Float32Array(an.frequencyBinCount);
            let curStage = -1;
            let attackTriggered = false;
            w.port.onmessage = e => {
                if (e.data.type === 'STAGE') {
                    curStage = e.data.stage;
                }
                if (e.data.type === 'ATTACK') {
                    attackTriggered = true;
                }
            };
            return {
                nodes: { w, an },
                inputs: { gate_in: w },
                outputs: { cv_out: w },
                resetStage: () => {
                    curStage = -1;
                    attackTriggered = false;
                    w.port.postMessage({ type: 'RESET' });
                },
                clear: () => {
                    curStage = -1;
                    attackTriggered = false;
                    w.port.postMessage({ type: 'RESET' });
                },
                read: () => {
                    an.getFloatTimeDomainData(buf);
                    const atk = attackTriggered;
                    attackTriggered = false;
                    return { stage: curStage, attackTriggered: atk, values: [buf[0] || 0] };
                }
            };
        },
        update: (ctx, inst, d) => inst.nodes.w.port.postMessage({
            type: 'SET_PARAMS',
            attack: d.attack ?? 0.02,
            attackCurve: d.attackCurve ?? 0.0,
            decay: d.decay ?? 0.2,
            decayCurve: d.decayCurve ?? 0.0,
            sustain: d.sustain ?? 0.6,
            release: d.release ?? 0.4,
            releaseCurve: d.releaseCurve ?? 0.0
        })
    },
    LFO: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'lfo-processor', {
                numberOfInputs: 2,
                numberOfOutputs: 1,
                parameterData: {
                    rate: d.rate ?? 2.0,
                    depth: d.depth ?? 1.0,
                    duty: d.duty ?? 0.5,
                    phase: d.phase ?? 0.0
                }
            });
            w.port.postMessage({
                type: 'SET_CONFIG',
                waveType: d.waveType || 'sine',
                polarity: d.polarity || 'bipolar',
                syncMode: d.syncMode || 'free',
                division: d.division || '1/4',
                bpm: eng?.masterBPM || 120
            });
            const rIn = ctx.createGain(), cvIn = ctx.createGain();
            rIn.connect(w, 0, 0);
            cvIn.connect(w, 0, 1);
            return {
                nodes: { w, rIn, cvIn },
                inputs: { reset: rIn, cv_in: cvIn },
                outputs: { cv_out: w }
            };
        },
        update: (ctx, inst, d, patch, eng) => {
            ['rate', 'depth', 'duty', 'phase'].forEach(p => {
                if (d[p] !== undefined) AudioHelpers.set(inst.nodes.w.parameters.get(p), d[p], ctx);
            });
            inst.nodes.w.port.postMessage({
                type: 'SET_CONFIG',
                waveType: d.waveType || 'sine',
                polarity: d.polarity || 'bipolar',
                syncMode: d.syncMode || 'free',
                division: d.division || '1/4',
                bpm: eng?.masterBPM || 120
            });
        }
    },
    DELAY: {
        create: (ctx, d) => {
            const del = ctx.createDelay(5.0), fb = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain(), inp = ctx.createGain(), out = ctx.createGain();
            const mix = d.mix ?? 0.5;
            del.delayTime.value = d.delayTime ?? 0.3;
            fb.gain.value = d.feedback ?? 0.4;
            wet.gain.value = mix;
            dry.gain.value = 1.0 - mix;
            inp.connect(dry); inp.connect(del); del.connect(fb); fb.connect(del); del.connect(wet); dry.connect(out); wet.connect(out);
            const inst = {
                nodes: { del, fb, wet, dry, inp, out },
                inputs: { wave_in: inp },
                outputs: { wave_out: out },
                clear: () => {
                    try {
                        const curTime = ctx.currentTime;
                        fb.gain.cancelScheduledValues(curTime);
                        fb.gain.setValueAtTime(0, curTime);
                        fb.gain.setValueAtTime(d.feedback ?? 0.4, curTime + 0.05);

                        inp.disconnect(inst.nodes.del);
                        fb.disconnect(inst.nodes.del);
                        inst.nodes.del.disconnect(fb);
                        inst.nodes.del.disconnect(wet);

                        const newDel = ctx.createDelay(5.0);
                        newDel.delayTime.value = d.delayTime ?? 0.3;
                        inp.connect(newDel);
                        fb.connect(newDel);
                        newDel.connect(fb);
                        newDel.connect(wet);
                        inst.nodes.del = newDel;
                    } catch (e) {}
                }
            };
            return inst;
        },
        update: (ctx, inst, d) => {
            AudioHelpers.set(inst.nodes.del.delayTime, d.delayTime ?? 0.3, ctx);
            AudioHelpers.set(inst.nodes.fb.gain, d.feedback ?? 0.4, ctx);
            const mix = d.mix ?? 0.5;
            AudioHelpers.set(inst.nodes.wet.gain, mix, ctx);
            AudioHelpers.set(inst.nodes.dry.gain, 1.0 - mix, ctx);
        }
    },
    CVDELAY: {
        create: (ctx, d) => {
            const w = new AudioWorkletNode(ctx, 'cv-delay-processor', { numberOfInputs: 2, numberOfOutputs: 1 });
            const pTime = w.parameters.get('timeMs');
            const pDepth = w.parameters.get('cvDepth');
            if (pTime) pTime.value = d.timeMs ?? 50;
            if (pDepth) pDepth.value = d.cvDepth ?? 1.0;

            const sigIn = ctx.createGain();
            const timeCvIn = ctx.createGain();
            const out = ctx.createGain();

            sigIn.connect(w, 0, 0);
            timeCvIn.connect(w, 0, 1);
            w.connect(out);

            return {
                nodes: { w, sigIn, timeCvIn, out },
                inputs: { sig_in: sigIn, time_cv: timeCvIn },
                outputs: { cv_out: out },
                clear: () => {
                    w.port.postMessage({ type: 'RESET' });
                }
            };
        },
        update: (ctx, inst, d) => {
            const pTime = inst.nodes.w.parameters.get('timeMs');
            const pDepth = inst.nodes.w.parameters.get('cvDepth');
            if (pTime) AudioHelpers.set(pTime, d.timeMs ?? 50, ctx, 0.005);
            if (pDepth) AudioHelpers.set(pDepth, d.cvDepth ?? 1.0, ctx, 0.005);
        }
    },
    REVERB: {
        create: (ctx, d) => {
            const inp = ctx.createGain(), out = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), conv = ctx.createConvolver(), damp = ctx.createBiquadFilter(), cvG = ctx.createGain();
            const mix = d.mix ?? 0.4;
            damp.type = 'lowpass'; damp.frequency.value = d.damp??4500; dry.gain.value = 1.0 - mix; wet.gain.value = mix; cvG.gain.value = 0.5;
            conv.buffer = AudioHelpers.buildReverbBuffer(ctx, d.time??1.8, d.mode||'hall');
            inp.connect(dry); dry.connect(out); inp.connect(damp); damp.connect(conv); conv.connect(wet); wet.connect(out); cvG.connect(wet.gain);
            const inst = {
                nodes: { inp, out, dry, wet, conv, damp, cvG },
                inputs: { wave_in: inp, cv_in: cvG },
                outputs: { wave_out: out },
                _time: d.time??1.8,
                _mode: d.mode||'hall',
                clear: () => {
                    try {
                        const curTime = ctx.currentTime;
                        wet.gain.cancelScheduledValues(curTime);
                        wet.gain.setValueAtTime(0, curTime);
                        wet.gain.setValueAtTime(d.mix ?? 0.4, curTime + 0.05);
                    } catch (e) {}
                }
            };
            return inst;
        },
        update: (ctx, inst, d) => {
            const mix = d.mix ?? 0.4;
            AudioHelpers.set(inst.nodes.wet.gain, mix, ctx); AudioHelpers.set(inst.nodes.dry.gain, 1.0 - mix, ctx);
            AudioHelpers.set(inst.nodes.damp.frequency, d.damp??4500, ctx);
            if (Math.abs((d.time??1.8) - inst._time) > 0.1 || (d.mode||'hall') !== inst._mode) {
                inst._time = d.time??1.8; inst._mode = d.mode||'hall';
                try { inst.nodes.conv.buffer = AudioHelpers.buildReverbBuffer(ctx, inst._time, inst._mode); } catch(e){}
            }
        }
    },
    MIX: {
        create: (ctx, d) => {
            const sumBus = ctx.createGain();
            const out = ctx.createGain();

            // Always-on limiter (fast compressor) to prevent digital clipping
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -1.0;
            limiter.knee.value = 3.0;
            limiter.ratio.value = 20.0;
            limiter.attack.value = 0.001;
            limiter.release.value = 0.06;

            // Soft-clipper shaper to smoothly catch transients without harsh digital clipping
            const shaper = ctx.createWaveShaper();
            shaper.curve = getSoftClipCurve();
            shaper.oversample = '2x';

            // Level & clipping detector analyser
            const an = ctx.createAnalyser();
            an.fftSize = 64;
            const buf = new Float32Array(an.frequencyBinCount);

            sumBus.connect(an);
            sumBus.connect(limiter);
            limiter.connect(shaper);
            shaper.connect(out);

            const inputs = {}, nodes = { sumBus, limiter, shaper, an, out };
            for (let c = 1; c <= 4; c++) {
                const inG = ctx.createGain();
                inG.gain.value = d[`lvl${c}`] ?? 1.0;
                inG.connect(sumBus);
                inputs[`wave_in${c}`] = inG;
                nodes[`in${c}`] = inG;
            }

            let clipHoldUntil = 0;

            return {
                nodes,
                inputs,
                outputs: { wave_out: out },
                read: () => {
                    an.getFloatTimeDomainData(buf);
                    let peak = 0;
                    for (let i = 0; i < buf.length; i++) {
                        const a = Math.abs(buf[i]);
                        if (a > peak) peak = a;
                    }
                    const isClipNow = peak >= 1.05 || (typeof limiter.reduction === 'number' && limiter.reduction < -2.5);
                    const now = performance.now();
                    if (isClipNow) {
                        clipHoldUntil = now + 140;
                    }
                    return {
                        peak,
                        isClipping: now < clipHoldUntil
                    };
                }
            };
        },
        update: (ctx, inst, d) => {
            for (let c = 1; c <= 4; c++) {
                if (inst.nodes[`in${c}`] && d[`lvl${c}`] !== undefined) AudioHelpers.set(inst.nodes[`in${c}`].gain, d[`lvl${c}`], ctx);
            }
        }
    },
    SLIDER: {
        create: (ctx, d) => { const s = ctx.createConstantSource(); s.offset.value = d.vol??0.7; s.start(); return { nodes: { s }, inputs: {}, outputs: { cv_out: s } }; },
        update: (ctx, inst, d) => AudioHelpers.set(inst.nodes.s.offset, d.vol??0.7, ctx)
    },
    NOISE: {
        create: (ctx, d) => {
            const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = d.tone??8000;
            const out = ctx.createGain(); out.gain.value = d.level??0.8; flt.connect(out);
            const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), data = b.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.connect(flt); src.start();
            return { nodes: { flt, out, src, _b: b }, inputs: {}, outputs: { wave_out: out }, _type: 'white' };
        },
        update: (ctx, inst, d) => {
            AudioHelpers.set(inst.nodes.flt.frequency, d.tone??8000, ctx); AudioHelpers.set(inst.nodes.out.gain, d.level??0.8, ctx);
            if (d.noiseType && d.noiseType !== inst._type) {
                inst._type = d.noiseType; const data = inst.nodes._b.getChannelData(0), len = data.length;
                if (d.noiseType === 'white') { for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1; }
                else if (d.noiseType === 'pink') {
                    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
                    for (let i = 0; i < len; i++) {
                        let w = Math.random() * 2 - 1;
                        b0 = 0.99886*b0 + w*0.0555; b1 = 0.99332*b1 + w*0.075; b2 = 0.969*b2 + w*0.153; b3 = 0.8665*b3 + w*0.31; b4 = 0.55*b4 + w*0.53; b5 = -0.7616*b5 - w*0.016;
                        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.536) * 0.11; b6 = w * 0.1159;
                    }
                } else if (d.noiseType === 'brown') {
                    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
                }
            }
        }
    },
    CLK: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'clock-processor', {
                parameterData: {
                    bpm: eng.masterBPM || 120,
                    pulseWidthMs: d.pulseWidthMs ?? 15,
                    limitPct: Math.min(90, d.limitPct ?? 90)
                }
            });
            w.port.postMessage({
                type: 'SET_STATE',
                running: eng.isPlaying,
                div: d.div || 'x2',
                limitPct: Math.min(90, d.limitPct ?? 90)
            });
            if (eng?.silentSink) w.connect(eng.silentSink);
            return { nodes: { w }, inputs: {}, outputs: { gate_out: w } };
        },
        update: (ctx, inst, d, patch, eng) => {
            AudioHelpers.set(inst.nodes.w.parameters.get('bpm'), eng.masterBPM || 120, ctx, 0.02);
            if (d.pulseWidthMs !== undefined) {
                AudioHelpers.set(inst.nodes.w.parameters.get('pulseWidthMs'), d.pulseWidthMs, ctx, 0.02);
            }
            if (d.limitPct !== undefined) {
                AudioHelpers.set(inst.nodes.w.parameters.get('limitPct'), Math.min(90, d.limitPct), ctx, 0.02);
            }
            inst.nodes.w.port.postMessage({
                type: 'SET_STATE',
                div: d.div,
                limitPct: Math.min(90, d.limitPct ?? 90)
            });
        }
    },
    THROUGH: {
        create: (ctx, d) => {
            const g = ctx.createGain(); g.gain.value = d.state!==false?1.0:0.0;
            return { nodes: { g }, inputs: { wave_in: g }, outputs: { wave_out: g } };
        },
        update: (ctx, inst, d) => AudioHelpers.set(inst.nodes.g.gain, d.state!==false?1.0:0.0, ctx, 0.003)
    },
    MATH1: {
        create: (ctx, d, patch, eng) => createMathAudio(ctx, d, patch, eng, false),
        update: (ctx, inst, d, patch) => updateMathAudio(inst, d, patch, false)
    },
    MATH2: {
        create: (ctx, d, patch, eng) => createMathAudio(ctx, d, patch, eng, true),
        update: (ctx, inst, d, patch) => updateMathAudio(inst, d, patch, true)
    },
    SH: {
        create: (ctx, d, patch) => {
            const w = new AudioWorkletNode(ctx, 'sh-processor', { numberOfInputs: 2, numberOfOutputs: 1, parameterData: { glide: d.glide??0.0, scale: d.scale??1.0 }});
            w.port.postMessage({ type: 'SET_CONFIG', hasExternalSig: patch.has('sig_in'), polarity: d.polarity||'unipolar' });
            const sig = ctx.createGain(), trg = ctx.createGain(), out = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 256;
            sig.connect(w,0,0); trg.connect(w,0,1); w.connect(out); out.connect(an);
            const buf = new Float32Array(an.frequencyBinCount);
            return { nodes: { w, sig, trg, out, an }, inputs: { sig_in: sig, trig_in: trg }, outputs: { cv_out: out }, read: () => { an.getFloatTimeDomainData(buf); return { values: [buf[0]||0] }; } };
        },
        update: (ctx, inst, d, patch) => {
            if (d.glide !== undefined) AudioHelpers.set(inst.nodes.w.parameters.get('glide'), d.glide, ctx);
            if (d.scale !== undefined) AudioHelpers.set(inst.nodes.w.parameters.get('scale'), d.scale, ctx);
            inst.nodes.w.port.postMessage({ type: 'SET_CONFIG', hasExternalSig: patch.has('sig_in'), polarity: d.polarity||'unipolar' });
        }
    },
    SCOPE: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'scope-processor', { numberOfInputs: 3, numberOfOutputs: 0 });
            w.port.postMessage({ type: 'SET_CONFIG', timeSpan: d.timeSpan ?? 0.1 });

            const g1 = ctx.createGain(), g2 = ctx.createGain(), gTrig = ctx.createGain();
            g1.connect(w, 0, 0);
            g2.connect(w, 0, 1);
            gTrig.connect(w, 0, 2);

            let latest = { buf1: new Float32Array(512), buf2: new Float32Array(512), trigBuf: new Float32Array(512), sampleRate: ctx.sampleRate };
            w.port.onmessage = e => {
                if (e.data.type === 'SCOPE_DATA') {
                    latest = e.data;
                }
            };

            return {
                nodes: { w, g1, g2, gTrig },
                inputs: { in1: g1, in2: g2, trig: gTrig },
                outputs: {},
                _hasTrig: patch?.has('trig'),
                _hasIn2: patch?.has('in2'),
                read: () => ({
                    buf1: latest.buf1,
                    buf2: latest.buf2,
                    trigBuf: latest.trigBuf,
                    hasTrig: patch?.has('trig'),
                    hasIn2: patch?.has('in2'),
                    sampleRate: latest.sampleRate || ctx.sampleRate
                })
            };
        },
        update: (ctx, inst, d, patch) => {
            inst._hasTrig = patch?.has('trig');
            inst._hasIn2 = patch?.has('in2');
            inst.nodes.w.port.postMessage({ type: 'SET_CONFIG', timeSpan: d.timeSpan ?? 0.1 });
        }
    },
    MON: {
        create: (ctx, d, patch, eng) => {
            const inputs = {}, nodes = {}, bufs = [new Float32Array(256), new Float32Array(256), new Float32Array(256), new Float32Array(256)];
            for (let c = 1; c <= 4; c++) {
                const an = ctx.createAnalyser(), inG = ctx.createGain(); an.fftSize = 256; inG.connect(an);
                if (eng?.silentSink) inG.connect(eng.silentSink);
                inputs[`in${c}`] = inG; nodes[`in${c}`] = inG; nodes[`an${c}`] = an;
            }
            return { nodes, inputs, outputs: {}, read: () => {
                const vals = []; for (let c = 1; c <= 4; c++) { nodes[`an${c}`].getFloatTimeDomainData(bufs[c-1]); vals.push(bufs[c-1][0]||0); }
                return { values: vals };
            } };
        }
    },
    SPK: {
        create: (ctx, d) => {
            const inL = ctx.createGain(), inR = ctx.createGain();
            const outL = ctx.createGain(), outR = ctx.createGain();
            const anL = ctx.createAnalyser(), anR = ctx.createAnalyser();
            anL.fftSize = 64;
            anR.fftSize = 64;
            const bufL = new Float32Array(anL.frequencyBinCount);
            const bufR = new Float32Array(anR.frequencyBinCount);

            const merger = ctx.createChannelMerger(2);
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -1.5;
            limiter.knee.value = 3.0;
            limiter.ratio.value = 20.0;
            limiter.attack.value = 0.002;
            limiter.release.value = 0.08;

            const vol = d.masterVol ?? 0.12;
            outL.gain.value = vol;
            outR.gain.value = vol;

            inL.connect(outL);
            inR.connect(outR);

            outL.connect(anL);
            outR.connect(anR);

            outL.connect(merger, 0, 0);
            outR.connect(merger, 0, 1);
            merger.connect(limiter);
            limiter.connect(ctx.destination);

            return {
                nodes: { inL, inR, outL, outR, anL, anR, merger, limiter },
                inputs: {
                    wave_in_l: inL,
                    wave_in_r: inR,
                    wave_in: inL
                },
                outputs: {},
                read: () => {
                    anL.getFloatTimeDomainData(bufL);
                    anR.getFloatTimeDomainData(bufR);
                    let peakL = 0, peakR = 0;
                    for (let i = 0; i < bufL.length; i++) {
                        const aL = Math.abs(bufL[i]);
                        if (aL > peakL) peakL = aL;
                        const aR = Math.abs(bufR[i]);
                        if (aR > peakR) peakR = aR;
                    }
                    return { peakL, peakR };
                }
            };
        },
        update: (ctx, inst, d) => {
            const vol = d.masterVol ?? 0.12;
            if (inst.nodes.outL) AudioHelpers.set(inst.nodes.outL.gain, vol, ctx);
            if (inst.nodes.outR) AudioHelpers.set(inst.nodes.outR.gain, vol, ctx);
        }
    },
    KEY: {
        create: (ctx, d) => {
            const p = ctx.createConstantSource(), g = ctx.createConstantSource();
            p.offset.value = ((d.currentMidi ?? 60) - 24) / 12.0;
            p.start();
            g.offset.value = 0.0;
            g.start();
            return { nodes: { p, g }, inputs: {}, outputs: { cv_out: p, gate_out: g } };
        }
    },
    SEQ: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'seq-processor', { numberOfInputs: 1, numberOfOutputs: 2 });
            w.port.postMessage({ type: 'SET_STEPS', steps: d.steps });
            const cv = ctx.createGain(), gt = ctx.createGain(), gIn = ctx.createGain();
            w.connect(cv, 0, 0);
            w.connect(gt, 1, 0);
            gIn.connect(w, 0, 0);
            if (eng?.silentSink) gt.connect(eng.silentSink);
            let st = -1;
            w.port.onmessage = e => { if (e.data.type === 'STEP') st = e.data.step; };
            return { nodes: { w, cv, gt, gIn }, inputs: { gate_in: gIn }, outputs: { cv_out: cv, gate_out: gt }, resetStep: () => { st = -1; }, read: () => ({ step: st }) };
        },
        update: (ctx, inst, d) => { if (d.steps) inst.nodes.w.port.postMessage({ type: 'SET_STEPS', steps: d.steps }); }
    },
    PAT: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'pat-processor', {
                numberOfInputs: 0,
                numberOfOutputs: 2,
                parameterData: {
                    bpm: eng?.masterBPM || 120
                }
            });
            const cycles = parseStrudelPatternCycles(d.pattern || 'c2 c2 c2 c2', d.cycleBeats || 4, 16);
            w.port.postMessage({
                type: 'SET_EVENTS',
                cycles,
                cycleBeats: d.cycleBeats || 4,
                gateLen: d.gateLen ?? 0.80
            });
            w.port.postMessage({
                type: 'SET_STATE',
                running: eng?.isPlaying || false
            });

            const cv = ctx.createGain(), gt = ctx.createGain();
            w.connect(cv, 0, 0);
            w.connect(gt, 1, 0);
            if (eng?.silentSink) {
                gt.connect(eng.silentSink);
            }

            let latestPhase = 0, latestIdx = -1, latestCycle = 0;
            w.port.onmessage = e => {
                if (e.data.type === 'PLAYHEAD') {
                    latestPhase = e.data.phase;
                    latestIdx = e.data.activeIdx;
                    latestCycle = e.data.cycleCount || 0;
                }
            };

            return {
                nodes: { w, cv, gt },
                inputs: {},
                outputs: { cv_out: cv, gate_out: gt },
                resetStep: () => { latestPhase = 0; latestIdx = -1; latestCycle = 0; },
                read: () => ({ phase: latestPhase, activeIdx: latestIdx, cycleCount: latestCycle })
            };
        },
        update: (ctx, inst, d, patch, eng) => {
            AudioHelpers.set(inst.nodes.w.parameters.get('bpm'), eng?.masterBPM || 120, ctx, 0.02);
            const cycles = parseStrudelPatternCycles(d.pattern || 'c2 c2 c2 c2', d.cycleBeats || 4, 16);
            inst.nodes.w.port.postMessage({
                type: 'SET_EVENTS',
                cycles,
                cycleBeats: d.cycleBeats || 4,
                gateLen: d.gateLen ?? 0.80
            });
        }
    },
    CHORD: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'chord-processor', {
                numberOfInputs: 3,
                numberOfOutputs: 4,
                outputChannelCount: [1, 1, 1, 1]
            });

            const chordIdx = CHORD_ORDER.indexOf(d.chord || 'min');
            const voiceIdx = VOICING_ORDER.indexOf(d.voicing || 'close');
            const rootCv = ((d.rootMidi ?? 48) - 24) / 12.0;

            const hasRoot = patch.has('cv_in');
            const hasType = patch.has('type_cv');
            const hasVoice = patch.has('voice_cv');

            w.port.postMessage({
                type: 'SET_PARAMS',
                rootCv,
                chordIdx: chordIdx >= 0 ? chordIdx : 0,
                voiceIdx: voiceIdx >= 0 ? voiceIdx : 0,
                hasRoot,
                hasType,
                hasVoice
            });

            const inRoot = ctx.createGain();
            const inType = ctx.createGain();
            const inVoice = ctx.createGain();
            inRoot.connect(w, 0, 0);
            inType.connect(w, 0, 1);
            inVoice.connect(w, 0, 2);

            const out1 = ctx.createGain();
            const out2 = ctx.createGain();
            const out3 = ctx.createGain();
            const out4 = ctx.createGain();
            w.connect(out1, 0, 0);
            w.connect(out2, 1, 0);
            w.connect(out3, 2, 0);
            w.connect(out4, 3, 0);

            if (eng?.silentSink) out1.connect(eng.silentSink);

            let activeChordIdx = chordIdx >= 0 ? chordIdx : 0;
            let activeVoiceIdx = voiceIdx >= 0 ? voiceIdx : 0;
            w.port.onmessage = (e) => {
                if (e.data.type === 'ACTIVE') {
                    activeChordIdx = e.data.chordIdx;
                    activeVoiceIdx = e.data.voiceIdx;
                }
            };

            return {
                nodes: { w, inRoot, inType, inVoice, out1, out2, out3, out4 },
                inputs: { cv_in: inRoot, type_cv: inType, voice_cv: inVoice },
                outputs: { cv_out1: out1, cv_out2: out2, cv_out3: out3, cv_out4: out4 },
                read: () => ({ activeChordIdx, activeVoiceIdx })
            };
        },
        update: (ctx, inst, d, patch) => {
            const chordIdx = CHORD_ORDER.indexOf(d.chord || 'min');
            const voiceIdx = VOICING_ORDER.indexOf(d.voicing || 'close');
            const rootCv = ((d.rootMidi ?? 48) - 24) / 12.0;

            const hasRoot = patch.has('cv_in');
            const hasType = patch.has('type_cv');
            const hasVoice = patch.has('voice_cv');

            inst.nodes.w.port.postMessage({
                type: 'SET_PARAMS',
                rootCv,
                chordIdx: chordIdx >= 0 ? chordIdx : 0,
                voiceIdx: voiceIdx >= 0 ? voiceIdx : 0,
                hasRoot,
                hasType,
                hasVoice
            });
        }
    },
    SUB: {
        create: (ctx, d) => {
            const nodes = {}, inputs = {}, outputs = {};
            // Slots 1..6: Inputs (Send: Parent -> Child)
            for (let i = 1; i <= 6; i++) {
                const pin = `PIN${i}_in`;
                const inGain = ctx.createGain();
                inGain.gain.value = 1.0;
                nodes[pin] = inGain;
                inputs[pin] = inGain;
                inputs[`PIN${i}`] = inGain;
                inputs[`io_${i}`] = inGain;
            }
            // Slots 7..12: Outputs (Return: Child -> Parent)
            for (let i = 7; i <= 12; i++) {
                const pin = `PIN${i}_out`;
                const outGain = ctx.createGain();
                outGain.gain.value = 1.0;
                nodes[pin] = outGain;
                outputs[pin] = outGain;
                outputs[`PIN${i}`] = outGain;
                outputs[`io_${i}`] = outGain;
            }
            outputs['io_9'] = outputs['PIN7_out'];
            return { nodes, inputs, outputs, targetPage: d.targetPage ?? 1 };
        },
        update: (ctx, inst, d) => {
            inst.targetPage = d.targetPage ?? 1;
        }
    },
    SUB_IO: {
        create: (ctx) => {
            const nodes = {}, inputs = {}, outputs = {};
            // Slots 1..6: Outputs (Receive from Parent)
            for (let i = 1; i <= 6; i++) {
                const pin = `PIN${i}_out`;
                const outGain = ctx.createGain();
                outGain.gain.value = 1.0;
                nodes[pin] = outGain;
                outputs[pin] = outGain;
                outputs[`PIN${i}`] = outGain;
                outputs[`io_${i}`] = outGain;
            }
            // Slots 7..12: Inputs (Send back to Parent)
            for (let i = 7; i <= 12; i++) {
                const pin = `PIN${i}_in`;
                const inGain = ctx.createGain();
                inGain.gain.value = 1.0;
                nodes[pin] = inGain;
                inputs[pin] = inGain;
                inputs[`PIN${i}`] = inGain;
                inputs[`io_${i}`] = inGain;
            }
            inputs['io_9'] = inputs['PIN7_in'];
            return { nodes, inputs, outputs };
        }
    },
    MARKOV: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'markov-processor', {
                numberOfInputs: 2,
                numberOfOutputs: 7
            });
            const rootM = d.rootMidi ?? 60;
            const cvVal = d.quantize !== false ? ((rootM - 24) / 12.0) : (d.stateVal ?? 1.0);

            const isInitOn = !!d.initOn;
            const initialState = isInitOn ? 1 : (d.state ? 1 : 0);
            d.state = initialState;

            w.port.postMessage({
                type: 'SET_STATE',
                state: initialState,
                initOn: isInitOn,
                stateVal: cvVal,
                stayWeight: d.stayWeight ?? 10,
                weights: d.weights || [0, 0, 0, 0],
                holdClocks: d.holdClocks ?? 1
            });

            // Keepalive silent sink to destination
            const silent = ctx.createGain();
            silent.gain.value = 0.0;
            w.connect(silent, 4);
            silent.connect(ctx.destination);

            // Inputs: 0: clk_in, 1: trig_in
            const gClk = ctx.createGain();
            gClk.connect(w, 0, 0);

            const gTrig = ctx.createGain();
            gTrig.connect(w, 0, 1);

            // Outputs: 0..3: trig_out1..4, 4: cv_out, 5: gate_out, 6: step_gate
            const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain(), g4 = ctx.createGain();
            const gCv = ctx.createGain(), gGate = ctx.createGain(), gStepGate = ctx.createGain();
            w.connect(g1, 0);
            w.connect(g2, 1);
            w.connect(g3, 2);
            w.connect(g4, 3);
            w.connect(gCv, 4);
            w.connect(gGate, 5);
            w.connect(gStepGate, 6);

            const inst = {
                nodes: { w, silent, gClk, gTrig, g1, g2, g3, g4, gCv, gGate, gStepGate },
                inputs: {
                    clk_in: gClk,
                    transition_in: gTrig,
                    trig_in: gTrig
                },
                outputs: {
                    transition_out1: g1,
                    transition_out2: g2,
                    transition_out3: g3,
                    transition_out4: g4,
                    trig_out1: g1,
                    trig_out2: g2,
                    trig_out3: g3,
                    trig_out4: g4,
                    cv_out: gCv,
                    state_out: gCv, // alias for backward compatibility
                    gate_out: gGate,
                    gt_out: gGate,
                    trig_out: gStepGate,
                    step_gate: gStepGate,
                    step_gt: gStepGate
                },
                _liveState: initialState,
                resetStep: () => {
                    const st = d.initOn ? 1 : 0;
                    inst._liveState = st;
                    d.state = st;
                },
                read: () => ({ state: inst._liveState })
            };

            w.port.onmessage = e => {
                if (e.data.type === 'STATE_CHANGED') {
                    inst._liveState = e.data.state;
                    d.state = e.data.state;
                }
            };

            return inst;
        },
        update: (ctx, inst, d, patch, eng) => {
            const rootM = d.rootMidi ?? 60;
            const cvVal = d.quantize !== false ? ((rootM - 24) / 12.0) : (d.stateVal ?? 1.0);
            const isInitOn = !!d.initOn;
            const curState = d.state ? 1 : 0;
            inst._liveState = curState;
            inst.nodes.w?.port.postMessage({
                type: 'SET_STATE',
                state: curState,
                initOn: isInitOn,
                stateVal: cvVal,
                stayWeight: d.stayWeight ?? 10,
                weights: d.weights || [0, 0, 0, 0],
                holdClocks: d.holdClocks ?? 1
            });
        }
    },
    FM: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'fm-processor', {
                numberOfInputs: 2,
                numberOfOutputs: 1
            });
            const outGain = ctx.createGain();
            outGain.gain.value = 1.0;
            w.connect(outGain);

            if (eng?.silentSink) w.connect(eng.silentSink);

            const gIn = ctx.createGain();
            const pIn = ctx.createGain();
            gIn.connect(w, 0, 0);
            pIn.connect(w, 0, 1);

            const hasGate = patch ? (patch.has('gate_in') || patch.has('gate')) : false;

            const payload = {
                type: 'SET_PARAMS',
                hasGateIn: hasGate,
                algorithm: d.algorithm ?? 1,
                rootMidi: d.rootMidi ?? 48,
                op1: d.op1 || { ratio: 1.0, level: 0.85, attack: 0.005, decay: 0.4, sustain: 0.0, release: 0.1, curve: 'exp' },
                op2: d.op2 || { ratio: 2.0, level: 1.5, attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.05, curve: 'exp' },
                op3: d.op3 || { ratio: 3.5, level: 1.8, feedback: 0.0, wave: 'sine', attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.02, curve: 'exp' }
            };
            w.port.postMessage(payload);

            return {
                nodes: { w, outGain, gIn, pIn },
                inputs: {
                    gate_in: gIn,
                    pitch_in: pIn,
                    cv_in: pIn // alias
                },
                outputs: {
                    wave_out: outGain
                },
                resetStage: () => w.port.postMessage({ type: 'RESET' }),
                clear: () => w.port.postMessage({ type: 'RESET' })
            };
        },
        update: (ctx, inst, d, patch, eng) => {
            const hasGate = patch ? (patch.has('gate_in') || patch.has('gate')) : false;
            inst.nodes.w?.port.postMessage({
                type: 'SET_PARAMS',
                hasGateIn: hasGate,
                algorithm: d.algorithm ?? 1,
                rootMidi: d.rootMidi ?? 48,
                op1: d.op1,
                op2: d.op2,
                op3: d.op3
            });
        }
    },
    FMCORE: {
        create: (ctx, d, patch, eng) => {
            const w = new AudioWorkletNode(ctx, 'fm-core-processor', {
                numberOfInputs: 3,
                numberOfOutputs: 1
            });
            const outGain = ctx.createGain();
            outGain.gain.value = 1.0;
            w.connect(outGain);

            if (eng?.silentSink) w.connect(eng.silentSink);

            const pIn = ctx.createGain();
            const mIn = ctx.createGain();
            const idxIn = ctx.createGain();

            pIn.connect(w, 0, 0);
            mIn.connect(w, 0, 1);
            idxIn.connect(w, 0, 2);

            const hasIndexCv = patch ? (patch.has('index_cv') || patch.has('idx_cv')) : false;

            w.port.postMessage({
                type: 'SET_PARAMS',
                hasIndexCv,
                level: d.level ?? 0.85,
                ratio: d.ratio ?? 1.0,
                fine: d.fine ?? 0,
                index: d.index ?? 1.0,
                feedback: d.feedback ?? 0.0,
                rootMidi: d.rootMidi ?? 48
            });

            return {
                nodes: { w, outGain, pIn, mIn, idxIn },
                inputs: {
                    pitch_in: pIn,
                    cv_in: pIn,
                    mod_in: mIn,
                    wave_in: mIn,
                    index_cv: idxIn,
                    idx_cv: idxIn
                },
                outputs: {
                    wave_out: outGain
                },
                resetStage: () => w.port.postMessage({ type: 'RESET' }),
                clear: () => w.port.postMessage({ type: 'RESET' })
            };
        },
        update: (ctx, inst, d, patch) => {
            const hasIndexCv = patch ? (patch.has('index_cv') || patch.has('idx_cv')) : false;
            inst.nodes.w?.port.postMessage({
                type: 'SET_PARAMS',
                hasIndexCv,
                level: d.level ?? 0.85,
                ratio: d.ratio ?? 1.0,
                fine: d.fine ?? 0,
                index: d.index ?? 1.0,
                feedback: d.feedback ?? 0.0,
                rootMidi: d.rootMidi ?? 48
            });
        }
    }
};

// Aliases for backward compatibility
AUDIO_REGISTRY.FMx3 = AUDIO_REGISTRY.FM;
AUDIO_REGISTRY.FM3OP = AUDIO_REGISTRY.FM;


