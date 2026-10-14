// src/dsp/processors/adsr-core.js

export const ADSR_CURVE_PRESETS = {
    exp: { attackCurve: 0.0, decayCurve: -0.75, releaseCurve: -0.75 },
    lin: { attackCurve: 0.0, decayCurve: 0.0, releaseCurve: 0.0 },
    log: { attackCurve: 0.75, decayCurve: 0.75, releaseCurve: 0.75 }
};

export class AdsrCore {
    constructor(initParams = {}) {
        this.val = 0;
        this.st = 'idle';
        this.t = 0;
        this.startVal = 0;

        this.attack = 0.02;
        this.attackCurve = 0.0;
        this.decay = 0.2;
        this.decayCurve = -0.75;
        this.sustain = 0.6;
        this.release = 0.4;
        this.releaseCurve = -0.75;

        this.aK = 0;
        this.aInv = 1;
        this.dK = 0;
        this.dInv = 1;
        this.rK = 0;
        this.rInv = 1;

        this.lastHi = false;
        this.attackOccurred = false;

        this.setParams(initParams);
    }

    setParams(p = {}) {
        if (!p) return;
        if (p.attack !== undefined) this.attack = Math.max(0.0005, p.attack);
        if (p.attackCurve !== undefined) this.attackCurve = Math.max(-1.0, Math.min(1.0, p.attackCurve));
        if (p.decay !== undefined) this.decay = Math.max(0.001, p.decay);
        if (p.decayCurve !== undefined) this.decayCurve = Math.max(-1.0, Math.min(1.0, p.decayCurve));
        if (p.sustain !== undefined) this.sustain = Math.max(0.0, Math.min(1.0, p.sustain));
        if (p.release !== undefined) this.release = Math.max(0.001, p.release);
        if (p.releaseCurve !== undefined) this.releaseCurve = Math.max(-1.0, Math.min(1.0, p.releaseCurve));

        if (p.curve && ADSR_CURVE_PRESETS[p.curve]) {
            const pre = ADSR_CURVE_PRESETS[p.curve];
            this.attackCurve = pre.attackCurve;
            this.decayCurve = pre.decayCurve;
            this.releaseCurve = pre.releaseCurve;
        }

        if (p.aCurve) this.attackCurve = p.aCurve === 'log' ? 0.75 : (p.aCurve === 'exp' ? -0.75 : 0.0);
        if (p.dCurve) this.decayCurve = p.dCurve === 'log' ? 0.75 : (p.dCurve === 'exp' ? -0.75 : 0.0);
        if (p.rCurve) this.releaseCurve = p.rCurve === 'log' ? 0.75 : (p.rCurve === 'exp' ? -0.75 : 0.0);

        this.updateCurves();
    }

    updateCurves() {
        const ac = -this.attackCurve;
        if (Math.abs(ac) < 0.02) {
            this.aK = 0;
            this.aInv = 1;
        } else {
            this.aK = ac * 4.0;
            this.aInv = 1.0 / Math.expm1(this.aK);
        }

        if (Math.abs(this.decayCurve) < 0.02) {
            this.dK = 0;
            this.dInv = 1;
        } else {
            this.dK = this.decayCurve * 4.0;
            this.dInv = 1.0 / Math.expm1(this.dK);
        }

        if (Math.abs(this.releaseCurve) < 0.02) {
            this.rK = 0;
            this.rInv = 1;
        } else {
            this.rK = this.releaseCurve * 4.0;
            this.rInv = 1.0 / Math.expm1(this.rK);
        }
    }

    reset() {
        this.st = 'idle';
        this.val = 0;
        this.startVal = 0;
        this.t = 1.0;
        this.lastHi = false;
        this.attackOccurred = false;
    }

    step(isHi, sr) {
        if (isHi && !this.lastHi) {
            this.st = 'a';
            this.t = 0;
            this.startVal = this.val;
            this.attackOccurred = true;
        } else if (!isHi && this.lastHi) {
            if (this.sustain > 0.001) {
                this.st = 'r';
                this.t = 0;
                this.startVal = this.val;
            }
        }
        this.lastHi = isHi;

        const aInc = 1 / Math.max(1, this.attack * sr);
        const dInc = 1 / Math.max(1, this.decay * sr);
        const rInc = 1 / Math.max(1, this.release * sr);

        if (this.st === 'a') {
            this.t += aInc;
            if (this.t >= 1.0) {
                this.t = 0;
                this.val = 1.0;
                this.st = 'd';
            } else {
                const s = this.aK === 0 ? this.t : Math.expm1(this.aK * this.t) * this.aInv;
                this.val = this.startVal + (1.0 - this.startVal) * s;
            }
        } else if (this.st === 'd') {
            this.t += dInc;
            if (this.t >= 1.0) {
                this.t = 1.0;
                this.val = this.sustain;
                this.st = (this.sustain > 0.001 && isHi) ? 's' : 'idle';
                if (this.sustain <= 0.001) this.val = 0.0;
            } else {
                const s = this.dK === 0 ? this.t : Math.expm1(this.dK * this.t) * this.dInv;
                this.val = this.sustain + (1.0 - this.sustain) * (1.0 - s);
            }
        } else if (this.st === 's') {
            this.val = this.sustain;
        } else if (this.st === 'r') {
            this.t += rInc;
            if (this.t >= 1.0) {
                this.t = 1.0;
                this.val = 0.0;
                this.st = 'idle';
            } else {
                const s = this.rK === 0 ? this.t : Math.expm1(this.rK * this.t) * this.rInv;
                this.val = this.startVal * (1.0 - s);
            }
        } else {
            this.val = 0.0;
        }
        return this.val;
    }

    getStageNumber() {
        return this.st === 'a' ? 0 : (this.st === 'd' ? 1 : (this.st === 's' ? 2 : (this.st === 'r' ? 3 : -1)));
    }
}

