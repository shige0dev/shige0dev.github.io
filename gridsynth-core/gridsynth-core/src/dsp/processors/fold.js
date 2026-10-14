export class FoldProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'fold', defaultValue: 1.5, minValue: 0.0, maxValue: 10.0 },
            { name: 'bias', defaultValue: 0.0, minValue: -1.0, maxValue: 1.0 }
        ];
    }

    process(ins, outs, params) {
        const inp = ins[0]?.[0], out = outs[0]?.[0];
        if (!out) return true;
        const bias = params.bias[0] || 0;
        const isFoldArray = params.fold.length > 1;
        const singleFold = params.fold[0] || 0;
        for (let i = 0; i < out.length; i++) {
            const inVal = inp ? inp[i] : 0;
            const foldVal = Math.max(0, isFoldArray ? params.fold[i] : singleFold);
            const drv = 1.0 + foldVal * 3.0;
            let v = (inVal + bias) * drv;
            for (let it = 0; it < 10; it++) {
                if (v > 1.0) v = 2.0 - v;
                else if (v < -1.0) v = -2.0 - v;
                else break;
            }
            out[i] = Math.max(-1.0, Math.min(1.0, v * 0.85));
        }
        return true;
    }
}

registerProcessor('fold-processor', FoldProcessor);

