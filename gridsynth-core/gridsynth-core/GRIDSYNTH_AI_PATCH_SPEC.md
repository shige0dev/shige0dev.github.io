# Gridsynth AI Patch Generation & Composition Specification (v2.0)
> **For AI Assistants (ChatGPT, Claude, Gemini, Cursor, Copilot, etc.)**
> 本仕様書は、AIが **Gridsynth**（Webベース 5×8 モジュラーシンセサイザー）用のパッチデータ（JSON形式）を自律的かつエラーなく設計・作曲・出力するための完全リファレンス仕様書です。
> 人間向けの解説は最小限に留め、構文規則、スキーマ定義、ポート仕様、計算式、および即時利用可能なパッチレシピを中心に構成されています。

---

## 1. 概要 (Overview)

- **グリッド構成**: 横5列 × 縦8行 = 計40スロット（インデックス `0` 〜 `39`）
- **パッチデータ形式**: **完全な単一 JSON オブジェクト**
- **再生方式**: クロック（`CLK`）またはシーケンサー（`SEQ` / `PAT` / `MARKOV`）駆動のリアルタイムWeb Audio / AudioWorklet合成
- **電圧規格**: 
  - オーディオ信号: ±1.0V (0dBFS基準)
  - ピッチCV: 1V/Oct (1.0V = 1オクターブ / 1半音 = 1/12V ≈ 0.08333V)
  - ゲート/トリガー: 0.0V (Low) / 1.0V (High)
  - 変調CV: 0.0V 〜 1.0V (Unipolar) または -1.0V 〜 +1.0V (Bipolar)

---

## 2. トップレベル JSON 構造 (Patch JSON Schema)

AIが出力するパッチは、必ず以下の厳密なスキーマ構造に従う必要があります。

```json
{
  "bpm": 126,
  "pages": {
    "0": {
      "name": "Main",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "VCO1",
        "3": "VCF1",
        "4": "SPK1"
      },
      "modules": {
        "CLK1": { "type": "CLK", "div": "x2", "pulseWidthMs": 15 },
        "SEQ1": { "type": "SEQ", "quantize": true, "steps": [ ... ] },
        "VCO1": { "type": "VCO", "wave": "sawtooth", "freq1": 110, "channels": 1 },
        "VCF1": { "type": "VCF", "filterType": "lowpass", "cutoff": 800, "q": 4.0, "modDepth": 2000 },
        "SPK1": { "type": "SPK", "masterVol": 0.16 }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "SEQ1:cv_out > VCO1:cv_in",
        "VCO1:wave_out > VCF1:wave_in",
        "VCF1:wave_out > SPK1:wave_in_l",
        "VCF1:wave_out > SPK1:wave_in_r"
      ]
    }
  }
}
```

### フィールド定義
| フィールド | 型 | 制約 / 範囲 | デフォルト | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **`bpm`** | `number` | `40` 〜 `260` | `120` | グローバルテンポ |
| **`pages`** | `object` | ページID (`"0"`, `"1"` ...) をキーとするマップ | - | ページ構造 |
| **`pages["0"].name`** | `string` | 任意の文字列 | `"Main"` | ページ名 |
| **`pages["0"].slots`** | `object` | キー: `"0"` 〜 `"39"`, 値: モジュールID | `{}` | グリッドスロット配置 |
| **`pages["0"].modules`** | `object` | キー: モジュールID, 値: パラメータオブジェクト | `{}` | モジュール実体 |
| **`pages["0"].connections`** | `array` | 短縮接続文字列の配列 | `[]` | ケーブル結線リスト |

---

## 3. グリッド配置とスロット番号ルール (Grid & Slot System)

グリッドは **横5列 × 縦8行** の全40スロットです。

```
       Col 0   Col 1   Col 2   Col 3   Col 4
Row 0:  [ 0]    [ 1]    [ 2]    [ 3]    [ 4]  <- [4] に SPK1 を置くと綺麗
Row 1:  [ 5]    [ 6]    [ 7]    [ 8]    [ 9]
Row 2:  [10]    [11]    [12]    [13]    [14]
Row 3:  [15]    [16]    [17]    [18]    [19]
Row 4:  [20]    [21]    [22]    [23]    [24]
Row 5:  [25]    [26]    [27]    [28]    [29]
Row 6:  [30]    [31]    [32]    [33]    [34]
Row 7:  [35]    [36]    [37]    [38]    [39]
```

### スロット計算式
$$\text{slotIndex} = \text{row} \times 5 + \text{col} \quad (0 \le \text{row} \le 7, \quad 0 \le \text{col} \le 4)$$

- **厳格ルール**:
  1. **重複禁止**: 同一スロット番号に複数のモジュールを割り当ててはなりません（スロットは1対1対応）。
  2. **スロット指定必須**: `modules` に定義したすべてのモジュールIDは、必ず `slots` のいずれかの番号にマッピングされていなければなりません。
- **推奨レイアウト**:
  - `Col 0` 〜 `Col 1`: クロック・シーケンサー（`CLK`, `SEQ`, `PAT`, `MARKOV`）
  - `Col 2` 〜 `Col 3`: 音源・フィルター・エンベロープ（`VCO`, `NOISE`, `VCF`, `ADSR`, `VCA`）
  - `Col 4`: ミキサー・エフェクト・スピーカー（`MIX`, `DELAY`, `REVERB`, `SPK`）

---

## 4. ケーブル結線（Connection）の厳格ルール

`connections` 配列の書式:
```
"送信元モジュールID:送信元ポート名 > 送信先モジュールID:送信先ポート名"
```

### 接続の鉄則
1. **方向の厳守（出力 > 入力）**:
   - `>` の左側は必ず **出力ポート (out)**、右側は必ず **入力ポート (in)** でなければなりません（逆方向は不可）。
2. **自己ループ禁止**:
   - 同一モジュール内の出力から入力への直結（例: `"DELAY1:wave_out > DELAY1:wave_in"`）は禁止です。
3. **1出力からの分岐（スプリット / マルチプル）: 【完全許可】**:
   - 1つの出力ポートから複数の入力ポートへ分岐接続することは**完全に可能**です。
   - 例: クロック分配
     ```json
     "CLK1:gate_out > SEQ1:gate_in",
     "CLK1:gate_out > ADSR1:gate_in"
     ```
   - 例: エンベロープ分配（フィルターとVCAを同時に動かす）
     ```json
     "ADSR1:cv_out > VCF1:cv_in",
     "ADSR1:cv_out > VCA1:cv_in"
     ```
4. **1入力への複数出力接続（サミング）のルール**:
   - **オーディオ信号（`wave_out`）**: **直接の多重接続は禁止**。2つ以上のオーディオ信号をまとめる場合は、必ず `MIX` モジュールを経由してください（音割れ・位相干渉防止）。
   - **CV信号（ピッチCV / 変調CV）**: 直接多重接続すると電圧が加算（サミング）されます。複雑な演算を行う場合は `MATH1` または `MATH2` の使用を推奨します。
5. **最終出力の結線義務**:
   - 音を鳴らすには、必ず `SPK1:wave_in_l` および `SPK1:wave_in_r` にオーディオ信号が接続されていなければなりません。

---

## 5. モジュール完全辞書 (Module Catalog)

各モジュールの全パラメータの型、許容範囲、デフォルト値、ポート仕様です。

### 5.1 音源モジュール (Sound Sources)

#### `VCO` (アナログオシレーター)
- **入力ポート**:
  - `cv_in` (1V/Oct ピッチCV入力 / ボイス1)
  - `cv_in2`, `cv_in3`, `cv_in4` (ボイス2〜4用ピッチCV / `channels > 1` 時)
  - `sync_in` (オシレーター同期入力)
- **出力ポート**: `wave_out` (オーディオ)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `channels` | `number` | `1`, `2`, `3`, `4` | `1` | ボイス数（和音時は `4`） |
  | `wave` | `string` | `"sawtooth"`, `"square"`, `"triangle"`, `"sine"` | `"sawtooth"` | 波形 |
  | `freq1` | `number` | `20` 〜 `2000` | `220` | ボイス1基準周波数(Hz) |
  | `freq2` | `number` | `20` 〜 `2000` | `220` | ボイス2基準周波数(Hz) |
  | `freq3` | `number` | `20` 〜 `2000` | `220` | ボイス3基準周波数(Hz) |
  | `freq4` | `number` | `20` 〜 `2000` | `220` | ボイス4基準周波数(Hz) |
  | `quantize` | `boolean` | `true`, `false` | `false` | 半音クオンタイズ有効化 |

#### `NOISE` (ノイズジェネレーター)
- **入力ポート**: なし
- **出力ポート**: `wave_out` (オーディオ)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `noiseType` | `string` | `"white"`, `"pink"`, `"brown"` | `"white"` | ノイズ色 |
  | `tone` | `number` | `200` 〜 `16000` | `8000` | 内部LPFカットオフ(Hz) |
  | `level` | `number` | `0.0` 〜 `1.0` | `0.8` | 出力音量 |

#### `FOLD` (ウェーブフォルダー)
- **入力ポート**: `cv_in` (ピッチCV), `fold_cv` (フォールド変調CV)
- **出力ポート**: `wave_out` (オーディオ)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `wave` | `string` | `"sine"`, `"triangle"` | `"sine"` | 原波形 |
  | `fold` | `number` | `0.0` 〜 `5.0` | `1.5` | 倍音折り返し量 |
  | `bias` | `number` | `-2.0` 〜 `2.0` | `0.0` | DC対称性オフセット |

#### `FM` (3オペレーター FM音源・パーカッションジェネレーター)
各オペレータに独立したADSR（EXP/LIN/LOGカーブ対応）を内包した3オペレータ位相変調（PM）音源。キック、スネア、ハイハット、タム、金属音、ディープベースに最適。

- **入力ポート**:
  - `gate_in` (ゲート/トリガー入力: 3つの内包ADSRを同時にトリガー。ノートオン時に位相リセットして打撃パンチを安定化)
  - `pitch_in` (1V/Oct ピッチCV入力: 全オペレータがRatio比を保ったまま追従。別名 `cv_in` も接続可能)
- **出力ポート**:
  - `wave_out` (オーディオ出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `algorithm` | `number` | `1`, `2`, `3`, `4` | `1` | トポロジーアルゴリズム |
  | `rootMidi` | `number` | `24` 〜 `72` | `48` | 基準音程（MIDIノート番号: 48 = C3 130.8Hz） |
  | `op1` | `object` | `{ ratio, level, attack, decay, sustain, release, curve }` | - | 主キャリア（出力ボリューム） |
  | `op2` | `object` | `{ ratio, level, attack, decay, sustain, release, curve }` | - | モジュレータ 1 / 副キャリア（変調指数） |
  | `op3` | `object` | `{ ratio, level, feedback, wave, attack, decay, sustain, release, curve }` | - | モジュレータ 2（最上段変調指数） |

- **4つのトポロジー (Algorithms)**:
  - `1`: **直列スタック型 (Cascade)**: `Op3 ➔ Op2 ➔ Op1 ➔ OUT`（金属音、スネア、強打撃音、ディープFMベース）
  - `2`: **並列変調・Y字型 (Dual Modulator)**: `(Op3 + Op2) ➔ Op1 ➔ OUT`（キック、タム、カウベル、コンガ）
  - `3`: **2キャリア分岐型 (Split Carrier)**: `Op3 ➔ (Op2 + Op1) ➔ OUT`（ベル、エレピ、ブラス、和音リード）
  - `4`: **独立FM + サブベース型 (Hybrid)**: `(Op3 ➔ Op2) + Op1 ➔ OUT`（ダンス系キック、808/909パンチベース）
- **Op3の波形モード (`op3.wave`)**:
  - `"sine"`: サイン波（`feedback`: 0.0〜1.0 で自己変調）
  - `"noise"`: ホワイトノイズ（スネアのスナッピー、ハイハットの擦れ音、打撃アタックノイズをFMだけで生成可能）
- **オペレータ内包ADSR**:
  - `curve`: `"exp"` (指数減衰 / キレのあるパーカッション), `"lin"` (直線), `"log"` (対数)
  - `attack` (0.0005〜2.0s), `decay` (0.005〜3.0s), `sustain` (0.0〜1.0), `release` (0.005〜5.0s)

---

### 5.2 フィルター & アンプ (Processors)

#### `VCF` (ボルテージコントロールド・フィルター)
- **入力ポート**: `wave_in` (オーディオ入力), `cv_in` (カットオフ変調CV)
- **出力ポート**: `wave_out` (オーディオ出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `filterType` | `string` | `"lowpass"`, `"highpass"`, `"bandpass"`, `"notch"` | `"lowpass"` | フィルター種別 |
  | `cutoff` | `number` | `20` 〜 `20000` | `1000` | 基本カットオフ(Hz) |
  | `q` | `number` | `0.5` 〜 `20.0` | `1.0` | レゾナンス（Q値） |
  | `modDepth` | `number` | `0` 〜 `10000` | `2000` | CV変調深度(Hz) |

#### `VCA` (アンプ / ゲート)
- **入力ポート**: `wave_in` (オーディオ入力), `cv_in` (ゲイン制御CV)
- **出力ポート**: `wave_out` (オーディオ出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `level` | `number` | `0.0` 〜 `1.0` | `0.0` | 初期ゲインバイアス（※ADSR駆動時は `0.0` に設定） |
  | `cvDepth` | `number` | `0.0` 〜 `2.0` | `1.0` | CV入力に対するゲイン感度 |

---

### 5.3 変調 & エンベロープ (Modulators)

#### `ADSR` (4ステージ・エンベロープ)
- **入力ポート**: `gate_in` (ゲート / トリガーパルス入力)
- **出力ポート**: `cv_out` (0.0V〜1.0V CV出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `attack` | `number` | `0.001` 〜 `2.0` | `0.02` | アタック時間(秒) |
  | `decay` | `number` | `0.001` 〜 `2.0` | `0.2` | ディケイ時間(秒) |
  | `sustain` | `number` | `0.0` 〜 `1.0` | `0.6` | サスティン保持レベル |
  | `release` | `number` | `0.001` 〜 `5.0` | `0.4` | リリース減衰時間(秒) |
  | `attackCurve` | `number` | `-1.0` 〜 `1.0` | `0.0` | アタック曲線 (-1:指数, 0:直線, 1:対数) |
  | `decayCurve` | `number` | `-1.0` 〜 `1.0` | `0.0` | ディケイ曲線 |
  | `releaseCurve`| `number` | `-1.0` 〜 `1.0` | `0.0` | リリース曲線 |

#### `LFO` (低周波オシレーター)
- **入力ポート**: `reset` (位相リセットトリガー), `cv_in` (レート変調入力: 1Vあたり +2.0Hz)
- **出力ポート**: `cv_out` (CV出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `waveType` | `string` | `"sine"`, `"triangle"`, `"sawtooth"`, `"ramp"`, `"square"` | `"sine"` | LFO波形 |
  | `polarity` | `string` | `"bipolar"` (±Depth), `"unipolar"` (0〜+Depth) | `"bipolar"` | 出力極性 |
  | `syncMode` | `string` | `"free"` (Hz指定), `"sync"` (BPM音符同期) | `"free"` | 動作モード |
  | `rate` | `number` | `0.05` 〜 `30.0` | `2.0` | フリー時周波数(Hz) |
  | `division` | `string` | `"4/1"`, `"2/1"`, `"1/1"`, `"1/2"`, `"1/4"`, `"1/8"`, `"1/16"`, `"1/32"`, `"1/4T"`, `"1/8T"`, `"1/4D"`, `"1/8D"` | `"1/4"` | 同期時音符 |
  | `depth` | `number` | `0.0` 〜 `5.0` | `1.0` | 出力振幅ボルト |
  | `duty` | `number` | `0.01` 〜 `0.99` | `0.5` | デューティ比 |
  | `phase` | `number` | `0` 〜 `360` | `0` | 初期位相(度) |

---

### 5.4 シーケンサー & 演奏 (Sequencers & Controllers)

#### `CLK` (マスタークロック)
- **入力ポート**: なし
- **出力ポート**: `gate_out` (クロックパルス出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `div` | `string` | `"/16"`, `"/8"`, `"/7"`, `"/6"`, `"/5"`, `"/4"`, `"/3"`, `"/2"`, `"x1"`, `"x2"`, `"x3"`, `"x4"`, `"x5"`, `"x6"`, `"x7"`, `"x8"`, `"x16"` | `"x2"` | テンポ乗除比（分周 `"/16"` 〜 乗算 `"x16"`） |
  | `pulseWidthMs`| `number` | `1` 〜 `500` | `15` | トリガーパルス幅(ms) |
  | `limitPct` | `number` | `10` 〜 `90` | `90` | クロック周期に対する最大パルス幅上限比率（%） |
- **`div` の音楽的目安（AIパッチ設計用）**:
  - `"/16"`: 4小節ごと（超低速マクロ周期・セクション切り替え）
  - `"/8"`: 2小節ごと（スロー・コード進行ブロック）
  - `"/4"`: 1小節ごと（全音符・コード進行の切り替え）
  - `"/2"`: 2分音符（ハーフビート）
  - `"x1"`: 4分音符（1拍・キック基準）
  - `"x2"`: 8分音符（デフォルト・標準的なリフ速度）
  - `"x4"`: 16分音符（アシッドベースライン、高速アルペジオ）
  - `"x8"`: 32分音符（トラップ風ハイハットロール）
  - `"x16"`: 64分音符（超高速ラチェット・グリッチ・オーディオレート近傍）

#### `SEQ` (ステップシーケンサー)
- **入力ポート**: `gate_in` (クロックパルス受信)
- **出力ポート**: `cv_out` (ピッチCV), `gate_out` (ステップゲート)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `quantize` | `boolean` | `true`, `false` | `true` | 1V/Oct半音クオンタイズ |
  | `steps` | `array` | 要素数 **8個** の配列 | - | 8ステップの定義 |
- **可変長ステップの作り方**:
  - 配列長は常に8固定ですが、各ステップの `active: false` に設定されたステップは**自動的にスキップ**されます。
  - 例: 4ステップでループさせたい場合: ステップ0〜3の `active: true`、ステップ4〜7の `active: false` とします。
- **ステップオブジェクトの構造**:
  ```json
  { "cv": 0.25, "active": true, "cvActive": true, "gate": true }
  ```
  - `cv` (`number`): 電圧 (0.0=C1, 1.0=C2, 2.0=C3)。
  - `active` (`boolean`): ステップが存在するか（`false` でスキップ）。
  - `cvActive` (`boolean`): ピッチCVを更新するか（`false` でタイ/前の音程保持）。
  - `gate` (`boolean`): ゲートを出力するか（`false` で休符）。
- **音域制限とオクターブチェンジ（重要作法）**:
  - `SEQ` の各ステップで指定できる電圧は **`0.0V` 〜 `3.0V`（約3オクターブ：C1〜C4）** です。
  - シーケンスをより高い音域へオクターブチェンジさせたり、演奏中に曲のキーをリアルタイム移調（トランスポーズ）したい場合は、**`KEY`（キーボード）モジュールの `cv_out` を同じ `VCO:cv_in`（または `CHORD:cv_in`）へ合流（サミング）接続し、キーボードを押して電圧をかさ上げ（+1.0V ごとに1オクターブ上昇）** させてください（詳細は第6.2節参照）。

#### `KEY` (オンスクリーン・キーボード)
画面上のピアノロール鍵盤をタップして手動メロディ演奏やトランスポーズ電圧を供給するコントローラーです。
- **入力ポート**: なし
- **出力ポート**:
  - `cv_out`: 押下鍵盤のピッチCV (1V/Oct)
  - `gate_out`: キー押下ゲート
- **パラメータ**:
  | キー | 型 | 範囲 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `octave` | `number` | `1` 〜 `7` | `4` | キーボードの基準オクターブ |
- **主な役割**:
  1. 手動のリアルタイム鍵盤演奏
  2. `SEQ` とピッチCVを合流させて、シーケンスのリアルタイム・オクターブチェンジ / キー移調を行う

#### `PAT` (アルゴリズム・パターンシーケンサー / Strudel風)
- **入力ポート**: なし（BPMおよび再生状態に自動同期）
- **出力ポート**: `cv_out` (ピッチCV), `gate_out` (ゲート)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `pattern` | `string` | Strudel/TidalCycles パターン文字列 | `"c2 e2 g2 b2"` | 演奏パターン |
  | `cycleBeats`| `number` | `1`, `2`, `4`, `8` | `4` | 1サイクルの拍数 |
  | `gateLen` | `number` | `0.05` 〜 `0.95` | `0.80` | ノートゲート比率 |
- **有効な構文仕様**:
  - 音名: `c1` 〜 `b6`（大文字・小文字両対応）
  - 臨時記号: シャープ `c#2` / `cs2`、フラット `eb2` / `e_2`
  - 休符: `~`
  - サブディビジョン（分割）: `[c2 g2]` (1拍を2分割)、`[c2 [eb2 g2]]` (入れ子分割)
  - アルペジオ / 連打: `c2*2` (1拍で2回連打)
  - 和音: `[c2,e2,g2]` (同一拍のボイス重なり)

#### `MARKOV` (マルコフ連鎖プロバビリティシーケンサー)
確率的・アルゴリズム的に状態遷移を繰り返し、終わりのない音楽的フレーズを生成します。
本モジュールは**「1モジュール＝1つの状態（ノード）」**として機能するため、**基本的には2個以上のMARKOVを相互に結線して使用します**。

- **入力ポート**:
  - `clk_in`: クロックパルス入力（状態の維持拍数カウント）
  - `transition_in`: **マルコフ連鎖専用・遷移トリガー入力**（他ノードの `transition_out1..4` からバトンを受け取る入力ポート。旧名 `trig_in` も互換性あり。外部シーケンサー `SEQ:gate_out` から接続して連鎖再開のマスターきっかけとすることも可能）
- **出力ポート**:
  - `cv_out`: ピッチCV出力（このノードがアクティブな時のピッチ電圧）
  - `gate_out` (または `gt_out`): **持続ゲート出力**（ノードがアクティブ（点灯）になってから、**次に他の状態へ遷移するまでずっとON（1.0V）**を維持。持続音やレガート演奏、ロングトーン用エンベロープに最適）
  - `trig_out`: **発音用ワンショットトリガー出力**（ノードがアクティブ（発行）された**最初の1拍目のみ、入力クロックと同じパルス時間だけON（1.0V）**を出力。ホールド期間中や留まっている間は2拍目以降 0V を維持。単発発音やADSRトリガーに最適。旧名 `step_gate` も互換性あり）
  - `transition_out1` 〜 `transition_out4`: **マルコフ連鎖専用・次状態遷移用トリガー**（各ブランチへ遷移した瞬間に、選ばれたポートから次ノードへバトンを渡すパルスを出力。旧名 `trig_out1`〜`4` も互換性あり）
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `rootMidi` | `number` | `24` 〜 `96` | `60` | **出力ピッチ（MIDIノート番号）**。`cv_out` から `(rootMidi - 24) / 12.0` の 1V/Oct CV を出力（例: 48=C3, 51=Eb3, 55=G3, 60=C4） |
  | `quantize` | `boolean` | `true`, `false` | `true` | 半音クオンタイズ有効化（`true` で `rootMidi` を使用） |
  | `stateVal` | `number` | `0.0` 〜 `5.0` | `1.0` | `quantize: false` 時に直接出力する生CV電圧 |
  | `stayWeight` | `number` | `1` 〜 `20` | `10` | 現在の状態に留まる確率の重み |
  | `holdClocks` | `number` | `1` 〜 `16` | `1` | 1回の遷移で何拍保持するか |
  | `initOn` | `boolean` | `true`, `false` | `false` | リセット時にアクティブ状態で開始するか（**ネットワーク内で通常1台のみ `true`、他は `false`**） |
  | `weights` | `array` | 長さ4の数値配列 (`0`〜`20`) | `[5, 5, 5, 5]` | 各ブランチへの遷移確率ウェイト |

- **【最重要】ポートと結線ルール**:
  - **マルコフ連鎖専用の遷移結線（`transition_out` ➔ `transition_in`）**:
    `transition_out1..4` および `transition_in` は**マルコフ連鎖同士のバトン渡し専用**です。
    - `weights[0]` ➔ `transition_out1`
    - `weights[1]` ➔ `transition_out2`
    - `weights[2]` ➔ `transition_out3`
    - `weights[3]` ➔ `transition_out4`
    ※ 互換性のため、旧仕様の `trig_out1..4` および `trig_in` という記述も同一ポートとして自動解釈されます。
  - **未結線の扱いとシーケンサーからの再開きっかけ**:
    結線されていない `transition_out` に対応する枝が選ばれた場合、トリガーはどこにも伝達されず**連鎖はその場で停止（休止状態）**します。
    `transition_in` は基本的にマルコフ連鎖専用ですが、**ステップシーケンサー（`SEQ:gate_out`）等から `transition_in` へ結線**することで、休止したマルコフ連鎖を小節の頭などで定期的に再開（キックオフ）させる有機的な演奏構造を作ることができます。
  - **常時ループ（途切れない演奏）を作成する場合のルール**:
    結線していない `transition_out` に対応する `weights` の値は**必ず 0** に設定してください。
    （例: `transition_out1` と `transition_out2` のみ結線する場合 ➔ `"weights": [5, 5, 0, 0]`）
  - **音源（VCO / ADSR / VCA）への出力結線**:
    - ピッチ: 各 MARKOV の `cv_out` を同一の `VCO:cv_in`（または `CHORD:cv_in`）へサミング接続します。
    - トリガー/ゲート:
      - 発火ごとの単発発音・パーカッシブなノートオン ➔ **`trig_out`** を `ADSR:gate_in` や `VCA:cv_in` へ接続
      - 次のノードへ移るまでのロングトーン・レガート演奏 ➔ **`gate_out`** を接続

#### `CHORD` (4ボイス・コードジェネレーター)
単音CVから4声のポリフォニックCV（`cv_out1`〜`cv_out4`）を生成します。
- **入力ポート**:
  - `cv_in`: ルート音CV (1V/Oct)
  - `type_cv`: コード指定CV (0V〜7V。3ビットバイナリ `000`〜`111` に対応)
  - `voice_cv`: ボイシング指定CV (0V〜3V。2ビットバイナリ `00`〜`11` に対応)
- **出力ポート**:
  - `cv_out1`, `cv_out2`, `cv_out3`, `cv_out4`: 各ボイスのピッチCV出力
- **パラメータ**:
  | キー | 型 | 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `chord` | `string` | 8種類のコード識別子（下記参照） | `"min"` | 固定選択時のコード種別 |
  | `voicing`| `string` | 4種類のボイシング識別子（下記参照） | `"close"` | 固定選択時のボイシング |
  | `rootMidi`| `number` | `24` 〜 `72` | `48` | `cv_in`未接続時の基準ノート(48=C3) |

- **コード対応表（3ビット・0V〜7V）**:
  | 電圧 (CV) | Binary | コード名 | 半音インターバル | 特徴 |
  | :---: | :---: | :---: | :---: | :--- |
  | **0V** | `000` | `"min"` | `[0, 3, 7, 12]` | 基本マイナー |
  | **1V** | `001` | `"maj"` | `[0, 4, 7, 12]` | 基本メジャー（Bit 0 反転） |
  | **2V** | `010` | `"m7"` | `[0, 3, 7, 10]` | マイナー7th（Bit 1 反転） |
  | **3V** | `011` | `"7th"` | `[0, 4, 7, 10]` | ドミナント7th（Bit 0+1 反転） |
  | **4V** | `100` | `"dim7"` | `[0, 3, 6, 9]` | ディミニッシュ7th（Bit 2 反転） |
  | **5V** | `101` | `"5th"` | `[0, 7, 12, 19]` | パワーコード（Bit 0+2 反転） |
  | **6V** | `110` | `"sus4"` | `[0, 5, 7, 12]` | サスペンデッド4th（Bit 1+2 反転） |
  | **7V** | `111` | `"Maj7"` | `[0, 4, 7, 11]` | メジャー7th（全ビット反転） |

- **ボイシング対応表（2ビット・0V〜3V）**:
  | 電圧 (CV) | Binary | ボイシング名 | オフセット半音 |
  | :---: | :---: | :---: | :---: |
  | **0V** | `00` | `"close"` | `[0, 0, 0, 0]` (密着配置) |
  | **1V** | `01` | `"drop2"` | `[0, -12, 0, 0]` (第2音をオクターブ下げ) |
  | **2V** | `10` | `"drop3"` | `[0, 0, -12, 0]` (第3音をオクターブ下げ) |
  | **3V** | `11` | `"open"` | `[0, 0, 12, 12]` (高音部を開放) |

- **4音ポリフォニックVCOへの接続ルール**:
  `VCO` の `channels: 4` と組み合わせ、以下のように1対1で接続します:
  ```json
  "CHORD1:cv_out1 > VCO1:cv_in",
  "CHORD1:cv_out2 > VCO1:cv_in2",
  "CHORD1:cv_out3 > VCO1:cv_in3",
  "CHORD1:cv_out4 > VCO1:cv_in4"
  ```

---

### 5.5 エフェクト & ユーティリティ (Effects & Utilities)

#### `DELAY` (ステレオディレイ)
- **入力ポート**: `wave_in` (オーディオ入力)
- **出力ポート**: `wave_out` (オーディオ出力)
- **パラメータ**:
  | キー | 型 | 範囲 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `delayTime` | `number` | `0.02` 〜 `1.5` | `0.3` | ディレイタイム(秒) |
  | `feedback` | `number` | `0.0` 〜 `0.95` | `0.4` | フィードバック量 |
  | `mix` | `number` | `0.0` 〜 `1.0` | `0.5` | ドライ/ウェット比率（`1.0` で100%ウェット） |

#### `REVERB` (コンボリューション・リバーブ)
- **入力ポート**: `wave_in` (オーディオ入力), `cv_in` (ウェットゲイン変調CV: 0V〜1V)
- **出力ポート**: `wave_out` (オーディオ出力)
- **パラメータ**:
  | キー | 型 | 範囲 / 選択肢 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `time` | `number` | `0.1` 〜 `10.0` | `1.8` | 残響時間(秒) |
  | `damp` | `number` | `200` 〜 `10000` | `4500` | 高域ダンピング周波数(Hz) |
  | `mix` | `number` | `0.0` 〜 `1.0` | `0.4` | ドライ/ウェット比率 |
  | `mode` | `string` | `"hall"`, `"room"`, `"spring"`, `"shimmer"` | `"hall"` | 空間アルゴリズム |

#### `MIX` (4ch オーディオミキサー)
複数パートやエフェクト音をまとめるための必須モジュールです。
- **入力ポート**: `wave_in1`, `wave_in2`, `wave_in3`, `wave_in4`
- **出力ポート**: `wave_out`
- **パラメータ**:
  | キー | 型 | 範囲 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `channels` | `number` | `2`, `3`, `4` | `2` | 有効入力数 |
  | `lvl1` 〜 `lvl4` | `number` | `0.0` 〜 `1.0` | `0.8` | 各チャンネルの入力レベル |
- **音割れ防止 & クリップ表示**:
  - 常時ONのリミッター（DynamicsCompressor + tanhソフトクリッパー）を内蔵。複数信号の加算によるデジタル音割れを自動抑制します。
  - 入力レベルが飽和（クリッピング）した際は、パネル上のバー周辺に赤い光彩（クリップインジケーター）がリアルタイム表示されます。

#### `SPK` (マスター出力 / スピーカー) ★接続必須
ブラウザのマスター出力へ最終オーディオを送り出す唯一の出口です。
- **入力ポート**: `wave_in_l` (左ch入力), `wave_in_r` (右ch入力)
- **出力ポート**: なし
- **パラメータ**:
  | キー | 型 | 範囲 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `masterVol` | `number` | `0.0` 〜 `0.5` | `0.16` | マスター音量（音割れ防止のため `0.12`〜`0.20` 推奨） |

### 5.6 サブパッチ & ブリッジ (Subpatches & Cross-Page Routing)

ページ間のシグナル中継や、モジュール群をブラックボックス化して再利用・階層化するための特殊モジュールです。

#### `SUB` (サブパッチ・コンテナ / 親機ブリッジ)
親ページ（メインページなど）に配置し、指定したサブページ（子ページ）と信号を中継します。
- **物理ポート構成（表裏対称マッピング規則）**:
  - `PIN1_in` 〜 `PIN6_in`: **送り入力ポート (親 ➔ 子)**（クロック、ゲート、ピッチCV、変調CV等）
  - `PIN7_out` 〜 `PIN12_out`: **戻り出力ポート (子 ➔ 親)**（生成オーディオL/R、内部LFO/ENV還元等）
  - **端子のU字型配置**: 左上から下へPIN1〜3、下辺を左から右へPIN4〜9、右辺を下から上へPIN10〜12。
  - **エイリアス対応**: `subType`（または `manifest.ports`）が定義されている場合、物理ピン名に代えて `pitch_in`, `trig_in`, `wave_out` などの機能別名を直接結線に記述できます。
- **パラメータ**:
  | キー | 型 | 範囲 | デフォルト | 説明 |
  | :--- | :--- | :--- | :--- | :--- |
  | `subType` | `string` | 任意のサブパッチ型番 | - | ファクトリー品またはユーザー品型番（例: `"AcidVoice"`, `"TechnoKick"`）。指定時は `targetPage` 不要で自動採番・動的展開されます。 |
  | `targetPage` | `number` | `1` 〜 | `1` | （自作・手動指定時）中継先のサブページ番号（`pages` オブジェクト内のキー） |

#### `SUB_IO` (サブパッチ入出力インターフェース / 子機ブリッジ)
サブページ（Page 1〜）内に配置し、親ページの `SUB` モジュールと信号を授受する入出力端子です。
- **物理ポート構成（親モジュールと厳密に対称ペア）**:
  - `PIN1_out` 〜 `PIN6_out`: **送り出力ポート (親 ➔ 子)**（親から流し込まれたクロック、CV等が湧き出す）
  - `PIN7_in` 〜 `PIN12_in`: **戻り入力ポート (子 ➔ 親)**（子で生成したオーディオ、CV等を親へ流し込む）
  - **エイリアス対応**: 親と同様に `manifest.ports` のエイリアス名（`pitch_in`, `trig_in`, `wave_out` 等）を直接結線に記述できます。
- **パラメータ**:
  - なし（設定不要。1つのサブページにスロット `"2"` または `"0"` に1台配置）

---

## 6. 音階と 1V/Oct ピッチCV計算式 (Musical Pitch Calculations)

Gridsynth の `SEQ` の `cv` パラメータは、**1.0V = 1オクターブ (12半音)** 規格です。

### 6.1 音名と CV 値の対照表（C1〜C4）

$$\text{CV} = \frac{\text{MIDI Note} - 24}{12}$$

| ノート名 | MIDI | CV値 (10進) | 音楽的意味 |
| :--- | :---: | :---: | :--- |
| **C1** | 24 | `0.0000` | 基準ルート（低音ベース） |
| **D1** | 26 | `0.1667` | 長2度 |
| **Eb1** | 27 | `0.2500` | 短3度 (Minor 3rd) |
| **E1** | 28 | `0.3333` | 長3度 (Major 3rd) |
| **F1** | 29 | `0.4167` | 完全4度 |
| **G1** | 31 | `0.5833` | 完全5度 |
| **Ab1** | 32 | `0.6667` | 短6度 |
| **A1** | 33 | `0.7500` | 長6度 |
| **Bb1** | 34 | `0.8333` | 短7度 (Minor 7th) |
| **B1** | 35 | `0.9167` | 長7度 (Major 7th) |
| **C2** | 36 | `1.0000` | 1オクターブ上 |
| **Eb2** | 39 | `1.2500` | 1オクターブ上の短3度 |
| **G2** | 43 | `1.5833` | 1オクターブ上の完全5度 |
| **C3** | 48 | `2.0000` | 2オクターブ上（リード・コード基準） |
| **C4** | 60 | `3.0000` | 3オクターブ上（高音メロディ） |

### 6.2 オクターブチェンジとリアルタイム・トランスポーズ（KEYサミング技法）

`SEQ` の内部スライダーで設定できる音域は **約3オクターブ（`0.0V` [C1] 〜 `3.0V` [C4]）** です。
4オクターブ以上の高音域へオクターブチェンジさせたり、曲中でコード進行に合わせてシーケンス全体をリアルタイム移調（トランスポーズ）させたい場合は、**`KEY`（キーボード）モジュールからのピッチCVをサミング（加算）して電圧を引き上げます**。

* **原理（入力サミング）**:
  Gridsynth のモジュラーエンジンでは、同一の入力ポート（例: `VCO1:cv_in` や `CHORD1:cv_in`）に複数のケーブルを接続すると、入力電圧が**自動的に加算（サミング）**されます。

  $$\text{最終オシレーターCV} = \text{SEQのCV} + \text{KEYのCV}$$

* **電圧の足し算によるオクターブ変化**:
  - `KEY` で **C1 (MIDI 24)** を弾いた時: `KEY:cv_out = 0.0V` ➔ 原音のまま（オクターブ変化なし）
  - `KEY` で **C2 (MIDI 36)** を弾いた時: `KEY:cv_out = +1.0V` ➔ **+1オクターブ上へシフト（オクターブチェンジ）**
  - `KEY` で **C3 (MIDI 48)** を弾いた時: `KEY:cv_out = +2.0V` ➔ **+2オクターブ上へシフト**
  - `KEY` で **C4 (MIDI 60)** を弾いた時: `KEY:cv_out = +3.0V` ➔ **+3オクターブ上へシフト**
  - `KEY` で D, E, F, G などの他の鍵盤を弾いた時: シーケンスのフレーズ音程関係を保ったまま、曲のキー全体がリアルタイムに移調（トランスポーズ）されます。

* **結線例（オクターブチェンジ対応シーケンス）**:
```
// クロックと発音
CLK1:gate_out > SEQ1:gate_in
SEQ1:gate_out > ADSR1:gate_in

// ピッチCVのサミング（SEQ1とKEY1の両方を同じVCO1:cv_inに直結）
SEQ1:cv_out   > VCO1:cv_in      (基本シーケンス旋律 / 0〜3V)
KEY1:cv_out   > VCO1:cv_in      (キーボードによる電圧かさ上げ: +1Vごとに1オクターブ上昇)
```

---

## 7. 実戦パッチングレシピ (Patch Architecture Recipes)

### 【レシピ 1】標準減算アナログシンセ（ベース / リード）
```
CLK1:gate_out > SEQ1:gate_in
SEQ1:cv_out   > VCO1:cv_in        (ピッチ決定)
SEQ1:gate_out > ADSR1:gate_in     (発音トリガー)
VCO1:wave_out > VCF1:wave_in      (原音)
ADSR1:cv_out  > VCF1:cv_in        (フィルターモジュレーション)
VCF1:wave_out > VCA1:wave_in      (アンプ入力)
ADSR1:cv_out  > VCA1:cv_in        (音量エンベロープ)
VCA1:wave_out > DELAY1:wave_in    (空間系)
DELAY1:wave_out > SPK1:wave_in_l
DELAY1:wave_out > SPK1:wave_in_r
```

### 【レシピ 2】パーカッション / ドラム合成
- **エレクトロキック（急激なピッチ降下）**:
  - `CLK1:gate_out > ADSR1:gate_in`
  - `ADSR1:cv_out > VCO1:cv_in`（Attack: `0.001`, Decay: `0.08`, Sustain: `0.0` の超高速エンベロープでアタック感を作る）
  - `VCO1:wave_out > VCA1:wave_in`
  - `ADSR1:cv_out > VCA1:cv_in`
  - `VCA1:wave_out > MIX1:wave_in1`
- **ハイハット / スネア（フィルタリングド・ノイズ）**:
  - `CLK2` (x8 等の細分クロック) `> ADSR2:gate_in`
  - `NOISE1:wave_out > VCF1:wave_in` (Highpass または Bandpass)
  - `VCF1:wave_out > VCA2:wave_in`
  - `ADSR2:cv_out > VCA2:cv_in` (Decay: `0.05` 前後のショートディケイ)
  - `VCA2:wave_out > MIX1:wave_in2`
- **サミング**:
  - `MIX1:wave_out > SPK1:wave_in_l`
  - `MIX1:wave_out > SPK1:wave_in_r`

### 【レシピ 3】2パート本格アンサンブル（アシッドベース ＋ 4声コードパッド）
```
[パートA: ベース]
CLK1:gate_out  > SEQ1:gate_in
SEQ1:cv_out    > VCO1:cv_in
SEQ1:gate_out  > ADSR1:gate_in
VCO1:wave_out  > VCF1:wave_in
ADSR1:cv_out   > VCF1:cv_in
VCF1:wave_out  > VCA1:wave_in
ADSR1:cv_out   > VCA1:cv_in
VCA1:wave_out  > MIX1:wave_in1

[パートB: 4声ポリフォニックコード]
PAT1:cv_out    > CHORD1:cv_in      (ルート音シーケンス)
CHORD1:cv_out1 > VCO2:cv_in       (VCO2 は channels: 4)
CHORD1:cv_out2 > VCO2:cv_in2
CHORD1:cv_out3 > VCO2:cv_in3
CHORD1:cv_out4 > VCO2:cv_in4
PAT1:gate_out  > ADSR2:gate_in
VCO2:wave_out  > VCF2:wave_in
ADSR2:cv_out   > VCF2:cv_in
VCF2:wave_out  > VCA2:wave_in
ADSR2:cv_out   > VCA2:cv_in
VCA2:wave_out  > REVERB1:wave_in
REVERB1:wave_out > MIX1:wave_in2

[マスター出力]
MIX1:wave_out  > SPK1:wave_in_l
MIX1:wave_out  > SPK1:wave_in_r
```

### 【レシピ 4】マルコフ連鎖による確率的メロディ・コード進行（3ノード・パーペチュアル型）
3台の MARKOV を相互接続し、途切れずに永久遷移し続ける基本骨格です。

- **構成**:
  - `MARKOV1` (ノードA / `initOn: true`, `rootMidi: 48` [C3], `weights: [5, 5, 0, 0]`)
  - `MARKOV2` (ノードB / `initOn: false`, `rootMidi: 51` [Eb3], `weights: [5, 5, 0, 0]`)
  - `MARKOV3` (ノードC / `initOn: false`, `rootMidi: 55` [G3], `weights: [5, 5, 0, 0]`)
- **結線**:
```
// クロック分配 (全ノードへクロック供給)
CLK1:gate_out > MARKOV1:clk_in
CLK1:gate_out > MARKOV2:clk_in
CLK1:gate_out > MARKOV3:clk_in

// 相互バトン渡し (transition_out1, transition_out2 のみ使用し、未結線の weights[2], [3] は 0)
MARKOV1:transition_out1 > MARKOV2:transition_in
MARKOV1:transition_out2 > MARKOV3:transition_in

MARKOV2:transition_out1 > MARKOV1:transition_in
MARKOV2:transition_out2 > MARKOV3:transition_in

MARKOV3:transition_out1 > MARKOV1:transition_in
MARKOV3:transition_out2 > MARKOV2:transition_in

// ピッチサミング (アクティブなノードのピッチを音源へ合流)
MARKOV1:cv_out > VCO1:cv_in
MARKOV2:cv_out > VCO1:cv_in
MARKOV3:cv_out > VCO1:cv_in

// 発音トリガーサミング (各ノードの発行時ワンショットトリガーをADSRへ合流)
MARKOV1:trig_out > ADSR1:gate_in
MARKOV2:trig_out > ADSR1:gate_in
MARKOV3:trig_out > ADSR1:gate_in

// 発音・フィルター・出力
VCO1:wave_out > VCF1:wave_in
ADSR1:cv_out  > VCF1:cv_in
VCF1:wave_out > VCA1:wave_in
ADSR1:cv_out  > VCA1:cv_in
VCA1:wave_out > SPK1:wave_in_l
VCA1:wave_out > SPK1:wave_in_r
```

---

## 8. サブパッチアーキテクチャ、ファクトリー活用、および「境界切断・二分割」生成仕様 (Subpatch Architecture & Boundary-Cut Rules)

Gridsynth は、大規模なパッチや複雑なシンセボイスを整理・カプセル化・再利用するために、独立した作業グリッドを持つサブパッチ（マルチページ）機構を備えています。

---

### 8.1 新サブパッチアーキテクチャ概要 (v2.1)
従来の手動ページ番号固定（`targetPage: 1`）や曖昧な端子体系を刷新し、以下の4大コンセプトにより**「部品としての独立性」**と**「AI／人間双方にとって破綻しない厳格なシグナルフロー」**を実現しています。

1. **ページ番号非依存の管理（`subType` 動的バインド）**:
   - AIやユーザーは固定ページ番号（`targetPage`）を指定する必要はありません。型番（`subType: "AcidVoice"` 等）を指定するだけで、システムが空いている最小ページ番号（`1`, `2`...）を自動採番し、モジュール群・内部結線を動的に展開します。
   - 同一型番を複数配置した場合（例: `AcidVoice` を2台）でも、ID衝突することなく独立したサブページ（`ACID BASS`, `ACID BASS_1`）に自動展開され、完全並行動作します。
2. **表裏対称端子ペア（PIN1〜6 送り / PIN7〜12 戻り）**:
   - 親モジュール（`SUB`）と子モジュール（`SUB_IO`）で入出力の役割が厳密に対称ペアとなっています。
   - すべての結線が Gridsynth の鉄則である **「送信元:_out > 送信先:_in」** に100%合致し、接続方向の反転や文法違反が発生しません。
3. **端子エイリアス（機能別名）結線**:
   - ファクトリー品やマニフェスト付きサブパッチでは、物理ピン名（`PIN4_in`, `PIN9_out`）に加え、`trig_in`, `pitch_in`, `wave_out` などの直感的な**端子エイリアス名を結線に直接記述可能**です。
4. **境界切断・二分割（Boundary-Cut）生成アルゴリズム**:
   - AIが自作サブパッチを設計する際は、まず全体フラットな結線を考案し、親・子の境界を横断する線を抽出して二分割出力する標準手順が確立されています。

---

### 8.2 ファクトリーサブパッチ完全カタログ（全11種類）
AIは以下のファクトリーサブパッチ型番（`subType`）を親ページ（`pages["0"]`）で指定するだけで、子ページを自前で実装することなく高品位なボイスやドラムキットを瞬時に呼び出せます。

| `subType` (型番) | 名称 / カテゴリ | 入力エイリアス (親から見た役割) | 出力エイリアス (親から見た役割) | 親ページ結線例 |
| :--- | :--- | :--- | :--- | :--- |
| **`AcidVoice`** | 303 ACID BASS<br>(Synth Voice) | `pitch_in` (PIN4 / CV)<br>`trig_in` (PIN3 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ1:cv_out > SUB1:pitch_in`<br>`SEQ1:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in1` |
| **`MonoVoice`** | VOICE (Standard Lead)<br>(Synth Voice) | `pitch_in` (PIN4 / CV)<br>`gate_in` (PIN3 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ1:cv_out > SUB1:pitch_in`<br>`SEQ1:gate_out > SUB1:gate_in`<br>`SUB1:wave_out > SPK1:wave_in_l` |
| **`DualVCOVoice`**<br>(または `DualLead`) | DUAL VCO (Fat Bass/Lead)<br>(Synth Voice) | `pitch_in` (PIN4 / CV)<br>`gate_in` (PIN3 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ1:cv_out > SUB1:pitch_in`<br>`CLK1:gate_out > SUB1:gate_in`<br>`SUB1:wave_out > MIX1:wave_in1` |
| **`SpaceFxVoice`**<br>(または `SpaceFx`) | SPACE FX (Delay + Reverb)<br>(Effect Rack) | `wave_in` (PIN4 / Audio) | `wave_out` (PIN9 / Audio) | `VCO1:wave_out > SUB1:wave_in`<br>`SUB1:wave_out > SPK1:wave_in` |
| **`BassDrum`** | BASS DRUM (Analog Kick 1)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `CLK1:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in1` |
| **`TechnoKick`** | BASS DRUM 2 (Hard Techno Kick)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `CLK1:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in1` |
| **`SnareDrum`** | SNARE DRUM (909 Snare)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ1:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in2` |
| **`HiHat`** | HI-HAT (Metallic Closed Hat)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `CLK2:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in3` |
| **`HandClap`** | HAND CLAP (Multi-Burst Clap)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ2:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in4` |
| **`TechnoTom`** | TECHNO TOM (Resonant Tom)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ1:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in2` |
| **`MetallicPerc`** | METALLIC PERC (Rim / Ring)<br>(Percussion) | `trig_in` (PIN4 / Gate) | `wave_out` (PIN9 / Audio) | `SEQ1:gate_out > SUB1:trig_in`<br>`SUB1:wave_out > MIX1:wave_in3` |

> [!TIP]
> **ファクトリー活用時のAI推奨パターン**:
> ドラムキットやアシッドベースボイスを鳴らす場合、AIは子ページ（`pages["1"]` 等）のモジュールや配線を自分で書く必要は一切ありません。
> 親ページで `"SUB1": { "type": "SUB", "subType": "AcidVoice" }` のように型番を指定し、`SUB1:pitch_in`、`SUB1:trig_in`、`SUB1:wave_out` に結線するだけで、内部配線・音色合成・ページ展開が自動実行されます。

---

### 8.3 物理端子仕様（表裏対称マッピング規則）
ファクトリー品以外の**自作サブパッチ**や、カスタム配線を行う場合、物理端子スロット 1〜12 は親側（`SUB`）と子側（`SUB_IO`）で完全に対称ペアを形成します。

| スロット | 信号の向き | 親モジュール（`SUB`） | サブモジュール（`SUB_IO`） | 主な伝達信号 |
| :---: | :---: | :---: | :---: | :--- |
| **1 〜 6** | **親 ➔ 子（送り）** | **`PIN1_in` 〜 `PIN6_in`**<br>（親から見てSUBへ流し込む） | **`PIN1_out` 〜 `PIN6_out`**<br>（子から見てSUB_IOから湧き出す） | クロック、ゲート、ピッチCV、変調CV、外部原音オーディオなど |
| **7 〜 12** | **子 ➔ 親（戻り）** | **`PIN7_out` 〜 `PIN12_out`**<br>（親から見てSUBから湧き出す） | **`PIN7_in` 〜 `PIN12_in`**<br>（子から見てSUB_IOへ流し込む） | 生成オーディオ(L/R)、内部LFO/ENV還元、EOLトリガーなど |

#### 結線文法の整合性（`_out > _in` の完全保証）
- **親 ➔ 子（例: ピッチCV）**:
  - 親（Page 0）側: `"SEQ1:cv_out > SUB1:PIN4_in"` （out > in: 正常）
  - 子（Page 1）側: `"SUB_IO1:PIN4_out > VCO1:cv_in"` （out > in: 正常）
- **子 ➔ 親（例: オーディオ戻り）**:
  - 子（Page 1）側: `"VCA1:wave_out > SUB_IO1:PIN9_in"` （out > in: 正常）
  - 親（Page 0）側: `"SUB1:PIN9_out > MIX1:wave_in1"` （out > in: 正常）

#### 端子のU字型物理配置
モジュールパネル上では、端子が左上から時計回りU字型に整然と配置されています：
- **左辺（下方向）**: `PIN1`（スロット1）, `PIN2`（スロット2）, `PIN3`（スロット3）
- **下辺（右方向）**: `PIN4`（スロット4）, `PIN5`（スロット5）, `PIN6`（スロット6）, `PIN7`（スロット7）, `PIN8`（スロット8）, `PIN9`（スロット9）
- **右辺（上方向）**: `PIN10`（スロット10）, `PIN11`（スロット11）, `PIN12`（スロット12）

---

### 8.4 AI向け「境界切断・二分割（Boundary-Cut）」生成アルゴリズム
AIがユーザーから「新しい音源をサブパッチとして作って」「マルチページ構成にして」と要求された場合、以下の**4段階アルゴリズム**に従って生成してください。

```
[ Step 1: 全体フラット結線の考案 ]
  親・子の境界を意識せず、シンセ全体の信号フローを設計。
  (例: CLK1 -> SEQ1 -> VCO1 -> VCF1 -> VCA1 -> SPK1)
            |
            v
[ Step 2: 境界切断 ＆ 境界通過ケーブルの抽出 ]
  ・親から子へ渡る線 (SEQ1:cv_out, SEQ1:gate_out)
    ➔ 送りピン PIN4, PIN3 に順次割り当て (左下コーナー入力)
  ・子から親へ戻る線 (VCA1:wave_out -> SPK1)
    ➔ 戻りピン PIN9 に割り当て (右下コーナー出力)
  ・1対N 分岐は同一ピン番号を共有
            |
            v
[ Step 3: 結線の二分割出力 ]
  ・親側 (Page 0): SUB1:PIN4_in, SUB1:PIN3_in, SUB1:PIN9_out
  ・子側 (Page 1): SUB_IO1:PIN4_out, SUB_IO1:PIN3_out, SUB_IO1:PIN9_in
            |
            v
[ Step 4: 入出力厳格検証 ]
  ・すべての結線が [送信元:_out > 送信先:_in] であることを再確認
```

#### 各ステップの詳細手順
1. **全体フラット結線の考案**:
   まず、全モジュールが単一ページにあるかのように全体のシグナルパス（演奏シーケンス ➔ 音源 ➔ フィルター ➔ アンプ ➔ エフェクト ➔ 出力）を考案します。
2. **境界通過ケーブルの抽出**:
   カプセル化するモジュール群（子ページ候補）を決め、親と子の境界を横断するケーブルのみをリストアップします。
   - **親 ➔ 子（CV、クロック、ゲート）**:
     `PIN1`〜`PIN6` の空きスロット（一次入力は推奨 `PIN4`、二次入力は推奨 `PIN3`）に順次割り当てます。
     ※もし親のクロックが子の複数モジュールに分配される場合（1対N分岐）、親側は1本（`CLK1:gate_out > SUB1:PIN4_in`）、子側は同一ピンから複数分岐（`SUB_IO1:PIN4_out > MODA:in`, `SUB_IO1:PIN4_out > MODB:in`）とします。
   - **子 ➔ 親（オーディオ、返還CV）**:
     `PIN7`〜`PIN12` の空きスロット（メインオーディオ出力は推奨 `PIN9`）に順次割り当てます。
3. **結線の二分割出力**:
   親ページ側の `connections` と、子ページ側の `connections` に物理ピン（またはエイリアス）を用いて振り分けます。
4. **入出力厳格検証（`_out > _in`）**:
   `>` の左側が必ず `_out`、右側が必ず `_in` であることをチェックし、出力します。

---

### 8.5 完全動作マルチページJSONサンプル

#### 実例A: ファクトリーサブパッチ活用（親ページのみで完結する高密度グルーヴボックス）
ファクトリー品の型番（`subType`）とエイリアス端子を活用し、子ページ記述なしでキック、ハイハット、アシッドベースを同時演奏させる最小・強力なJSONです。

```json
{
  "bpm": 130,
  "pages": {
    "0": {
      "name": "Groove Console",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "SUB1",
        "5": "CLK2",
        "7": "SUB2",
        "10": "CLK3",
        "12": "SUB3",
        "3": "MIX1",
        "4": "SPK1"
      },
      "modules": {
        "CLK1": { "type": "CLK", "div": "x4", "pulseWidthMs": 15 },
        "SEQ1": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true }
          ]
        },
        "SUB1": { "type": "SUB", "subType": "AcidVoice" },
        "CLK2": { "type": "CLK", "div": "x1", "pulseWidthMs": 20 },
        "SUB2": { "type": "SUB", "subType": "TechnoKick" },
        "CLK3": { "type": "CLK", "div": "x2", "pulseWidthMs": 10 },
        "SUB3": { "type": "SUB", "subType": "HiHat" },
        "MIX1": { "type": "MIX", "channels": 4, "lvl1": 0.7, "lvl2": 0.9, "lvl3": 0.6, "lvl4": 0.0 },
        "SPK1": { "type": "SPK", "masterVol": 0.18 }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "SEQ1:gate_out > SUB1:trig_in",
        "SEQ1:cv_out   > SUB1:pitch_in",
        "SUB1:wave_out > MIX1:wave_in1",
        "CLK2:gate_out > SUB2:trig_in",
        "SUB2:wave_out > MIX1:wave_in2",
        "CLK3:gate_out > SUB3:trig_in",
        "SUB3:wave_out > MIX1:wave_in3",
        "MIX1:wave_out > SPK1:wave_in_l",
        "MIX1:wave_out > SPK1:wave_in_r"
      ]
    }
  }
}
```

#### 実例B: 「境界切断・二分割」による自作マルチページシンセ
親（Page 0）でアルペジオパターンを生成し、子（Page 1）の自作FM/減算ハイブリッドボイスに送り込んで鳴らす、境界切断ルールに厳格準拠した完全パッチです。

```json
{
  "bpm": 128,
  "pages": {
    "0": {
      "name": "Sequencer Console",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "SUB1",
        "3": "MIX1",
        "4": "SPK1"
      },
      "modules": {
        "CLK1": { "type": "CLK", "div": "x4", "pulseWidthMs": 15 },
        "SEQ1": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true },
            { "cv": 1.0, "active": true, "cvActive": true, "gate": true }
          ]
        },
        "SUB1": { "type": "SUB", "targetPage": 1 },
        "MIX1": { "type": "MIX", "channels": 2, "lvl1": 0.8, "lvl2": 0.8 },
        "SPK1": { "type": "SPK", "masterVol": 0.16 }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "SEQ1:cv_out   > SUB1:PIN4_in",
        "SEQ1:gate_out > SUB1:PIN3_in",
        "SUB1:PIN9_out > MIX1:wave_in1",
        "MIX1:wave_out > SPK1:wave_in_l",
        "MIX1:wave_out > SPK1:wave_in_r"
      ]
    },
    "1": {
      "name": "Custom Hybrid Voice",
      "slots": {
        "2": "SUB_IO1",
        "7": "VCO1",
        "8": "VCF1",
        "12": "ADSR1",
        "13": "VCA1"
      },
      "modules": {
        "SUB_IO1": { "type": "SUB_IO" },
        "VCO1": { "type": "VCO", "wave": "sawtooth", "freq1": 110, "channels": 1 },
        "VCF1": { "type": "VCF", "filterType": "lowpass", "cutoff": 650, "q": 8.0, "modDepth": 2400 },
        "ADSR1": { "type": "ADSR", "attack": 0.005, "decay": 0.22, "sustain": 0.0, "release": 0.08 },
        "VCA1": { "type": "VCA", "level": 0.0 }
      },
      "connections": [
        "SUB_IO1:PIN4_out > VCO1:cv_in",
        "SUB_IO1:PIN3_out > ADSR1:gate_in",
        "VCO1:wave_out    > VCF1:wave_in",
        "ADSR1:cv_out     > VCF1:cv_in",
        "VCF1:wave_out    > VCA1:wave_in",
        "ADSR1:cv_out     > VCA1:cv_in",
        "VCA1:wave_out    > SUB_IO1:PIN9_in"
      ]
    }
  }
}
```

---

### 8.6 単体サブパッチ / プリセット配布スキーマ（JSON）
配布用・ライブラリ登録用のサブパッチ単体JSONは、特定のページ番号を持たず、`subType` を主キーとする自己完結型フォーマット（`format: "gridsynth-submodule"`）で記述します。

```json
{
  "format": "gridsynth-submodule",
  "version": "2.1",
  "subType": "CustomAcidVoice",
  "name": "Custom Acid Bass Voice",
  "category": "Synth Voice",
  "author": "Custom",
  "manifest": {
    "description": "303スタイルのアシッドベースボイス",
    "ports": {
      "pitch_in": { "pin": "PIN4", "signal": "cv" },
      "trig_in":  { "pin": "PIN3", "signal": "gate" },
      "wave_out": { "pin": "PIN9", "signal": "audio" }
    }
  },
  "slots": {
    "2": "SUB_IO1",
    "7": "VCO1",
    "8": "VCF1",
    "12": "ADSR1",
    "13": "VCA1"
  },
  "modules": {
    "SUB_IO1": { "type": "SUB_IO" },
    "VCO1": { "type": "VCO", "wave": "sawtooth", "freq1": 110, "channels": 1 },
    "VCF1": { "type": "VCF", "filterType": "lowpass", "cutoff": 500, "q": 8.0 },
    "ADSR1": { "type": "ADSR", "decay": 0.2, "sustain": 0.0 },
    "VCA1": { "type": "VCA", "level": 0.0 }
  },
  "connections": [
    "SUB_IO1:pitch_in > VCO1:cv_in",
    "SUB_IO1:trig_in > ADSR1:gate_in",
    "VCO1:wave_out > VCF1:wave_in",
    "ADSR1:cv_out > VCF1:cv_in",
    "VCF1:wave_out > VCA1:wave_in",
    "ADSR1:cv_out > VCA1:cv_in",
    "VCA1:wave_out > SUB_IO1:wave_out"
  ]
}
```
※マニフェストの `pin` は `PIN1`〜`PIN12` の番号ベースで定義し、親側・子側のどちらから参照されたかによってシステムが `_in` / `_out` を自動付与して解決します。


---

## 9. 完全動作実例 JSON (Complete Working Demo)

以下は、そのまま Gridsynth に読み込んですぐに鳴らせる「アシッドベース ＋ 空間系ディレイ」の完全な JSON です。

```json
{
  "bpm": 132,
  "pages": {
    "0": {
      "name": "Acid Drive",
      "slots": {
        "0": "CLK1",
        "1": "SEQ1",
        "2": "VCO1",
        "3": "VCF1",
        "4": "SPK1",
        "6": "ADSR1",
        "7": "VCA1",
        "8": "DELAY1"
      },
      "modules": {
        "CLK1": {
          "type": "CLK",
          "div": "x4",
          "pulseWidthMs": 20
        },
        "SEQ1": {
          "type": "SEQ",
          "quantize": true,
          "steps": [
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": true, "gate": false },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.25, "active": true, "cvActive": true, "gate": false },
            { "cv": 1.0, "active": true, "cvActive": true, "gate": true },
            { "cv": 0.5833, "active": true, "cvActive": true, "gate": true }
          ]
        },
        "VCO1": {
          "type": "VCO",
          "wave": "sawtooth",
          "freq1": 110,
          "channels": 1,
          "quantize": false
        },
        "VCF1": {
          "type": "VCF",
          "filterType": "lowpass",
          "cutoff": 450,
          "q": 8.0,
          "modDepth": 3600
        },
        "ADSR1": {
          "type": "ADSR",
          "attack": 0.005,
          "decay": 0.16,
          "sustain": 0.0,
          "release": 0.12,
          "attackCurve": 0.0,
          "decayCurve": 0.0,
          "releaseCurve": 0.0
        },
        "VCA1": {
          "type": "VCA",
          "level": 0.0,
          "cvDepth": 1.0
        },
        "DELAY1": {
          "type": "DELAY",
          "delayTime": 0.227,
          "feedback": 0.45,
          "mix": 0.35
        },
        "SPK1": {
          "type": "SPK",
          "masterVol": 0.16
        }
      },
      "connections": [
        "CLK1:gate_out > SEQ1:gate_in",
        "SEQ1:gate_out > ADSR1:gate_in",
        "SEQ1:cv_out > VCO1:cv_in",
        "VCO1:wave_out > VCF1:wave_in",
        "ADSR1:cv_out > VCF1:cv_in",
        "VCF1:wave_out > VCA1:wave_in",
        "ADSR1:cv_out > VCA1:cv_in",
        "VCA1:wave_out > DELAY1:wave_in",
        "DELAY1:wave_out > SPK1:wave_in_l",
        "DELAY1:wave_out > SPK1:wave_in_r"
      ]
    }
  }
}
```

---

## 10. AI へのシステムプロンプト指示テンプレート (Prompt Template)

外部のAI（ChatGPT, Claude, Gemini 等）に曲作りやパッチ作成を指示する際は、以下のプロンプトをそのままコピーして入力してください。

```text
あなたはモジュラーシンセサイザーのプロフェッショナルサウンドデザイナーです。
添付の「Gridsynth AI Patch Generation & Composition Specification」の仕様に厳密に従い、Gridsynthで再生可能な完全なパッチJSONを出力してください。

【楽曲テーマ・リクエスト】:
- スタイル: [例: BPM 126 のディープミニマルテクノ。パーカッシブなベースと空間系アルペジオ]
- パート構成: [例: 2パート構成（ベース + ドラム / コード）または 単一パート]
- 使用したいモジュール: [例: VCO, VCF, VCA, ADSR, SEQ, DELAY, SPK, MIX など]

【出力ルール】:
1. 説明書に記載されている正式なポート名とパラメータ名のみを使用してください。
2. 接続は "送信元ID:ポート > 送信先ID:ポート" の形式とし、必ず出力ポートから入力ポートへ向けてください。
3. 最終出力は必ず SPK1 の wave_in_l および wave_in_r に結線してください。
4. slots のキー ("0"〜"39") と modules のモジュールIDを重複なく1対1でマッピングしてください。
5. 前置きや解説は一切省き、Gridsynth にそのままインポートできる単一の ```json コードブロックのみを出力してください。
6. MARKOV モジュールを使用する場合は、複数ノード（2台以上）を相互に transition_out1..4 と transition_in で結線してください。未結線の transition_out に対応する weights 配列の値は必ず 0 に設定し、意図しないシーケンス停止を防いでください。ノードの出力ピッチは rootMidi（例: 48, 51, 55）で指定します。また、ネットワーク内で必ず1台のみ "initOn": true（初期起動）を設定してください。音源のトリガーには trig_out（ワンショット）または gate_out（持続）を使用します。
7. FM モジュールを使用する場合は、3オペレータ（Op1: キャリア, Op2: モジュレータ1, Op3: モジュレータ2）のRatio比、アルゴリズム（1: 直列, 2: 並列変調, 3: 2キャリア分岐, 4: FM+サブ）、および各オペレータの内包ADSR（EXP/LIN/LOG）を活用して、キック、スネア、ハイハット、ディープベース、金属音リードを合成してください。スネアやハットのノイズ成分には Op3 の "wave": "noise" が極めて有効です。
```
