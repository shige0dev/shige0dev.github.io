# GridSynth - プロジェクト概要・設計思想・内部アーキテクチャ & ロードマップ

本ドキュメントは、**GridSynth (Grid Modular Synthesizer)** の設計思想、内部アーキテクチャ、データモデル、実装経緯、モバイル（Galaxy S25等）対応方針、および今後のAPI / MCP（Model Context Protocol）拡張ロードマップを網羅した開発引継ぎ用総合リファレンスです。

---

## 1. プロジェクト概要 & 設計思想 (Philosophy & Overview)

### 1.1 基本コンセプト
GridSynth は、Web ブラウザ上で動作する **5×8 グリッド型のモジュラーシンセサイザー** です。
- **視覚的パッチング**: 5列×8行（計40スロット）のグリッド上にモジュールを配置し、端子間をバーチャルケーブルで接続して音作りを行います。
- **モジュラーの自由度 × 階層化カプセル化**: 単一画面のパッチングだけでなく、「サブパッチ（`SUB` / `SUB_IO`）」により、複雑な音源（キック、スネア、アシッドベース等）を1つのスロットにまとめて階層管理できます。
- **Strudel / Tidal mini-notation の融合 (`PAT` モジュール)**: ライブコーディング言語（Strudel / TidalCycles）のパターン記法を取り入れ、`[c2 c2] c3*2 ~` といった柔軟なリズム・旋律を直感的に生成可能です。
- **Web Audio API ネイティブ & ゼロビルド (Vanilla JS)**: 外部の重厚なフレームワークやビルドステップ（Webpack/Vite等）を排し、純粋な HTML5/CSS3/ES Modules のみで動作。高い可搬性と軽量なフットプリントを実現しています。

---

## 2. 内部アーキテクチャ (Internal Architecture)

システムは **UI層 (UIController)**、**モジュール定義層 (MODULE_REGISTRY)**、**音声エンジン層 (AudioEngine / AUDIO_REGISTRY)**、**パーサー層 (StrudelParser)** の疎結合な構造で構成されています。

```
+-------------------------------------------------------------------------+
|                              index.html                                 |
+-------------------------------------------------------------------------+
|                               UI Layer                                  |
|   - UIController (src/ui/controller.js)                                 |
|   - UIHelpers (src/ui/helpers.js)                                       |
|   - 5x8 Grid DOM, SVG Cable Overlay, Parameter Dock/Popup, Modal UI     |
+-------------------------------------------------------------------------+
|                           Module Registry                               |
|   - MODULE_REGISTRY (src/modules/registry.js)                           |
|     (UIメタデータ, 入出力端子, パラメータ定義, テンプレート描画)           |
+-------------------------------------------------------------------------+
|                         Pattern Parser Engine                           |
|   - StrudelParser (src/core/strudel-parser.js)                          |
|     (mini-notation 解析, 再帰的ポリリズム, *N, !N, 休符 ~, ハイライト同期) |
+-------------------------------------------------------------------------+
|                           Audio Engine                                  |
|   - AudioEngine (src/audio/engine.js)                                   |
|   - AUDIO_REGISTRY (src/audio/registry.js)                              |
|     (Web Audio API グラフ, CV/Audio信号, keepalive機構, カスタムノード)   |
+-------------------------------------------------------------------------+
|                        Data & Preset Layer                              |
|   - Default Presets (src/presets/default.js) : 01_ 〜 06_               |
|   - Subpatch Presets (src/presets/subpatches.js)                        |
|   - LocalStorage Database & JSON Export/Import                          |
+-------------------------------------------------------------------------+
```

### 2.1 主要コンポーネント詳細

#### ① 音声エンジン (`src/audio/engine.js`, `src/audio/registry.js`)
- **AudioContext & クロック**: 高精度なハードウェアタイマー基準で動作。マスターテンポ（BPM）を元にクロックパルス・シーケンスステップ・パターンフェーズを計算。
- **CV（Control Voltage）と Audio の統合**: Web Audio API の `ConstantSourceNode` や `AudioParam` を組み合わせ、1V/oct 相当のピッチCV、0〜1VのエンベロープCV、バイポーラ/ユニポーラ変調をシームレスに処理。
- **Keepalive 機構 (`silentSink`)**: Web Audio API では、スピーカー（`destination`）に繋がっていないグラフ枝がガベージコレクションや最適化で処理停止する場合があります。`PAT`、`CLK`、`SEQ` などの独立駆動モジュールには無音のゲインノード（`GainNode(0) -> destination`）を接続し、単体動作時でもシーケンスが停止しない設計になっています。

#### ② モジュール定義システム (`src/modules/registry.js`)
- 各モジュール（`VCO`, `VCF`, `VCA`, `ADSR`, `CLK`, `SEQ`, `PAT`, `SH`, `DELAY`, `REVERB`, `FOLD`, `MIX`, `SUB`, `SUB_IO`, `SPK`, `KEY` 等）の入出力端子（オーディオ / CV / ゲート）、UIコントロールのパラメータ範囲・デフォルト値を一元管理。

#### ③ UI コントローラー (`src/ui/controller.js`)
- **40スロット管理**: `slots`（位置マップ）、`modules`（インスタンス状態）、`connections`（結線リスト）の状態管理。
- **階層ナビゲーション**: ページ0（メイン）とページ1〜（サブパッチ）のスタック遷移、親ページからのI/Oポートフォワーディング。
- **マルチ選択 & ドック/ポップアップ**: モジュールをクリックして画面下部ドックで詳細調整、または複数選択による一括移動/削除。

#### ④ Strudel / Tidal 記法パーサー (`src/core/strudel-parser.js`)
- mini-notation の文字列（例: `[c2 c2 c2 c2] [c2 c2 c2 c3] [c2 c2 c2 c2] [c2 c2 c2 c4]`）をトークン分解・AST化。
- `*N`（時間圧縮/連打）、`!N`（ステップ反復）、`~`（休符）、`[ ... ]`（ネスト構造）を正確に計算し、1サイクル内のステップ配列・周波数・ゲート長を生成。リアルタイムに発音中要素のハイライト位置をUIへ通知。

---

## 3. JSON による設定記述の考え方 (Patch Schema Design)

GridSynth のパッチデータは、**完全宣言型（Declarative）かつポータブルな JSON 構造** を採用しています。

### 3.1 スキーマ仕様
```json
{
  "bpm": 120,
  "pages": {
    "0": {
      "name": "MAIN",
      "slots": {
        "1": "PAT1",
        "2": "VCO1",
        "3": "VCF1",
        "4": "SPK1"
      },
      "modules": {
        "PAT1": {
          "type": "PAT",
          "pattern": "c2 c2 c2 c3",
          "cycleBeats": 4,
          "gateLen": 0.8,
          "presetName": "4-on-floor"
        },
        "VCO1": {
          "type": "VCO",
          "channels": 1,
          "quantize": true,
          "wave": "sawtooth",
          "freq1": 220
        },
        "VCF1": {
          "type": "VCF",
          "cutoff": 600,
          "q": 2.5,
          "filterType": "lowpass",
          "modDepth": 1200
        },
        "SPK1": {
          "type": "SPK",
          "masterVol": 0.12
        }
      },
      "connections": [
        {
          "from": { "moduleId": "PAT1", "port": "cv_out" },
          "to": { "moduleId": "VCO1", "port": "cv_in" }
        },
        {
          "from": { "moduleId": "VCO1", "port": "wave_out" },
          "to": { "moduleId": "VCF1", port: "wave_in" }
        },
        {
          "from": { "moduleId": "VCF1", "port": "wave_out" },
          "to": { "moduleId": "SPK1", "port": "wave_in" }
        }
      ]
    },
    "1": {
      "name": "SUB_DRUM_KIT",
      "slots": { ... },
      "modules": { ... },
      "connections": [ ... ]
    }
  }
}
```

### 3.2 設計思想
1. **ランタイムと設定の完全分離**: グラフの構築ロジックと設定データを分離。JSON さえあればどのクライアントでも同一の音響空間を完全再現可能。
2. **サブパッチのカプセル化**: ページ単位でスロット・モジュール・結線が独立しており、将来的なサブパッチ単体の切り出し（User Subpatch Library）やモジュール間共有が容易。
3. **安全なインポート / エクスポート**: 不正な接続や未知のモジュールIDが含まれていてもクラッシュせず、安全にフォールバック・検証するパーサー構造。

---

## 4. スマートフォン（Galaxy S25 等）対応方針 (Mobile Optimization)

Samsung Galaxy S25 等の最新ハイエンドスマートフォン（超高解像度 Dynamic AMOLED 2X, アスペクト比約 19.5:9 / 20:9, 120Hz ディスプレイ）での快適な演奏・パッチング体験を想定した要件と最適化設計です。

### 4.1 画面レイアウト & レスポンシブ設計
- **ビューポート制御**: `user-scalable=no` およびピンチズーム誤動作防止。縦持ち（Portrait）時は 5 列を画面幅に最適フィットさせ、縦スクロールで 8 行を閲覧。横持ち（Landscape）時は 5×8 全体を1画面に俯瞰表示。
- **Dynamic Safe Area**: Galaxy S25 のパンチホールカメラ部やシステムナビゲーションバーを考慮した `env(safe-area-inset-*)` の適用。
- **高リフレッシュレート (120Hz) 最適化**: ケーブル描画（SVG / Canvas）やステップ点滅の requestAnimationFrame 最適化により、120Hz スクリーンでの滑らかな描画を維持。

### 4.2 タッチ操作 UX
- **タップ・トゥ・ワイヤ (Tap-to-Wire)**: 指でドラッグしづらいモバイル画面向けに、「出力ポートをタップ → 入力ポートをタップ」の2ステップ結線操作をファーストクラスでサポート。
- **ロングプレス & クイックメニュー**: モジュール長押しでのパラメータドック展開、コンテキストメニュー（複製・削除・サブパッチを開く）。
- **タッチノブ / スライダーの操作性**: 画面タッチ時に指で値が見えなくならないよう、ポップアップインジケーターや画面下部固定の大型パラメータ調整パネル（Bottom Sheet）を連動。

### 4.3 オーディオ低レイテンシ & 省電力
- **ユーザーインタラクションによる AudioContext 解除**: Android / Chrome のオートプレイポリシーに対応したワンタップアンロック。
- **Low-Latency Audio ワークレット化**: リアルタイムキーボード演奏時のレイテンシを最小化。

---

## 5. API & MCP (Model Context Protocol) 拡張ロードマップ

GridSynth を AI（LLM）や外部エージェント、外部DAW/ハードウェアと双方向連携させるための拡張計画です。

```
+-------------------------------------------------------------------------+
|                  AI Agent / LLM (Claude, Gemini, etc.)                  |
+-------------------------------------------------------------------------+
                                   |
                          (MCP Tools / Prompts)
                                   v
+-------------------------------------------------------------------------+
|                         GridSynth MCP Server                            |
|  - get_current_patch()        : 現在のパッチ状態 (JSON) を取得          |
|  - set_patch(json)            : パッチ全体をロード・更新               |
|  - add_module(type, slot)     : モジュールを特定スロットへ追加         |
|  - connect(from, to)          : 端子間をワイヤリング                   |
|  - set_parameter(mod, key, v) : パラメータ（Cutoff, ADSR等）を調整     |
|  - generate_pattern(prompt)   : 自然言語から Strudel 記法を生成/適用   |
+-------------------------------------------------------------------------+
                                   |
                       (WebSocket / Web API / OSC)
                                   v
+-------------------------------------------------------------------------+
|                           GridSynth Web App                             |
+-------------------------------------------------------------------------+
```

### 5.1 MCP サーバー連携ツール群 (Proposed MCP Tools)
1. **`gridsynth_get_patch`**: 現在の全ページ、モジュール、接続情報を JSON 形式でエクスポートして AI に渡す。
2. **`gridsynth_apply_patch`**: AI が生成した JSON パッチをアプリに即座に反映・演奏させる。
3. **`gridsynth_tweak_sound`**: 「もっとダークなアシッドベースにして」「ディレイを控えめにして」といった自然言語指示に対し、VCF Cutoff / Decay / Delay Mix などのパラメータのみをピンポイントで変更。
4. **`gridsynth_compose_strudel`**: 音楽ジャンルや雰囲気に合わせた mini-notation パターンを生成し、`PAT` モジュールへ即時注入。
5. **`gridsynth_diagnose_patch`**: 「音が鳴らない」「結線がループしている」などのトラブルシューティングを AI が接続グラフを走査して自己診断・修正提案。

### 5.2 外部 Web API / Web MIDI / OSC ロードマップ
- **Headless Mode / Audio Worklet API**: ブラウザ UI なしで Node.js や Deno 環境でのバウンス・音声レンダリング。
- **Web MIDI API**: 外部 MIDI キーボードやハードウェアコントローラー（KORG nanoKONTROL 等）のノブ/鍵盤とのマッピング。
- **WebRTC / WebSocket によるリモートセッション**: 複数人でのリアルタイム共同パッチング。

---

## 6. プリセット構成体系 (Current Factory Presets)

2026年10月現在の標準ファクトリープリセット（`src/presets/default.js`）：

| プリセット名 | 概要・構成 |
| :--- | :--- |
| **`01_DELAY_TECHNO`** | 8ステップシーケンサー、矩形波VCO、VCF、ディレイによるミニマルテクノ |
| **`02_KEYBOARD_LEAD`** | KEYモジュールによるリアルタイム演奏用リードシンセ |
| **`03_WAVEFOLD_VERB`** | ウェーブフォルダー (FOLD) とリバーブによるリッチなハーモニクス倍音パッチ |
| **`04_RANDOM_SH_DELAY`** | S&H（サンプル＆ホールド）ランダムCV + KEY手動ピッチ加算 + ディレイパッチ |
| **`05_SUBPATCH_MULTI_GROOVE`** | 4トラック構成（Acid Bass, Kick, Snare, Hi-Hat, Clap）をサブパッチで内包したグルーヴボックス |
| **`06_STRUDEL_HOUSE_BASSLINE`** | PATモジュール（Strudel mini-notation）を活用した16ステップオクターブベースライン |

---

## 7. 開発・保守における留意点 (Important Guidelines for Developers)

1. **LocalStorage クリーンアップの維持**: プリセット名やキー名を変更・削除した際は、`src/ui/controller.js` の `oldLegacyKeys` 配列に旧キーを登録し、ユーザーのブラウザストレージと整合性を保つこと。
2. **Keepalive の徹底**: 音声信号が常時スピーカーに直結しないトリガー/CV生成モジュール（`PAT`, `CLK`, `SEQ` 等）を追加・改修する際は、必ず `silentSink`（`GainNode(0) -> destination`）への接続を維持すること。
3. **Vanilla JS の原則**: 特別な外部バンドラーを必要としない ES Modules（`import/export`）形式を厳守し、ブラウザで `index.html` を開くだけで即座に動作するシンプルさを保つこと。
