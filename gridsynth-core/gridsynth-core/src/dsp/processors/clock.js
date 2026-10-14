import { getSR } from './common.js';

export function parseClockRate(val) {
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
}

export class ClockProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'bpm', defaultValue: 120.0, minValue: 40.0, maxValue: 260.0 },
            { name: 'pulseWidthMs', defaultValue: 15.0 },
            { name: 'limitPct', defaultValue: 90.0, minValue: 10.0, maxValue: 90.0 }
        ];
    }

    constructor() {
        super();
        this.cnt = 0;
        this.left = 0;
        this.div = 'x2';
        this.limitPct = 90.0;
        this.running = false;
        this.port.onmessage = e => {
            if (e.data.type === 'SET_STATE') {
                if (typeof e.data.running === 'boolean') {
                    if (e.data.running && !this.running) this.cnt = 9999999;
                    this.running = e.data.running;
                }
                if (e.data.div) this.div = e.data.div;
                if (e.data.limitPct !== undefined) this.limitPct = Math.min(90.0, e.data.limitPct);
            }
        };
    }

    process(ins, outs, params) {
        const out = outs[0]?.[0];
        if (!out) return true;
        const mult = parseClockRate(this.div);
        const sr = getSR();
        const bpm = params.bpm[0] || 120.0;
        const intSec = 60.0 / bpm / mult;
        const sPerInt = Math.max(1, Math.round(intSec * sr));
        const lim = Math.min(90.0, (params.limitPct ? params.limitPct[0] : this.limitPct) ?? 90.0);
        const maxPDur = Math.max(1, Math.min(sPerInt - 1, Math.round(sPerInt * (lim / 100.0))));
        const reqPDur = Math.max(1, Math.round(((params.pulseWidthMs[0] || 15) / 1000) * sr));
        const pDur = Math.min(reqPDur, maxPDur);

        for (let i = 0; i < out.length; i++) {
            if (!this.running) {
                out[i] = 0;
                continue;
            }
            if (this.cnt >= sPerInt) {
                this.cnt = 0;
                this.left = pDur;
            }
            this.cnt++;
            out[i] = this.left > 0 ? (this.left--, 1.0) : 0.0;
        }
        return true;
    }
}

registerProcessor('clock-processor', ClockProcessor);

