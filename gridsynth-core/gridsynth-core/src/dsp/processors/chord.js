// src/dsp/processors/chord.js

export class ChordProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.rootCv = 2.0; // default C3 ((48-24)/12)
        this.chordIdx = 0; // min (000)
        this.voiceIdx = 0; // close (00)
        this.hasRoot = false;
        this.hasType = false;
        this.hasVoice = false;
        this.lastChordIdx = -1;
        this.lastVoiceIdx = -1;

        // Semitone offsets for chords (0..7): min, maj, m7, 7th, dim7, 5th, sus4, Maj7
        this.chordSemis = [
            [0, 3, 7, 12],  // 000: min
            [0, 4, 7, 12],  // 001: maj
            [0, 3, 7, 10],  // 010: m7
            [0, 4, 7, 10],  // 011: 7th
            [0, 3, 6, 9],   // 100: dim7
            [0, 7, 12, 19], // 101: 5th
            [0, 5, 7, 12],  // 110: sus4
            [0, 4, 7, 11]   // 111: Maj7
        ];

        // Voicing offsets (0..3): close, drop2, drop3, open
        this.voicingSemis = [
            [0, 0, 0, 0],     // 00: close
            [0, -12, 0, 0],   // 01: drop2
            [0, 0, -12, 0],   // 10: drop3
            [0, 0, 12, 12]    // 11: open
        ];

        this.port.onmessage = (e) => {
            if (e.data.type === 'SET_PARAMS') {
                if (e.data.rootCv !== undefined) this.rootCv = e.data.rootCv;
                if (e.data.chordIdx !== undefined) this.chordIdx = Math.max(0, Math.min(7, e.data.chordIdx));
                if (e.data.voiceIdx !== undefined) this.voiceIdx = Math.max(0, Math.min(3, e.data.voiceIdx));
                if (e.data.hasRoot !== undefined) this.hasRoot = !!e.data.hasRoot;
                if (e.data.hasType !== undefined) this.hasType = !!e.data.hasType;
                if (e.data.hasVoice !== undefined) this.hasVoice = !!e.data.hasVoice;
            }
        };
    }

    process(ins, outs) {
        const inRoot = ins[0]?.[0];
        const inType = ins[1]?.[0];
        const inVoice = ins[2]?.[0];

        const o1 = outs[0]?.[0];
        const o2 = outs[1]?.[0];
        const o3 = outs[2]?.[0];
        const o4 = outs[3]?.[0];

        if (!o1 && !o2 && !o3 && !o4) return true;

        const len = (o1 || o2 || o3 || o4).length;
        const hasRoot = this.hasRoot && inRoot;
        const hasType = this.hasType && inType;
        const hasVoice = this.hasVoice && inVoice;

        for (let i = 0; i < len; i++) {
            const root = hasRoot ? inRoot[i] : this.rootCv;

            let cIdx = this.chordIdx;
            if (hasType) {
                const v = inType[i];
                cIdx = Math.max(0, Math.min(7, Math.floor(v + 0.001)));
            }

            let vIdx = this.voiceIdx;
            if (hasVoice) {
                const v = inVoice[i];
                vIdx = Math.max(0, Math.min(3, Math.floor(v + 0.001)));
            }

            if (cIdx !== this.lastChordIdx || vIdx !== this.lastVoiceIdx) {
                this.lastChordIdx = cIdx;
                this.lastVoiceIdx = vIdx;
                this.port.postMessage({ type: 'ACTIVE', chordIdx: cIdx, voiceIdx: vIdx });
            }

            const cOffsets = this.chordSemis[cIdx] || this.chordSemis[0];
            const vOffsets = this.voicingSemis[vIdx] || this.voicingSemis[0];

            if (o1) o1[i] = root + (cOffsets[0] + vOffsets[0]) / 12.0;
            if (o2) o2[i] = root + (cOffsets[1] + vOffsets[1]) / 12.0;
            if (o3) o3[i] = root + (cOffsets[2] + vOffsets[2]) / 12.0;
            if (o4) o4[i] = root + (cOffsets[3] + vOffsets[3]) / 12.0;
        }

        return true;
    }
}

registerProcessor('chord-processor', ChordProcessor);

