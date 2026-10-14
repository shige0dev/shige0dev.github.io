export const preset05 = {
    bpm: 126,
    pages: {
        "0": {
            slots: { "0": "CLK1", "1": "SEQ1", "2": "SUB1", "3": "MIX1", "4": "SPK1", "5": "CLK2", "7": "SUB2", "10": "CLK3", "11": "SEQ2", "12": "SUB5", "15": "SUB4" },
            modules: {
                "CLK1": { type: "CLK", div: "x4", pulseWidthMs: 15 },
                "SEQ1": {
                    type: "SEQ",
                    quantize: true,
                    steps: [
                        { cv: 0, active: true, cvActive: true, gate: true },
                        { cv: 0, active: true, cvActive: true, gate: true },
                        { cv: 1, active: true, cvActive: true, gate: true },
                        { cv: 0, active: true, cvActive: true, gate: true },
                        { cv: 0, active: true, cvActive: true, gate: true },
                        { cv: 0.25, active: true, cvActive: true, gate: true },
                        { cv: 0, active: true, cvActive: true, gate: true },
                        { cv: 1, active: true, cvActive: true, gate: true }
                    ]
                },
                "SUB1": { type: "SUB", targetPage: 1, subType: "AcidVoice" },
                "MIX1": { type: "MIX", channels: 4, lvl1: 0.65, lvl2: 0.95, lvl3: 0.65, lvl4: 0.60 },
                "SPK1": { type: "SPK", masterVol: 0.25 },
                "CLK2": { type: "CLK", div: "x1", pulseWidthMs: 20 },
                "SUB2": { type: "SUB", targetPage: 2, subType: "BassDrum" },
                "CLK3": { type: "CLK", div: "x2", pulseWidthMs: 15 },
                "SEQ2": { type: "SEQ", steps: [0, 0, 1.0, 0, 0, 0, 1.0, 0] },
                "SUB5": { type: "SUB", targetPage: 5, subType: "HandClap" },
                "SUB4": { type: "SUB", targetPage: 4, subType: "HiHat" }
            },
            connections: [
                "CLK1:gate_out > SEQ1:gate_in",
                "SEQ1:cv_out > SUB1:PIN4_in",
                "SEQ1:gate_out > SUB1:PIN3_in",
                "SUB1:PIN9_out > MIX1:wave_in1",
                "CLK2:gate_out > SUB2:PIN4_in",
                "SUB2:PIN9_out > MIX1:wave_in2",
                "CLK3:gate_out > SEQ2:gate_in",
                "SEQ2:gate_out > SUB5:PIN4_in",
                "SUB5:PIN9_out > MIX1:wave_in3",
                "CLK1:gate_out > SUB4:PIN4_in",
                "SUB4:PIN9_out > MIX1:wave_in4",
                "MIX1:wave_out > SPK1:wave_in_l",
                "MIX1:wave_out > SPK1:wave_in_r"
            ]
        },
        "1": {
            name: "ACID BASS",
            subType: "AcidVoice",
            sourceTemplateId: "FACTORY_ACID",
            slots: { "2": "SUB_IO1", "7": "VCO1", "8": "VCF1", "12": "ADSR1", "13": "VCA1" },
            modules: {
                "SUB_IO1": { type: "SUB_IO" },
                "VCO1": { type: "VCO", channels: 1, freq1: 65.41, wave: "sawtooth" },
                "VCF1": { type: "VCF", cutoff: 320, q: 12.0, modDepth: 4600 },
                "ADSR1": { type: "ADSR", attack: 0.002, decay: 0.22, sustain: 0.05, release: 0.15 },
                "VCA1": { type: "VCA", level: 0.0 }
            },
            connections: [
                "SUB_IO1:PIN4_out > VCO1:cv_in",
                "SUB_IO1:PIN3_out > ADSR1:gate_in",
                "VCO1:wave_out > VCF1:wave_in",
                "ADSR1:cv_out > VCF1:cv_in",
                "VCF1:wave_out > VCA1:wave_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "VCA1:wave_out > SUB_IO1:PIN9_in"
            ]
        },
        "2": {
            name: "BASS DRUM",
            subType: "BassDrum",
            sourceTemplateId: "FACTORY_KICK",
            slots: { "2": "SUB_IO1", "5": "VCO1", "6": "MATH2_1", "7": "ADSR1", "8": "ADSR2", "10": "VCA1" },
            modules: {
                "SUB_IO1": { type: "SUB_IO" },
                "VCO1": { type: "VCO", channels: 1, freq1: 52, wave: "sine", quantize: false },
                "MATH2_1": { type: "MATH2", mode: "MULTI", valA: 0.0, valB: 2.6 },
                "ADSR1": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.055, decayCurve: -0.75, sustain: 0.0, release: 0.03, releaseCurve: -0.7 },
                "ADSR2": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.52, decayCurve: -0.42, sustain: 0.0, release: 0.08, releaseCurve: -0.4 },
                "VCA1": { type: "VCA", level: 0.0 }
            },
            connections: [
                "SUB_IO1:PIN4_out > ADSR1:gate_in",
                "SUB_IO1:PIN4_out > ADSR2:gate_in",
                "ADSR1:cv_out > MATH2_1:a",
                "MATH2_1:cv_out > VCO1:cv_in",
                "VCO1:wave_out > VCA1:wave_in",
                "ADSR2:cv_out > VCA1:cv_in",
                "VCA1:wave_out > SUB_IO1:PIN9_in"
            ]
        },
        "3": {
            name: "SNARE DRUM",
            subType: "SnareDrum",
            sourceTemplateId: "FACTORY_SNARE",
            slots: { "2": "SUB_IO1", "5": "VCO1", "6": "ADSR1", "7": "MIX1", "8": "ADSR2", "9": "NOISE1", "10": "VCA1", "14": "VCF1", "19": "VCA2" },
            modules: {
                "SUB_IO1": { type: "SUB_IO" },
                "VCO1": { type: "VCO", channels: 1, freq1: 185, wave: "triangle", quantize: false },
                "ADSR1": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.085, decayCurve: -0.7, sustain: 0.0, release: 0.03, releaseCurve: -0.7 },
                "MIX1": { type: "MIX", channels: 2, lvl1: 0.85, lvl2: 0.75 },
                "ADSR2": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.18, decayCurve: -0.6, sustain: 0.0, release: 0.04, releaseCurve: -0.6 },
                "NOISE1": { type: "NOISE", noiseType: "white", tone: 7500, level: 1.0 },
                "VCA1": { type: "VCA", level: 0.0 },
                "VCF1": { type: "VCF", filterType: "highpass", cutoff: 2400, q: 1.8, modDepth: 0 },
                "VCA2": { type: "VCA", level: 0.0 }
            },
            connections: [
                "SUB_IO1:PIN4_out > ADSR1:gate_in",
                "SUB_IO1:PIN4_out > ADSR2:gate_in",
                "VCO1:wave_out > VCA1:wave_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "VCA1:wave_out > MIX1:wave_in1",
                "NOISE1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > VCA2:wave_in",
                "ADSR2:cv_out > VCA2:cv_in",
                "VCA2:wave_out > MIX1:wave_in2",
                "MIX1:wave_out > SUB_IO1:PIN9_in"
            ]
        },
        "4": {
            name: "HI-HAT",
            subType: "HiHat",
            sourceTemplateId: "FACTORY_HIHAT",
            slots: { "2": "SUB_IO1", "6": "NOISE1", "7": "VCF1", "8": "ADSR1", "12": "VCA1" },
            modules: {
                "SUB_IO1": { type: "SUB_IO" },
                "NOISE1": { type: "NOISE", noiseType: "white", tone: 9500, level: 1.0 },
                "VCF1": { type: "VCF", filterType: "highpass", cutoff: 7800, q: 3.5, modDepth: 0 },
                "ADSR1": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.048, decayCurve: -0.85, sustain: 0.0, release: 0.02, releaseCurve: -0.8 },
                "VCA1": { type: "VCA", level: 0.0 }
            },
            connections: [
                "SUB_IO1:PIN4_out > ADSR1:gate_in",
                "NOISE1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > VCA1:wave_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "VCA1:wave_out > SUB_IO1:PIN9_in"
            ]
        },
        "5": {
            name: "HAND CLAP",
            subType: "HandClap",
            sourceTemplateId: "FACTORY_CLAP",
            slots: { "2": "SUB_IO1", "5": "CVDELAY1", "6": "CVDELAY2", "7": "ADSR1", "8": "ADSR2", "9": "ADSR3", "10": "NOISE1", "11": "VCF1", "12": "VCA1" },
            modules: {
                "SUB_IO1": { type: "SUB_IO" },
                "CVDELAY1": { type: "CVDELAY", timeMs: 11 },
                "CVDELAY2": { type: "CVDELAY", timeMs: 22 },
                "ADSR1": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.010, decayCurve: -0.85, sustain: 0.0, release: 0.005, releaseCurve: -0.8 },
                "ADSR2": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.010, decayCurve: -0.85, sustain: 0.0, release: 0.005, releaseCurve: -0.8 },
                "ADSR3": { type: "ADSR", attack: 0.0005, attackCurve: -0.5, decay: 0.18, decayCurve: -0.55, sustain: 0.0, release: 0.04, releaseCurve: -0.6 },
                "NOISE1": { type: "NOISE", noiseType: "white", tone: 6000, level: 1.0 },
                "VCF1": { type: "VCF", filterType: "bandpass", cutoff: 1300, q: 2.2, modDepth: 0 },
                "VCA1": { type: "VCA", level: 0.0 }
            },
            connections: [
                "SUB_IO1:PIN4_out > ADSR1:gate_in",
                "SUB_IO1:PIN4_out > CVDELAY1:sig_in",
                "CVDELAY1:cv_out > ADSR2:gate_in",
                "SUB_IO1:PIN4_out > CVDELAY2:sig_in",
                "CVDELAY2:cv_out > ADSR3:gate_in",
                "ADSR1:cv_out > VCA1:cv_in",
                "ADSR2:cv_out > VCA1:cv_in",
                "ADSR3:cv_out > VCA1:cv_in",
                "NOISE1:wave_out > VCF1:wave_in",
                "VCF1:wave_out > VCA1:wave_in",
                "VCA1:wave_out > SUB_IO1:PIN9_in"
            ]
        }
    }
};

