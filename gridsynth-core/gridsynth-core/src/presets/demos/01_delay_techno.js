export const preset01 = {
  "bpm": 126,
  "pages": {
    "0": {
      "name": "",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "VCO1",
        "3": "VCF1",
        "4": "DELAY1",
        "8": "ADSR1",
        "9": "VCA1",
        "10": "SEQ4",
        "11": "KEY1",
        "13": "LFO1",
        "14": "SPK1",
        "15": "SEQ2",
        "16": "SEQ3",
        "19": "SCOPE1"
      },
      "modules": {
        "CLK1": {
          "type": "CLK",
          "div": "x4",
          "pulseWidthMs": 367,
          "limitPct": 90
        },
        "SEQ1": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 1,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 1,
              "active": true,
              "cvActive": true,
              "gate": true
            }
          ]
        },
        "VCO1": {
          "type": "VCO",
          "channels": 1,
          "quantize": true,
          "wave": "square",
          "freq1": 55,
          "freq2": 220,
          "freq3": 220,
          "freq4": 220
        },
        "VCF1": {
          "type": "VCF",
          "cutoff": 147,
          "q": 8.4,
          "filterType": "lowpass",
          "modDepth": 4200
        },
        "DELAY1": {
          "type": "DELAY",
          "delayTime": 0.238,
          "feedback": 0.48,
          "mix": 0.4
        },
        "ADSR1": {
          "type": "ADSR",
          "attack": 0.0005,
          "attackCurve": 0,
          "decay": 0.16,
          "decayCurve": 0,
          "sustain": 0.05,
          "release": 0.5104584612013139,
          "releaseCurve": 0
        },
        "VCA1": {
          "type": "VCA",
          "level": 0,
          "cvDepth": 1
        },
        "KEY1": {
          "type": "KEY",
          "octave": 3,
          "lastNote": "C3",
          "currentMidi": 60
        },
        "LFO1": {
          "type": "LFO",
          "waveType": "sine",
          "polarity": "unipolar",
          "syncMode": "free",
          "division": "1/4",
          "rate": 0.08000000000000002,
          "depth": 2,
          "phase": 0,
          "duty": 0.5
        },
        "SPK1": {
          "type": "SPK",
          "masterVol": 0.12
        },
        "SEQ2": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            }
          ]
        },
        "SEQ3": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.583331,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.416665,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": false,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": false,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": false,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": false,
              "cvActive": true,
              "gate": true
            }
          ]
        },
        "SCOPE1": {
          "type": "SCOPE",
          "timeSpan": 0.001,
          "vRange": 2.5,
          "trigMode": "auto",
          "displayMode": "time",
          "ySpread": 0
        },
        "SEQ4": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            {
              "cv": 0,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": true
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            },
            {
              "cv": 0.25,
              "active": true,
              "cvActive": true,
              "gate": false
            }
          ]
        }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "SEQ1:gate_out > ADSR1:gate_in",
        "SEQ1:cv_out > VCO1:cv_in",
        "VCO1:wave_out > VCF1:wave_in",
        "ADSR1:cv_out > VCF1:cv_in",
        "VCF1:wave_out > VCA1:wave_in",
        "ADSR1:cv_out > VCA1:cv_in",
        "VCA1:wave_out > DELAY1:wave_in",
        "DELAY1:wave_out > SPK1:wave_in_l",
        "DELAY1:wave_out > SPK1:wave_in_r",
        "KEY1:cv_out > VCO1:cv_in",
        "LFO1:cv_out > VCF1:cv_in",
        "SEQ2:gate_out > SEQ3:gate_in",
        "SEQ3:cv_out > VCO1:cv_in",
        "DELAY1:wave_out > SCOPE1:in1",
        "LFO1:cv_out > SCOPE1:in2",
        "SEQ1:gate_out > SEQ4:gate_in",
        "SEQ4:gate_out > SEQ2:gate_in"
      ]
    }
  }
};
