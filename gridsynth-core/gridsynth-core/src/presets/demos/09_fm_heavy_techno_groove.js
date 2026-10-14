export const preset09 = {
  "bpm": 132,
  "pages": {
    "0": {
      "name": "FM Heavy Techno",
      "slots": {
        "0": "CLK1",
        "1": "CLK2",
        "2": "FM1",
        "3": "MIX1",
        "4": "SPK1",
        "5": "CLK3",
        "6": "SEQ1",
        "7": "FM2",
        "8": "VCF1",
        "9": "MIX2",
        "10": "SEQ2",
        "11": "CVDELAY1",
        "12": "FM3",
        "13": "VCF2",
        "14": "MIX3",
        "15": "MARKOV1",
        "16": "LFO1",
        "17": "FM4",
        "18": "FOLD1",
        "19": "DELAY1",
        "20": "MARKOV2",
        "21": "LFO2",
        "22": "FM5",
        "23": "MATH1",
        "24": "REVERB1",
        "25": "MARKOV3",
        "26": "SH1",
        "27": "FM6",
        "28": "ADSR1",
        "29": "SCOPE1"
      },
      "modules": {
        "CLK1": {
          "type": "CLK",
          "div": "x4",
          "pulseWidthMs": 25,
          "limitPct": 50
        },
        "CLK2": {
          "type": "CLK",
          "div": "x1",
          "pulseWidthMs": 30,
          "limitPct": 50
        },
        "CLK3": {
          "type": "CLK",
          "div": "/2",
          "pulseWidthMs": 30,
          "limitPct": 50
        },
        "SEQ1": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": true, "gate": false },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 1.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": false }
          ]
        },
        "SEQ2": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            { "cv": 0.0, "active": true, "cvActive": false, "gate": false },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": false },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": false },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": false },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": false },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": false, "gate": false }
          ]
        },
        "MARKOV1": {
          "type": "MARKOV",
          "rootMidi": 60,
          "holdClocks": 2,
          "stayWeight": 15,
          "weights": [25, 0, 0, 0],
          "initOn": true,
          "state": 1
        },
        "MARKOV2": {
          "type": "MARKOV",
          "rootMidi": 63,
          "holdClocks": 1,
          "stayWeight": 10,
          "weights": [25, 0, 0, 0],
          "initOn": false,
          "state": 0
        },
        "MARKOV3": {
          "type": "MARKOV",
          "rootMidi": 67,
          "holdClocks": 2,
          "stayWeight": 20,
          "weights": [25, 0, 0, 0],
          "initOn": false,
          "state": 0
        },
        "FM1": {
          "type": "FMx3",
          "algorithm": 3,
          "rootMidi": 36,
          "op1": { "ratio": 1.0, "level": 0.9, "attack": 0.002, "decay": 0.35, "sustain": 0.0, "release": 0.1, "curve": "exp" },
          "op2": { "ratio": 2.0, "level": 1.8, "attack": 0.002, "decay": 0.06, "sustain": 0.0, "release": 0.03, "curve": "exp" },
          "op3": { "ratio": 4.0, "level": 2.2, "feedback": 0.0, "wave": "sine", "attack": 0.002, "decay": 0.012, "sustain": 0.0, "release": 0.01, "curve": "exp" }
        },
        "FM2": {
          "type": "FMx3",
          "algorithm": 1,
          "rootMidi": 48,
          "op1": { "ratio": 1.0, "level": 0.8, "attack": 0.002, "decay": 0.16, "sustain": 0.0, "release": 0.05, "curve": "exp" },
          "op2": { "ratio": 1.5, "level": 1.2, "attack": 0.002, "decay": 0.12, "sustain": 0.0, "release": 0.04, "curve": "exp" },
          "op3": { "ratio": 3.5, "level": 2.5, "feedback": 0.0, "wave": "noise", "attack": 0.002, "decay": 0.15, "sustain": 0.0, "release": 0.05, "curve": "exp" }
        },
        "FM3": {
          "type": "FMx3",
          "algorithm": 1,
          "rootMidi": 60,
          "op1": { "ratio": 1.41, "level": 0.75, "attack": 0.001, "decay": 0.045, "sustain": 0.0, "release": 0.02, "curve": "exp" },
          "op2": { "ratio": 3.14, "level": 2.0, "attack": 0.001, "decay": 0.04, "sustain": 0.0, "release": 0.02, "curve": "exp" },
          "op3": { "ratio": 6.28, "level": 3.0, "feedback": 0.0, "wave": "noise", "attack": 0.001, "decay": 0.035, "sustain": 0.0, "release": 0.02, "curve": "exp" }
        },
        "FM4": {
          "type": "FMx3",
          "algorithm": 1,
          "rootMidi": 36,
          "op1": { "ratio": 1.0, "level": 0.85, "attack": 0.003, "decay": 0.22, "sustain": 0.15, "release": 0.08, "curve": "exp" },
          "op2": { "ratio": 1.0, "level": 1.5, "attack": 0.003, "decay": 0.12, "sustain": 0.0, "release": 0.05, "curve": "exp" },
          "op3": { "ratio": 2.0, "level": 1.4, "feedback": 0.25, "wave": "sine", "attack": 0.003, "decay": 0.08, "sustain": 0.0, "release": 0.04, "curve": "exp" }
        },
        "FM5": {
          "type": "FMx3",
          "algorithm": 3,
          "rootMidi": 60,
          "op1": { "ratio": 1.0, "level": 0.75, "attack": 0.002, "decay": 0.35, "sustain": 0.0, "release": 0.15, "curve": "exp" },
          "op2": { "ratio": 3.0, "level": 0.8, "attack": 0.002, "decay": 0.25, "sustain": 0.0, "release": 0.1, "curve": "exp" },
          "op3": { "ratio": 3.5, "level": 2.2, "feedback": 0.15, "wave": "sine", "attack": 0.002, "decay": 0.12, "sustain": 0.0, "release": 0.06, "curve": "exp" }
        },
        "FM6": {
          "type": "FMx3",
          "algorithm": 2,
          "rootMidi": 54,
          "op1": { "ratio": 0.75, "level": 0.65, "attack": 0.001, "decay": 0.15, "sustain": 0.0, "release": 0.05, "curve": "exp" },
          "op2": { "ratio": 5.25, "level": 3.0, "attack": 0.001, "decay": 0.04, "sustain": 0.0, "release": 0.02, "curve": "exp" },
          "op3": { "ratio": 7.77, "level": 4.0, "feedback": 0.35, "wave": "sine", "attack": 0.001, "decay": 0.02, "sustain": 0.0, "release": 0.01, "curve": "exp" }
        },
        "CVDELAY1": {
          "type": "CVDELAY",
          "timeMs": 60,
          "cvDepth": 1.0
        },
        "VCF1": {
          "type": "VCF",
          "cutoff": 850,
          "q": 3.5,
          "filterType": "lowpass",
          "modDepth": 1800
        },
        "VCF2": {
          "type": "VCF",
          "cutoff": 1600,
          "q": 4.0,
          "filterType": "bandpass",
          "modDepth": 1200
        },
        "LFO1": {
          "type": "LFO",
          "syncMode": "sync",
          "division": "1/1",
          "waveType": "triangle",
          "depth": 0.6,
          "rate": 0.5
        },
        "LFO2": {
          "type": "LFO",
          "syncMode": "free",
          "waveType": "sine",
          "rate": 4.5,
          "depth": 0.4
        },
        "FOLD1": {
          "type": "FOLD",
          "fold": 1.8,
          "bias": 0.2
        },
        "MATH1": {
          "type": "MATH1",
          "mode": "SCALE",
          "valA": 0.5
        },
        "SH1": {
          "type": "SH",
          "polarity": "bipolar"
        },
        "ADSR1": {
          "type": "ADSR",
          "attack": 0.01,
          "decay": 0.25,
          "sustain": 0.0,
          "release": 0.1,
          "curve": "exp"
        },
        "DELAY1": {
          "type": "DELAY",
          "delayTime": 0.227,
          "feedback": 0.45,
          "mix": 0.4
        },
        "REVERB1": {
          "type": "REVERB",
          "time": 2.2,
          "mix": 0.35
        },
        "MIX1": {
          "type": "MIX",
          "channels": 4,
          "lvl1": 0.95,
          "lvl2": 0.85,
          "lvl3": 0.75,
          "lvl4": 0.65
        },
        "MIX2": {
          "type": "MIX",
          "channels": 4,
          "lvl1": 0.85,
          "lvl2": 0.75,
          "lvl3": 0.60,
          "lvl4": 0.55
        },
        "MIX3": {
          "type": "MIX",
          "channels": 2,
          "lvl1": 0.90,
          "lvl2": 0.80
        },
        "SCOPE1": {
          "type": "SCOPE"
        },
        "SPK1": {
          "type": "SPK",
          "masterVol": 0.22
        }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "CLK1:gate_out > SEQ2:gate_in",
        "CLK1:gate_out > MARKOV1:clk_in",
        "CLK1:gate_out > MARKOV2:clk_in",
        "CLK1:gate_out > MARKOV3:clk_in",
        "CLK1:gate_out > SH1:trig_in",

        "CLK2:gate_out > FM1:gate_in",
        "FM1:wave_out > MIX1:wave_in1",

        "CLK3:gate_out > FM2:gate_in",
        "FM2:wave_out > MIX1:wave_in2",

        "SEQ2:gate_out > FM3:gate_in",
        "FM3:wave_out > MIX1:wave_in3",

        "SEQ2:gate_out > CVDELAY1:sig_in",
        "CVDELAY1:cv_out > FM6:gate_in",
        "FM6:wave_out > MIX1:wave_in4",

        "SEQ1:cv_out > FM4:pitch_in",
        "SEQ1:gate_out > FM4:gate_in",
        "FM4:wave_out > VCF1:wave_in",
        "LFO1:cv_out > VCF1:cv_in",
        "VCF1:wave_out > MIX2:wave_in1",

        "MARKOV1:transition_out1 > MARKOV2:transition_in",
        "MARKOV2:transition_out1 > MARKOV3:transition_in",
        "MARKOV3:transition_out1 > MARKOV1:transition_in",

        "MARKOV1:cv_out > FM5:pitch_in",
        "MARKOV2:cv_out > FM5:pitch_in",
        "MARKOV3:cv_out > FM5:pitch_in",
        "MARKOV1:trig_out > FM5:gate_in",
        "MARKOV2:trig_out > FM5:gate_in",
        "MARKOV3:trig_out > FM5:gate_in",

        "FM5:wave_out > VCF2:wave_in",
        "VCF2:wave_out > DELAY1:wave_in",
        "DELAY1:wave_out > REVERB1:wave_in",

        "VCF2:wave_out > MIX2:wave_in2",
        "DELAY1:wave_out > MIX2:wave_in3",
        "REVERB1:wave_out > MIX2:wave_in4",

        "MIX1:wave_out > MIX3:wave_in1",
        "MIX2:wave_out > MIX3:wave_in2",

        "MIX3:wave_out > SCOPE1:in1",
        "CLK2:gate_out > SCOPE1:trig",
        "MIX3:wave_out > SPK1:wave_in_l",
        "MIX3:wave_out > SPK1:wave_in_r"
      ]
    }
  }
};
