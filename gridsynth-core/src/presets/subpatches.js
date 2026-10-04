export const FACTORY_SUBPATCHES = {
    'FACTORY_VOICE': {
        id: 'FACTORY_VOICE',
        name: 'VOICE',
        category: 'Synth Voice',
        isSystem: true,
        description: 'Standard Mono Synth Voice (VCO + VCF + ADSR + VCA)',
        pins: {
            L1: { label: 'Pitch (1V/Oct)', type: 'cv_in' },
            L2: { label: 'Gate In', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'VOICE',
            slots: {
                "2": "SUB_IO1",
                "7": "VCO1",
                "8": "VCF1",
                "12": "ADSR1",
                "13": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "VCO1": { "type": "VCO", "channels": 1, "freq1": 130, "wave": "sawtooth", "col": 2, "row": 1 },
                "VCF1": { "type": "VCF", "cutoff": 1600, "q": 3.8, "modDepth": 1800, "col": 3, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.01, "decay": 0.25, "sustain": 0.25, "release": 0.2, "col": 2, "row": 2 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 3, "row": 2 }
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
        }
    },
    'FACTORY_ACID': {
        id: 'FACTORY_ACID',
        name: 'ACID BASS',
        category: 'Synth Voice',
        isSystem: true,
        description: '303-style resonant screaming acid bass (Sawtooth + Resonant VCF + Snappy Decay)',
        pins: {
            L1: { label: 'Pitch (1V/Oct)', type: 'cv_in' },
            L2: { label: 'Gate In', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'ACID BASS',
            slots: {
                "2": "SUB_IO1",
                "7": "VCO1",
                "8": "VCF1",
                "12": "ADSR1",
                "13": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "VCO1": { "type": "VCO", "channels": 1, "freq1": 65.41, "wave": "sawtooth", "col": 2, "row": 1 },
                "VCF1": { "type": "VCF", "cutoff": 320, "q": 12.0, "modDepth": 4600, "col": 3, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.002, "decay": 0.22, "sustain": 0.05, "release": 0.15, "col": 2, "row": 2 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 3, "row": 2 }
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
        }
    },
    'FACTORY_DUAL_VCO': {
        id: 'FACTORY_DUAL_VCO',
        name: 'DUAL LEAD',
        category: 'Synth Voice',
        isSystem: true,
        description: 'Dual detuned oscillators with lowpass filter',
        pins: {
            L1: { label: 'Pitch (1V/Oct)', type: 'cv_in' },
            L2: { label: 'Gate In', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'DUAL LEAD',
            slots: {
                "2": "SUB_IO1",
                "7": "VCO1",
                "8": "VCF1",
                "12": "ADSR1",
                "13": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "VCO1": { "type": "VCO", "channels": 2, "freq1": 220, "freq2": 222, "wave": "sawtooth", "col": 2, "row": 1 },
                "VCF1": { "type": "VCF", "cutoff": 2200, "q": 2.5, "modDepth": 1500, "col": 3, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.02, "decay": 0.35, "sustain": 0.4, "release": 0.3, "col": 2, "row": 2 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 3, "row": 2 }
            },
            connections: [
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "VCO1", port: "cv_in" } },
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "VCO1", port: "cv_in2" } },
                { from: { moduleId: "SUB_IO1", port: "L2" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCF1", port: "cv_in" } },
                { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
            ]
        }
    },
    'FACTORY_SPACE_FX': {
        id: 'FACTORY_SPACE_FX',
        name: 'SPACE FX',
        category: 'Effect',
        isSystem: true,
        description: 'Stereo-like Delay & Reverb processing block',
        pins: {
            L1: { label: 'Audio In', type: 'audio_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'SPACE FX',
            slots: {
                "2": "SUB_IO1",
                "7": "DELAY1",
                "8": "REVERB1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "DELAY1": { "type": "DELAY", "delayTime": 0.32, "feedback": 0.45, "mix": 0.4, "col": 2, "row": 1 },
                "REVERB1": { "type": "REVERB", "time": 2.6, "damp": 4000, "mix": 0.35, "col": 3, "row": 1 }
            },
            connections: [
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "DELAY1", port: "wave_in" } },
                { from: { moduleId: "DELAY1", port: "wave_out" }, to: { moduleId: "REVERB1", port: "wave_in" } },
                { from: { moduleId: "REVERB1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
            ]
        }
    },
    'FACTORY_KICK': {
        id: 'FACTORY_KICK',
        name: 'BASS DRUM',
        category: 'Percussion',
        isSystem: true,
        description: 'Punchy 808/909-style analogue kick with pitch sweep and exponential decay',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'BASS DRUM',
            slots: {
                "2": "SUB_IO1",
                "5": "VCO1",
                "6": "MATH2_1",
                "7": "ADSR1",
                "8": "ADSR2",
                "10": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "VCO1": { "type": "VCO", "channels": 1, "freq1": 52, "wave": "sine", "quantize": false, "col": 0, "row": 1 },
                "MATH2_1": { "type": "MATH2", "mode": "MULTI", "valA": 0.0, "valB": 2.6, "col": 1, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.055, "decayCurve": -0.75, "sustain": 0.0, "release": 0.03, "releaseCurve": -0.7, "col": 2, "row": 1 },
                "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.52, "decayCurve": -0.42, "sustain": 0.0, "release": 0.08, "releaseCurve": -0.4, "col": 3, "row": 1 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 0, "row": 2 }
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
        }
    },
    'FACTORY_SNARE': {
        id: 'FACTORY_SNARE',
        name: 'SNARE DRUM',
        category: 'Percussion',
        isSystem: true,
        description: 'Dual-layer analogue snare (Triangle body tone + Highpass filtered noise wire)',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'SNARE DRUM',
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
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "VCO1": { "type": "VCO", "channels": 1, "freq1": 185, "wave": "triangle", "quantize": false, "col": 0, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.085, "decayCurve": -0.7, "sustain": 0.0, "release": 0.03, "releaseCurve": -0.7, "col": 1, "row": 1 },
                "MIX1": { "type": "MIX", "channels": 2, "lvl1": 0.85, "lvl2": 0.75, "col": 2, "row": 1 },
                "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.18, "decayCurve": -0.6, "sustain": 0.0, "release": 0.04, "releaseCurve": -0.6, "col": 3, "row": 1 },
                "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 7500, "level": 1.0, "col": 4, "row": 1 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 0, "row": 2 },
                "VCF1": { "type": "VCF", "filterType": "highpass", "cutoff": 2400, "q": 1.8, "modDepth": 0, "col": 4, "row": 2 },
                "VCA2": { "type": "VCA", "level": 0.0, "col": 4, "row": 3 }
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
        }
    },
    'FACTORY_KICK2': {
        id: 'FACTORY_KICK2',
        name: 'BASS DRUM 2',
        category: 'Percussion',
        isSystem: true,
        description: 'Hard & Rich Techno Kick (Crisp Attack Click + 50Hz Deep Resonant Sub Rumble)',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'BASS DRUM 2',
            slots: {
                "2": "SUB_IO1",
                "5": "MATH2_1",
                "6": "MATH2_2",
                "7": "ADSR1",
                "8": "ADSR2",
                "9": "NOISE1",
                "10": "VCO1",
                "11": "VCA1",
                "12": "MIX1",
                "13": "VCA2",
                "14": "VCF1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "MATH2_1": { "type": "MATH2", "mode": "MULTI", "valA": 0.0, "valB": 2.2, "col": 0, "row": 1 },
                "MATH2_2": { "type": "MATH2", "mode": "ADD", "valA": 0.0, "valB": 0.62, "col": 1, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.045, "decayCurve": -0.85, "sustain": 0.0, "release": 0.02, "releaseCurve": -0.8, "col": 2, "row": 1 },
                "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.65, "decayCurve": -0.28, "sustain": 0.0, "release": 0.12, "releaseCurve": -0.3, "col": 3, "row": 1 },
                "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 8000, "level": 1.0, "col": 4, "row": 1 },
                "VCO1": { "type": "VCO", "channels": 1, "freq1": 52, "wave": "sine", "quantize": false, "col": 0, "row": 2 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 1, "row": 2 },
                "MIX1": { "type": "MIX", "channels": 2, "lvl1": 1.0, "lvl2": 0.18, "col": 2, "row": 2 },
                "VCA2": { "type": "VCA", "level": 0.0, "col": 3, "row": 2 },
                "VCF1": { "type": "VCF", "filterType": "highpass", "cutoff": 4500, "q": 2.2, "modDepth": 0, "col": 4, "row": 2 }
            },
            connections: [
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR2", port: "gate_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "MATH2_1", port: "a" } },
                { from: { moduleId: "MATH2_1", port: "cv_out" }, to: { moduleId: "MATH2_2", port: "a" } },
                { from: { moduleId: "MATH2_2", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                { from: { moduleId: "ADSR2", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "MIX1", port: "wave_in1" } },
                { from: { moduleId: "NOISE1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA2", port: "wave_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA2", port: "cv_in" } },
                { from: { moduleId: "VCA2", port: "wave_out" }, to: { moduleId: "MIX1", port: "wave_in2" } },
                { from: { moduleId: "MIX1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
            ]
        }
    },
    'FACTORY_HIHAT': {
        id: 'FACTORY_HIHAT',
        name: 'HI-HAT',
        category: 'Percussion',
        isSystem: true,
        description: 'Crisp & Sizzling Techno Hi-Hat (Highpass Filtered Metallic Noise + Ultra-snappy Decay)',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'HI-HAT',
            slots: {
                "2": "SUB_IO1",
                "6": "NOISE1",
                "7": "VCF1",
                "8": "ADSR1",
                "12": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 9500, "level": 1.0, "col": 1, "row": 1 },
                "VCF1": { "type": "VCF", "filterType": "highpass", "cutoff": 7800, "q": 3.5, "modDepth": 0, "col": 2, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.048, "decayCurve": -0.85, "sustain": 0.0, "release": 0.02, "releaseCurve": -0.8, "col": 3, "row": 1 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 2, "row": 2 }
            },
            connections: [
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                { from: { moduleId: "NOISE1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
            ]
        }
    },
    'FACTORY_CLAP': {
        id: 'FACTORY_CLAP',
        name: 'HAND CLAP',
        category: 'Percussion',
        isSystem: true,
        description: 'Authentic 909 Multi-Burst Hand Clap (Dual CVDELAY + Triple Burst ADSR + Bandpass Resonant Noise)',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'HAND CLAP',
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
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "CVDELAY1": { "type": "CVDELAY", "timeMs": 11, "col": 0, "row": 1 },
                "CVDELAY2": { "type": "CVDELAY", "timeMs": 22, "col": 1, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.010, "decayCurve": -0.85, "sustain": 0.0, "release": 0.005, "releaseCurve": -0.8, "col": 2, "row": 1 },
                "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.010, "decayCurve": -0.85, "sustain": 0.0, "release": 0.005, "releaseCurve": -0.8, "col": 3, "row": 1 },
                "ADSR3": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.18, "decayCurve": -0.55, "sustain": 0.0, "release": 0.04, "releaseCurve": -0.6, "col": 4, "row": 1 },
                "NOISE1": { "type": "NOISE", "noiseType": "white", "tone": 6000, "level": 1.0, "col": 0, "row": 2 },
                "VCF1": { "type": "VCF", "filterType": "bandpass", "cutoff": 1300, "q": 2.2, "modDepth": 0, "col": 1, "row": 2 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 2, "row": 2 }
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
    },
    'FACTORY_TOM': {
        id: 'FACTORY_TOM',
        name: 'TECHNO TOM',
        category: 'Percussion',
        isSystem: true,
        description: 'Polyrhythmic Acid/Tribal Tom (Tuned Triangle Pitch-bend + Deep Resonant Body)',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'TECHNO TOM',
            slots: {
                "2": "SUB_IO1",
                "5": "MATH2_1",
                "6": "MATH2_2",
                "7": "ADSR1",
                "8": "ADSR2",
                "11": "VCO1",
                "12": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "MATH2_1": { "type": "MATH2", "mode": "MULTI", "valA": 0.0, "valB": 1.8, "col": 0, "row": 1 },
                "MATH2_2": { "type": "MATH2", "mode": "ADD", "valA": 0.0, "valB": 1.6, "col": 1, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.045, "decayCurve": -0.8, "sustain": 0.0, "release": 0.02, "releaseCurve": -0.8, "col": 2, "row": 1 },
                "ADSR2": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.35, "decayCurve": -0.45, "sustain": 0.0, "release": 0.06, "releaseCurve": -0.4, "col": 3, "row": 1 },
                "VCO1": { "type": "VCO", "channels": 1, "freq1": 100, "wave": "triangle", "quantize": false, "col": 1, "row": 2 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 2, "row": 2 }
            },
            connections: [
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR2", port: "gate_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "MATH2_1", port: "a" } },
                { from: { moduleId: "MATH2_1", port: "cv_out" }, to: { moduleId: "MATH2_2", port: "a" } },
                { from: { moduleId: "MATH2_2", port: "cv_out" }, to: { moduleId: "VCO1", port: "cv_in" } },
                { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                { from: { moduleId: "ADSR2", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
            ]
        }
    },
    'FACTORY_PERC': {
        id: 'FACTORY_PERC',
        name: 'METALLIC PERC',
        category: 'Percussion',
        isSystem: true,
        description: 'Hypnotic Modular Metallic Percussion / Rim Shot (Dual Resonant Ring + Snappy Click)',
        pins: {
            L1: { label: 'Trig / Gate', type: 'gate_in' },
            R1: { label: 'Audio Out', type: 'audio_out' }
        },
        pageData: {
            name: 'METALLIC PERC',
            slots: {
                "2": "SUB_IO1",
                "6": "VCO1",
                "7": "VCF1",
                "8": "ADSR1",
                "12": "VCA1"
            },
            modules: {
                "SUB_IO1": { "type": "SUB_IO", "col": 2, "row": 0 },
                "VCO1": { "type": "VCO", "channels": 2, "freq1": 1850, "freq2": 2420, "wave": "square", "quantize": false, "col": 1, "row": 1 },
                "VCF1": { "type": "VCF", "filterType": "bandpass", "cutoff": 2100, "q": 4.5, "modDepth": 0, "col": 2, "row": 1 },
                "ADSR1": { "type": "ADSR", "attack": 0.0005, "attackCurve": -0.5, "decay": 0.028, "decayCurve": -0.9, "sustain": 0.0, "release": 0.015, "releaseCurve": -0.9, "col": 3, "row": 1 },
                "VCA1": { "type": "VCA", "level": 0.0, "col": 2, "row": 2 }
            },
            connections: [
                { from: { moduleId: "SUB_IO1", port: "L1" }, to: { moduleId: "ADSR1", port: "gate_in" } },
                { from: { moduleId: "VCO1", port: "wave_out" }, to: { moduleId: "VCF1", port: "wave_in" } },
                { from: { moduleId: "VCF1", port: "wave_out" }, to: { moduleId: "VCA1", port: "wave_in" } },
                { from: { moduleId: "ADSR1", port: "cv_out" }, to: { moduleId: "VCA1", port: "cv_in" } },
                { from: { moduleId: "VCA1", port: "wave_out" }, to: { moduleId: "SUB_IO1", port: "R1" } }
            ]
        }
    }
};
