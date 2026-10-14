export const preset03 = {
    bpm: 120,
    pages: {
        "0": {
            slots: { "0": "CLK1", "1": "SEQ1", "2": "FOLD1", "3": "VCA1", "4": "SPK1", "6": "ADSR1", "8": "REVERB1" },
            modules: {
                "CLK1": { type: "CLK", pulseWidthMs: 25 },
                "SEQ1": { type: "SEQ", steps: [0, 0.25, 0.417, 0.583, 0.75, 0.583, 0.917, 0.333] },
                "FOLD1": { type: "FOLD", fold: 2.2, bias: 0.15 },
                "VCA1": { type: "VCA", level: 0.0 },
                "SPK1": { type: "SPK" },
                "ADSR1": { type: "ADSR", attack: 0.01, decay: 0.28, sustain: 0.15, release: 0.2 },
                "REVERB1": { type: "REVERB", time: 2.4, damp: 4200, mix: 0.45 }
            },
            connections: [
                "CLK1:gate_out > SEQ1:gate_in",
                "SEQ1:gate_out > ADSR1:gate_in",
                "SEQ1:cv_out > FOLD1:cv_in",
                "FOLD1:wave_out > VCA1:wave_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "VCA1:wave_out > REVERB1:wave_in",
                "REVERB1:wave_out > SPK1:wave_in_l",
                "REVERB1:wave_out > SPK1:wave_in_r"
            ]
        }
    }
};

