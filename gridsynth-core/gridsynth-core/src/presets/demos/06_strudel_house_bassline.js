export const preset06 = {
    bpm: 120,
    pages: {
        "0": {
            name: "HOUSE BASSLINE",
            slots: { "1": "PAT1", "2": "VCO1", "3": "VCF1", "4": "SPK1", "6": "PAT2", "8": "ADSR1", "9": "VCA1" },
            modules: {
                "PAT1": { type: "PAT", pattern: "[c2 c2 c2 c2] [c2 c2 c2 c3] [c2 c2 c2 c2] [c2 c2 c2 c4]", cycleBeats: 4, gateLen: 0.8, presetName: "16-Step Octaves" },
                "VCO1": { type: "VCO", channels: 1, quantize: true, wave: "sawtooth", freq1: 220 },
                "VCF1": { type: "VCF", cutoff: 600, q: 2.5, filterType: "lowpass", modDepth: 1200 },
                "SPK1": { type: "SPK", masterVol: 0.12 },
                "PAT2": { type: "PAT", pattern: "c2 c2 c2 c3", cycleBeats: 4, gateLen: 0.8, presetName: "4-on-floor" },
                "ADSR1": { type: "ADSR", attack: 0.0005, attackCurve: 0, decay: 0.176, decayCurve: 0, sustain: 0.22, release: 0.047, releaseCurve: 0 },
                "VCA1": { type: "VCA", level: 0, cvDepth: 1 }
            },
            connections: [
                "VCO1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > VCA1:wave_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "VCA1:wave_out > SPK1:wave_in_l",
                "VCA1:wave_out > SPK1:wave_in_r",
                "PAT1:cv_out > VCO1:cv_in",
                "PAT1:gate_out > ADSR1:gate_in",
                "PAT2:cv_out > VCO1:cv_in"
            ]
        }
    }
};

