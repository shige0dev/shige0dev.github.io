# TAPE モジュール 実装バックアップ

このディレクトリは、GRIDSYNTHの **TAPEモジュール**（サンプラー／テープループモジュール）の一時退避用バックアップです。  
ユーザーの指示により、**AI開発の対象から除外**されています。

---

## 含まれるファイル

1. `TapeProcessor.dsp.js`
   - AudioWorklet 内の DSP 実装 (`tape-processor`)
   - マイクロフェード、速度・方向制御、DCオフセット防止、再生ヘッド位置の postMessage 通知

2. `tape_audio_registry.js`
   - オーディオグラフ側の定義 (`AUDIO_REGISTRY.TAPE`)
   - `AudioWorkletNode` の生成、4入力（trig_in, start_cv, len_cv, speed_cv）、2出力（wave_out, gate_out）
   - バッファ管理、パラメータ更新

3. `tape_module_registry.js`
   - UI・フロントエンド定義 (`MODULE_REGISTRY.TAPE`)
   - カセットリールアニメーション、波形スプライン描画、デュアルハンドル、拡大縮小ズーム、ファイル読み込み

---

## 将来再開する場合の手順

もし TAPE モジュールを再開する場合：

1. **`src/dsp/worklet-code.js`**:
   `TapeProcessor.dsp.js` の内容を `registerProcessor('markov-processor', ...);` の下に追加。

2. **`src/audio/registry.js`**:
   `tape_audio_registry.js` の `TAPE_AUDIO_ENTRY` を `AUDIO_REGISTRY` 内に `TAPE: ...` として追加。

3. **`src/modules/registry.js`**:
   `tape_module_registry.js` の `TAPE_MODULE_ENTRY` を `MODULE_REGISTRY` 内に `TAPE: ...` として追加。

4. **`src/audio/engine.js`**:
   `audioWorkletReady` のチェック対象リストおよび停止処理に `'TAPE'` を追加。

5. **`src/ui/controller.js`**:
   `openSettingsModal` や `liveTypes` に `'TAPE'` を追加。

