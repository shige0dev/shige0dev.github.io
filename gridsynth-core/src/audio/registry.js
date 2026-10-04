import { AudioHelpers } from './helpers.js';
import { MultiOscGroup } from './multi-osc.js';
import { MODULE_REGISTRY } from '../modules/registry.js';
import { parseStrudelPattern, parseStrudelPatternCycles } from '../core/strudel-parser.js';

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
            return {
                nodes: { w, an },
                inputs: { gate_in: w },
                outputs: { cv_out: w },
                read: () => {
                    an.getFloatTimeDomainData(buf);
                    return { values: [buf[0] || 0] };
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
            del.delayTime.value = d.delayTime??0.3; fb.gain.value = d.feedback??0.4; wet.gain.value = d.mix??0.5; dry.gain.value = 1.0 - (d.mix??0.5)*0.3;
            inp.connect(dry); inp.connect(del); del.connect(fb); fb.connect(del); del.connect(wet); dry.connect(out); wet.connect(out);
            return { nodes: { del, fb, wet, dry, inp, out }, inputs: { wave_in: inp }, outputs: { wave_out: out } };
        },
        update: (ctx, inst, d) => {
            AudioHelpers.set(inst.nodes.del.delayTime, d.delayTime??0.3, ctx); AudioHelpers.set(inst.nodes.fb.gain, d.feedback??0.4, ctx);
            AudioHelpers.set(inst.nodes.wet.gain, d.mix??0.5, ctx); AudioHelpers.set(inst.nodes.dry.gain, 1.0 - (d.mix??0.5)*0.3, ctx);
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
                outputs: { cv_out: out }
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
            damp.type = 'lowpass'; damp.frequency.value = d.damp??4500; dry.gain.value = 1.0 - (d.mix??0.4)*0.3; wet.gain.value = d.mix??0.4; cvG.gain.value = 0.5;
            conv.buffer = AudioHelpers.buildReverbBuffer(ctx, d.time??1.8, d.mode||'hall');
            inp.connect(dry); dry.connect(out); inp.connect(damp); damp.connect(conv); conv.connect(wet); wet.connect(out); cvG.connect(wet.gain);
            return { nodes: { inp, out, dry, wet, conv, damp, cvG }, inputs: { wave_in: inp, cv_in: cvG }, outputs: { wave_out: out }, _time: d.time??1.8, _mode: d.mode||'hall' };
        },
        update: (ctx, inst, d) => {
            AudioHelpers.set(inst.nodes.wet.gain, d.mix??0.4, ctx); AudioHelpers.set(inst.nodes.dry.gain, 1.0 - (d.mix??0.4)*0.3, ctx);
            AudioHelpers.set(inst.nodes.damp.frequency, d.damp??4500, ctx);
            if (Math.abs((d.time??1.8) - inst._time) > 0.1 || (d.mode||'hall') !== inst._mode) {
                inst._time = d.time??1.8; inst._mode = d.mode||'hall';
                try { inst.nodes.conv.buffer = AudioHelpers.buildReverbBuffer(ctx, inst._time, inst._mode); } catch(e){}
            }
        }
    },
    MIX: {
        create: (ctx, d) => {
            const out = ctx.createGain(), inputs = {}, nodes = { out };
            for (let c = 1; c <= 4; c++) {
                const inG = ctx.createGain(); inG.gain.value = d[`lvl${c}`] ?? 1.0; inG.connect(out);
                inputs[`wave_in${c}`] = inG; nodes[`in${c}`] = inG;
            }
            return { nodes, inputs, outputs: { wave_out: out } };
        },
        update: (ctx, inst, d) => {
            for (let c = 1; c <= 4; c++) { if (inst.nodes[`in${c}`] && d[`lvl${c}`] !== undefined) AudioHelpers.set(inst.nodes[`in${c}`].gain, d[`lvl${c}`], ctx); }
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
                    limitPct: d.limitPct ?? 90
                }
            });
            w.port.postMessage({
                type: 'SET_STATE',
                running: eng.isPlaying,
                div: d.div || 'x2',
                limitPct: d.limitPct ?? 90
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
                AudioHelpers.set(inst.nodes.w.parameters.get('limitPct'), d.limitPct, ctx, 0.02);
            }
            inst.nodes.w.port.postMessage({
                type: 'SET_STATE',
                div: d.div,
                limitPct: d.limitPct ?? 90
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
        create: (ctx, d, patch, eng) => {
            const gA = ctx.createGain(), out = ctx.createGain(), an = ctx.createAnalyser();
            an.fftSize = 256; out.connect(an);
            if (eng?.silentSink) out.connect(eng.silentSink);
            const w = new AudioWorkletNode(ctx, 'math-processor', { numberOfInputs: 2, numberOfOutputs: 1 });
            w.port.postMessage({
                type: 'SET_PARAMS',
                mode: d.mode || 'ABS',
                valA: d.valA ?? 0.0,
                valB: 0.0,
                hasA: patch?.has('a') || false,
                hasB: false
            });
            gA.connect(w, 0, 0); w.connect(out);
            const buf = new Float32Array(an.frequencyBinCount);
            return { nodes: { gA, out, an, w }, inputs: { a: gA }, outputs: { cv_out: out }, read: () => { an.getFloatTimeDomainData(buf); return { values: [buf[0] || 0] }; } };
        },
        update: (ctx, inst, d, patch) => {
            inst.nodes.w.port.postMessage({
                type: 'SET_PARAMS',
                mode: d.mode || 'ABS',
                valA: d.valA ?? 0.0,
                valB: 0.0,
                hasA: patch?.has('a') || false,
                hasB: false
            });
        }
    },
    MATH2: {
        create: (ctx, d, patch, eng) => {
            const gA = ctx.createGain(), gB = ctx.createGain(), out = ctx.createGain(), an = ctx.createAnalyser();
            an.fftSize = 256; out.connect(an);
            if (eng?.silentSink) out.connect(eng.silentSink);
            const w = new AudioWorkletNode(ctx, 'math-processor', { numberOfInputs: 2, numberOfOutputs: 1 });
            w.port.postMessage({
                type: 'SET_PARAMS',
                mode: d.mode || 'ADD',
                valA: d.valA ?? 0.0,
                valB: d.valB ?? 1.0,
                hasA: patch?.has('a') || false,
                hasB: patch?.has('b') || false
            });
            gA.connect(w, 0, 0); gB.connect(w, 0, 1); w.connect(out);
            const buf = new Float32Array(an.frequencyBinCount);
            return { nodes: { gA, gB, out, an, w }, inputs: { a: gA, b: gB }, outputs: { cv_out: out }, read: () => { an.getFloatTimeDomainData(buf); return { values: [buf[0] || 0] }; } };
        },
        update: (ctx, inst, d, patch) => {
            inst.nodes.w.port.postMessage({
                type: 'SET_PARAMS',
                mode: d.mode || 'ADD',
                valA: d.valA ?? 0.0,
                valB: d.valB ?? 1.0,
                hasA: patch?.has('a') || false,
                hasB: patch?.has('b') || false
            });
        }
    },
    MATH: {
        create: (ctx, d, patch, eng) => {
            const gA = ctx.createGain(), gB = ctx.createGain(), out = ctx.createGain(), an = ctx.createAnalyser();
            an.fftSize = 256; out.connect(an);
            if (eng?.silentSink) out.connect(eng.silentSink);
            const w = new AudioWorkletNode(ctx, 'math-processor', { numberOfInputs: 2, numberOfOutputs: 1 });
            w.port.postMessage({
                type: 'SET_PARAMS',
                mode: d.mode || 'ADD',
                valA: d.valA ?? 0.0,
                valB: d.valB ?? 1.0,
                hasA: patch?.has('a') || false,
                hasB: patch?.has('b') || false
            });
            gA.connect(w, 0, 0); gB.connect(w, 0, 1); w.connect(out);
            const buf = new Float32Array(an.frequencyBinCount);
            return { nodes: { gA, gB, out, an, w }, inputs: { a: gA, b: gB }, outputs: { cv_out: out }, read: () => { an.getFloatTimeDomainData(buf); return { values: [buf[0] || 0] }; } };
        },
        update: (ctx, inst, d, patch) => {
            inst.nodes.w.port.postMessage({
                type: 'SET_PARAMS',
                mode: d.mode || 'ADD',
                valA: d.valA ?? 0.0,
                valB: d.valB ?? 1.0,
                hasA: patch?.has('a') || false,
                hasB: patch?.has('b') || false
            });
        }
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
            const inp = ctx.createGain(), out = ctx.createGain();
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -1.5;
            limiter.knee.value = 3.0;
            limiter.ratio.value = 20.0;
            limiter.attack.value = 0.002;
            limiter.release.value = 0.08;

            out.gain.value = d.masterVol ?? 0.12;

            inp.connect(out);
            out.connect(limiter);
            limiter.connect(ctx.destination);

            return { nodes: { inp, out, limiter }, inputs: { wave_in: inp }, outputs: {} };
        },
        update: (ctx, inst, d) => AudioHelpers.set(inst.nodes.out.gain, d.masterVol ?? 0.12, ctx)
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
        create: (ctx, d, patch) => {
            const chordInfo = MODULE_REGISTRY.CHORD.CHORD_TYPES[d.chord || 'm7'] || MODULE_REGISTRY.CHORD.CHORD_TYPES['m7'];
            const voicingOffsets = MODULE_REGISTRY.CHORD.VOICINGS[d.voicing || 'close'] || [0, 0, 0, 0];
            const isPatched = patch.has('cv_in');
            const baseCv = isPatched ? 0 : ((d.rootMidi ?? 48) - 24) / 12.0;

            const inGain = ctx.createGain();
            inGain.gain.value = 1.0;

            const offsets = [];
            const outputs = {};

            for (let i = 0; i < 4; i++) {
                const semi = (chordInfo.semis[i] || 0) + (voicingOffsets[i] || 0);
                const cvOffset = semi / 12.0;

                const cSrc = ctx.createConstantSource();
                cSrc.offset.value = baseCv + cvOffset;
                cSrc.start();

                const outGain = ctx.createGain();
                cSrc.connect(outGain);
                if (isPatched) {
                    inGain.connect(outGain);
                }

                offsets.push(cSrc);
                outputs[`cv_out${i + 1}`] = outGain;
            }

            return {
                nodes: { inGain, offsets, outputs },
                inputs: { cv_in: inGain },
                outputs
            };
        },
        update: (ctx, inst, d, patch) => {
            const chordInfo = MODULE_REGISTRY.CHORD.CHORD_TYPES[d.chord || 'm7'] || MODULE_REGISTRY.CHORD.CHORD_TYPES['m7'];
            const voicingOffsets = MODULE_REGISTRY.CHORD.VOICINGS[d.voicing || 'close'] || [0, 0, 0, 0];
            const isPatched = patch.has('cv_in');
            const baseCv = isPatched ? 0 : ((d.rootMidi ?? 48) - 24) / 12.0;

            inst.nodes.offsets.forEach((cSrc, i) => {
                const semi = (chordInfo.semis[i] || 0) + (voicingOffsets[i] || 0);
                const cvOffset = semi / 12.0;
                AudioHelpers.set(cSrc.offset, baseCv + cvOffset, ctx);
            });
        }
    },
    SUB: {
        create: (ctx, d) => {
            const nodes = {}, inputs = {}, outputs = {};
            const pinNames = ['L1','L2','L3','L4','R1','R2','R3','R4','B1','B2','B3','B4'];
            pinNames.forEach(pin => {
                const inGain = ctx.createGain();
                inGain.gain.value = 1.0;
                const outGain = ctx.createGain();
                outGain.gain.value = 1.0;
                nodes[pin] = { in: inGain, out: outGain };
                inputs[pin] = inGain;
                outputs[pin] = outGain;
            });
            return { nodes, inputs, outputs, targetPage: d.targetPage ?? 1 };
        },
        update: (ctx, inst, d) => {
            inst.targetPage = d.targetPage ?? 1;
        }
    },
    SUB_IO: {
        create: (ctx) => {
            const nodes = {}, inputs = {}, outputs = {};
            const pinNames = ['L1','L2','L3','L4','R1','R2','R3','R4','B1','B2','B3','B4'];
            pinNames.forEach(pin => {
                const inGain = ctx.createGain();
                inGain.gain.value = 1.0;
                const outGain = ctx.createGain();
                outGain.gain.value = 1.0;
                nodes[pin] = { in: inGain, out: outGain };
                inputs[pin] = inGain;
                outputs[pin] = outGain;
            });
            return { nodes, inputs, outputs };
        }
    }
};

