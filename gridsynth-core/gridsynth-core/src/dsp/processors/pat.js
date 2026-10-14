import { getSR } from './common.js';

export class PatProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'bpm', defaultValue: 120.0, minValue: 30.0, maxValue: 300.0 }
        ];
    }

    constructor() {
        super();
        this.cycles = [[]];
        this.cycleBeats = 4.0;
        this.gateLen = 0.80;
        this.running = false;
        this.phase = 0.0;
        this.cycleCount = 0;
        this.cv = 0;
        this.gate = 0;
        this.gap = 0;
        this.activeIdx = -1;
        this.postCounter = 0;

        this.port.onmessage = e => {
            if (e.data.type === 'SET_EVENTS') {
                if (e.data.cycles && e.data.cycles.length > 0) {
                    this.cycles = e.data.cycles;
                } else if (e.data.events) {
                    this.cycles = [e.data.events];
                }
                if (e.data.cycleBeats) this.cycleBeats = e.data.cycleBeats;
                if (e.data.gateLen !== undefined) this.gateLen = Math.max(0.05, Math.min(0.98, e.data.gateLen));
            } else if (e.data.type === 'SET_STATE') {
                if (typeof e.data.running === 'boolean') {
                    if (e.data.running && !this.running) {
                        this.phase = 0.0;
                        this.cycleCount = 0;
                        this.gap = 0;
                        this.activeIdx = -1;
                    }
                    this.running = e.data.running;
                }
            } else if (e.data.type === 'RESET') {
                this.phase = 0.0;
                this.cycleCount = 0;
                this.gap = 0;
                this.activeIdx = -1;
            }
        };
    }

    process(ins, outs, params) {
        const cvOut = outs[0]?.[0], gOut = outs[1]?.[0];
        const len = (cvOut || gOut || []).length || 128;
        const sr = getSR();
        const bpm = params.bpm[0] || 120.0;
        const cycleSec = (60.0 / bpm) * (this.cycleBeats || 4.0);
        const phaseInc = 1.0 / Math.max(1, cycleSec * sr);
        const minGapSamples = Math.max(1, Math.round(0.002 * sr));

        for (let i = 0; i < len; i++) {
            if (!this.running) {
                if (cvOut) cvOut[i] = this.cv;
                if (gOut) gOut[i] = 0;
                continue;
            }

            this.phase += phaseInc;
            if (this.phase >= 1.0) {
                this.phase -= 1.0;
                this.cycleCount++;
                this.activeIdx = -1;
            }

            const curEvents = this.cycles[this.cycleCount % this.cycles.length] || [];
            let curEv = null;
            let curIdx = -1;
            for (let eIdx = 0; eIdx < curEvents.length; eIdx++) {
                const ev = curEvents[eIdx];
                if (this.phase >= ev.start && this.phase < ev.end) {
                    curEv = ev;
                    curIdx = (ev.tokenIdx !== undefined) ? ev.tokenIdx : eIdx;
                    break;
                }
            }

            if (curIdx !== this.activeIdx) {
                this.activeIdx = curIdx;
                if (curEv && !curEv.isRest) {
                    const trigger = (curEv.prob === undefined || curEv.prob >= 1.0) ? true : (Math.random() < curEv.prob);
                    if (trigger) {
                        this.cv = curEv.cv ?? 0;
                        this.gap = minGapSamples;
                    } else {
                        curEv = null;
                    }
                }
            }

            if (this.gap > 0) {
                this.gap--;
                this.gate = 0.0;
            } else if (curEv && !curEv.isRest) {
                const evDur = curEv.end - curEv.start;
                const evProg = (this.phase - curEv.start) / Math.max(0.0001, evDur);
                const gRatio = this.gateLen ?? 0.80;
                this.gate = (evProg < gRatio) ? 1.0 : 0.0;
            } else {
                this.gate = 0.0;
            }

            if (cvOut) cvOut[i] = this.cv;
            if (gOut) gOut[i] = this.gate;
        }

        this.postCounter += len;
        if (this.running && this.postCounter >= 256) {
            this.postCounter = 0;
            this.port.postMessage({
                type: 'PLAYHEAD',
                phase: this.phase,
                cycleCount: this.cycleCount,
                activeIdx: this.activeIdx
            });
        }

        return true;
    }
}

registerProcessor('pat-processor', PatProcessor);

