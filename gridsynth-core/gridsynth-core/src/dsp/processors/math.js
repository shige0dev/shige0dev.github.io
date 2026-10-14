export class MathProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.mode = 'ADD';
        this.valA = 0.0;
        this.valB = 1.0;
        this.hasA = false;
        this.hasB = false;
        this.port.onmessage = (e) => {
            if (e.data.type === 'SET_PARAMS') {
                if (e.data.mode) this.mode = e.data.mode;
                if (e.data.valA !== undefined) this.valA = e.data.valA;
                if (e.data.valB !== undefined) this.valB = e.data.valB;
                if (e.data.hasA !== undefined) this.hasA = e.data.hasA;
                if (e.data.hasB !== undefined) this.hasB = e.data.hasB;
            }
        };
    }

    process(ins, outs) {
        const out = outs[0]?.[0];
        if (!out) return true;
        const inA = ins[0]?.[0], inB = ins[1]?.[0];
        const mode = this.mode, defA = this.valA, defB = this.valB;
        const hasA = this.hasA && inA, hasB = this.hasB && inB;

        for (let i = 0; i < out.length; i++) {
            const a = hasA ? inA[i] : defA;
            const b = hasB ? inB[i] : defB;
            let v = 0;
            switch (mode) {
                case 'ADD':
                    v = a + b;
                    break;
                case 'MULTI':
                    v = a * b;
                    break;
                case 'DIFF':
                    v = a - b;
                    break;
                case 'MOD':
                    v = b !== 0 ? (a - b * Math.floor(a / b)) : 0;
                    break;
                case 'A^B':
                    if (a < 0) {
                        v = -Math.pow(Math.abs(a), b);
                    } else {
                        v = Math.pow(a, b);
                    }
                    break;
                case 'ABS':
                    v = Math.abs(a);
                    break;
                case 'FLOOR':
                    v = Math.floor(a);
                    break;
                case 'CEIL':
                    v = Math.ceil(a);
                    break;
                case 'ROUND':
                    v = Math.round(a);
                    break;
                case 'INT':
                    v = Math.trunc(a);
                    break;
                case 'MIN':
                    v = Math.min(a, b);
                    break;
                case 'MAX':
                    v = Math.max(a, b);
                    break;
                case '<':
                    v = a < b ? 1.0 : 0.0;
                    break;
                case '<=':
                    v = a <= b ? 1.0 : 0.0;
                    break;
                case '==':
                    v = Math.abs(a - b) < 1e-4 ? 1.0 : 0.0;
                    break;
                case '>=':
                    v = a >= b ? 1.0 : 0.0;
                    break;
                case '>':
                    v = a > b ? 1.0 : 0.0;
                    break;
                default:
                    v = a + b;
                    break;
            }
            out[i] = isNaN(v) || !isFinite(v) ? 0 : v;
        }
        return true;
    }
}

registerProcessor('math-processor', MathProcessor);

