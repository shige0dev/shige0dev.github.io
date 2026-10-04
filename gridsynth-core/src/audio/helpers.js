export const AudioHelpers = {
    set: (p, v, ctx, t = 0.015) => {
        if (!p || !ctx) return;
        try {
            p.setTargetAtTime(v, ctx.currentTime, t);
        } catch (e) {
            try { p.setValueAtTime(v, ctx.currentTime); } catch (_) {}
        }
    },
    cleanup: (nodes) => {
        if (!nodes) return;
        const cleanItem = (n) => {
            if (!n) return;
            if (typeof n.stop === 'function') { try { n.stop(); } catch(e){} }
            if (typeof n.disconnect === 'function') { try { n.disconnect(); } catch(e){} }
            if (typeof n === 'object' && !n.connect && !n.disconnect) {
                Object.values(n).forEach(cleanItem);
            }
        };
        Object.values(nodes).forEach(cleanItem);
    },
    buildReverbBuffer: (ctx, dur, mode = 'hall') => {
        const sr = ctx.sampleRate, len = Math.max(128, Math.floor(sr * Math.max(0.1, Math.min(dur, 6.0))));
        const b = ctx.createBuffer(2, len, sr), l = b.getChannelData(0), r = b.getChannelData(1);
        const dec = { room: 5.2, hall: 3.2, plate: 2.4 }[mode] ?? 3.2;
        const decayCoeff = Math.exp((-dec * 3.0) / len);
        let env = 1.0;
        for (let i = 0; i < len; i++) {
            l[i] = (Math.random() * 2 - 1) * env;
            r[i] = (Math.random() * 2 - 1) * env;
            env *= decayCoeff;
        }
        return b;
    }
};
