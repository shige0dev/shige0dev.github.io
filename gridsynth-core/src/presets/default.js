export const getDefaultPresets = () => ({
    'DEMO01_DELAY_TECHNO': {
        bpm: 120,
        pages: {
            "0": {
                slots: {
                    "0": "CLK1",
                    "1": "SEQ1",
                    "2": "VCO1",
                    "3": "VCF1",
                    "4": "DELAY1",
                    "8": "ADSR1",
                    "9": "VCA1",
                    "14": "SPK1"
                },
                modules: {
                    "CLK1": { "type": "CLK", "div": "x4", "pulseWidthMs": 20 },
                    "SEQ1": { "type": "SEQ", "steps": [0, 0.583, 0.25, 0.75, 0, 0.917, 0.333, 1.0] },
                    "VCO1": { "type": "VCO", "channels": 1, "freq1": 110, "wave": "square" },
                    "VCF1": { "type": "VCF", "cutoff": 950, "q": 4.5, "modDepth": 2600 },
                    "DELAY1": { "type": "DELAY", "delayTime": 0.24, "feedback": 0.52, "mix": 0.45 },
                    "ADSR1": { "type": "ADSR", "attack": 0.01, "decay": 0.18, "sustain": 0.25, "release": 0.15 },
                    "VCA1": { "type": "VCA", "level": 0.0 },
                    "SPK1": { "type": "SPK" }
                },
                connections: [
                    { from: { moduleId: "CLK1", port: "gate_out" }, to: { moduleId: "SEQ1", port: "gate_in" } },
                    { from: { moduleId: "SEQ1", port: "gate_out" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "SEQ1", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCF1", port: "cv_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "DELAY1", port: "wave_in" } },
                    { from: { moduleId: "DELAY1", port: "wave_out" }, to: { moduleId: "SPK1", port: "wave_in" } }
                ]
            }
        }
    },
    'DEMO02_KEYBOARD_LEAD': {
        bpm: 120,
        pages: {
            "0": {
                slots: {
                    "0": "KEY1",
                    "1": "VCO1",
                    "2": "VCF1",
                    "4": "SPK1",
                    "7": "ADSR1",
                    "8": "VCA1"
                },
                modules: {
                    "KEY1": { "type": "KEY" },
                    "VCO1": { "type": "VCO", "channels": 1, "freq1": 220 },
                    "VCF1": { "type": "VCF", "cutoff": 2200, "q": 3.8 },
                    "SPK1": { "type": "SPK" },
                    "ADSR1": { "type": "ADSR", "attack": 0.04, "decay": 0.35, "sustain": 0.45, "release": 0.55 },
                    "VCA1": { "type": "VCA", "level": 0.0 }
                },
                connections: [
                    { from: { moduleId: "KEY1", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                    { from: { moduleId: "KEY1", port: "gate_out" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SPK1", port: "wave_in" } }
                ]
            }
        }
    },
    'DEMO03_WAVEFOLD_VERB': {
        bpm: 120,
        pages: {
            "0": {
                slots: {
                    "0": "CLK1",
                    "1": "SEQ1",
                    "2": "FOLD1",
                    "3": "VCA1",
                    "4": "SPK1",
                    "6": "ADSR1",
                    "8": "REVERB1"
                },
                modules: {
                    "CLK1": { "type": "CLK", "pulseWidthMs": 25 },
                    "SEQ1": { "type": "SEQ", "steps": [0, 0.25, 0.417, 0.583, 0.75, 0.583, 0.917, 0.333] },
                    "FOLD1": { "type": "FOLD", "fold": 2.2, "bias": 0.15 },
                    "VCA1": { "type": "VCA", "level": 0.0 },
                    "SPK1": { "type": "SPK" },
                    "ADSR1": { "type": "ADSR", "attack": 0.01, "decay": 0.28, "sustain": 0.15, "release": 0.2 },
                    "REVERB1": { "type": "REVERB", "time": 2.4, "damp": 4200, "mix": 0.45 }
                },
                connections: [
                    { from: { moduleId: "CLK1", port: "gate_out" }, to: { moduleId: "SEQ1", port: "gate_in" } },
                    { from: { moduleId: "SEQ1", port: "gate_out" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "SEQ1", port: "cv_out" }, to: { moduleId: "FOLD1", port: "cv_in" } },
                    { from: { moduleId: "FOLD1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "REVERB1", port: "wave_in" } },
                    { from: { moduleId: "REVERB1", port: "wave_out" }, to: { moduleId: "SPK1", port: "wave_in" } }
                ]
            }
        }
    },
    'DEMO04_RANDOM_SH_DELAY': {
        bpm: 120,
        pages: {
            "0": {
                name: "",
                slots: {
                    "0": "CLK1",
                    "1": "SH1",
                    "2": "VCO1",
                    "3": "VCF1",
                    "4": "SPK1",
                    "6": "KEY1",
                    "7": "DELAY1"
                },
                modules: {
                    "CLK1": {
                        "type": "CLK",
                        "div": "x1",
                        "pulseWidthMs": 30,
                        "limitPct": 90
                    },
                    "SH1": {
                        "type": "SH",
                        "glide": 0,
                        "scale": 0.9,
                        "polarity": "unipolar"
                    },
                    "VCO1": {
                        "type": "VCO",
                        "channels": 1,
                        "quantize": true,
                        "wave": "triangle",
                        "freq1": 160,
                        "freq2": 220,
                        "freq3": 220,
                        "freq4": 220
                    },
                    "VCF1": {
                        "type": "VCF",
                        "cutoff": 2400,
                        "q": 2.2,
                        "filterType": "lowpass",
                        "modDepth": 1000
                    },
                    "SPK1": {
                        "type": "SPK",
                        "masterVol": 0.31
                    },
                    "DELAY1": {
                        "type": "DELAY",
                        "delayTime": 0.38,
                        "feedback": 0.58,
                        "mix": 0.38
                    },
                    "KEY1": {
                        "type": "KEY",
                        "octave": 3,
                        "lastNote": "C3",
                        "currentMidi": 60
                    }
                },
                connections: [
                    { from: { moduleId: "CLK1", port: "gate_out" }, to: { moduleId: "SH1", port: "trig_in" } },
                    { from: { moduleId: "SH1", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                    { from: { moduleId: "SH1", port: "cv_out" }, to: { moduleId: "VCF1", port: "cv_in" } },
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "DELAY1", port: "wave_in" } },
                    { from: { moduleId: "DELAY1", port: "wave_out" }, to: { moduleId: "SPK1", port: "wave_in" } },
                    { from: { moduleId: "KEY1", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } }
                ]
            }
        }
    },
    'DEMO05_MULTI_GROOVE': {
        bpm: 128,
        pages: {
            "0": {
                slots: {
                    "0": "CLK1",
                    "1": "SEQ1",
                    "2": "SUB1",
                    "3": "MIX1",
                    "4": "SPK1",
                    "5": "CLK2",
                    "7": "SUB2",
                    "10": "CLK3",
                    "11": "SEQ2",
                    "12": "SUB5",
                    "15": "SUB4"
                },
                modules: {
                    "CLK1": { "type": "CLK", "div": "x4", "pulseWidthMs": 15 },
                    "SEQ1": { "type": "SEQ", "steps": [0, 0.083, 0.583, 0, 0.75, 0.583, 1.0, 0.25] },
                    "SUB1": { "type": "SUB", "targetPage": 1 },
                    "MIX1": { "type": "MIX", "channels": 4, "lvl1": 0.65, "lvl2": 0.95, "lvl3": 0.65, "lvl4": 0.60 },
                    "SPK1": { "type": "SPK", "masterVol": 0.25 },
                    "CLK2": { "type": "CLK", "div": "x1", "pulseWidthMs": 20 },
                    "SUB2": { "type": "SUB", "targetPage": 2 },
                    "CLK3": { "type": "CLK", "div": "x2", "pulseWidthMs": 15 },
                    "SEQ2": { "type": "SEQ", "steps": [0, 0, 1.0, 0, 0, 0, 1.0, 0] },
                    "SUB5": { "type": "SUB", "targetPage": 5 },
                    "SUB4": { "type": "SUB", "targetPage": 4 }
                },
                connections: [
                    { from: { moduleId: "CLK1", port: "gate_out" }, to: { moduleId: "SEQ1", port: "gate_in" } },
                    { from: { moduleId: "SEQ1", port: "cv_out" }, to: { moduleId: "SUB1", port: "L1" } },
                    { from: { moduleId: "SEQ1", port: "gate_out" }, to: { moduleId: "SUB1", port: "L2" } },
                    { from: { moduleId: "SUB1", port: "R1" }, to: { moduleId: "MIX1", port: "wave_in1" } },

                    { from: { moduleId: "CLK2", port: "gate_out" }, to: { moduleId: "SUB2", port: "L1" } },
                    { from: { moduleId: "SUB2", port: "R1" }, to: { moduleId: "MIX1", port: "wave_in2" } },

                    { from: { moduleId: "CLK3", port: "gate_out" }, to: { moduleId: "SEQ2", port: "gate_in" } },
                    { from: { moduleId: "SEQ2", port: "gate_out" }, to: { moduleId: "SUB5", port: "L1" } },
                    { from: { moduleId: "SUB5", port: "R1" }, to: { moduleId: "MIX1", port: "wave_in3" } },

                    { from: { moduleId: "CLK1", port: "gate_out" }, to: { moduleId: "SUB4", port: "L1" } },
                    { from: { moduleId: "SUB4", port: "R1" }, to: { moduleId: "MIX1", port: "wave_in4" } },

                    { from: { moduleId: "MIX1", port: "wave_out" }, to: { moduleId: "SPK1", port: "wave_in" } }
                ]
            },
            "1": {
                name: "ACID BASS",
                slots: {
                    "2": "SUB_IO1",
                    "7": "VCO1",
                    "8": "VCF1",
                    "12": "ADSR1",
                    "13": "VCA1"
                },
                modules: {
                    "SUB_IO1": { "type": "SUB_IO" },
                    "VCO1": { "type": "VCO", "channels": 1, "freq1": 65.41, "wave": "sawtooth" },
                    "VCF1": { "type": "VCF", "cutoff": 320, "q": 12.0, "modDepth": 4600 },
                    "ADSR1": { "type": "ADSR", "attack": 0.002, "decay": 0.22, "sustain": 0.05, "release": 0.15 },
                    "VCA1": { "type": "VCA", "level": 0.0 }
                },
                connections: [
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "VCO1", port: "cv_in" } },
                    { from: { moduleId: "SUB_IO1", port: "L2" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCF1", port: "cv_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
                ]
            },
            "2": {
                name: "BASS DRUM",
                slots: {
                    "2": "SUB_IO1",
                    "5": "VCO1",
                    "6": "MATH2_1",
                    "7": "ADSR1",
                    "8": "ADSR2",
                    "10": "VCA1"
                },
                modules: {
                    "SUB_IO1": { "type": "SUB_IO" },
                    "VCO1": { "type": "VCO", "channels": 1, "freq1": 52, "wave": "sine", "quantize": false },
                    "MATH2_1": { "type": "MATH2", "mode": "MULTI", "valA": 0.0, "valB": 2.6 },
                    "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.055, "decayCurve": -0.75, "sustain": 0.0, "release": 0.03, "releaseCurve": -0.7 },
                    "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.52, "decayCurve": -0.42, "sustain": 0.0, "release": 0.08, "releaseCurve": -0.4 },
                    "VCA1": { "type": "VCA", "level": 0.0 }
                },
                connections: [
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR2", port: "gate_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "MATH2_1", port: "a" } },
                    { from: { moduleId: "MATH2_1", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR2", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
                ]
            },
            "3": {
                name: "SNARE DRUM",
                slots: {
                    "2": "SUB_IO1",
                    "5": "VCO1",
                    "6": "ADSR1",
                    "7": "MIX1",
                    "8": "ADSR2",
                    "9": "NOISE1",
                    "10": "VCA1",
                    "14": "VCF1",
                    "19": "VCA2"
                },
                modules: {
                    "SUB_IO1": { "type": "SUB_IO" },
                    "VCO1": { "type": "VCO", "channels": 1, "freq1": 185, "wave": "triangle", "quantize": false },
                    "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.085, "decayCurve": -0.7, "sustain": 0.0, "release": 0.03, "releaseCurve": -0.7 },
                    "MIX1": { "type": "MIX", "channels": 2, "lvl1": 0.85, "lvl2": 0.75 },
                    "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.18, "decayCurve": -0.6, "sustain": 0.0, "release": 0.04, "releaseCurve": -0.6 },
                    "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 7500, "level": 1.0 },
                    "VCA1": { "type": "VCA", "level": 0.0 },
                    "VCF1": { "type": "VCF", "filterType": "highpass", "cutoff": 2400, "q": 1.8, "modDepth": 0 },
                    "VCA2": { "type": "VCA", "level": 0.0 }
                },
                connections: [
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR2", port: "gate_in" } },
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "MIX1", port: "wave_in1" } },
                    { from: { moduleId: "NOISE1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA2", port: "wave_in" } },
                    { from: { moduleId: "ADSR2", port: "cv_out" }, to: { moduleId: "VCA2", port: "cv_in" } },
                    { from: { moduleId: "VCA2", port: "wave_out" }, to: { moduleId: "MIX1", port: "wave_in2" } },
                    { from: { moduleId: "MIX1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
                ]
            },
            "4": {
                name: "HI-HAT",
                slots: {
                    "2": "SUB_IO1",
                    "6": "NOISE1",
                    "7": "VCF1",
                    "8": "ADSR1",
                    "12": "VCA1"
                },
                modules: {
                    "SUB_IO1": { "type": "SUB_IO" },
                    "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 9500, "level": 1.0 },
                    "VCF1": { "type": "VCF", "filterType": "highpass", "cutoff": 7800, "q": 3.5, "modDepth": 0 },
                    "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.048, "decayCurve": -0.85, "sustain": 0.0, "release": 0.02, "releaseCurve": -0.8 },
                    "VCA1": { "type": "VCA", "level": 0.0 }
                },
                connections: [
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "NOISE1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
                ]
            },
            "5": {
                name: "HAND CLAP",
                slots: {
                    "2": "SUB_IO1",
                    "5": "CVDELAY1",
                    "6": "CVDELAY2",
                    "7": "ADSR1",
                    "8": "ADSR2",
                    "9": "ADSR3",
                    "10": "NOISE1",
                    "11": "VCF1",
                    "12": "VCA1"
                },
                modules: {
                    "SUB_IO1": { "type": "SUB_IO" },
                    "CVDELAY1": { "type": "CVDELAY", "timeMs": 11 },
                    "CVDELAY2": { "type": "CVDELAY", "timeMs": 22 },
                    "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.010, "decayCurve": -0.85, "sustain": 0.0, "release": 0.005, "releaseCurve": -0.8 },
                    "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.010, "decayCurve": -0.85, "sustain": 0.0, "release": 0.005, "releaseCurve": -0.8 },
                    "ADSR3": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.18, "decayCurve": -0.55, "sustain": 0.0, "release": 0.04, "releaseCurve": -0.6 },
                    "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 6000, "level": 1.0 },
                    "VCF1": { "type": "VCF", "filterType": "bandpass", "cutoff": 1300, "q": 2.2, "modDepth": 0 },
                    "VCA1": { "type": "VCA", "level": 0.0 }
                },
                connections: [
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "CVDELAY1", port: "sig_in" } },
                    { from: { moduleId: "CVDELAY1", port: "cv_out" }, to: { moduleId: "ADSR2", port: "gate_in" } },
                    { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "CVDELAY2", port: "sig_in" } },
                    { from: { moduleId: "CVDELAY2", port: "cv_out" }, to: { moduleId: "ADSR3", port: "gate_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "ADSR2", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "ADSR3", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "NOISE1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
                ]
            }
        }
    },
    'DEMO06_HOUSE_BASSLINE': {
        bpm: 120,
        pages: {
            "0": {
                name: "HOUSE BASSLINE",
                slots: {
                    "1": "PAT1",
                    "2": "VCO1",
                    "3": "VCF1",
                    "4": "SPK1",
                    "6": "PAT2",
                    "8": "ADSR1",
                    "9": "VCA1"
                },
                modules: {
                    "PAT1": {
                        "type": "PAT",
                        "pattern": "[c2 c2 c2 c2] [c2 c2 c2 c3] [c2 c2 c2 c2] [c2 c2 c2 c4]",
                        "cycleBeats": 4,
                        "gateLen": 0.8,
                        "presetName": "16-Step Octaves"
                    },
                    "VCO1": {
                        "type": "VCO",
                        "channels": 1,
                        "quantize": true,
                        "wave": "sawtooth",
                        "freq1": 220
                    },
                    "VCF1": {
                        "type": "VCF",
                        "cutoff": 600,
                        "q": 2.5,
                        "filterType": "lowpass",
                        "modDepth": 1200
                    },
                    "SPK1": {
                        "type": "SPK",
                        "masterVol": 0.12
                    },
                    "PAT2": {
                        "type": "PAT",
                        "pattern": "c2 c2 c2 c3",
                        "cycleBeats": 4,
                        "gateLen": 0.8,
                        "presetName": "4-on-floor"
                    },
                    "ADSR1": {
                        "type": "ADSR",
                        "attack": 0.0005,
                        "attackCurve": 0,
                        "decay": 0.176,
                        "decayCurve": 0,
                        "sustain": 0.22,
                        "release": 0.047,
                        "releaseCurve": 0
                    },
                    "VCA1": {
                        "type": "VCA",
                        "level": 0,
                        "cvDepth": 1
                    }
                },
                connections: [
                    { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                    { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                    { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                    { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SPK1", port: "wave_in" } },
                    { from: { moduleId: "PAT1", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                    { from: { moduleId: "PAT1", port: "gate_out" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                    { from: { moduleId: "PAT2", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } }
                ]
            }
        }
    }
});
