export class MarkovProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.state = 0;
        this.initOn = false;
        this.stateVal = 0.0;
        this.stayWeight = 10;
        this.weights = [0, 0, 0, 0];
        this.holdClocks = 1;
        this.clockCount = 0;
        this.clkActive = false;
        this.trigOutCh = -1;
        this.shotActive = false;

        this.port.onmessage = e => {
            if (e.data.type === 'SET_STATE') {
                if (e.data.initOn !== undefined) this.initOn = !!e.data.initOn;
                if (e.data.state !== undefined) this.state = e.data.state ? 1 : 0;
                if (e.data.stateVal !== undefined) this.stateVal = e.data.stateVal;
                if (e.data.stayWeight !== undefined) this.stayWeight = e.data.stayWeight;
                if (e.data.weights) this.weights = e.data.weights;
                if (e.data.holdClocks !== undefined) this.holdClocks = Math.max(1, Math.round(e.data.holdClocks));
            } else if (e.data.type === 'TRIGGER_TOGGLE') {
                this.state = this.state ? 0 : 1;
                this.clockCount = 0;
                this.trigOutCh = -1;
                this.clkActive = false;
                this.shotActive = false;
                this.port.postMessage({ type: 'STATE_CHANGED', state: this.state });
            } else if (e.data.type === 'RESET') {
                this.state = this.initOn ? 1 : 0;
                this.clockCount = 0;
                this.trigOutCh = -1;
                this.clkActive = false;
                this.shotActive = false;
                this.port.postMessage({ type: 'STATE_CHANGED', state: this.state });
            }
        };
    }

    process(ins, outs) {
        const inClk = ins[0]?.[0];
        const inTrig = ins[1]?.[0];

        const o1 = outs[0]?.[0], o2 = outs[1]?.[0], o3 = outs[2]?.[0], o4 = outs[3]?.[0];
        const cvOut = outs[4]?.[0], gtOut = outs[5]?.[0], stepGtOut = outs[6]?.[0];
        const outArr = [o1, o2, o3, o4];
        const len = 128;

        for (let i = 0; i < len; i++) {
            const clkV = inClk ? inClk[i] : 0.0;
            const trigV = inTrig ? inTrig[i] : 0.0;
            const isClkHi = clkV >= 0.5;

            // 1. 他ノードからの遷移トリガー受信（バトン受け口）
            if (trigV >= 0.5) {
                if (this.state === 0) {
                    this.state = 1;
                    this.clockCount = 1;
                    this.clkActive = true; // 現在の立ち上がり拍でバトンを受け取ったので同拍での即時遷移を防止
                    this.shotActive = true; // ノード発行時のワンショットトリガーをこの拍で発火
                    this.port.postMessage({ type: 'STATE_CHANGED', state: 1 });
                }
            }

            // 2. クロック入力の立ち下がり検知（ロック解除・トリガー消灯）
            if (clkV < 0.3) {
                this.clkActive = false;
                this.trigOutCh = -1;
                this.shotActive = false; // 1拍のクロック終了でワンショットトリガー消灯
            }

            // 3. クロック立ち上がり検知と状態遷移
            const isRising = (isClkHi && !this.clkActive);
            if (isRising) {
                this.clkActive = true;

                if (this.state === 1) {
                    if (this.clockCount === 0) {
                        // 初期起動ノードの第1拍目
                        this.clockCount = 1;
                        this.shotActive = true; // 初回発行時のワンショットトリガー発火
                    } else {
                        // 最低保持クロック数（holdClocks）に達している場合、確率遷移を判定
                        if (this.clockCount >= this.holdClocks) {
                            let totalW = Math.max(0, this.stayWeight);
                            for (let k = 0; k < 4; k++) {
                                totalW += Math.max(0, this.weights[k] || 0);
                            }

                            if (totalW > 0) {
                                const r = Math.random() * totalW;
                                let acc = Math.max(0, this.stayWeight);
                                if (r >= acc) {
                                    let chosen = -1;
                                    for (let k = 0; k < 4; k++) {
                                        acc += Math.max(0, this.weights[k] || 0);
                                        if (r < acc) {
                                            chosen = k;
                                            break;
                                        }
                                    }
                                    if (chosen !== -1) {
                                        // 即座に次ノードへ遷移！
                                        this.state = 0;
                                        this.clockCount = 0;
                                        this.trigOutCh = chosen;
                                        this.shotActive = false;
                                        this.port.postMessage({ type: 'STATE_CHANGED', state: 0 });
                                    }
                                }
                            }
                        }

                        // 遷移せず留まる場合、滞在クロック数を加算
                        if (this.state === 1) {
                            this.clockCount++;
                        }
                    }
                }
            }

            // 4. トリガ出力（trig_out1..4）: クロックHighの間、遷移先ポートへパルス出力
            for (let k = 0; k < 4; k++) {
                const outCh = outArr[k];
                if (outCh) {
                    outCh[i] = (this.trigOutCh === k && isClkHi) ? 1.0 : 0.0;
                }
            }

            // 5. CV出力（cv_out）: アクティブ時は音程CV、次クロック立ち上がりまで保持
            if (cvOut) {
                cvOut[i] = this.state === 1 ? this.stateVal : 0.0;
            }

            // 6. 持続ゲート出力（gate_out）: 次に遷移するまでずっとON（1.0V）
            if (gtOut) {
                gtOut[i] = this.state === 1 ? 1.0 : 0.0;
            }

            // 7. ワンショットトリガ出力（step_gate）:
            // ノードがアクティブ（発行）された最初の拍に、入力トリガー（クロックHigh）と同じ時間だけ1.0Vを出力
            if (stepGtOut) {
                stepGtOut[i] = (this.state === 1 && this.shotActive && isClkHi) ? 1.0 : 0.0;
            }
        }

        return true;
    }
}

registerProcessor('markov-processor', MarkovProcessor);

