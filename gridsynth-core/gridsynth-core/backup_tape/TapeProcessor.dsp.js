// [BACKUP] TapeProcessor DSP implementation for AudioWorklet
// Originally in src/dsp/worklet-code.js

class TapeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = null;
        this.bufferLen = 0;
        this.playHead = 0.0;
        this.isPlaying = false;
        this.startRatio = 0.0;
        this.endRatio = 1.0;
        this.baseSpeed = 1.0;
        this.loop = false;
        this.lastTrig = false;
        this.msgCounter = 0;
        this.fadeGain = 1.0;

        this.port.onmessage = e => {
            const d = e.data;
            if (!d) return;
            if (d.type === 'SET_BUFFER') {
                this.buffer = d.buffer;
                this.bufferLen = this.buffer ? this.buffer.length : 0;
                this.playHead = 0.0;
            } else if (d.type === 'SET_PARAMS') {
                if (d.start !== undefined) this.startRatio = Math.max(0, Math.min(1, Number(d.start) || 0));
                if (d.end !== undefined) {
                    this.endRatio = Math.max(0, Math.min(1, Number(d.end) || 0));
                } else if (d.length !== undefined) {
                    this.endRatio = Math.max(0, Math.min(1, this.startRatio + (Number(d.length) || 1)));
                }
                if (d.speed !== undefined) this.baseSpeed = Number(d.speed) ?? 1.0;
                if (d.loop !== undefined) this.loop = !!d.loop;
            } else if (d.type === 'TRIGGER') {
                this.triggerPlay(d.startCv || 0, d.lenCv || 0);
            } else if (d.type === 'STOP') {
                this.isPlaying = false;
            }
        };
    }

    triggerPlay(startCv = 0, lenCv = 0) {
        if (!this.bufferLen) return;
        const effStart = Math.max(0, Math.min(1.0, this.startRatio + startCv));
        const effEnd = Math.max(0, Math.min(1.0, this.endRatio + lenCv));
        if (Math.abs(effStart - effEnd) < 0.001) return;

        this.playHead = effStart * this.bufferLen;
        this.isPlaying = true;
        this.fadeGain = 0.0; // マイクロフェードインでトリガー時のクリックスパイクを防止
    }

    process(ins, outs) {
        const inTrig = ins[0]?.[0];
        const inStart = ins[1]?.[0];
        const inLen = ins[2]?.[0];
        const inSpeed = ins[3]?.[0];

        const outWave = outs[0]?.[0];
        const outGate = outs[1]?.[0];
        const len = 128;

        for (let i = 0; i < len; i++) {
            const trgV = inTrig ? inTrig[i] : 0.0;
            const isTrigHi = trgV >= 0.5;
            const startCv = inStart ? inStart[i] : 0.0;
            const lenCv = inLen ? inLen[i] : 0.0;
            const speedCv = inSpeed ? inSpeed[i] : 0.0;

            // 1. トリガ立ち上がり検出
            if (isTrigHi && !this.lastTrig) {
                this.triggerPlay(startCv, lenCv);
            }
            this.lastTrig = isTrigHi;

            if (!this.isPlaying || !this.bufferLen) {
                if (outWave) outWave[i] = 0.0;
                if (outGate) outGate[i] = 0.0;
                continue;
            }

            // 2. 実効パラメーター計算
            const effStartRatio = Math.max(0, Math.min(1.0, this.startRatio + startCv));
            const effEndRatio = Math.max(0, Math.min(1.0, this.endRatio + lenCv));
            const startSample = effStartRatio * this.bufferLen;
            const endSample = effEndRatio * this.bufferLen;
            if (Math.abs(startSample - endSample) < 10) {
                this.isPlaying = false;
                if (outWave) outWave[i] = 0.0;
                if (outGate) outGate[i] = 0.0;
                continue;
            }

            const effSpeed = this.baseSpeed + speedCv;
            const absSpeed = Math.abs(effSpeed);
            if (absSpeed < 0.0001) {
                // 速度ゼロ時は静止かつDCオフセット出力防止
                if (outWave) outWave[i] = 0.0;
                if (outGate) outGate[i] = 0.0;
                continue;
            }

            // 向き判定: 選択範囲の方向 × 速度の正負
            const rangeForward = startSample <= endSample;
            const speedForward = effSpeed >= 0;
            const isReverse = rangeForward ? !speedForward : speedForward;

            // 3. サンプル読み出し（線形補間）
            const pos = this.playHead;
            const i0 = Math.floor(pos);
            const frac = pos - i0;
            const s0 = (i0 >= 0 && i0 < this.bufferLen) ? this.buffer[i0] : 0.0;
            const s1 = (i0 + 1 >= 0 && i0 + 1 < this.bufferLen) ? this.buffer[i0 + 1] : s0;
            const rawSample = s0 + frac * (s1 - s0);

            // マイクロフェードイン（約2msでスムーズに立ち上がり）
            if (this.fadeGain < 1.0) {
                this.fadeGain = Math.min(1.0, this.fadeGain + 0.02);
            }
            const sampleVal = rawSample * this.fadeGain;

            if (outWave) outWave[i] = sampleVal;
            if (outGate) outGate[i] = 1.0;

            // 4. 再生ヘッド移動
            if (isReverse) {
                this.playHead -= absSpeed;
                const bound = Math.min(startSample, endSample);
                if (this.playHead <= bound) {
                    if (this.loop) {
                        this.playHead = Math.max(startSample, endSample);
                        this.fadeGain = 0.0; // ループ折り返し時のクリックノイズ防止
                    } else {
                        this.isPlaying = false;
                    }
                }
            } else {
                this.playHead += absSpeed;
                const bound = Math.max(startSample, endSample);
                if (this.playHead >= bound) {
                    if (this.loop) {
                        this.playHead = Math.min(startSample, endSample);
                        this.fadeGain = 0.0; // ループ折り返し時のクリックノイズ防止
                    } else {
                        this.isPlaying = false;
                    }
                }
            }
        }

        // UI用進捗通知（約46ms周期）
        this.msgCounter++;
        if (this.msgCounter >= 16) {
            this.msgCounter = 0;
            if (this.bufferLen > 0) {
                const normPos = Math.max(0, Math.min(1, this.playHead / this.bufferLen));
                this.port.postMessage({ type: 'PLAY_STATUS', isPlaying: this.isPlaying, pos: normPos });
            }
        }

        return true;
    }
}
registerProcessor('tape-processor', TapeProcessor);

