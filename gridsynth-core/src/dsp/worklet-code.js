export const WORKLET_DSP_CODE = `
    const getSR = () => (typeof sampleRate !== 'undefined') ? sampleRate : 48000;
    class ClockProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return [
                { name: 'bpm', defaultValue: 120.0, minValue: 40.0, maxValue: 260.0 },
                { name: 'pulseWidthMs', defaultValue: 15.0 },
                { name: 'limitPct', defaultValue: 90.0, minValue: 10.0, maxValue: 99.0 }
            ];
        }
        constructor() {
            super();
            this.cnt = 0;
            this.left = 0;
            this.div = 'x2';
            this.limitPct = 90.0;
            this.running = false;
            this.port.onmessage = e => {
                if (e.data.type === 'SET_STATE') {
                    if (typeof e.data.running === 'boolean') {
                        if (e.data.running && !this.running) this.cnt = 9999999;
                        this.running = e.data.running;
                    }
                    if (e.data.div) this.div = e.data.div;
                    if (e.data.limitPct !== undefined) this.limitPct = e.data.limitPct;
                }
            };
        }
        process(ins, outs, params) {
            const out = outs[0]?.[0]; if (!out) return true;
            const mult = parseFloat(String(this.div).replace('x','')) || 2.0;
            const sr = getSR();
            const bpm = params.bpm[0] || 120.0;
            const intSec = 60.0 / bpm / mult;
            const sPerInt = Math.max(1, Math.round(intSec * sr));
            const lim = (params.limitPct ? params.limitPct[0] : this.limitPct) ?? 90.0;
            const maxPDur = Math.max(1, Math.min(sPerInt - 1, Math.round(sPerInt * (lim / 100.0))));
            const reqPDur = Math.max(1, Math.round(((params.pulseWidthMs[0] || 15) / 1000) * sr));
            const pDur = Math.min(reqPDur, maxPDur);

            for (let i = 0; i < out.length; i++) {
                if (!this.running) { out[i] = 0; continue; }
                if (this.cnt >= sPerInt) {
                    this.cnt = 0;
                    this.left = pDur;
                }
                this.cnt++;
                out[i] = this.left > 0 ? (this.left--, 1.0) : 0.0;
            }
            return true;
        }
    }
    registerProcessor('clock-processor', ClockProcessor);

    class SeqProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.step = -1;
            this.lastHi = false;
            this.cv = 0;
            this.gate = 0;
            this.gap = 0;
            this.steps = [];
            this.port.onmessage = e => {
                if (e.data.type === 'SET_STEPS') {
                    this.steps = e.data.steps || [];
                } else if (e.data.type === 'RESET') {
                    this.step = -1;
                    this.lastHi = false;
                    this.gap = 0;
                }
            };
        }
        process(ins, outs) {
            const gIn = ins[0]?.[0], cvOut = outs[0]?.[0], gOut = outs[1]?.[0];
            const len = (cvOut || gOut || gIn || []).length || 128;
            const minGap = Math.max(1, Math.round(0.002 * getSR()));

            for (let i = 0; i < len; i++) {
                const isHi = (gIn ? gIn[i] : 0) > 0.3;
                if (isHi && !this.lastHi) {
                    let found = false;
                    for (let a = 0; a < 8; a++) {
                        this.step = (this.step + 1) % 8;
                        if (this.steps[this.step]?.active !== false) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        const cur = this.steps[this.step];
                        if (cur?.cvActive !== false) {
                            this.cv = cur.cv ?? 0;
                        }
                        this.gap = minGap;
                        this.port.postMessage({ type: 'STEP', step: this.step });
                    }
                }
                this.lastHi = isHi;

                const cur = (this.step >= 0 && this.step < 8) ? this.steps[this.step] : null;
                const shouldGate = cur && (cur.active !== false) && (cur.gate !== false) && isHi;
                if (this.gap > 0) {
                    this.gap--;
                    this.gate = 0;
                } else {
                    this.gate = shouldGate ? 1.0 : 0.0;
                }

                if (cvOut) cvOut[i] = this.cv;
                if (gOut) gOut[i] = this.gate;
            }
            return true;
        }
    }
    registerProcessor('seq-processor', SeqProcessor);

    class AdsrProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.lastHi = false;
            this.val = 0;
            this.st = 'idle';
            this.t = 0;
            this.startVal = 0;
            this.attack = 0.02;
            this.attackCurve = 0.0;
            this.decay = 0.2;
            this.decayCurve = 0.0;
            this.sustain = 0.6;
            this.release = 0.4;
            this.releaseCurve = 0.0;

            this.aK = 0; this.aInv = 1;
            this.dK = 0; this.dInv = 1;
            this.rK = 0; this.rInv = 1;

            this.updateCurves = () => {
                const ac = -this.attackCurve;
                if (Math.abs(ac) < 0.02) { this.aK = 0; this.aInv = 1; }
                else { this.aK = ac * 4.0; this.aInv = 1.0 / Math.expm1(this.aK); }

                if (Math.abs(this.decayCurve) < 0.02) { this.dK = 0; this.dInv = 1; }
                else { this.dK = this.decayCurve * 4.0; this.dInv = 1.0 / Math.expm1(this.dK); }

                if (Math.abs(this.releaseCurve) < 0.02) { this.rK = 0; this.rInv = 1; }
                else { this.rK = this.releaseCurve * 4.0; this.rInv = 1.0 / Math.expm1(this.rK); }
            };
            this.updateCurves();

            this.port.onmessage = e => {
                if (e.data.type === 'SET_PARAMS') {
                    if (e.data.attack !== undefined) this.attack = Math.max(0.001, e.data.attack);
                    if (e.data.attackCurve !== undefined) this.attackCurve = Math.max(-1.0, Math.min(1.0, e.data.attackCurve));
                    if (e.data.decay !== undefined) this.decay = Math.max(0.001, e.data.decay);
                    if (e.data.decayCurve !== undefined) this.decayCurve = Math.max(-1.0, Math.min(1.0, e.data.decayCurve));
                    if (e.data.sustain !== undefined) this.sustain = Math.max(0.0, Math.min(1.0, e.data.sustain));
                    if (e.data.release !== undefined) this.release = Math.max(0.001, e.data.release);
                    if (e.data.releaseCurve !== undefined) this.releaseCurve = Math.max(-1.0, Math.min(1.0, e.data.releaseCurve));
                    this.updateCurves();
                }
            };
        }
        process(ins, outs) {
            const gIn = ins[0]?.[0], out = outs[0]?.[0]; if (!out) return true;
            const sr = getSR();
            const aInc = 1 / Math.max(1, this.attack * sr);
            const dInc = 1 / Math.max(1, this.decay * sr);
            const rInc = 1 / Math.max(1, this.release * sr);

            const aK = this.aK, aInv = this.aInv;
            const dK = this.dK, dInv = this.dInv;
            const rK = this.rK, rInv = this.rInv;

            for (let i = 0; i < out.length; i++) {
                const isHi = (gIn ? gIn[i] : 0) > 0.3;
                if (isHi && !this.lastHi) {
                    this.st = 'a';
                    this.t = 0;
                    this.startVal = this.val;
                } else if (!isHi && this.lastHi) {
                    this.st = 'r';
                    this.t = 0;
                    this.startVal = this.val;
                }
                this.lastHi = isHi;

                if (this.st === 'a') {
                    this.t += aInc;
                    if (this.t >= 1.0) {
                        this.t = 0;
                        this.val = 1.0;
                        this.st = 'd';
                    } else {
                        const s = aK === 0 ? this.t : Math.expm1(aK * this.t) * aInv;
                        this.val = this.startVal + (1.0 - this.startVal) * s;
                    }
                } else if (this.st === 'd') {
                    this.t += dInc;
                    if (this.t >= 1.0) {
                        this.t = 1.0;
                        this.val = this.sustain;
                        this.st = 's';
                    } else {
                        const s = dK === 0 ? this.t : Math.expm1(dK * this.t) * dInv;
                        this.val = this.sustain + (1.0 - this.sustain) * (1.0 - s);
                    }
                } else if (this.st === 's') {
                    this.val = this.sustain;
                } else if (this.st === 'r') {
                    this.t += rInc;
                    if (this.t >= 1.0) {
                        this.t = 1.0;
                        this.val = 0.0;
                        this.st = 'idle';
                    } else {
                        const s = rK === 0 ? this.t : Math.expm1(rK * this.t) * rInv;
                        this.val = this.startVal * (1.0 - s);
                    }
                } else {
                    this.val = 0.0;
                }
                out[i] = this.val;
            }
            return true;
        }
    }
    registerProcessor('adsr-processor', AdsrProcessor);

    class LfoProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return [
                { name: 'rate', defaultValue: 2.0, minValue: 0.001, maxValue: 100.0 },
                { name: 'depth', defaultValue: 1.0, minValue: 0.0, maxValue: 10.0 },
                { name: 'duty', defaultValue: 0.5, minValue: 0.01, maxValue: 0.99 },
                { name: 'phase', defaultValue: 0.0, minValue: 0.0, maxValue: 360.0 }
            ];
        }
        constructor() {
            super();
            this.ph = 0;
            this.type = 'sine';
            this.pol = 'bipolar';
            this.syncMode = 'free';
            this.division = '1/4';
            this.bpm = 120;
            this.lastTrig = false;

            this.port.onmessage = e => {
                if (e.data.type === 'SET_CONFIG') {
                    if (e.data.waveType) this.type = e.data.waveType;
                    if (e.data.polarity) this.pol = e.data.polarity;
                    if (e.data.syncMode) this.syncMode = e.data.syncMode;
                    if (e.data.division) this.division = e.data.division;
                    if (e.data.bpm) this.bpm = e.data.bpm;
                }
            };
        }
        process(ins, outs, params) {
            const resetIn = ins[0]?.[0];
            const rateCvIn = ins[1]?.[0];
            const out = outs[0]?.[0];
            if (!out) return true;

            const d = params.depth[0] ?? 1.0;
            const duty = Math.max(0.01, Math.min(0.99, params.duty[0] ?? 0.5));
            const phaseDeg = params.phase[0] ?? 0.0;
            const phaseOffset = (phaseDeg / 360.0) % 1.0;
            const uni = this.pol === 'unipolar';
            const sr = getSR();
            const type = this.type;

            if (this.syncMode === 'sync') {
                const bpm = Math.max(20, this.bpm || 120);
                const beatFreq = bpm / 60.0;
                const divMap = {
                    '4/1': 0.0625, '2/1': 0.125, '1/1': 0.25,
                    '1/2': 0.5, '1/4': 1.0, '1/8': 2.0, '1/16': 4.0, '1/32': 8.0,
                    '1/4T': 1.5, '1/8T': 3.0, '1/16T': 6.0,
                    '1/4D': 0.6667, '1/8D': 1.3333
                };
                const mult = divMap[this.division] || 1.0;
                const baseRate = beatFreq * mult;
                const frameStart = (typeof currentFrame !== 'undefined') ? currentFrame : ((typeof currentTime !== 'undefined') ? (currentTime * sr) : 0);

                for (let i = 0; i < out.length; i++) {
                    const rawP = ((frameStart + i) / sr) * baseRate + phaseOffset;
                    const p = ((rawP % 1.0) + 1.0) % 1.0;
                    let r = 0;
                    if (type === 'sine') r = Math.sin(2 * Math.PI * p);
                    else if (type === 'square') r = p < duty ? 1 : -1;
                    else if (type === 'triangle') r = p < duty ? (-1 + 2 * (p / duty)) : (1 - 2 * ((p - duty) / (1 - duty)));
                    else if (type === 'sawtooth') r = 2 * p - 1;
                    else if (type === 'ramp') r = 1 - 2 * p;
                    out[i] = uni ? (r + 1) * 0.5 * d : r * d;
                }
            } else {
                const baseRate = params.rate[0] ?? 2.0;
                for (let i = 0; i < out.length; i++) {
                    const trigVal = resetIn ? resetIn[i] : 0;
                    const isHi = trigVal > 0.3;
                    if (isHi && !this.lastTrig) {
                        this.ph = 0;
                    }
                    this.lastTrig = isHi;

                    let effRate = baseRate;
                    if (rateCvIn) {
                        effRate = Math.max(0.001, effRate * Math.pow(2, rateCvIn[i]));
                    }
                    effRate = Math.max(0.001, Math.min(100.0, effRate));

                    this.ph = (this.ph + effRate / sr) % 1.0;
                    const rawP = this.ph + phaseOffset;
                    const p = ((rawP % 1.0) + 1.0) % 1.0;
                    let r = 0;
                    if (type === 'sine') r = Math.sin(2 * Math.PI * p);
                    else if (type === 'square') r = p < duty ? 1 : -1;
                    else if (type === 'triangle') r = p < duty ? (-1 + 2 * (p / duty)) : (1 - 2 * ((p - duty) / (1 - duty)));
                    else if (type === 'sawtooth') r = 2 * p - 1;
                    else if (type === 'ramp') r = 1 - 2 * p;
                    out[i] = uni ? (r + 1) * 0.5 * d : r * d;
                }
            }
            return true;
        }
    }
    registerProcessor('lfo-processor', LfoProcessor);

    class MathProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.mode = 'ADD';
            this.valA = 0.0;
            this.valB = 1.0;
            this.hasA = false;
            this.hasB = false;
            this.port.onmessage = (e) => {
                if (e.data.type === 'SET_PARAMS') {
                    if (e.data.mode) this.mode = e.data.mode;
                    if (e.data.valA !== undefined) this.valA = e.data.valA;
                    if (e.data.valB !== undefined) this.valB = e.data.valB;
                    if (e.data.hasA !== undefined) this.hasA = e.data.hasA;
                    if (e.data.hasB !== undefined) this.hasB = e.data.hasB;
                }
            };
        }
        process(ins, outs) {
            const out = outs[0]?.[0]; if (!out) return true;
            const inA = ins[0]?.[0], inB = ins[1]?.[0];
            const mode = this.mode, defA = this.valA, defB = this.valB;
            const hasA = this.hasA && inA, hasB = this.hasB && inB;

            for (let i = 0; i < out.length; i++) {
                const a = hasA ? inA[i] : defA;
                const b = hasB ? inB[i] : defB;
                let v = 0;
                switch (mode) {
                    case 'ADD':
                        v = a + b;
                        break;
                    case 'MULTI':
                        v = a * b;
                        break;
                    case 'DIFF':
                        v = a - b;
                        break;
                    case 'MOD':
                        v = b !== 0 ? (a - b * Math.floor(a / b)) : 0;
                        break;
                    case 'A^B':
                        if (a < 0) {
                            v = -Math.pow(Math.abs(a), b);
                        } else {
                            v = Math.pow(a, b);
                        }
                        break;
                    case 'ABS':
                        v = Math.abs(a);
                        break;
                    case 'FLOOR':
                        v = Math.floor(a);
                        break;
                    case 'CEIL':
                        v = Math.ceil(a);
                        break;
                    case 'ROUND':
                        v = Math.round(a);
                        break;
                    case 'INT':
                        v = Math.trunc(a);
                        break;
                    case 'MIN':
                        v = Math.min(a, b);
                        break;
                    case 'MAX':
                        v = Math.max(a, b);
                        break;
                    case '<':
                        v = a < b ? 1.0 : 0.0;
                        break;
                    case '<=':
                        v = a <= b ? 1.0 : 0.0;
                        break;
                    case '==':
                        v = Math.abs(a - b) < 1e-4 ? 1.0 : 0.0;
                        break;
                    case '>=':
                        v = a >= b ? 1.0 : 0.0;
                        break;
                    case '>':
                        v = a > b ? 1.0 : 0.0;
                        break;
                    default:
                        v = a + b;
                        break;
                }
                out[i] = isNaN(v) || !isFinite(v) ? 0 : v;
            }
            return true;
        }
    }
    registerProcessor('math-processor', MathProcessor);

    class SampleHoldProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() { return [{ name: 'glide', defaultValue: 0.0 }, { name: 'scale', defaultValue: 1.0 }]; }
        constructor() { super(); this.held = 0; this.cur = 0; this.lastTrig = false; this.manualTrig = false; this.hasExt = false; this.pol = 'unipolar'; this.port.onmessage = e => { if (e.data.type === 'SET_CONFIG') { this.hasExt = e.data.hasExternalSig; this.pol = e.data.polarity; } else if (e.data.type === 'TRIG') { this.manualTrig = true; } }; }
        process(ins, outs, params) {
            const sig = ins[0]?.[0], trg = ins[1]?.[0], out = outs[0]?.[0]; if (!out) return true;
            const sr = getSR(), sc = params.scale[0]||1, gl = params.glide[0]||0;
            for (let i = 0; i < out.length; i++) {
                const isHi = (trg ? trg[i] : 0) > 0.3;
                if ((isHi && !this.lastTrig) || this.manualTrig) {
                    if (this.hasExt && sig) {
                        this.held = sig[i];
                    } else {
                        this.held = this.pol === 'bipolar' ? (Math.random() * 2 - 1) : Math.random();
                    }
                    this.manualTrig = false;
                }
                this.lastTrig = isHi;
                const target = this.held * sc;
                this.cur = gl <= 0.001 ? target : (target + (this.cur - target) * Math.exp(-1.0 / (gl * sr)));
                out[i] = this.cur;
            }
            return true;
        }
    }
    registerProcessor('sh-processor', SampleHoldProcessor);

    class FoldProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return [
                { name: 'fold', defaultValue: 1.5, minValue: 0.0, maxValue: 10.0 },
                { name: 'bias', defaultValue: 0.0, minValue: -1.0, maxValue: 1.0 }
            ];
        }
        process(ins, outs, params) {
            const inp = ins[0]?.[0], out = outs[0]?.[0];
            if (!out) return true;
            const bias = params.bias[0] || 0;
            const isFoldArray = params.fold.length > 1;
            const singleFold = params.fold[0] || 0;
            for (let i = 0; i < out.length; i++) {
                const inVal = inp ? inp[i] : 0;
                const foldVal = Math.max(0, isFoldArray ? params.fold[i] : singleFold);
                const drv = 1.0 + foldVal * 3.0;
                let v = (inVal + bias) * drv;
                for (let it = 0; it < 10; it++) {
                    if (v > 1.0) v = 2.0 - v;
                    else if (v < -1.0) v = -2.0 - v;
                    else break;
                }
                out[i] = Math.max(-1.0, Math.min(1.0, v * 0.85));
            }
            return true;
        }
    }
    registerProcessor('fold-processor', FoldProcessor);

    class CvDelayProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return [
                { name: 'timeMs', defaultValue: 50, minValue: 0, maxValue: 5000 },
                { name: 'cvDepth', defaultValue: 1.0, minValue: 0, maxValue: 10 }
            ];
        }
        constructor() {
            super();
            this.maxSamples = 48000 * 5; // 5s max buffer
            this.buffer = new Float32Array(this.maxSamples);
            this.writeIndex = 0;
        }
        process(ins, outs, params) {
            const sigIn = ins[0]?.[0];
            const timeCvIn = ins[1]?.[0];
            const out = outs[0]?.[0];
            if (!out) return true;

            const sr = getSR();
            const baseTimeMs = params.timeMs[0] || 0;
            const depth = params.cvDepth[0] || 1.0;
            const isTimeArray = params.timeMs.length > 1;

            for (let i = 0; i < out.length; i++) {
                const s = sigIn ? sigIn[i] : 0;
                this.buffer[this.writeIndex] = s;

                let delayMs = isTimeArray ? params.timeMs[i] : baseTimeMs;
                if (timeCvIn) {
                    delayMs += (timeCvIn[i] || 0) * 500 * depth;
                }
                delayMs = Math.max(0, Math.min(4999, delayMs));

                const delaySamples = (delayMs / 1000) * sr;
                let readPos = this.writeIndex - delaySamples;
                while (readPos < 0) readPos += this.maxSamples;
                while (readPos >= this.maxSamples) readPos -= this.maxSamples;

                const r0 = Math.floor(readPos);
                const r1 = (r0 + 1) % this.maxSamples;
                const frac = readPos - r0;
                out[i] = this.buffer[r0] * (1 - frac) + this.buffer[r1] * frac;

                this.writeIndex = (this.writeIndex + 1) % this.maxSamples;
            }
            return true;
        }
    }
    registerProcessor('cv-delay-processor', CvDelayProcessor);

    class ScopeProcessor extends AudioWorkletProcessor {
        constructor() {
            super();
            this.bufLen = 512;
            this.buf1 = new Float32Array(this.bufLen);
            this.buf2 = new Float32Array(this.bufLen);
            this.trigBuf = new Float32Array(this.bufLen);
            this.writeIdx = 0;
            this.sampleCounter = 0;
            this.decimation = 1;
            this.min1 = 0; this.max1 = 0;
            this.min2 = 0; this.max2 = 0;
            this.postCounter = 0;

            this.port.onmessage = e => {
                if (e.data.type === 'SET_CONFIG') {
                    const timeSpan = Math.max(0.0005, Math.min(10.0, e.data.timeSpan || 0.1));
                    const sr = getSR();
                    this.decimation = Math.max(1, Math.round((timeSpan * sr) / this.bufLen));
                }
            };
        }
        process(ins) {
            const in1 = ins[0]?.[0];
            const in2 = ins[1]?.[0];
            const trig = ins[2]?.[0];
            const len = (in1 || in2 || trig)?.length || 128;

            for (let i = 0; i < len; i++) {
                const s1 = in1 ? in1[i] : 0;
                const s2 = in2 ? in2[i] : 0;
                const tr = trig ? trig[i] : s1;

                if (this.sampleCounter === 0) {
                    this.min1 = s1; this.max1 = s1;
                    this.min2 = s2; this.max2 = s2;
                } else {
                    if (s1 < this.min1) this.min1 = s1;
                    if (s1 > this.max1) this.max1 = s1;
                    if (s2 < this.min2) this.min2 = s2;
                    if (s2 > this.max2) this.max2 = s2;
                }

                this.sampleCounter++;
                if (this.sampleCounter >= this.decimation) {
                    this.sampleCounter = 0;
                    const val1 = (Math.abs(this.max1) >= Math.abs(this.min1)) ? this.max1 : this.min1;
                    const val2 = (Math.abs(this.max2) >= Math.abs(this.min2)) ? this.max2 : this.min2;

                    this.buf1[this.writeIdx] = val1;
                    this.buf2[this.writeIdx] = val2;
                    this.trigBuf[this.writeIdx] = tr;
                    this.writeIdx = (this.writeIdx + 1) & (this.bufLen - 1);
                }
            }

            this.postCounter += len;
            if (this.postCounter >= 512) {
                this.postCounter = 0;
                const out1 = new Float32Array(this.bufLen);
                const out2 = new Float32Array(this.bufLen);
                const outTrig = new Float32Array(this.bufLen);
                const start = this.writeIdx;
                for (let j = 0; j < this.bufLen; j++) {
                    const idx = (start + j) & (this.bufLen - 1);
                    out1[j] = this.buf1[idx];
                    out2[j] = this.buf2[idx];
                    outTrig[j] = this.trigBuf[idx];
                }
                this.port.postMessage({
                    type: 'SCOPE_DATA',
                    buf1: out1,
                    buf2: out2,
                    trigBuf: outTrig,
                    sampleRate: getSR()
                });
            }
            return true;
        }
    }
    registerProcessor('scope-processor', ScopeProcessor);

    class PatProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
            return [
                { name: 'bpm', defaultValue: 120.0, minValue: 30.0, maxValue: 300.0 }
            ];
        }
        constructor() {
            super();
            this.cycles = [[]];
            this.cycleBeats = 4.0;
            this.gateLen = 0.80;
            this.running = false;
            this.phase = 0.0;
            this.cycleCount = 0;
            this.cv = 0;
            this.gate = 0;
            this.gap = 0;
            this.activeIdx = -1;
            this.postCounter = 0;

            this.port.onmessage = e => {
                if (e.data.type === 'SET_EVENTS') {
                    if (e.data.cycles && e.data.cycles.length > 0) {
                        this.cycles = e.data.cycles;
                    } else if (e.data.events) {
                        this.cycles = [e.data.events];
                    }
                    if (e.data.cycleBeats) this.cycleBeats = e.data.cycleBeats;
                    if (e.data.gateLen !== undefined) this.gateLen = Math.max(0.05, Math.min(0.98, e.data.gateLen));
                } else if (e.data.type === 'SET_STATE') {
                    if (typeof e.data.running === 'boolean') {
                        if (e.data.running && !this.running) {
                            this.phase = 0.0;
                            this.cycleCount = 0;
                            this.gap = 0;
                            this.activeIdx = -1;
                        }
                        this.running = e.data.running;
                    }
                } else if (e.data.type === 'RESET') {
                    this.phase = 0.0;
                    this.cycleCount = 0;
                    this.gap = 0;
                    this.activeIdx = -1;
                }
            };
        }

        process(ins, outs, params) {
            const cvOut = outs[0]?.[0], gOut = outs[1]?.[0];
            const len = (cvOut || gOut || []).length || 128;
            const sr = getSR();
            const bpm = params.bpm[0] || 120.0;
            const cycleSec = (60.0 / bpm) * (this.cycleBeats || 4.0);
            const phaseInc = 1.0 / Math.max(1, cycleSec * sr);
            const minGapSamples = Math.max(1, Math.round(0.002 * sr));

            for (let i = 0; i < len; i++) {
                if (!this.running) {
                    if (cvOut) cvOut[i] = this.cv;
                    if (gOut) gOut[i] = 0;
                    continue;
                }

                this.phase += phaseInc;
                if (this.phase >= 1.0) {
                    this.phase -= 1.0;
                    this.cycleCount++;
                    this.activeIdx = -1;
                }

                const curEvents = this.cycles[this.cycleCount % this.cycles.length] || [];
                let curEv = null;
                let curIdx = -1;
                for (let eIdx = 0; eIdx < curEvents.length; eIdx++) {
                    const ev = curEvents[eIdx];
                    if (this.phase >= ev.start && this.phase < ev.end) {
                        curEv = ev;
                        curIdx = (ev.tokenIdx !== undefined) ? ev.tokenIdx : eIdx;
                        break;
                    }
                }

                if (curIdx !== this.activeIdx) {
                    this.activeIdx = curIdx;
                    if (curEv && !curEv.isRest) {
                        const trigger = (curEv.prob === undefined || curEv.prob >= 1.0) ? true : (Math.random() < curEv.prob);
                        if (trigger) {
                            this.cv = curEv.cv ?? 0;
                            this.gap = minGapSamples;
                        } else {
                            curEv = null;
                        }
                    }
                }

                if (this.gap > 0) {
                    this.gap--;
                    this.gate = 0.0;
                } else if (curEv && !curEv.isRest) {
                    const evDur = curEv.end - curEv.start;
                    const evProg = (this.phase - curEv.start) / Math.max(0.0001, evDur);
                    const gRatio = this.gateLen ?? 0.80;
                    this.gate = (evProg < gRatio) ? 1.0 : 0.0;
                } else {
                    this.gate = 0.0;
                }

                if (cvOut) cvOut[i] = this.cv;
                if (gOut) gOut[i] = this.gate;
            }

            this.postCounter += len;
            if (this.running && this.postCounter >= 256) {
                this.postCounter = 0;
                this.port.postMessage({
                    type: 'PLAYHEAD',
                    phase: this.phase,
                    cycleCount: this.cycleCount,
                    activeIdx: this.activeIdx
                });
            }

            return true;
        }
    }
    registerProcessor('pat-processor', PatProcessor);
`;
