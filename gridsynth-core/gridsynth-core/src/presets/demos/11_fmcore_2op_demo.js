export const preset11 = {
  "bpm": 126,
  "pages": {
    "0": {
      "name": "FMCORE 2-OP Modular",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "ADSR1",
        "3": "ADSR2",
        "4": "SPK1",
        "5": "LFO1",
        "6": "FMCORE1",
        "7": "FMCORE2",
        "8": "VCA1",
        "9": "SCOPE1",
        "10": "DELAY1"
      },
      "modules": {
        "CLK1": {
          "type": "CLK",
          "div": "x2",
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
            { "cv": 0.75, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0833, "active": true, "cvActive": true, "gate": true }
          ]
        },
        "ADSR1": {
          "type": "ADSR",
          "attack": 0.003,
          "decay": 0.18,
          "sustain": 0.05,
          "release": 0.06,
          "aCurve": "exp",
          "dCurve": "exp",
          "rCurve": "exp"
        },
        "ADSR2": {
          "type": "ADSR",
          "attack": 0.003,
          "decay": 0.32,
          "sustain": 0.2,
          "release": 0.12,
          "aCurve": "exp",
          "dCurve": "exp",
          "rCurve": "exp"
        },
        "LFO1": {
          "type": "LFO",
          "syncMode": "free",
          "rate": 0.5,
          "depth": 0.1,
          "waveType": "sine"
        },
        "FMCORE1": {
          "type": "FMCORE",
          "level": 0.95,
          "ratio": 2.0,
          "fine": 0,
          "index": 2.2,
          "feedback": 0.12,
          "rootMidi": 48
        },
        "FMCORE2": {
          "type": "FMCORE",
          "level": 0.85,
          "ratio": 1.0,
          "fine": 0,
          "index": 1.0,
          "feedback": 0.0,
          "rootMidi": 48
        },
        "VCA1": {
          "type": "VCA",
          "level": 1.0,
          "cvDepth": 1.0
        },
        "DELAY1": {
          "type": "DELAY",
          "delayTime": 0.26,
          "feedback": 0.32,
          "mix": 0.4
        },
        "SCOPE1": {
          "type": "SCOPE",
          "timeSpan": 0.02,
          "vRange": 5.0,
          "trigMode": "auto",
          "displayMode": "time",
          "ySpread": 0.22
        },
        "SPK1": {
          "type": "SPK",
          "masterVol": 0.22
        }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "SEQ1:gate_out > ADSR1:gate_in",
        "SEQ1:gate_out > ADSR2:gate_in",
        "SEQ1:cv_out > FMCORE1:pitch_in",
        "SEQ1:cv_out > FMCORE2:pitch_in",
        "ADSR1:cv_out > FMCORE2:index_cv",
        "FMCORE1:wave_out > FMCORE2:mod_in",
        "FMCORE2:wave_out > VCA1:wave_in",
        "ADSR2:cv_out > VCA1:cv_in",
        "VCA1:wave_out > DELAY1:wave_in",
        "VCA1:wave_out > SPK1:wave_in_l",
        "DELAY1:wave_out > SPK1:wave_in_r",
        "VCA1:wave_out > SCOPE1:in1",
        "FMCORE1:wave_out > SCOPE1:in2",
        "CLK1:gate_out > SCOPE1:trig"
      ]
    }
  }
};

