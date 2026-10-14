// src/dsp/processors/fm-core.js
import { getSR } from './common.js';

const TWO_PI = 2 * Math.PI;

export class FmCoreProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase = 0;
        this.lastOut = 0;

        this.level = 0.85;
        this.ratio = 1.0;
        this.fine = 0;
        this.index = 1.0;
        this.feedback = 0.0;
        this.rootMidi = 48;
        this.hasIndexCv = false;

        this.port.onmessage = e => {
            if (e.data.type === 'SET_PARAMS') {
                const d = e.data;
                if (d.level !== undefined) this.level = Math.max(0, Math.min(2.0, d.level));
                if (d.ratio !== undefined) this.ratio = Math.max(0.01, d.ratio);
                if (d.fine !== undefined) this.fine = d.fine;
                if (d.index !== undefined) this.index = Math.max(0, d.index);
                if (d.feedback !== undefined) this.feedback = Math.max(0, Math.min(1.0, d.feedback));
                if (d.rootMidi !== undefined) this.rootMidi = d.rootMidi;
                if (d.hasIndexCv !== undefined) this.hasIndexCv = !!d.hasIndexCv;
            } else if (e.data.type === 'RESET') {
                this.phase = 0;
                this.lastOut = 0;
            }
        };
    }

    process(ins, outs) {
        const out = outs[0]?.[0];
        if (!out) return true;

        const pIn = ins[0]?.[0];    // pitch_in / cv_in (1V/Oct)
        const mIn = ins[1]?.[0];    // mod_in / wave_in (phase modulator audio/CV)
        const idxIn = ins[2]?.[0];  // index_cv (optional modulation index CV)
        const sr = getSR();

        for (let i = 0; i < out.length; i++) {
            const cv = pIn ? pIn[i] : 0.0;
            const midiPitch = (this.rootMidi - 69 + (this.fine || 0) / 100) / 12.0 + cv;
            const baseFreq = 440.0 * Math.pow(2.0, midiPitch);
            const freq = baseFreq * this.ratio;

            // Phase modulation from external mod_in
            let modPhase = 0.0;
            if (mIn) {
                const idxMod = this.hasIndexCv ? (idxIn ? Math.max(0, idxIn[i]) : 0.0) : 1.0;
                modPhase = mIn[i] * this.index * idxMod * Math.PI;
            }

            // Self-feedback phase modulation
            const fbMod = this.lastOut * (this.feedback || 0.0) * Math.PI;

            // Pure sine carrier with phase modulation
            const sample = Math.sin(this.phase + modPhase + fbMod);
            this.lastOut = sample;

            out[i] = sample * this.level;

            this.phase = (this.phase + TWO_PI * freq / sr) % TWO_PI;
        }

        return true;
    }
}

registerProcessor('fm-core-processor', FmCoreProcessor);

