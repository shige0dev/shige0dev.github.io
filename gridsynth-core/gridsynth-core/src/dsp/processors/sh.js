import { getSR } from './common.js';

export class SampleHoldProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'glide', defaultValue: 0.0 },
            { name: 'scale', defaultValue: 1.0 }
        ];
    }

    constructor() {
        super();
        this.held = 0;
        this.cur = 0;
        this.lastTrig = false;
        this.manualTrig = false;
        this.hasExt = false;
        this.pol = 'unipolar';
        this.port.onmessage = e => {
            if (e.data.type === 'SET_CONFIG') {
                this.hasExt = e.data.hasExternalSig;
                this.pol = e.data.polarity;
            } else if (e.data.type === 'TRIG') {
                this.manualTrig = true;
            }
        };
    }

    process(ins, outs, params) {
        const sig = ins[0]?.[0], trg = ins[1]?.[0], out = outs[0]?.[0];
        if (!out) return true;
        const sr = getSR(), sc = params.scale[0] || 1, gl = params.glide[0] || 0;
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

