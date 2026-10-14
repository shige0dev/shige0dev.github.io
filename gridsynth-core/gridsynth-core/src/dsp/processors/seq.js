import { getSR } from './common.js';

export class SeqProcessor extends AudioWorkletProcessor {
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

