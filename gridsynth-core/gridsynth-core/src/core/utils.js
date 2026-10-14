export const safeClone = (obj) =>
    typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

export const parseConn = (c) => {
    if (!c) return null;
    if (typeof c === 'object') {
        if (c.from && c.to) {
            const fM = typeof c.from === 'object' ? c.from.moduleId : c.from.split(':')[0];
            const fP = typeof c.from === 'object' ? c.from.port : c.from.split(':')[1];
            const tM = typeof c.to === 'object' ? c.to.moduleId : c.to.split(':')[0];
            const tP = typeof c.to === 'object' ? c.to.port : c.to.split(':')[1];
            if (fM && fP && tM && tP) {
                return {
                    from: { moduleId: String(fM).trim(), port: String(fP).trim() },
                    to: { moduleId: String(tM).trim(), port: String(tP).trim() }
                };
            }
        }
        return null;
    }
    if (typeof c === 'string' && c.includes('>')) {
        const [f, t] = c.split('>');
        const [fM, fP] = f.split(':'), [tM, tP] = t.split(':');
        if (fM && fP && tM && tP) {
            return {
                from: { moduleId: fM.trim(), port: fP.trim() },
                to: { moduleId: tM.trim(), port: tP.trim() }
            };
        }
    }
    return null;
};

export const isSubModule = (modIdOrType) => {
    if (!modIdOrType || typeof modIdOrType !== 'string') return false;
    const s = modIdOrType.trim().toUpperCase();
    return s === 'SUB' || s === 'SUB_IO' || s.startsWith('SUB_IO') || s.startsWith('SUB');
};

export const isSubIOModule = (modIdOrType) => {
    if (!modIdOrType || typeof modIdOrType !== 'string') return false;
    const s = modIdOrType.trim().toUpperCase();
    return s === 'SUB_IO' || s.startsWith('SUB_IO');
};

export const getOppositeSubPort = (port) => {
    if (!port || typeof port !== 'string') return port;
    const m = port.match(/^PIN([1-9]|1[0-2])_(in|out)$/i);
    if (!m) return port;
    const num = parseInt(m[1], 10);
    const dir = m[2].toLowerCase();
    const oppDir = dir === 'in' ? 'out' : 'in';
    return `PIN${num}_${oppDir}`;
};

export const normalizeSubPort = (port, modIdOrType = null, manifest = null) => {
    if (!port || typeof port !== 'string') return port;
    const p = port.trim();
    const pLower = p.toLowerCase();
    const isChild = modIdOrType ? isSubIOModule(modIdOrType) : false;

    // 1. Check if port matches an alias defined in manifest.ports
    if (manifest && manifest.ports) {
        for (const [aliasKey, def] of Object.entries(manifest.ports)) {
            if (aliasKey.toLowerCase() === pLower) {
                const pinStr = (def.pin || '').toUpperCase();
                const m = pinStr.match(/^PIN([1-9]|1[0-2])$/);
                if (m) {
                    const slot = parseInt(m[1], 10);
                    if (slot <= 6) {
                        return isChild ? `PIN${slot}_out` : `PIN${slot}_in`;
                    } else {
                        return isChild ? `PIN${slot}_in` : `PIN${slot}_out`;
                    }
                }
            }
        }
    }

    // 2. Already exact PINn_in or PINn_out (case-insensitive)
    const pinMatch = p.match(/^PIN([1-9]|1[0-2])_(in|out)$/i);
    if (pinMatch) {
        return `PIN${pinMatch[1]}_${pinMatch[2].toLowerCase()}`;
    }

    // 3. Bare PINn without _in/_out
    const barePinMatch = p.match(/^PIN([1-9]|1[0-2])$/i);
    if (barePinMatch) {
        const slot = parseInt(barePinMatch[1], 10);
        if (slot <= 6) {
            return isChild ? `PIN${slot}_out` : `PIN${slot}_in`;
        } else {
            return isChild ? `PIN${slot}_in` : `PIN${slot}_out`;
        }
    }

    // 4. Common functional fallbacks (AI prompts / mistakes)
    const fallbacks = {
        'cv_in': 4, 'cv': 4, 'pitch_in': 4, 'pitch': 4, '1v_oct': 4, '1v/oct': 4,
        'gate_in': 3, 'gate': 3,
        'trig_in': 4, 'trig': 4,
        'wave_in': 4, 'audio_in': 4,
        'cv_in2': 3, 'mod_in': 3, 'cv2': 3, 'clk_in': 3, 'sync_in': 3,
        'gate_in2': 2, 'trig2': 2, 'reset_in': 2, 'reset': 2,
        'wave_out': 9, 'out': 9, 'audio_out': 9, 'main_out': 9,
        'wave_out2': 10, 'out2': 10, 'audio_out2': 10, 'aux_out': 10, 'wet_out': 10
    };
    if (fallbacks[pLower]) {
        const slot = fallbacks[pLower];
        if (slot <= 6) {
            return isChild ? `PIN${slot}_out` : `PIN${slot}_in`;
        } else {
            return isChild ? `PIN${slot}_in` : `PIN${slot}_out`;
        }
    }

    // 5. Legacy io_1 .. io_12 support
    const ioMatch = pLower.match(/^io_?([1-9]|1[0-2])$/);
    if (ioMatch) {
        const num = parseInt(ioMatch[1], 10);
        let slot = num;
        if (num === 9) slot = 7;
        else if (num === 10) slot = 8;
        else if (num === 11) slot = 9;
        else if (num === 12) slot = 10;

        if (slot <= 6) {
            return isChild ? `PIN${slot}_out` : `PIN${slot}_in`;
        } else {
            return isChild ? `PIN${slot}_in` : `PIN${slot}_out`;
        }
    }

    return port;
};

export const getSubPortAlias = (port, modIdOrType = null, manifest = null) => {
    if (!port || typeof port !== 'string') return null;
    const norm = normalizeSubPort(port, modIdOrType, manifest);
    const pinMatch = norm.match(/^PIN([1-9]|1[0-2])_(in|out)$/i);
    const pinNumber = pinMatch ? parseInt(pinMatch[1], 10) : null;
    const pinBare = pinNumber ? `PIN${pinNumber}` : null;

    if (!manifest || !manifest.ports || !pinBare) {
        return pinBare ? { pin: pinBare, physicalPort: norm, alias: null, aliasUpper: null, label: norm, desc: null, signal: null } : null;
    }

    for (const [aliasKey, def] of Object.entries(manifest.ports)) {
        if ((def.pin || '').toUpperCase() === pinBare) {
            const aliasUpper = aliasKey.toUpperCase();
            return {
                alias: aliasKey,
                aliasUpper,
                pin: pinBare,
                physicalPort: norm,
                label: `${aliasUpper} (${norm})`,
                desc: def.desc || null,
                signal: def.signal || null
            };
        }
    }

    return { pin: pinBare, physicalPort: norm, alias: null, aliasUpper: null, label: norm, desc: null, signal: null };
};

export const isSubPortOutput = (port, modIdOrType = null, manifest = null) => {
    const norm = normalizeSubPort(port, modIdOrType, manifest);
    const m = norm.match(/^PIN([1-9]|1[0-2])_(in|out)$/i);
    return m ? m[2].toLowerCase() === 'out' : false;
};

export const isSubPortInput = (port, modIdOrType = null, manifest = null) => {
    const norm = normalizeSubPort(port, modIdOrType, manifest);
    const m = norm.match(/^PIN([1-9]|1[0-2])_(in|out)$/i);
    return m ? m[2].toLowerCase() === 'in' : false;
};

export const connKey = (c) => `${c.from.moduleId}:${c.from.port} > ${c.to.moduleId}:${c.to.port}`;

export const isSameConn = (a, b) => {
    if (!a || !b) return false;
    const aFromM = a.from?.moduleId, bFromM = b.from?.moduleId;
    const aToM = a.to?.moduleId, bToM = b.to?.moduleId;
    if (aFromM !== bFromM || aToM !== bToM) return false;

    const aFromP = a.from?.port, bFromP = b.from?.port;
    const fromMatch = aFromP === bFromP || (isSubModule(aFromM) && normalizeSubPort(aFromP, aFromM) === normalizeSubPort(bFromP, bFromM));
    if (!fromMatch) return false;

    const aToP = a.to?.port, bToP = b.to?.port;
    const toMatch = aToP === bToP || (isSubModule(aToM) && normalizeSubPort(aToP, aToM) === normalizeSubPort(bToP, bToM));
    return toMatch;
};

export const HIGHLIGHT_CLASSES = {
    move: 'drop-highlight-valid',
    copy: 'drop-highlight-copy-valid',
    invalid: 'drop-highlight-invalid'
};

export const generateModuleId = (type, existingModules) => {
    let num = 1;
    while (existingModules[`${type}${num}`]) num++;
    return `${type}${num}`;
};

export const SIGNAL_TYPES = {
    CLOCK: {
        id: 'clock',
        label: 'CLOCK',
        stroke: '#f43f5e',       // rose-500
        brightStroke: '#fecdd3', // rose-200
        tailwind: 'bg-rose-500'
    },
    GATE_SEQ: {
        id: 'gate_seq',
        label: 'GATE/STEP',
        stroke: '#f43f5e',       // rose-500 (MARKOV / SEQ gate)
        brightStroke: '#fecdd3',
        tailwind: 'bg-rose-500'
    },
    TRIGGER: {
        id: 'trigger',
        label: 'TRIGGER',
        stroke: '#f59e0b',       // amber-500
        brightStroke: '#fde68a', // amber-200
        tailwind: 'bg-amber-500'
    },
    GATE: {
        id: 'gate',
        label: 'GATE',
        stroke: '#f59e0b',       // amber-500
        brightStroke: '#fde68a',
        tailwind: 'bg-orange-500'
    },
    CV: {
        id: 'cv',
        label: 'CV',
        stroke: '#eab308',       // yellow-500
        brightStroke: '#fef08a', // yellow-200
        tailwind: 'bg-yellow-400'
    },
    AUDIO: {
        id: 'audio',
        label: 'AUDIO',
        stroke: '#38bdf8',       // sky-400
        brightStroke: '#bae6fd', // sky-200
        tailwind: 'bg-blue-500'
    },
    DEFAULT: {
        id: 'default',
        label: 'SIGNAL',
        stroke: '#38bdf8',
        brightStroke: '#bae6fd',
        tailwind: 'bg-slate-500'
    }
};

export const getPortSignalType = (portName = '', modId = '') => {
    const p = String(portName).toLowerCase();
    const m = String(modId).toUpperCase();

    if (m.startsWith('CLK') || p.includes('clk')) {
        return SIGNAL_TYPES.CLOCK;
    }
    if ((p.includes('gate_in') && m.startsWith('SEQ')) || ((p.includes('gate') || p === 'trig_out') && m.startsWith('MARKOV'))) {
        return SIGNAL_TYPES.GATE_SEQ;
    }
    if (p.includes('trig') || p.includes('transition') || p === 'reset') {
        return SIGNAL_TYPES.TRIGGER;
    }
    if (p.includes('gate')) {
        return SIGNAL_TYPES.GATE;
    }
    if (p.includes('cv') || p.includes('pitch') || p === 'a' || p === 'b' || p.startsWith('time') || p.startsWith('fold') || (p.startsWith('in') && !p.startsWith('wave'))) {
        return SIGNAL_TYPES.CV;
    }
    if (p.includes('wave') || p.startsWith('out') || p.startsWith('audio')) {
        return SIGNAL_TYPES.AUDIO;
    }
    return SIGNAL_TYPES.DEFAULT;
};

export const resolveConnectionSignalType = (conn) => {
    if (!conn) return SIGNAL_TYPES.DEFAULT;
    const fM = conn.from?.moduleId || '';
    const fP = conn.from?.port || '';
    const tM = conn.to?.moduleId || '';
    const tP = conn.to?.port || '';

    const fType = getPortSignalType(fP, fM);
    const tType = getPortSignalType(tP, tM);

    if (fType.id === 'clock' || tType.id === 'clock') return SIGNAL_TYPES.CLOCK;
    if (fType.id === 'gate_seq' || tType.id === 'gate_seq') return SIGNAL_TYPES.GATE_SEQ;
    if (fType.id === 'trigger' || tType.id === 'trigger') return SIGNAL_TYPES.TRIGGER;
    if (fType.id === 'gate' || tType.id === 'gate') return SIGNAL_TYPES.GATE;
    if (fType.id === 'cv' || tType.id === 'cv') return SIGNAL_TYPES.CV;
    if (fType.id === 'audio' || tType.id === 'audio') return SIGNAL_TYPES.AUDIO;

    return fType.id !== 'default' ? fType : tType;
};

export const parseClockRate = (val) => {
    if (typeof val === 'number') return val > 0 ? val : 1.0;
    if (!val || typeof val !== 'string') return 1.0;
    const s = val.trim();
    if (s.startsWith('/')) {
        const d = parseFloat(s.slice(1));
        return (d && d > 0) ? 1.0 / d : 1.0;
    }
    if (s.includes('/')) {
        const parts = s.split('/');
        const num = parseFloat(parts[0]), den = parseFloat(parts[1]);
        if (num && den) return num / den;
    }
    if (s.toLowerCase().startsWith('x')) {
        const m = parseFloat(s.slice(1));
        return (m && m > 0) ? m : 1.0;
    }
    const n = parseFloat(s);
    return (n && n > 0) ? n : 1.0;
};
