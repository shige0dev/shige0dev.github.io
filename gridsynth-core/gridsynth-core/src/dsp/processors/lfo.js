import { getSR } from './common.js';

export class LfoProcessor extends AudioWorkletProcessor {
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

