import { getSR } from './common.js';

export class ScopeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufLen = 512;
        this.buf1 = new Float32Array(this.bufLen);
        this.buf2 = new Float32Array(this.bufLen);
        this.trigBuf = new Float32Array(this.bufLen);
        this.writeIdx = 0;
        this.sampleCounter = 0;
        this.decimation = 1;
        this.min1 = 0;
        this.max1 = 0;
        this.min2 = 0;
        this.max2 = 0;
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
                this.min1 = s1;
                this.max1 = s1;
                this.min2 = s2;
                this.max2 = s2;
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

