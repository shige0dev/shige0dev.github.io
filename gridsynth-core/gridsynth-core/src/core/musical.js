// src/core/musical.js

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const CHORD_TYPES = {
    'min':  { label: 'MIN',  semis: [0, 3, 7, 12], binary: '000', index: 0 },
    'maj':  { label: 'MAJ',  semis: [0, 4, 7, 12], binary: '001', index: 1 },
    'm7':   { label: 'm7',   semis: [0, 3, 7, 10], binary: '010', index: 2 },
    '7th':  { label: '7TH',  semis: [0, 4, 7, 10], binary: '011', index: 3 },
    'dim7': { label: 'DIM7', semis: [0, 3, 6, 9],  binary: '100', index: 4 },
    '5th':  { label: '5TH',  semis: [0, 7, 12, 19], binary: '101', index: 5 },
    'sus4': { label: 'SUS4', semis: [0, 5, 7, 12], binary: '110', index: 6 },
    'Maj7': { label: 'MAJ7', semis: [0, 4, 7, 11], binary: '111', index: 7 }
};

export const CHORD_ORDER = ['min', 'maj', 'm7', '7th', 'dim7', '5th', 'sus4', 'Maj7'];

export const CHORD_VOICINGS = {
    'close': [0, 0, 0, 0],
    'drop2': [0, -12, 0, 0],
    'drop3': [0, 0, -12, 0],
    'open':  [0, 0, 12, 12]
};

export const VOICING_LABELS = {
    'close': { label: 'CLOSE',  binary: '00', index: 0 },
    'drop2': { label: 'DROP 2', binary: '01', index: 1 },
    'drop3': { label: 'DROP 3', binary: '10', index: 2 },
    'open':  { label: 'OPEN',   binary: '11', index: 3 }
};

export const VOICING_ORDER = ['close', 'drop2', 'drop3', 'open'];

export const midiToNoteName = (midi) => {
    const m = Math.round(midi);
    const n = NOTES[((m % 12) + 12) % 12];
    const oct = Math.floor(m / 12) - 1;
    return `${n}${oct}`;
};

export const cvToNoteName = (cv) => midiToNoteName(Math.round(cv * 12) + 24);

export const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export const freqToMidi = (freq) => Math.round(69 + 12 * Math.log2(Math.max(10, freq) / 440));

