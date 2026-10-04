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

export const connKey = (c) => `${c.from.moduleId}:${c.from.port} > ${c.to.moduleId}:${c.to.port}`;

export const isSameConn = (a, b) =>
    a && b &&
    a.from.moduleId === b.from.moduleId &&
    a.from.port === b.from.port &&
    a.to.moduleId === b.to.moduleId &&
    a.to.port === b.to.port;

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
