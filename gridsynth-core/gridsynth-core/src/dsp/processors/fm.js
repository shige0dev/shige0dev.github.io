// src/dsp/processors/fm.js
import { getSR } from './common.js';
import { AdsrCore } from './adsr-core.js';

const TWO_PI = 2 * Math.PI;

export class FmProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase1 = 0;
        this.phase2 = 0;
        this.phase3 = 0;
        this.lastOp3Out = 0;
        this.lastGateHi = false;
        this.hasGateIn = false;

        this.algorithm = 1;
        this.rootMidi = 48; // C3 (130.81Hz)

        this.op1 = { ratio: 1.0, level: 0.85 };
        this.op2 = { ratio: 2.0, level: 1.5 };
        this.op3 = { ratio: 3.5, level: 1.8, feedback: 0.0, wave: 'sine' };

        this.env1 = new AdsrCore({ attack: 0.005, decay: 0.4, sustain: 0.0, release: 0.1, curve: 'exp' });
        this.env2 = new AdsrCore({ attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.05, curve: 'exp' });
        this.env3 = new AdsrCore({ attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.02, curve: 'exp' });

        this.port.onmessage = e => {
            if (e.data.type === 'SET_PARAMS') {
                const d = e.data;
                if (d.hasGateIn !== undefined) this.hasGateIn = !!d.hasGateIn;
                if (d.algorithm !== undefined) this.algorithm = Math.max(1, Math.min(3, Math.round(d.algorithm)));
                if (d.rootMidi !== undefined) this.rootMidi = d.rootMidi;

                if (d.op1) {
                    if (d.op1.ratio !== undefined) this.op1.ratio = Math.max(0.01, d.op1.ratio);
                    if (d.op1.level !== undefined) this.op1.level = Math.max(0.0, d.op1.level);
                    this.env1.setParams(d.op1);
                }

                if (d.op2) {
                    if (d.op2.ratio !== undefined) this.op2.ratio = Math.max(0.01, d.op2.ratio);
                    if (d.op2.level !== undefined) this.op2.level = Math.max(0.0, d.op2.level);
                    this.env2.setParams(d.op2);
                }

                if (d.op3) {
                    if (d.op3.ratio !== undefined) this.op3.ratio = Math.max(0.01, d.op3.ratio);
                    if (d.op3.level !== undefined) this.op3.level = Math.max(0.0, d.op3.level);
                    if (d.op3.feedback !== undefined) this.op3.feedback = Math.max(0.0, Math.min(1.0, d.op3.feedback));
                    if (d.op3.wave !== undefined) this.op3.wave = d.op3.wave;
                    this.env3.setParams(d.op3);
                }
            } else if (e.data.type === 'RESET') {
                this.phase1 = 0;
                this.phase2 = 0;
                this.phase3 = 0;
                this.lastOp3Out = 0;
                this.lastGateHi = false;
                this.env1.reset();
                this.env2.reset();
                this.env3.reset();
            }
        };
    }

    process(ins, outs) {
        const out = outs[0]?.[0];
        if (!out) return true;

        const gIn = ins[0]?.[0];     // gate_in
        const pIn = ins[1]?.[0];     // pitch_in / cv_in
        const sr = getSR();

        for (let i = 0; i < out.length; i++) {
            const isGateHi = this.hasGateIn ? ((gIn ? gIn[i] : 0) > 0.3) : true;

            // Percussion transient phase lock on note onset
            if (this.hasGateIn && isGateHi && !this.lastGateHi) {
                this.phase1 = 0;
                this.phase2 = 0;
                this.phase3 = 0;
                this.lastOp3Out = 0;
            }
            this.lastGateHi = isGateHi;

            // Pitch CV calculation (1V/Oct)
            const cv = pIn ? pIn[i] : 0.0;
            const baseFreq = 440.0 * Math.pow(2.0, (this.rootMidi - 69) / 12.0 + cv);

            const f1 = baseFreq * this.op1.ratio;
            const f2 = baseFreq * this.op2.ratio;
            const f3 = baseFreq * this.op3.ratio;

            // Advance Envelopes
            let envVal1 = 1.0, envVal2 = 1.0, envVal3 = 1.0;
            if (this.hasGateIn) {
                envVal1 = this.env1.step(isGateHi, sr);
                envVal2 = this.env2.step(isGateHi, sr);
                envVal3 = this.env3.step(isGateHi, sr);
            }

            // 1. Calculate Op3 (Modulator 2)
            let rawOp3 = 0.0;
            if (this.op3.wave === 'noise') {
                rawOp3 = (Math.random() * 2.0 - 1.0);
            } else {
                const fbMod = this.lastOp3Out * (this.op3.feedback || 0.0) * Math.PI;
                rawOp3 = Math.sin(this.phase3 + fbMod);
                this.lastOp3Out = rawOp3;
            }
            const op3Out = rawOp3 * envVal3 * this.op3.level;

            // 2. Routing based on Topology Algorithm (1 - 3)
            let finalSample = 0.0;

            switch (this.algorithm) {
                case 1: {
                    // Alg 1: Serial Cascade (3 -> 2 -> 1 -> OUT)
                    const rawOp2 = Math.sin(this.phase2 + op3Out * Math.PI);
                    const op2Out = rawOp2 * envVal2 * this.op2.level;

                    const rawOp1 = Math.sin(this.phase1 + op2Out * Math.PI);
                    finalSample = rawOp1 * envVal1 * this.op1.level;
                    break;
                }

                case 2: {
                    // Alg 2: Dual Modulator ((3 + 2) -> 1 -> OUT)
                    const rawOp2 = Math.sin(this.phase2);
                    const op2Out = rawOp2 * envVal2 * this.op2.level;

                    const modSum = (op3Out + op2Out) * Math.PI;
                    const rawOp1 = Math.sin(this.phase1 + modSum);
                    finalSample = rawOp1 * envVal1 * this.op1.level;
                    break;
                }

                case 3: {
                    // Alg 3: FM + Layer (3 + (2 -> 1) -> OUT)
                    // Op2 modulates Op1 (2-OP FM core)
                    const rawOp2 = Math.sin(this.phase2);
                    const op2Out = rawOp2 * envVal2 * this.op2.level;

                    const rawOp1 = Math.sin(this.phase1 + op2Out * Math.PI);
                    const op1Out = rawOp1 * envVal1 * this.op1.level;

                    // Op3 (White Noise or Sine with FB) directly layers to OUT
                    finalSample = op1Out + op3Out * 0.75;
                    break;
                }

                default: {
                    const rawOp1 = Math.sin(this.phase1);
                    finalSample = rawOp1 * envVal1 * this.op1.level;
                    break;
                }
            }

            out[i] = finalSample;

            // Phase accumulation
            this.phase1 = (this.phase1 + TWO_PI * f1 / sr) % TWO_PI;
            this.phase2 = (this.phase2 + TWO_PI * f2 / sr) % TWO_PI;
            this.phase3 = (this.phase3 + TWO_PI * f3 / sr) % TWO_PI;
        }

        return true;
    }
}

registerProcessor('fm-processor', FmProcessor);

