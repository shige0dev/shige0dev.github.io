import { AudioHelpers } from './helpers.js';

export const MultiOscGroup = {
    create: (ctx, d, patch, targetDest) => {
        const ch = Math.min(4, Math.max(1, d.channels || 1));
        const wave = (d.wave || 'sawtooth').toLowerCase();
        const oscs = [], cvGains = [], inputs = {};

        for (let i = 1; i <= ch; i++) {
            const portName = i === 1 ? 'cv_in' : `cv_in${i}`;
            const isPatched = patch.has(portName);

            const osc = ctx.createOscillator();
            osc.type = wave;

            const cvGain = ctx.createGain();
            cvGain.gain.value = 1200;
            cvGain.connect(osc.detune);
            inputs[portName] = cvGain;
            cvGains.push(cvGain);

            if (isPatched) {
                osc.frequency.value = 32.703;
                osc.detune.value = 0;
            } else {
                osc.frequency.value = d[`freq${i}`] || 220;
                osc.detune.value = 0;
            }

            osc.connect(targetDest);
            osc.start();
            oscs.push(osc);
        }
        return { oscs, cvGains, inputs };
    },
    update: (ctx, oscs, d, patch) => {
        const wave = (d.wave || 'sawtooth').toLowerCase();
        oscs.forEach((osc, idx) => {
            const c = idx + 1;
            const portName = c === 1 ? 'cv_in' : `cv_in${c}`;
            const isPatched = patch.has(portName);

            if (isPatched) {
                AudioHelpers.set(osc.frequency, 32.703, ctx);
                AudioHelpers.set(osc.detune, 0, ctx);
            } else {
                AudioHelpers.set(osc.frequency, d[`freq${c}`] || 220, ctx);
                AudioHelpers.set(osc.detune, 0, ctx);
            }
            if (wave) osc.type = wave;
        });
    }
};
