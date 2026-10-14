// [BACKUP] MODULE_REGISTRY.TAPE implementation
// Originally in src/modules/registry.js

export const TAPE_MODULE_ENTRY = {
    color: 'amber',
    defaults: () => ({
        type: 'TAPE',
        url: '',
        fileName: '',
        fileDuration: '1.60',
        start: 0.0,
        end: 1.0,
        length: 1.0,
        speed: 1.0,
        loop: false,
        zoom: 1.0,
        viewOffset: 0.0
    }),
    ports: () => ({
        in: [
            { port: 'trig_in', color: 'bg-orange-500' },
            { port: 'start_cv', color: 'bg-yellow-400' },
            { port: 'len_cv', color: 'bg-yellow-400' },
            { port: 'speed_cv', color: 'bg-yellow-400' }
        ],
        out: [
            { port: 'wave_out', color: 'bg-blue-500' },
            { port: 'gate_out', color: 'bg-orange-500' }
        ]
    }),
    renderGrid: (m) => {
        const spd = m.speed ?? 1.0;
        const isLoop = !!m.loop;
        const curStart = m.start ?? 0.0;
        const curEnd = m.end !== undefined ? m.end : (curStart + (m.length ?? 1.0));
        const isRev = curStart > curEnd;
        return `
            <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-amber-300 w-full px-1">
                <!-- Cassette visual -->
                <div class="w-12 h-6 bg-slate-950/90 rounded border ${isRev ? 'border-purple-500/60' : 'border-amber-600/40'} p-0.5 flex flex-col justify-between relative overflow-hidden shadow-inner">
                    <div class="flex justify-between items-center px-1 pt-0.5">
                        <div class="tape-reel-l w-2.5 h-2.5 rounded-full border ${isRev ? 'border-purple-400/80' : 'border-amber-400/80'} flex items-center justify-center">
                            <div class="w-1 h-1 ${isRev ? 'bg-purple-400/90' : 'bg-amber-400/90'} rounded-full"></div>
                        </div>
                        <div class="h-1 flex-1 mx-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div class="tape-pos-bar h-full ${isRev ? 'bg-gradient-to-l from-purple-500 to-pink-300' : 'bg-gradient-to-r from-amber-500 to-yellow-300'} w-0 transition-all duration-75"></div>
                        </div>
                        <div class="tape-reel-r w-2.5 h-2.5 rounded-full border ${isRev ? 'border-purple-400/80' : 'border-amber-400/80'} flex items-center justify-center">
                            <div class="w-1 h-1 ${isRev ? 'bg-purple-400/90' : 'bg-amber-400/90'} rounded-full"></div>
                        </div>
                    </div>
                    <div class="text-[6.5px] font-mono text-center ${isRev ? 'text-purple-300 font-bold' : 'text-amber-400/80'} truncate">
                        ${isRev ? '⏪ REV' : (m.fileName ? `📁 ${m.fileName.slice(0, 10)}` : (m.url ? 'EXT FILE' : '4-PERC'))}
                    </div>
                </div>
                <div class="flex items-center gap-1 mt-0.5 text-[8px] font-mono font-bold">
                    <span class="${isRev ? 'text-purple-400' : (spd < 0 ? 'text-rose-400' : 'text-amber-300')}">${isRev ? 'REV' : `${spd.toFixed(1)}x`}</span>
                    <span class="text-[7px] text-slate-400">${isLoop ? 'LOOP' : '1-SHOT'}</span>
                </div>
            </div>`;
    },
    renderSplineWaveform: (buf, curStart = 0, curEnd = 1, curPos = 0, isPlaying = false, vStart = 0.0, vEnd = 1.0) => {
        const W = 390, H = 84, midY = H / 2;
        const ptsCount = 110;
        const topPts = [], botPts = [];

        const totalLen = (buf && buf.length > 0) ? buf.length : 44100 * 1.6;
        const winStartIdx = Math.max(0, Math.floor(vStart * totalLen));
        const winEndIdx = Math.min(totalLen, Math.floor(vEnd * totalLen));
        const winLen = Math.max(1, winEndIdx - winStartIdx);

        if (buf && buf.length > 0) {
            const step = winLen / ptsCount;
            for (let i = 0; i < ptsCount; i++) {
                const sStart = Math.min(buf.length - 1, winStartIdx + Math.floor(i * step));
                const sEnd = Math.min(buf.length, winStartIdx + Math.floor((i + 1) * step));
                let peak = 0;
                for (let j = sStart; j < sEnd; j++) {
                    const a = Math.abs(buf[j] || 0);
                    if (a > peak) peak = a;
                }
                const x = (i / (ptsCount - 1)) * W;
                const ampY = Math.min(midY - 2, peak * (midY - 2));
                topPts.push({ x, y: midY - ampY });
                botPts.push({ x, y: midY + ampY });
            }
        } else {
            for (let i = 0; i < ptsCount; i++) {
                const x = (i / (ptsCount - 1)) * W;
                const t = vStart + (i / ptsCount) * (vEnd - vStart);
                const env = Math.sin(t * Math.PI);
                const wave = (Math.sin(t * 30) * 0.5 + 0.5) * env * (midY - 6);
                topPts.push({ x, y: midY - wave });
                botPts.push({ x, y: midY + wave });
            }
        }

        let splineD = `M ${topPts[0].x} ${topPts[0].y}`;
        for (let i = 0; i < topPts.length - 1; i++) {
            const mx = (topPts[i].x + topPts[i + 1].x) / 2;
            const my = (topPts[i].y + topPts[i + 1].y) / 2;
            splineD += ` Q ${topPts[i].x} ${topPts[i].y}, ${mx} ${my}`;
        }
        splineD += ` L ${topPts[topPts.length - 1].x} ${topPts[topPts.length - 1].y}`;
        splineD += ` L ${botPts[botPts.length - 1].x} ${botPts[botPts.length - 1].y}`;
        for (let i = botPts.length - 1; i > 0; i--) {
            const mx = (botPts[i].x + botPts[i - 1].x) / 2;
            const my = (botPts[i].y + botPts[i - 1].y) / 2;
            splineD += ` Q ${botPts[i].x} ${botPts[i].y}, ${mx} ${my}`;
        }
        splineD += ` Z`;

        const vSpan = Math.max(0.001, vEnd - vStart);
        const toViewX = (r) => ((r - vStart) / vSpan) * W;

        const minNorm = Math.min(curStart, curEnd);
        const maxNorm = Math.max(curStart, curEnd);
        const selLeft = Math.max(0, toViewX(minNorm));
        const selRight = Math.min(W, toViewX(maxNorm));
        const spanW = Math.max(0, selRight - selLeft);

        const startX = toViewX(curStart);
        const endX = toViewX(curEnd);
        const headX = toViewX(curPos || 0);

        const isStartVisible = startX >= 0 && startX <= W;
        const isEndVisible = endX >= 0 && endX <= W;
        const isHeadVisible = isPlaying && headX >= 0 && headX <= W;

        return `
            <div class="relative w-full bg-black border border-b-0 border-slate-800 overflow-hidden select-none cursor-pointer tape-waveform-wrap rounded-none">
                <svg viewBox="0 0 ${W} ${H}" class="w-full h-20 block bg-black" preserveAspectRatio="none">
                    <!-- Grid lines -->
                    <line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="#1e293b" stroke-width="0.8"/>
                    <line x1="${W*0.25}" y1="0" x2="${W*0.25}" y2="${H}" stroke="#1e293b" stroke-width="0.5"/>
                    <line x1="${W*0.5}" y1="0" x2="${W*0.5}" y2="${H}" stroke="#1e293b" stroke-width="0.5"/>
                    <line x1="${W*0.75}" y1="0" x2="${W*0.75}" y2="${H}" stroke="#1e293b" stroke-width="0.5"/>

                    <!-- Waveform spline body (Monochrome black & white, no gradient) -->
                    <path id="tape-svg-wave-path" d="${splineD}" fill="#ffffff" stroke="#ffffff" stroke-width="1.0" stroke-linejoin="round"/>

                    <!-- Selection segment highlight (Solid semi-transparent white, NO top/bottom dotted lines) -->
                    <rect id="tape-svg-sel-rect" x="${selLeft}" y="0" width="${spanW}" height="${H}" fill="rgba(255, 255, 255, 0.18)" stroke="none"/>

                    <!-- Start and End vertical marker lines (SOLID lines) -->
                    <line id="tape-svg-start-line" x1="${startX}" y1="0" x2="${startX}" y2="${H}" stroke="#ffffff" stroke-width="1.5" class="${isStartVisible ? 'opacity-100' : 'opacity-0'}"/>
                    <line id="tape-svg-end-line" x1="${endX}" y1="0" x2="${endX}" y2="${H}" stroke="#ffffff" stroke-width="1.5" class="${isEndVisible ? 'opacity-100' : 'opacity-0'}"/>

                    <!-- Live Playhead line -->
                    <line id="tape-modal-playhead" x1="${headX}" y1="0" x2="${headX}" y2="${H}" stroke="#38bdf8" stroke-width="2" class="${isHeadVisible ? 'opacity-100' : 'opacity-0'} shadow-md"/>
                </svg>
            </div>`;
    },
    updateLive: (cell, data, isPlaying, modalEl, m) => {
        if (!data) return;
        const bar = cell?.querySelector('.tape-pos-bar');
        if (bar && data.pos !== undefined) {
            bar.style.width = `${Math.round(data.pos * 100)}%`;
        }
        const reelL = cell?.querySelector('.tape-reel-l');
        const reelR = cell?.querySelector('.tape-reel-r');
        if (reelL && reelR) {
            if (data.isPlaying) {
                reelL.classList.add('animate-spin');
                reelR.classList.add('animate-spin');
            } else {
                reelL.classList.remove('animate-spin');
                reelR.classList.remove('animate-spin');
            }
        }

        // モーダル側リアルタイム再生ヘッド更新（ズーム考慮）
        if (modalEl) {
            const head = modalEl.querySelector('#tape-modal-playhead');
            if (head && data.pos !== undefined) {
                const zoom = m?.zoom || 1.0;
                const vSpan = 1.0 / zoom;
                const vStart = m?.viewOffset || 0.0;
                const hX = ((data.pos - vStart) / vSpan) * 390;
                head.setAttribute('x1', hX);
                head.setAttribute('x2', hX);
                if (data.isPlaying && hX >= 0 && hX <= 390) {
                    head.classList.remove('opacity-0');
                    head.classList.add('opacity-100');
                } else {
                    head.classList.remove('opacity-100');
                    head.classList.add('opacity-0');
                }
            }
        }
    },
    renderModal: (m, ctx) => {
        const isLoop = !!m.loop;
        const curStart = Math.max(0, Math.min(1.0, m.start ?? 0.0));
        const curEnd = Math.max(0, Math.min(1.0, m.end !== undefined ? m.end : (curStart + (m.length ?? 1.0))));
        const curLen = Math.abs(curEnd - curStart);
        const isRev = curStart > curEnd;

        // Zoom & View Window
        const zoom = Math.max(1.0, Math.min(16.0, m.zoom || 1.0));
        m.zoom = zoom;
        const vSpan = 1.0 / zoom;
        const maxOffset = Math.max(0, 1.0 - vSpan);
        const vStart = Math.max(0, Math.min(maxOffset, m.viewOffset || 0.0));
        m.viewOffset = vStart;
        const vEnd = vStart + vSpan;

        // オーディオバッファ取得
        const fullId = `${ctx.currentPageId || "0"}/${m.id}`;
        const inst = ctx.synth?.modules?.[fullId] || ctx.synth?.modules?.[m.id];
        const liveData = inst?.read ? inst.read() : null;
        const sampleRate = ctx.audioCtx?.sampleRate || ctx.synth?.ctx?.sampleRate || 44100;
        const buf = (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE?.get(m.id)) || inst?._bufferData || AudioHelpers.generateDefaultPercussionBuffer(sampleRate);
        const totalDurSec = buf ? (buf.length / sampleRate) : (m.fileDuration ? parseFloat(m.fileDuration) : 1.6);
        const curStartMs = Math.round(curStart * totalDurSec * 1000);
        const curEndMs = Math.round(curEnd * totalDurSec * 1000);
        const curLenMs = Math.round(curLen * totalDurSec * 1000);

        // Handle track positions in zoomed space
        const toTrackPct = (r) => ((r - vStart) / vSpan) * 100;
        const startPct = toTrackPct(curStart);
        const endPct = toTrackPct(curEnd);
        const isStartInView = startPct >= 0 && startPct <= 100;
        const isEndInView = endPct >= 0 && endPct <= 100;
        const clampedStartPct = Math.max(0, Math.min(100, startPct));
        const clampedEndPct = Math.max(0, Math.min(100, endPct));

        const minNorm = Math.min(curStart, curEnd);
        const maxNorm = Math.max(curStart, curEnd);
        const minTrackPct = Math.max(0, Math.min(100, toTrackPct(minNorm)));
        const maxTrackPct = Math.max(0, Math.min(100, toTrackPct(maxNorm)));
        const spanWidthPct = Math.max(0, maxTrackPct - minTrackPct);

        return `
            <div class="space-y-1.5 p-1 w-full select-none">
                <!-- Top Bar: File, Loop/1-Shot, Trigger -->
                <div class="flex items-center justify-between gap-1.5 bg-slate-950 px-2 py-1.5 rounded-none border border-slate-800">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        <input id="tape-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" class="sr-only">
                        <label for="tape-file-input" id="tape-file-btn" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-none text-[8.5px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm select-none">
                            <span>📁 FILE</span>
                        </label>
                        ${m.fileName ? `
                            <button id="tape-reset-drum-btn" class="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none text-[7.5px] font-bold border border-slate-700 transition shrink-0 cursor-pointer" title="ドラムセットに戻す">
                                🥁 RESET
                            </button>
                        ` : ''}
                        <span class="text-[8px] font-mono text-amber-300 font-bold truncate">
                            ${m.fileName ? `📁 ${m.fileName}` : '🥁 DRUM SET'}
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button id="tape-loop-btn" class="px-2.5 py-1 rounded-none text-[8.5px] font-bold border transition-colors cursor-pointer ${isLoop ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700'}">
                            ${isLoop ? 'LOOP' : '1-SHOT'}
                        </button>
                        <button id="tape-test-trig-btn" class="px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white rounded-none text-[8.5px] font-bold shadow-md shadow-orange-500/30 transition flex items-center gap-1 active:scale-95 cursor-pointer">
                            <span>▶ TRIG</span>
                        </button>
                    </div>
                </div>

                <!-- Row 2: Waveform Time Info & Zoom Controls -->
                <div class="flex items-center justify-between text-[8px] font-mono text-slate-400 px-0.5">
                    <div class="flex items-center gap-2 font-mono text-[8px]">
                        <span class="text-slate-300 font-bold">START: <span id="tape-start-txt">${curStartMs}ms</span></span>
                        <span class="text-slate-300 font-bold">END: <span id="tape-end-txt">${curEndMs}ms</span></span>
                        <span class="text-amber-300 font-bold">LEN: <span id="tape-len-txt">${curLenMs}ms</span></span>
                    </div>
                    <!-- Zoom Controls -->
                    <div class="flex items-center gap-1">
                        <span class="text-[7.5px] text-slate-500 font-bold">ZOOM:</span>
                        <button id="tape-zoom-out-btn" class="w-5 h-4.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 rounded-none border border-slate-700 text-[9px] font-bold flex items-center justify-center cursor-pointer transition select-none" title="時間軸縮小">−</button>
                        <button id="tape-zoom-reset-btn" class="px-1.5 h-4.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-300 rounded-none border border-slate-700 text-[7.5px] font-bold flex items-center justify-center cursor-pointer transition select-none" title="全体表示 (1.0x)">
                            <span id="tape-zoom-val-txt">${zoom.toFixed(1)}x</span>
                        </button>
                        <button id="tape-zoom-in-btn" class="w-5 h-4.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 rounded-none border border-slate-700 text-[9px] font-bold flex items-center justify-center cursor-pointer transition select-none" title="時間軸拡大">＋</button>
                    </div>
                </div>

                <!-- 1. Waveform Window -->
                ${TAPE_MODULE_ENTRY.renderSplineWaveform(buf, curStart, curEnd, liveData?.pos || 0, liveData?.isPlaying || false, vStart, vEnd)}

                <!-- Mini Overview Track -->
                <div id="tape-overview-track" class="relative w-full h-1.5 bg-black border-x border-slate-800 overflow-hidden cursor-pointer select-none rounded-none" title="クリックしてズーム位置を移動">
                    <div id="tape-overview-sel" class="absolute top-0 bottom-0 bg-amber-500/40" style="left: ${minNorm * 100}%; width: ${(maxNorm - minNorm) * 100}%;"></div>
                    <div id="tape-overview-view" class="absolute top-0 bottom-0 bg-white/20 border border-white/60" style="left: ${vStart * 100}%; width: ${(vEnd - vStart) * 100}%;"></div>
                </div>

                <!-- 2. Dual Handles Track -->
                <div id="tape-handle-track" class="relative w-full h-5 bg-black border border-t-0 border-slate-800 touch-none flex items-center cursor-ew-resize overflow-hidden rounded-none">
                    <div class="absolute inset-x-1 h-1.5 bg-slate-900 border-y border-slate-800"></div>
                    <div id="tape-span-bar" class="absolute h-2.5 top-1/2 -translate-y-1/2 bg-slate-700/80 border-y border-slate-500 cursor-grab active:cursor-grabbing z-10 select-none shadow-sm" style="left: ${minTrackPct}%; width: ${spanWidthPct}%;"></div>
                    <div id="tape-start-handle" class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-4.5 bg-slate-200 hover:bg-white text-slate-950 active:scale-110 border border-slate-400 shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing z-20 select-none transition-opacity duration-150 rounded-none" style="left: ${clampedStartPct}%; opacity: ${isStartInView ? '1.0' : '0.45'};">
                        <span id="tape-start-icon" class="text-[7px] font-bold pointer-events-none leading-none select-none">${isRev ? '◀' : '▶'}</span>
                    </div>
                    <div id="tape-end-handle" class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-4.5 bg-slate-800 hover:bg-slate-700 text-white active:scale-110 border border-slate-600 shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing z-20 select-none transition-opacity duration-150 rounded-none" style="left: ${clampedEndPct}%; opacity: ${isEndInView ? '1.0' : '0.45'};">
                        <span id="tape-end-icon" class="text-[7px] font-bold pointer-events-none leading-none select-none">${isRev ? '▶' : '◀'}</span>
                    </div>
                </div>
            </div>`;
    },
    bindEvents: (m, ctx, cb) => {
        m.speed = 1.0;
        if (m.end === undefined) {
            m.end = (m.start ?? 0.0) + (m.length ?? 1.0);
        }

        // Local File Loader
        const loadLocalFile = async (file) => {
            if (!file) return;
            try {
                if (ctx.synth && !ctx.synth.ctx) {
                    await ctx.synth.init();
                }
                const audioCtx = ctx.synth?.ctx || ctx.audioCtx || (window.AudioContext && new AudioContext());
                if (!audioCtx) throw new Error('AudioContext unavailable');

                const buf = await AudioHelpers.loadAudioBufferFromFile(audioCtx, file);
                m.url = '';
                m.fileName = file.name;
                m.fileDuration = (buf.length / (audioCtx.sampleRate || 44100)).toFixed(2);

                if (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE) {
                    window.TAPE_BUFFER_CACHE.set(m.id, buf);
                }
                const fullId = `${ctx.currentPageId || "0"}/${m.id}`;
                let targetInst = ctx.synth?.modules?.[fullId] || ctx.synth?.modules?.[m.id];
                if (!targetInst && ctx.synth && ctx.synth.ctx) {
                    ctx.synth.addModule(fullId, 'TAPE', m, ctx.patched || new Set());
                    targetInst = ctx.synth.modules[fullId];
                }
                if (targetInst) {
                    targetInst._bufferData = buf;
                    targetInst.nodes?.w?.port.postMessage({ type: 'SET_BUFFER', buffer: buf });
                }

                ctx.reRenderModal();
                cb();
                ctx.showToast?.(`音声ファイル「${file.name}」を読み込みました (${m.fileDuration}秒)`);
            } catch (err) {
                console.error('[TAPE] Failed to load local file:', err);
                ctx.showToast?.(`ファイル読込エラー: ${err.message || 'デコードに失敗しました'}`);
            }
        };

        const fileInp = document.getElementById('tape-file-input');
        fileInp?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadLocalFile(e.target.files[0]);
                e.target.value = '';
            }
        });

        const waveWrap = document.querySelector('.tape-waveform-wrap');
        if (waveWrap) {
            waveWrap.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                waveWrap.classList.add('border-emerald-400', 'bg-emerald-950/40');
            });
            waveWrap.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                waveWrap.classList.remove('border-emerald-400', 'bg-emerald-950/40');
            });
            waveWrap.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                waveWrap.classList.remove('border-emerald-400', 'bg-emerald-950/40');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    loadLocalFile(e.dataTransfer.files[0]);
                }
            });
        }

        document.getElementById('tape-reset-drum-btn')?.addEventListener('click', () => {
            const sr = ctx.audioCtx?.sampleRate || ctx.synth?.ctx?.sampleRate || 44100;
            const defBuf = AudioHelpers.generateDefaultPercussionBuffer(sr);
            m.url = '';
            m.fileName = '';
            m.fileDuration = '1.60';
            if (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE) {
                window.TAPE_BUFFER_CACHE.set(m.id, defBuf);
            }
            const fullId = `${ctx.currentPageId || "0"}/${m.id}`;
            let targetInst = ctx.synth?.modules?.[fullId] || ctx.synth?.modules?.[m.id];
            if (targetInst) {
                targetInst._bufferData = defBuf;
                targetInst.nodes?.w?.port.postMessage({ type: 'SET_BUFFER', buffer: defBuf });
            }
            ctx.reRenderModal();
            cb();
            ctx.showToast?.('ドラムセット (4-Hit Perc) に戻しました');
        });

        const track = document.getElementById('tape-handle-track');
        const startH = document.getElementById('tape-start-handle');
        const endH = document.getElementById('tape-end-handle');
        const spanBar = document.getElementById('tape-span-bar');
        const startIcon = document.getElementById('tape-start-icon');
        const endIcon = document.getElementById('tape-end-icon');
        const selRect = document.getElementById('tape-svg-sel-rect');
        const startLine = document.getElementById('tape-svg-start-line');
        const endLine = document.getElementById('tape-svg-end-line');
        const startTxt = document.getElementById('tape-start-txt');
        const endTxt = document.getElementById('tape-end-txt');
        const lenTxt = document.getElementById('tape-len-txt');
        const zoomValTxt = document.getElementById('tape-zoom-val-txt');
        const overviewSel = document.getElementById('tape-overview-sel');
        const overviewView = document.getElementById('tape-overview-view');

        const syncUI = () => {
            const curStart = m.start ?? 0.0;
            const curEnd = m.end !== undefined ? m.end : (curStart + (m.length ?? 1.0));
            const curLen = Math.abs(curEnd - curStart);
            const isRev = curStart > curEnd;
            m.length = curLen;

            const zoom = Math.max(1.0, Math.min(16.0, m.zoom || 1.0));
            m.zoom = zoom;
            const vSpan = 1.0 / zoom;
            const maxOffset = Math.max(0, 1.0 - vSpan);
            const vStart = Math.max(0, Math.min(maxOffset, m.viewOffset || 0.0));
            m.viewOffset = vStart;
            const vEnd = vStart + vSpan;

            const fullId = `${ctx.currentPageId || "0"}/${m.id}`;
            const inst = ctx.synth?.modules?.[fullId] || ctx.synth?.modules?.[m.id];
            const liveData = inst?.read ? inst.read() : null;
            const buf = (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE?.get(m.id)) || inst?._bufferData || null;
            const sr = ctx.audioCtx?.sampleRate || ctx.synth?.ctx?.sampleRate || 44100;
            const totalDurSec = buf ? (buf.length / sr) : (m.fileDuration ? parseFloat(m.fileDuration) : 1.6);
            const sMs = Math.round(curStart * totalDurSec * 1000);
            const eMs = Math.round(curEnd * totalDurSec * 1000);
            const lMs = Math.round(curLen * totalDurSec * 1000);

            if (startTxt) startTxt.textContent = `${sMs}ms`;
            if (endTxt) endTxt.textContent = `${eMs}ms`;
            if (lenTxt) lenTxt.textContent = `${lMs}ms`;
            if (zoomValTxt) zoomValTxt.textContent = `${zoom.toFixed(1)}x`;

            if (startIcon) startIcon.textContent = isRev ? '◀' : '▶';
            if (endIcon) endIcon.textContent = isRev ? '▶' : '◀';

            const toTrackPct = (r) => ((r - vStart) / vSpan) * 100;
            const toViewX = (r) => ((r - vStart) / vSpan) * 390;

            const startPct = toTrackPct(curStart);
            const endPct = toTrackPct(curEnd);
            const isStartInView = startPct >= 0 && startPct <= 100;
            const isEndInView = endPct >= 0 && endPct <= 100;
            const clampedStartPct = Math.max(0, Math.min(100, startPct));
            const clampedEndPct = Math.max(0, Math.min(100, endPct));

            const minTrackPct = Math.max(0, Math.min(100, toTrackPct(Math.min(curStart, curEnd))));
            const maxTrackPct = Math.max(0, Math.min(100, toTrackPct(Math.max(curStart, curEnd))));
            const spanWidthPct = Math.max(0, maxTrackPct - minTrackPct);

            if (startH) {
                startH.style.left = `${clampedStartPct}%`;
                startH.style.opacity = isStartInView ? '1.0' : '0.45';
            }
            if (endH) {
                endH.style.left = `${clampedEndPct}%`;
                endH.style.opacity = isEndInView ? '1.0' : '0.45';
            }
            if (spanBar) {
                spanBar.style.left = `${minTrackPct}%`;
                spanBar.style.width = `${spanWidthPct}%`;
            }

            const minX = Math.max(0, Math.min(390, Math.min(toViewX(curStart), toViewX(curEnd))));
            const maxX = Math.max(0, Math.min(390, Math.max(toViewX(curStart), toViewX(curEnd))));
            const spanW = Math.max(0, maxX - minX);
            if (selRect) {
                selRect.setAttribute('x', minX);
                selRect.setAttribute('width', spanW);
            }
            const sX = toViewX(curStart);
            const eX = toViewX(curEnd);
            if (startLine) {
                startLine.setAttribute('x1', sX);
                startLine.setAttribute('x2', sX);
                if (sX >= 0 && sX <= 390) { startLine.classList.remove('opacity-0'); startLine.classList.add('opacity-100'); }
                else { startLine.classList.remove('opacity-100'); startLine.classList.add('opacity-0'); }
            }
            if (endLine) {
                endLine.setAttribute('x1', eX);
                endLine.setAttribute('x2', eX);
                if (eX >= 0 && eX <= 390) { endLine.classList.remove('opacity-0'); endLine.classList.add('opacity-100'); }
                else { endLine.classList.remove('opacity-100'); endLine.classList.add('opacity-0'); }
            }

            const minNorm = Math.min(curStart, curEnd);
            const maxNorm = Math.max(curStart, curEnd);
            if (overviewSel) {
                overviewSel.style.left = `${minNorm * 100}%`;
                overviewSel.style.width = `${(maxNorm - minNorm) * 100}%`;
            }
            if (overviewView) {
                overviewView.style.left = `${vStart * 100}%`;
                overviewView.style.width = `${vSpan * 100}%`;
            }
        };

        if (startH && track) {
            let dragging = false;
            startH.addEventListener('pointerdown', (e) => {
                dragging = true;
                startH.setPointerCapture(e.pointerId);
                e.stopPropagation();
            });
            startH.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                const rect = track.getBoundingClientRect();
                const ratioInTrack = Math.max(0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
                const vSpan = 1.0 / (m.zoom || 1.0);
                const vStart = m.viewOffset || 0.0;
                m.start = Math.max(0, Math.min(1.0, vStart + ratioInTrack * vSpan));
                if (m.end === undefined) m.end = (m.start ?? 0) + (m.length ?? 1.0);
                m.length = Math.abs(m.end - m.start);
                syncUI();
                cb();
            });
            const stop = () => { dragging = false; };
            startH.addEventListener('pointerup', stop);
            startH.addEventListener('pointercancel', stop);
        }

        if (endH && track) {
            let dragging = false;
            endH.addEventListener('pointerdown', (e) => {
                dragging = true;
                endH.setPointerCapture(e.pointerId);
                e.stopPropagation();
            });
            endH.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                const rect = track.getBoundingClientRect();
                const ratioInTrack = Math.max(0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
                const vSpan = 1.0 / (m.zoom || 1.0);
                const vStart = m.viewOffset || 0.0;
                m.end = Math.max(0, Math.min(1.0, vStart + ratioInTrack * vSpan));
                if (m.start === undefined) m.start = 0.0;
                m.length = Math.abs(m.end - m.start);
                syncUI();
                cb();
            });
            const stop = () => { dragging = false; };
            endH.addEventListener('pointerup', stop);
            endH.addEventListener('pointercancel', stop);
        }

        if (spanBar && track) {
            let dragging = false, startClientX = 0, initialStart = 0, initialEnd = 0;
            spanBar.addEventListener('pointerdown', (e) => {
                dragging = true;
                startClientX = e.clientX;
                initialStart = m.start ?? 0.0;
                initialEnd = m.end !== undefined ? m.end : (initialStart + (m.length ?? 1.0));
                spanBar.setPointerCapture(e.pointerId);
                e.stopPropagation();
            });
            spanBar.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                const rect = track.getBoundingClientRect();
                const vSpan = 1.0 / (m.zoom || 1.0);
                const deltaRatio = ((e.clientX - startClientX) / rect.width) * vSpan;
                const minV = Math.min(initialStart, initialEnd);
                const maxV = Math.max(initialStart, initialEnd);
                const clampedShift = Math.max(-minV, Math.min(1.0 - maxV, deltaRatio));
                m.start = initialStart + clampedShift;
                m.end = initialEnd + clampedShift;
                m.length = maxV - minV;
                syncUI();
                cb();
            });
            const stop = () => { dragging = false; };
            spanBar.addEventListener('pointerup', stop);
            spanBar.addEventListener('pointercancel', stop);
        }

        if (waveWrap) {
            waveWrap.addEventListener('pointerdown', (e) => {
                if (e.target.closest('#tape-handle-track') || e.target.closest('#tape-overview-track')) return;
                const rect = waveWrap.getBoundingClientRect();
                const ratioInView = Math.max(0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
                const vSpan = 1.0 / (m.zoom || 1.0);
                const vStart = m.viewOffset || 0.0;
                const ratio = Math.max(0, Math.min(1.0, vStart + ratioInView * vSpan));
                const curStart = m.start ?? 0.0;
                const curEnd = m.end !== undefined ? m.end : (curStart + (m.length ?? 1.0));
                const isRev = curStart > curEnd;
                const span = Math.abs(curEnd - curStart);
                m.start = ratio;
                if (isRev) {
                    m.end = Math.max(0, ratio - span);
                } else {
                    m.end = Math.min(1.0, ratio + span);
                }
                m.length = Math.abs(m.end - m.start);
                syncUI();
                cb();
            });
        }

        const applyZoom = (newZoom, anchorNorm = 0.5) => {
            const clampedZoom = Math.max(1.0, Math.min(16.0, newZoom));
            const newSpan = 1.0 / clampedZoom;
            let newOffset = anchorNorm - newSpan * 0.5;
            newOffset = Math.max(0, Math.min(1.0 - newSpan, newOffset));
            m.zoom = clampedZoom;
            m.viewOffset = newOffset;
            ctx.reRenderModal();
            cb();
        };

        document.getElementById('tape-zoom-in-btn')?.addEventListener('click', () => {
            const curCenter = (m.viewOffset || 0) + (1.0 / (m.zoom || 1.0)) * 0.5;
            applyZoom((m.zoom || 1.0) * 1.5, curCenter);
        });
        document.getElementById('tape-zoom-out-btn')?.addEventListener('click', () => {
            const curCenter = (m.viewOffset || 0) + (1.0 / (m.zoom || 1.0)) * 0.5;
            applyZoom((m.zoom || 1.0) / 1.5, curCenter);
        });
        document.getElementById('tape-zoom-reset-btn')?.addEventListener('click', () => {
            m.zoom = 1.0;
            m.viewOffset = 0.0;
            ctx.reRenderModal();
            cb();
        });

        if (waveWrap) {
            waveWrap.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = waveWrap.getBoundingClientRect();
                const vSpan = 1.0 / (m.zoom || 1.0);
                const vStart = m.viewOffset || 0.0;
                const mouseRatio = Math.max(0, Math.min(1.0, (e.clientX - rect.left) / rect.width));
                const mouseNorm = vStart + mouseRatio * vSpan;

                const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25;
                const newZoom = Math.max(1.0, Math.min(16.0, (m.zoom || 1.0) * factor));
                const newSpan = 1.0 / newZoom;
                let newOffset = mouseNorm - mouseRatio * newSpan;
                newOffset = Math.max(0, Math.min(1.0 - newSpan, newOffset));
                m.zoom = newZoom;
                m.viewOffset = newOffset;
                ctx.reRenderModal();
                cb();
            }, { passive: false });
        }

        const overviewTrack = document.getElementById('tape-overview-track');
        if (overviewTrack) {
            let draggingView = false;
            const updateFromOverview = (clientX) => {
                const rect = overviewTrack.getBoundingClientRect();
                const clickRatio = Math.max(0, Math.min(1.0, (clientX - rect.left) / rect.width));
                const vSpan = 1.0 / (m.zoom || 1.0);
                let newOffset = clickRatio - vSpan * 0.5;
                newOffset = Math.max(0, Math.min(1.0 - vSpan, newOffset));
                m.viewOffset = newOffset;
                ctx.reRenderModal();
                cb();
            };
            overviewTrack.addEventListener('pointerdown', (e) => {
                draggingView = true;
                overviewTrack.setPointerCapture(e.pointerId);
                updateFromOverview(e.clientX);
            });
            overviewTrack.addEventListener('pointermove', (e) => {
                if (draggingView) updateFromOverview(e.clientX);
            });
            const stopOverview = () => { draggingView = false; };
            overviewTrack.addEventListener('pointerup', stopOverview);
            overviewTrack.addEventListener('pointercancel', stopOverview);
        }

        document.getElementById('tape-loop-btn')?.addEventListener('click', () => {
            m.loop = !m.loop;
            ctx.reRenderModal();
            cb();
        });

        document.getElementById('tape-test-trig-btn')?.addEventListener('click', async () => {
            if (ctx.synth && !ctx.synth.ctx) {
                await ctx.synth.init();
            }
            if (ctx.synth?.ctx?.state === 'suspended') {
                await ctx.synth.resume();
            }
            const fullId = `${ctx.currentPageId || "0"}/${m.id}`;
            let inst = ctx.synth?.modules?.[fullId] || ctx.synth?.modules?.[m.id];
            if (!inst && ctx.synth && ctx.synth.ctx) {
                ctx.synth.addModule(fullId, 'TAPE', m, ctx.patched || new Set());
                inst = ctx.synth.modules[fullId];
            }
            inst?.nodes?.w?.port.postMessage({ type: 'TRIGGER' });
        });
    }
};

