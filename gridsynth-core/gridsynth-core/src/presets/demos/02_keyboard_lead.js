export const preset02 = {
    bpm: 120,
    pages: {
        "0": {
            slots: { "0": "KEY1", "1": "VCO1", "2": "VCF1", "4": "SPK1", "7": "ADSR1", "8": "VCA1" },
            modules: {
                "KEY1": { type: "KEY" },
                "VCO1": { type: "VCO", channels: 1, freq1: 220 },
                "VCF1": { type: "VCF", cutoff: 2200, q: 3.8 },
                "SPK1": { type: "SPK" },
                "ADSR1": { type: "ADSR", attack: 0.04, decay: 0.35, sustain: 0.45, release: 0.55 },
                "VCA1": { type: "VCA", level: 0.0 }
            },
            connections: [
                "KEY1:cv_out > VCO1:cv_in",
                "KEY1:gate_out > ADSR1:gate_in",
                "VCO1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > VCA1:wave_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "VCA1:wave_out > SPK1:wave_in_l",
                "VCA1:wave_out > SPK1:wave_in_r"
            ]
        }
    }
};

