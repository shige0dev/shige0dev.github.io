import { getSR } from './common.js';
import { AdsrCore } from './adsr-core.js';

export class AdsrProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.env = new AdsrCore();
        this.lastReportedStage = -1;

        this.port.onmessage = e => {
            if (e.data.type === 'SET_PARAMS') {
                this.env.setParams(e.data);
            } else if (e.data.type === 'RESET' || e.data.type === 'CLEAR') {
                this.env.reset();
                this.lastReportedStage = -1;
                this.port.postMessage({ type: 'STAGE', stage: -1 });
            }
        };
    }

    process(ins, outs) {
        const gIn = ins[0]?.[0], out = outs[0]?.[0];
        if (!out) return true;
        const sr = getSR();

        for (let i = 0; i < out.length; i++) {
            const isHi = (gIn ? gIn[i] : 0) > 0.3;
            out[i] = this.env.step(isHi, sr);
        }

        if (this.env.attackOccurred) {
            this.env.attackOccurred = false;
            this.port.postMessage({ type: 'ATTACK' });
        }

        const curStage = this.env.getStageNumber();
        if (curStage !== this.lastReportedStage) {
            this.lastReportedStage = curStage;
            this.port.postMessage({ type: 'STAGE', stage: curStage });
        }
        return true;
    }
}

registerProcessor('adsr-processor', AdsrProcessor);
