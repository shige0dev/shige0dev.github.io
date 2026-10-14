export const preset04 = {
    bpm: 120,
    pages: {
        "0": {
            slots: { "0": "CLK1", "1": "SH1", "2": "VCO1", "3": "VCF1", "4": "SPK1", "6": "KEY1", "7": "DELAY1" },
            modules: {
                "CLK1": { type: "CLK", div: "x1", pulseWidthMs: 30, limitPct: 90 },
                "SH1": { type: "SH", glide: 0, scale: 0.9, polarity: "unipolar" },
                "VCO1": { type: "VCO", channels: 1, quantize: true, wave: "triangle", freq1: 160 },
                "VCF1": { type: "VCF", cutoff: 2400, q: 2.2, filterType: "lowpass", modDepth: 1000 },
                "SPK1": { type: "SPK", masterVol: 0.31 },
                "DELAY1": { type: "DELAY", delayTime: 0.38, feedback: 0.58, mix: 0.38 },
                "KEY1": { type: "KEY", octave: 3, lastNote: "C3", currentMidi: 60 }
            },
            connections: [
                "CLK1:gate_out > SH1:trig_in",
                "SH1:cv_out > VCO1:cv_in",
                "SH1:cv_out > VCF1:cv_in",
                "VCO1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > DELAY1:wave_in",
                "DELAY1:wave_out > SPK1:wave_in_l",
                "DELAY1:wave_out > SPK1:wave_in_r",
                "KEY1:cv_out > VCO1:cv_in"
            ]
        }
    }
};

