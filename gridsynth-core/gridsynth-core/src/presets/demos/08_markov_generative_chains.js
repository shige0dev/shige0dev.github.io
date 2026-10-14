export const preset08 = {
    bpm: 124,
    pages: {
        "0": {
            name: "MARKOV CHAIN",
            slots: {
                "0": "CLK1", "1": "LFO1", "2": "VCO1", "3": "VCF1", "4": "VCA1",
                "6": "ADSR1", "7": "DELAY1", "8": "REVERB1", "9": "SPK1",
                "15": "MARKOV1", "16": "MARKOV2", "17": "MARKOV3", "18": "MARKOV4", "19": "MARKOV5"
            },
            modules: {
                "CLK1": { type: "CLK", div: "x2", pulseWidthMs: 25, limitPct: 90 },
                "LFO1": { type: "LFO", waveType: "sine", polarity: "bipolar", syncMode: "free", rate: 0.12, depth: 0.25 },
                "VCO1": { type: "VCO", channels: 1, quantize: true, wave: "sawtooth", freq1: 130.81 },
                "VCF1": { type: "VCF", cutoff: 1050, q: 3.8, filterType: "lowpass", modDepth: 2400 },
                "VCA1": { type: "VCA", level: 0, cvDepth: 1 },
                "ADSR1": { type: "ADSR", attack: 0.005, decay: 0.22, sustain: 0.18, release: 0.25 },
                "DELAY1": { type: "DELAY", delayTime: 0.363, feedback: 0.54, mix: 0.38 },
                "REVERB1": { type: "REVERB", time: 3.2, damp: 3600, mix: 0.40 },
                "SPK1": { type: "SPK", masterVol: 0.32 },
                "MARKOV1": { type: "MARKOV", state: 1, initOn: true, rootMidi: 48, quantize: true, holdClocks: 4, stayWeight: 6, weights: [14, 10, 12, 0], numOutputs: 3 },
                "MARKOV2": { type: "MARKOV", state: 0, initOn: false, rootMidi: 51, quantize: true, holdClocks: 2, stayWeight: 4, weights: [12, 14, 8, 0], numOutputs: 3 },
                "MARKOV3": { type: "MARKOV", state: 0, initOn: false, rootMidi: 53, quantize: true, holdClocks: 1, stayWeight: 2, weights: [16, 12, 8, 0], numOutputs: 3 },
                "MARKOV4": { type: "MARKOV", state: 0, initOn: false, rootMidi: 55, quantize: true, holdClocks: 2, stayWeight: 6, weights: [14, 16, 8, 0], numOutputs: 3 },
                "MARKOV5": { type: "MARKOV", state: 0, initOn: false, rootMidi: 58, quantize: true, holdClocks: 1, stayWeight: 2, weights: [16, 12, 8, 0], numOutputs: 3 }
            },
            connections: [
                // Master Clock Star Distribution
                "CLK1:gate_out > MARKOV1:clk_in",
                "CLK1:gate_out > MARKOV2:clk_in",
                "CLK1:gate_out > MARKOV3:clk_in",
                "CLK1:gate_out > MARKOV4:clk_in",
                "CLK1:gate_out > MARKOV5:clk_in",
                "CLK1:gate_out > ADSR1:gate_in",

                // Markov Transition Mesh (5 nodes)
                "MARKOV1:transition_out1 > MARKOV2:transition_in",
                "MARKOV1:transition_out2 > MARKOV3:transition_in",
                "MARKOV1:transition_out3 > MARKOV4:transition_in",

                "MARKOV2:transition_out1 > MARKOV3:transition_in",
                "MARKOV2:transition_out2 > MARKOV4:transition_in",
                "MARKOV2:transition_out3 > MARKOV1:transition_in",

                "MARKOV3:transition_out1 > MARKOV4:transition_in",
                "MARKOV3:transition_out2 > MARKOV5:transition_in",
                "MARKOV3:transition_out3 > MARKOV1:transition_in",

                "MARKOV4:transition_out1 > MARKOV5:transition_in",
                "MARKOV4:transition_out2 > MARKOV1:transition_in",
                "MARKOV4:transition_out3 > MARKOV2:transition_in",

                "MARKOV5:transition_out1 > MARKOV1:transition_in",
                "MARKOV5:transition_out2 > MARKOV4:transition_in",
                "MARKOV5:transition_out3 > MARKOV3:transition_in",

                // Pitch CV Summing to VCO1
                "MARKOV1:cv_out > VCO1:cv_in",
                "MARKOV2:cv_out > VCO1:cv_in",
                "MARKOV3:cv_out > VCO1:cv_in",
                "MARKOV4:cv_out > VCO1:cv_in",
                "MARKOV5:cv_out > VCO1:cv_in",

                // Modulations
                "ADSR1:cv_out > VCF1:cv_in",
                "LFO1:cv_out > VCF1:cv_in",
                "ADSR1:cv_out > VCA1:cv_in",

                // Audio Signal Path
                "VCO1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > VCA1:wave_in",
                "VCA1:wave_out > DELAY1:wave_in",
                "DELAY1:wave_out > REVERB1:wave_in",
                "REVERB1:wave_out > SPK1:wave_in_l",
                "REVERB1:wave_out > SPK1:wave_in_r"
            ]
        }
    }
};

