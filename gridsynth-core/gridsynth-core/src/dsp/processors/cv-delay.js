import { getSR } from './common.js';

export class CvDelayProcessor extends AudioWorkletProcessor {
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
        this.port.onmessage = e => {
            if (e.data.type === 'RESET' || e.data.type === 'CLEAR') {
                this.buffer.fill(0);
                this.writeIndex = 0;
            }
        };
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

