export const preset10 = {
  "bpm": 128,
  "pages": {
    "0": {
      "name": "FM Simple Test",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "FM1",
        "3": "SCOPE1",
        "4": "SPK1",
        "5": "CLK2",
        "6": "FM2",
        "7": "FM3",
        "8": "MIX1"
      },
      "modules": {
        "CLK1": {
          "type": "CLK",
          "div": "x2",
          "pulseWidthMs": 30,
          "limitPct": 50
        },
        "CLK2": {
          "type": "CLK",
          "div": "x1",
          "pulseWidthMs": 30,
          "limitPct": 50
        },
        "SEQ1": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 1.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true }
          ]
        },
        "FM1": {
          "type": "FMx3",
          "algorithm": 1,
          "rootMidi": 48,
          "op1": { "ratio": 1.0, "level": 0.85, "attack": 0.005, "decay": 0.35, "sustain": 0.0, "release": 0.1, "curve": "exp" },
          "op2": { "ratio": 2.0, "level": 1.8, "attack": 0.005, "decay": 0.2, "sustain": 0.0, "release": 0.05, "curve": "exp" },
          "op3": { "ratio": 3.5, "level": 2.0, "feedback": 0.15, "wave": "sine", "attack": 0.005, "decay": 0.08, "sustain": 0.0, "release": 0.02, "curve": "exp" }
        },
        "FM2": {
          "type": "FMx3",
          "algorithm": 3,
          "rootMidi": 36,
          "op1": { "ratio": 1.0, "level": 0.9, "attack": 0.002, "decay": 0.4, "sustain": 0.0, "release": 0.1, "curve": "exp" },
          "op2": { "ratio": 2.0, "level": 1.5, "attack": 0.002, "decay": 0.06, "sustain": 0.0, "release": 0.03, "curve": "exp" },
          "op3": { "ratio": 4.0, "level": 2.0, "feedback": 0.0, "wave": "sine", "attack": 0.002, "decay": 0.015, "sustain": 0.0, "release": 0.01, "curve": "exp" }
        },
        "FM3": {
          "type": "FMx3",
          "algorithm": 2,
          "rootMidi": 60,
          "op1": { "ratio": 1.0, "level": 0.8, "attack": 0.002, "decay": 0.15, "sustain": 0.0, "release": 0.05, "curve": "exp" },
          "op2": { "ratio": 1.5, "level": 1.0, "attack": 0.002, "decay": 0.1, "sustain": 0.0, "release": 0.04, "curve": "exp" },
          "op3": { "ratio": 3.5, "level": 2.5, "feedback": 0.0, "wave": "noise", "attack": 0.002, "decay": 0.12, "sustain": 0.0, "release": 0.05, "curve": "exp" }
        },
        "MIX1": {
          "type": "MIX",
          "channels": 3,
          "lvl1": 0.85,
          "lvl2": 0.90,
          "lvl3": 0.70
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
        "SEQ1:gate_out > FM1:gate_in",
        "SEQ1:cv_out > FM1:pitch_in",

        "CLK2:gate_out > FM2:gate_in",
        "SEQ1:gate_out > FM3:gate_in",

        "FM1:wave_out > MIX1:wave_in1",
        "FM2:wave_out > MIX1:wave_in2",
        "FM3:wave_out > MIX1:wave_in3",

        "MIX1:wave_out > SCOPE1:in1",
        "CLK2:gate_out > SCOPE1:trig",
        "MIX1:wave_out > SPK1:wave_in_l",
        "MIX1:wave_out > SPK1:wave_in_r"
      ]
    }
  }
};

