import { UIHelpers } from '../ui/helpers.js';
import { parseStrudelPattern, STRUDEL_PRESETS, renderPatternHighlightedHTML } from '../core/strudel-parser.js';

export const MODULE_REGISTRY = {
    VCO: {
        color: 'blue',
        defaults: () => ({ type: 'VCO', channels: 1, quantize: true, wave: 'sawtooth', freq1: 220, freq2: 220, freq3: 220, freq4: 220 }),
        ports: (m) => ({ in: UIHelpers.getMultiPitchInPorts(m), out: [{ port: 'wave_out', color: 'bg-blue-500' }] }),
        renderPorts: (m, renderP, ports) => `
            <div class="absolute left-[3px] bottom-[3px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                ${renderP(ports.in || [])}
            </div>
            <div class="absolute right-[3px] bottom-[3px] flex items-center pointer-events-auto z-10">
                ${renderP(ports.out || [])}
            </div>`,
        renderGrid: (m) => {
            const isQ = m.quantize !== false;
            const f1 = m.freq1 || 220;
            const noteStr = isQ ? UIHelpers.midiToNoteName(UIHelpers.freqToMidi(f1)) : '';
            return `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400">
                <span class="text-[9px] font-bold uppercase">${m.wave || 'SAW'}</span>
                ${isQ ? `<span class="text-[13px] font-mono font-bold text-white tracking-tight">${noteStr}</span><span class="text-[8.5px] font-mono text-cyan-400/80">${Math.round(f1)}hz</span>` : `<span class="text-[13px] font-mono font-bold tracking-tight">${Math.round(f1)}<span class="text-[9px] ml-0.5">hz</span></span>`}
            </div>`;
        },
        renderModal: (m, ctx) => {
            const ch = Math.min(4, Math.max(1, m.channels || 1));
            const isQ = m.quantize !== false;
            const waves = [{ val: 'sawtooth', label: 'SAW' }, { val: 'square', label: 'SQR' }, { val: 'sine', label: 'SIN' }, { val: 'triangle', label: 'TRI' }];
            return `
                <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                    ${UIHelpers.createChannelControlHTML('vco', 'OSCS', ch)}
                    <button id="vco-qlz-btn" class="px-2 py-0.5 rounded text-[8.5px] font-bold border transition-colors ${isQ ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-800 text-slate-400 border-slate-700'}">QLZ: ${isQ ? 'ON' : 'OFF'}</button>
                </div>
                <div class="my-1.5">
                    <label class="block text-[8px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">Waveform</label>
                    <div class="grid grid-cols-4 gap-0.5">
                        ${waves.map(o => `<button class="vco-wave-btn py-0.5 rounded text-[8px] font-bold border transition-colors ${m.wave === o.val ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${o.val}">${o.label}</button>`).join('')}
                    </div>
                </div>
                <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 mt-1">
                    ${UIHelpers.renderPitchSlidersHTML(m, ctx, 'vco', 'blue', isQ)}
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const isQ = m.quantize !== false;
            document.getElementById('vco-qlz-btn')?.addEventListener('click', () => {
                m.quantize = !isQ;
                ctx.reRenderModal();
                cb();
            });
            UIHelpers.bindChannelControl('vco', m, ctx, 4, cb);
            UIHelpers.bindButtonGroup('.vco-wave-btn', 'bg-blue-600 text-white border-blue-500', 'bg-slate-800 text-slate-400 border-slate-700', val => {
                m.wave = val;
                cb();
            });
            UIHelpers.bindPitchSliders(m, ctx, 'vco', isQ, cb);
        }
    },
    VCF: {
        color: 'indigo',
        defaults: () => ({ type: 'VCF', cutoff: 1800, q: 2.5, filterType: 'lowpass', modDepth: 1200 }),
        ports: () => ({
            in: [
                { port: 'wave_in', color: 'bg-blue-500' },
                { port: 'cv_in', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        schema: {
            color: 'indigo',
            groups: [{ key: 'filterType', label: 'Mode', cols: 2, options: [{ val: 'lowpass', label: 'LP' }, { val: 'highpass', label: 'HP' }, { val: 'bandpass', label: 'BP' }, { val: 'notch', label: 'NOTCH' }] }],
            sliders: [
                { key: 'cutoff', label: 'CUTOFF', min: 30, max: 12000, step: 10, default: 1800, unit: 'hz', format: v => Math.round(v) + 'hz' },
                { key: 'q', label: 'RES (Q)', min: 0.1, max: 18, step: 0.1, default: 2.5, unit: 'q', format: v => v.toFixed(1) },
                { key: 'modDepth', label: 'CV MOD', min: 0, max: 3600, step: 50, default: 1200, unit: 'depth', color: 'amber', cvPort: 'cv_in', patchedVal: 0, patchedText: 'EXT', format: v => Math.round(v) }
            ]
        },
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400"><span class="text-[9px] font-bold uppercase">${m.filterType?.toUpperCase() || 'LP'}</span><span class="text-[13px] font-mono font-bold tracking-tight">${Math.round(m.cutoff || 1800)}<span class="text-[9px] ml-0.5">hz</span></span></div>`
    },
    VCA: {
        color: 'emerald',
        defaults: () => ({ type: 'VCA', level: 1.0, cvDepth: 1.0 }),
        ports: () => ({
            in: [
                { port: 'wave_in', color: 'bg-blue-500' },
                { port: 'cv_in', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        schema: {
            color: 'emerald',
            sliders: [
                { key: 'level', label: 'LEVEL', min: 0, max: 1.0, step: 0.01, default: 1.0, unit: 'BIAS', cvPort: 'cv_in', patchedVal: 0, patchedText: '0.00', format: v => v.toFixed(2) },
                { key: 'cvDepth', label: 'CV MOD', min: 0, max: 2.0, step: 0.05, default: 1.0, unit: 'xDEPTH', color: 'amber', format: v => v.toFixed(2) }
            ]
        },
        renderGrid: (m, ctx) => `<div class="flex items-center justify-center w-full h-full pointer-events-none"><div class="w-4 h-8 rounded-sm p-[1.5px] flex flex-col justify-end border border-slate-600 bg-slate-950/60"><div class="vca-meter-bar w-full bg-gradient-to-t from-emerald-600 to-cyan-400 rounded-xs" style="height: ${(ctx?.patched?.has('cv_in') ? 0 : Math.round((m.level??1)*100))}%;"></div></div></div>`,
        updateLive: (cell, data, isP, modal, m) => {
            const b = cell.querySelector('.vca-meter-bar');
            if (b) b.style.height = `${Math.max(0, Math.min(100, Math.round(((data?.hasCvIn ? data.values[0] : (m?.level ?? 1))) * 100)))}%`;
        }
    },
    FOLD: {
        color: 'sky',
        defaults: () => ({ type: 'FOLD', channels: 1, wave: 'sine', fold: 1.5, bias: 0.0, freq1: 220, freq2: 220, freq3: 220, freq4: 220 }),
        ports: (m) => ({
            in: [...UIHelpers.getMultiPitchInPorts(m), { port: 'fold_cv', color: 'bg-yellow-400' }],
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        renderPorts: (m, renderP, ports) => {
            const ch = Math.min(4, Math.max(1, m?.channels || 1));
            const pitchPorts = (ports.in || []).slice(0, ch);
            const foldCvPort = (ports.in || []).slice(ch);
            return `
                <div class="absolute left-[3px] bottom-[3px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                    ${renderP(pitchPorts)}
                </div>
                <div class="absolute bottom-[3px] left-[17px] pointer-events-auto z-10">
                    ${renderP(foldCvPort)}
                </div>
                <div class="absolute right-[3px] bottom-[3px] flex items-center pointer-events-auto z-10">
                    ${renderP(ports.out || [])}
                </div>`;
        },
        renderGrid: (m, ctx) => {
            const isFoldPatched = ctx?.patched?.has('fold_cv');
            const ch = Math.min(4, Math.max(1, m.channels || 1));
            const f1 = m.freq1 || 220;
            return `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400">
                <span class="text-[8px] font-bold uppercase">${m.wave || 'SIN'} (${ch}T)</span>
                <span class="text-[12px] font-mono font-bold">${Math.round(f1)}hz</span>
                <span class="text-[8px] font-mono">${isFoldPatched ? 'EXT' : 'F:' + (m.fold||0).toFixed(1)}</span>
            </div>`;
        },
        renderModal: (m, ctx) => {
            const ch = Math.min(4, Math.max(1, m.channels || 1));
            const waves = [{ val: 'sine', label: 'SIN' }, { val: 'triangle', label: 'TRI' }];
            const isFoldP = ctx.patched?.has('fold_cv');
            return `
                <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                    ${UIHelpers.createChannelControlHTML('fold', 'TIMBRES', ch)}
                    <div class="flex items-center gap-0.5">
                        ${waves.map(o => `<button class="fold-wave-btn px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${m.wave === o.val ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${o.val}">${o.label}</button>`).join('')}
                    </div>
                </div>
                <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 mt-1">
                    ${UIHelpers.renderPitchSlidersHTML(m, ctx, 'fold', 'sky', false)}
                    ${UIHelpers.createVSliderHTML('fold-fold', 'FOLD', 0, 5.0, 0.05, isFoldP ? 0 : (m.fold ?? 1.5), isFoldP ? 'PATCHED' : 'drv', 'amber', isFoldP, isFoldP ? 'EXT' : (m.fold ?? 1.5).toFixed(2))}
                    ${UIHelpers.createVSliderHTML('fold-bias', 'BIAS', -1.0, 1.0, 0.02, m.bias ?? 0.0, 'dc', 'purple', false, (m.bias ?? 0.0).toFixed(2))}
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            UIHelpers.bindChannelControl('fold', m, ctx, 4, cb);
            UIHelpers.bindButtonGroup('.fold-wave-btn', 'bg-sky-600 text-white border-sky-500', 'bg-slate-800 text-slate-400 border-slate-700', val => {
                m.wave = val;
                cb();
            });
            UIHelpers.bindPitchSliders(m, ctx, 'fold', false, cb);
            if (!ctx.patched?.has('fold_cv')) {
                UIHelpers.bindSlider('fold-fold', v => v.toFixed(2), v => { m.fold = v; cb(); });
            }
            UIHelpers.bindSlider('fold-bias', v => v.toFixed(2), v => { m.bias = v; cb(); });
        }
    },
    ADSR: {
        color: 'blue',
        defaults: () => ({ type: 'ADSR', attack: 0.02, attackCurve: 0.0, decay: 0.2, decayCurve: 0.0, sustain: 0.6, release: 0.4, releaseCurve: 0.0 }),
        ports: () => ({
            in: [{ port: 'gate_in', color: 'bg-orange-500' }],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        MAX_STAGES: [2, 3, 1, 5],
        schema: {
            color: 'blue',
            sliders: [
                { key: 'attack', label: 'A', min: 0.0005, max: 2.0, step: 0.001, default: 0.02, power: 2.5, unit: 'time', format: UIHelpers.formatTime },
                { key: 'attackCurve', label: 'AC', min: -1.0, max: 1.0, step: 0.05, default: 0.0, unit: 'crv', color: 'cyan', format: v => Math.abs(v) < 0.05 ? 'LIN' : (v < 0 ? `E${Math.round(-v*10)}` : `L${Math.round(v*10)}`) },
                { key: 'decay', label: 'D', min: 0.005, max: 3.0, step: 0.005, default: 0.2, power: 2.5, unit: 'time', format: UIHelpers.formatTime },
                { key: 'decayCurve', label: 'DC', min: -1.0, max: 1.0, step: 0.05, default: 0.0, unit: 'crv', color: 'cyan', format: v => Math.abs(v) < 0.05 ? 'LIN' : (v < 0 ? `E${Math.round(-v*10)}` : `L${Math.round(v*10)}`) },
                { key: 'sustain', label: 'S', min: 0.0, max: 1.0, step: 0.01, default: 0.6, unit: 'lvl', format: v => v.toFixed(2) },
                { key: 'release', label: 'R', min: 0.005, max: 5.0, step: 0.005, default: 0.4, power: 2.5, unit: 'time', format: UIHelpers.formatTime },
                { key: 'releaseCurve', label: 'RC', min: -1.0, max: 1.0, step: 0.05, default: 0.0, unit: 'crv', color: 'cyan', format: v => Math.abs(v) < 0.05 ? 'LIN' : (v < 0 ? `E${Math.round(-v*10)}` : `L${Math.round(v*10)}`) }
            ]
        },
        renderSvgCurve: (m) => {
            const padX = 8, padY = 5, W = 260 - padX * 2, H = 46 - padY * 2;
            const yTop = padY, yBot = padY + H;
            const ampH = H;
            const sus = Math.max(0, Math.min(1, m.sustain ?? 0.6));
            const ySus = yBot - sus * ampH;

            const viewTime = Math.max(0.02, m._viewTime ?? 1.0);
            const pxPerSec = W / viewTime;

            const att = Math.max(0.0001, m.attack ?? 0.02);
            const dec = Math.max(0.0001, m.decay ?? 0.2);
            const rel = Math.max(0.0001, m.release ?? 0.4);

            const wA = att * pxPerSec;
            const wD = dec * pxPerSec;
            const holdTime = Math.min(0.4, Math.max(0.02, viewTime * 0.15));
            const wS = holdTime * pxPerSec;
            const wR = rel * pxPerSec;

            const curveShape = (t, c) => {
                if (Math.abs(c) < 0.02) return t;
                const k = c * 4.0;
                return Math.expm1(k * t) / Math.expm1(k);
            };

            const maxX = padX + W;
            const rawPts = [];
            const N = 16;

            // Attack (0 -> 1)
            const xA0 = padX;
            rawPts.push([xA0, yBot]);
            if (wA < 1.5) {
                rawPts.push([xA0 + wA, yTop]);
            } else {
                for (let k = 1; k <= N; k++) {
                    const t = k / N;
                    const v = curveShape(t, -(m.attackCurve ?? 0.0));
                    rawPts.push([xA0 + t * wA, yBot - v * ampH]);
                }
            }

            // Decay (1 -> sustain)
            const xD0 = padX + wA;
            if (wD < 1.5) {
                rawPts.push([xD0 + wD, ySus]);
            } else {
                for (let k = 1; k <= N; k++) {
                    const t = k / N;
                    const v = 1.0 - curveShape(t, m.decayCurve ?? 0.0);
                    rawPts.push([xD0 + t * wD, ySus + v * (yTop - ySus)]);
                }
            }

            // Sustain
            const xS0 = padX + wA + wD;
            const xS1 = xS0 + wS;
            rawPts.push([xS1, ySus]);

            // Release (sustain -> 0)
            const xR0 = xS1;
            if (wR < 1.5) {
                rawPts.push([xR0 + wR, yBot]);
            } else {
                for (let k = 1; k <= N; k++) {
                    const t = k / N;
                    const v = 1.0 - curveShape(t, m.releaseCurve ?? 0.0);
                    rawPts.push([xR0 + t * wR, yBot - sus * ampH * v]);
                }
            }

            // Clip points to maxX
            const pts = [];
            for (let i = 0; i < rawPts.length; i++) {
                const p = rawPts[i];
                if (p[0] <= maxX) {
                    pts.push(p);
                } else {
                    const prev = rawPts[i - 1] || [padX, yBot];
                    const frac = (maxX - prev[0]) / Math.max(0.001, (p[0] - prev[0]));
                    const interpY = prev[1] + (p[1] - prev[1]) * Math.max(0, Math.min(1, frac));
                    pts.push([maxX, interpY]);
                    break;
                }
            }

            const lastP = pts[pts.length - 1];
            if (lastP[0] < maxX) {
                pts.push([maxX, yBot]);
            }

            const pathD = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
            const fillD = `${pathD} L ${maxX.toFixed(1)} ${yBot.toFixed(1)} L ${padX.toFixed(1)} ${yBot.toFixed(1)} Z`;

            let timeTicks = '';
            for (let div = 1; div < 4; div++) {
                const tickX = padX + (W * div) / 4;
                timeTicks += `<line x1="${tickX.toFixed(1)}" y1="${yTop}" x2="${tickX.toFixed(1)}" y2="${yBot}" stroke="#1e293b" stroke-width="0.5" stroke-dasharray="1,3"/>`;
            }

            const sepA = (wA >= 4 && (padX + wA) < maxX) ? `<line x1="${(padX + wA).toFixed(1)}" y1="${yTop}" x2="${(padX + wA).toFixed(1)}" y2="${yBot}" stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2"/>` : '';
            const sepD = (wD >= 4 && (padX + wA + wD) < maxX) ? `<line x1="${(padX + wA + wD).toFixed(1)}" y1="${yTop}" x2="${(padX + wA + wD).toFixed(1)}" y2="${yBot}" stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2"/>` : '';
            const sepS = ((padX + wA + wD + wS) < maxX) ? `<line x1="${(padX + wA + wD + wS).toFixed(1)}" y1="${yTop}" x2="${(padX + wA + wD + wS).toFixed(1)}" y2="${yBot}" stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2"/>` : '';

            const dotA = (padX + wA) <= maxX ? `<circle cx="${(padX + wA).toFixed(1)}" cy="${yTop}" r="2.5" fill="#38bdf8" />` : '';
            const dotD = (padX + wA + wD) <= maxX ? `<circle cx="${(padX + wA + wD).toFixed(1)}" cy="${ySus.toFixed(1)}" r="2" fill="#0284c7" />` : '';
            const dotS = (padX + wA + wD + wS) <= maxX ? `<circle cx="${(padX + wA + wD + wS).toFixed(1)}" cy="${ySus.toFixed(1)}" r="2" fill="#0284c7" />` : '';
            const dotR = (padX + wA + wD + wS + wR) <= maxX ? `<circle cx="${(padX + wA + wD + wS + wR).toFixed(1)}" cy="${yBot}" r="2" fill="#0284c7" />` : '';

            return `
                <svg viewBox="0 0 260 46" class="w-full h-12 select-none">
                    <defs>
                        <linearGradient id="adsr-curve-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/>
                            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.05"/>
                        </linearGradient>
                    </defs>
                    <line x1="${padX}" y1="${yBot}" x2="${maxX}" y2="${yBot}" stroke="#334155" stroke-width="1"/>
                    <line x1="${padX}" y1="${ySus.toFixed(1)}" x2="${maxX}" y2="${ySus.toFixed(1)}" stroke="#475569" stroke-width="0.75" stroke-dasharray="2,2"/>
                    ${timeTicks}
                    ${sepA}
                    ${sepD}
                    ${sepS}
                    <path d="${fillD}" fill="url(#adsr-curve-grad)" />
                    <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    ${dotA}
                    ${dotD}
                    ${dotS}
                    ${dotR}
                </svg>
            `;
        },
        renderModal: (m, ctx) => {
            const vTime = m._viewTime ?? 1.0;
            const sliderVal = Math.pow(Math.max(0, Math.min(1, (vTime - 0.02) / 9.98)), 1 / 2.5);
            return `
                <div id="adsr-curve-container" class="mb-1 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                    <div id="adsr-svg-wrap" class="w-full flex items-center justify-center">
                        ${MODULE_REGISTRY.ADSR.renderSvgCurve(m)}
                    </div>
                    <div class="flex items-center gap-1.5 px-1 pt-1 border-t border-slate-800/80">
                        <span class="text-[7.5px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">VIEW TIME</span>
                        <input type="range" id="adsr-view-time-slider" min="0" max="1" step="0.005" value="${sliderVal.toFixed(3)}" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400">
                        <span id="adsr-view-time-disp" class="text-[8px] font-mono text-cyan-300 font-bold min-w-[36px] text-right">${UIHelpers.formatTime(vTime)}</span>
                    </div>
                </div>
                ${UIHelpers.renderSchemaModal(m, ctx, MODULE_REGISTRY.ADSR.schema)}
            `;
        },
        bindEvents: (m, ctx, cb) => {
            const timeSlider = document.getElementById('adsr-view-time-slider');
            const timeDisp = document.getElementById('adsr-view-time-disp');
            const svgWrap = document.getElementById('adsr-svg-wrap');
            if (timeSlider) {
                timeSlider.addEventListener('input', (e) => {
                    const raw = parseFloat(e.target.value);
                    m._viewTime = 0.02 + 9.98 * Math.pow(Math.max(0, Math.min(1, raw)), 2.5);
                    if (timeDisp) timeDisp.textContent = UIHelpers.formatTime(m._viewTime);
                    if (svgWrap) svgWrap.innerHTML = MODULE_REGISTRY.ADSR.renderSvgCurve(m);
                });
            }
            UIHelpers.bindSchemaEvents(m, ctx, MODULE_REGISTRY.ADSR.schema, () => {
                if (svgWrap) svgWrap.innerHTML = MODULE_REGISTRY.ADSR.renderSvgCurve(m);
                cb();
            });
        },
        renderGrid: (m) => `<div class="flex items-end justify-center gap-1.5 w-full px-1.5 pointer-events-none adsr-bars-container">${[m.attack??0.02, m.decay??0.2, m.sustain??0.6, m.release??0.4].map((v, i) => `<div class="w-2 h-7 rounded-sm p-[1px] flex flex-col justify-end border border-slate-600 bg-slate-950/40"><div class="adsr-bar-${i} w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-xs" style="height: ${Math.max(5, Math.min(100, Math.round((v / (MODULE_REGISTRY.ADSR.MAX_STAGES[i] ?? 1))*100)))}%;"></div></div>`).join('')}</div>`,
        updateLive: (cell, data) => {
            const val = data?.values ? data.values[0] : 0;
            const container = cell.querySelector('.adsr-bars-container');
            if (container) {
                const isHot = val > 0.03;
                container.style.filter = isHot ? `drop-shadow(0 0 ${Math.min(8, Math.round(val * 8))}px rgba(34, 211, 238, 0.8))` : 'none';
                container.style.opacity = isHot ? (0.7 + val * 0.3).toFixed(2) : '0.7';
            }
        }
    },
    LFO: {
        color: 'indigo',
        DIVISIONS: ['4/1', '2/1', '1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/4D', '1/8D'],
        defaults: () => ({ type: 'LFO', waveType: 'sine', polarity: 'bipolar', syncMode: 'free', division: '1/4', rate: 2.0, depth: 1.0, phase: 0, duty: 0.5 }),
        ports: () => ({
            in: [
                { port: 'reset', color: 'bg-orange-500' },
                { port: 'cv_in', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        renderPorts: (m, renderP, ports) => `
            <div class="absolute left-[3px] bottom-[3px] flex items-center gap-1.5 pointer-events-auto z-10">
                ${renderP(ports.in || [])}
            </div>
            <div class="absolute right-[3px] bottom-[3px] flex items-center pointer-events-auto z-10">
                ${renderP(ports.out || [])}
            </div>`,
        renderGrid: (m) => {
            const isSync = m.syncMode === 'sync';
            const sp = m.polarity === 'unipolar' ? 'UNI' : 'BI';
            const rateDisp = isSync ? (m.division || '1/4') : `${(m.rate ?? 2).toFixed(1)}hz`;
            return `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-indigo-300">
                <span class="text-[8px] font-bold uppercase text-indigo-400">${(m.waveType || 'sin').substring(0,3)} (${sp})</span>
                <span class="text-[13px] font-mono font-bold text-white tracking-tight">${rateDisp}</span>
                <span class="text-[7.5px] font-mono text-indigo-400/80">φ:${Math.round(m.phase || 0)}°</span>
            </div>`;
        },
        renderModal: (m) => {
            const isSync = m.syncMode === 'sync';
            const waves = [
                { val: 'sine', label: 'SIN' },
                { val: 'triangle', label: 'TRI' },
                { val: 'sawtooth', label: 'SAW' },
                { val: 'ramp', label: 'RAMP' },
                { val: 'square', label: 'SQR' }
            ];
            const polarities = [
                { val: 'bipolar', label: 'BI (±)' },
                { val: 'unipolar', label: 'UNI (+)' }
            ];
            const divs = MODULE_REGISTRY.LFO.DIVISIONS;
            let divIdx = divs.indexOf(m.division || '1/4');
            if (divIdx === -1) divIdx = 4;

            return `
                <div class="space-y-1.5 p-0.5">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div class="flex items-center gap-1">
                            <button id="lfo-mode-free" class="px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${!isSync ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}">FREE (Hz)</button>
                            <button id="lfo-mode-sync" class="px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${isSync ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}">SYNC (BPM)</button>
                        </div>
                        <div class="flex items-center gap-0.5">
                            ${polarities.map(p => `<button class="lfo-pol-btn px-1.5 py-0.5 rounded text-[7.5px] font-bold border transition-colors ${m.polarity === p.val ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${p.val}">${p.label}</button>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="block text-[7.5px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">Waveform</label>
                        <div class="grid grid-cols-5 gap-0.5">
                            ${waves.map(w => `<button class="lfo-wave-btn py-0.5 rounded text-[8px] font-bold border transition-colors ${m.waveType === w.val ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${w.val}">${w.label}</button>`).join('')}
                        </div>
                    </div>
                    <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 gap-1">
                        ${isSync ? `
                            <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tight truncate w-full text-center">BEAT</span>
                                <span id="lfo-div-disp" class="text-[9px] text-indigo-300 font-mono font-bold hover:bg-slate-800/80 px-0.5 py-0.5 rounded">${m.division || '1/4'}</span>
                                <div class="h-24 flex items-center justify-center my-0.5">
                                    <input type="range" id="lfo-div-slider" min="0" max="${divs.length - 1}" step="1" value="${divIdx}" class="native-vslider accent-indigo-500">
                                </div>
                                <span class="text-[8px] font-mono text-slate-400">DIV</span>
                            </div>
                        ` : `
                            ${UIHelpers.createVSliderHTML('lfo-rate', 'RATE', 0.05, 30.0, 0.05, m.rate ?? 2.0, 'hz', 'indigo', false, `${(m.rate ?? 2.0).toFixed(2)}hz`)}
                        `}
                        ${UIHelpers.createVSliderHTML('lfo-phase', 'PHASE', 0, 360, 1, m.phase ?? 0, 'deg', 'indigo', false, `${Math.round(m.phase ?? 0)}°`)}
                        ${UIHelpers.createVSliderHTML('lfo-depth', 'DEPTH', 0, 5.0, 0.05, m.depth ?? 1.0, 'cv', 'indigo', false, (m.depth ?? 1.0).toFixed(2))}
                        ${UIHelpers.createVSliderHTML('lfo-duty', 'DUTY', 0.05, 0.95, 0.01, m.duty ?? 0.5, '%', 'indigo', false, `${Math.round((m.duty ?? 0.5) * 100)}%`)}
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const divs = MODULE_REGISTRY.LFO.DIVISIONS;
            document.getElementById('lfo-mode-free')?.addEventListener('click', () => { m.syncMode = 'free'; ctx.reRenderModal(); cb(); });
            document.getElementById('lfo-mode-sync')?.addEventListener('click', () => { m.syncMode = 'sync'; ctx.reRenderModal(); cb(); });

            UIHelpers.bindButtonGroup('.lfo-pol-btn', 'bg-indigo-600 text-white border-indigo-500', 'bg-slate-800 text-slate-400 border-slate-700', val => {
                m.polarity = val;
                cb();
            });
            UIHelpers.bindButtonGroup('.lfo-wave-btn', 'bg-indigo-600 text-white border-indigo-500', 'bg-slate-800 text-slate-400 border-slate-700', val => {
                m.waveType = val;
                cb();
            });

            if (m.syncMode === 'sync') {
                document.getElementById('lfo-div-slider')?.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.value);
                    m.division = divs[idx] || '1/4';
                    const d = document.getElementById('lfo-div-disp');
                    if (d) d.textContent = m.division;
                    cb();
                });
            } else {
                UIHelpers.bindSlider('lfo-rate', v => `${v.toFixed(2)}hz`, v => { m.rate = v; cb(); });
            }

            UIHelpers.bindSlider('lfo-phase', v => `${Math.round(v)}°`, v => { m.phase = Math.round(v); cb(); });
            UIHelpers.bindSlider('lfo-depth', v => v.toFixed(2), v => { m.depth = v; cb(); });
            UIHelpers.bindSlider('lfo-duty', v => `${Math.round(v * 100)}%`, v => { m.duty = v; cb(); });
        }
    },
    DELAY: {
        color: 'teal',
        defaults: () => ({ type: 'DELAY', delayTime: 0.3, feedback: 0.4, mix: 0.5 }),
        ports: () => ({
            in: [{ port: 'wave_in', color: 'bg-blue-500' }],
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        schema: {
            color: 'teal',
            sliders: [
                { key: 'delayTime', label: 'TIME', min: 0.02, max: 1.5, step: 0.01, default: 0.3, unit: 's', format: v => v.toFixed(2) + 's' },
                { key: 'feedback', label: 'FEEDBACK', min: 0, max: 0.95, step: 0.01, default: 0.4, unit: 'fb', format: v => v.toFixed(2) },
                { key: 'mix', label: 'MIX', min: 0, max: 1.0, step: 0.02, default: 0.5, unit: 'wet', format: v => v.toFixed(2) }
            ]
        },
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-tight pointer-events-none text-cyan-400"><span class="text-[13px] font-mono font-bold">${Math.round((m.delayTime??0.3)*1000)}ms</span><span class="text-[9px] font-mono">fb:${(m.feedback??0.4).toFixed(2)}</span></div>`
    },
    CVDELAY: {
        color: 'teal',
        defaults: () => ({ type: 'CVDELAY', timeMs: 50, cvDepth: 1.0 }),
        ports: () => ({
            in: [
                { port: 'time_cv', color: 'bg-yellow-400' },
                { port: 'sig_in', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        renderPorts: (m, renderP, ports) => `
            <div class="absolute left-[3px] bottom-[3px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                ${renderP(ports.in || [])}
            </div>
            <div class="absolute right-[3px] bottom-[3px] flex items-center pointer-events-auto z-10">
                ${renderP(ports.out || [])}
            </div>`,
        schema: {
            color: 'teal',
            sliders: [
                { key: 'timeMs', label: 'DELAY', min: 0, max: 2000, step: 1, default: 50, unit: 'ms', cvPort: 'time_cv', patchedVal: 50, patchedText: 'EXT CV', format: v => `${Math.round(v)}ms` },
                { key: 'cvDepth', label: 'CV MOD', min: 0, max: 2.0, step: 0.05, default: 1.0, unit: 'xMOD', color: 'amber', format: v => v.toFixed(2) }
            ]
        },
        renderGrid: (m, ctx) => {
            const isP = ctx?.patched?.has('time_cv');
            return `<div class="flex flex-col items-center justify-center leading-tight pointer-events-none text-teal-300">
                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400">CV DELAY</span>
                <span class="text-[13px] font-mono font-bold">${isP ? 'EXT' : `${Math.round(m.timeMs ?? 50)}<span class="text-[9px] ml-0.5">ms</span>`}</span>
            </div>`;
        }
    },
    REVERB: {
        color: 'violet',
        defaults: () => ({ type: 'REVERB', time: 1.8, damp: 4500, mix: 0.4, mode: 'hall' }),
        ports: () => ({
            in: [
                { port: 'wave_in', color: 'bg-blue-500' },
                { port: 'cv_in', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        schema: {
            color: 'violet',
            groups: [{ key: 'mode', label: 'Mode', cols: 3, options: [{ val: 'room', label: 'ROOM' }, { val: 'hall', label: 'HALL' }, { val: 'plate', label: 'PLATE' }] }],
            sliders: [
                { key: 'time', label: 'TIME', min: 0.2, max: 6.0, step: 0.1, default: 1.8, unit: 's', format: v => v.toFixed(1) + 's' },
                { key: 'damp', label: 'DAMP', min: 500, max: 16000, step: 100, default: 4500, unit: 'hz', format: v => (v>=1000?`${(v/1000).toFixed(1)}k`:Math.round(v))+'hz' },
                { key: 'mix', label: 'MIX', min: 0, max: 1.0, step: 0.02, default: 0.4, unit: 'wet', format: v => v.toFixed(2) }
            ]
        },
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400"><span class="text-[8px] font-bold uppercase">${m.mode||'HALL'}</span><span class="text-[13px] font-mono font-bold">${(m.time??1.8).toFixed(1)}s</span></div>`
    },
    MIX: {
        color: 'blue',
        defaults: () => ({ type: 'MIX', channels: 2, lvl1: 1.0, lvl2: 1.0, lvl3: 1.0, lvl4: 1.0 }),
        ports: (m) => ({
            in: Array.from({ length: m.channels || 2 }, (_, i) => ({ port: `wave_in${i+1}`, color: 'bg-blue-500' })),
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        renderGrid: (m) => `<div class="flex items-end justify-center gap-1.5 w-full px-1.5 pointer-events-none">${Array.from({length: m.channels||2}, (_, i) => `<div class="w-2 h-7 rounded-sm p-[1px] flex flex-col justify-end border border-slate-600 bg-slate-950/40"><div class="w-full bg-gradient-to-t from-blue-600 to-cyan-400" style="height: ${Math.round((m[`lvl${i+1}`]??1)*100)}%;"></div></div>`).join('')}</div>`,
        renderModal: (m, ctx) => {
            let s = ''; for (let c = 1; c <= (m.channels||2); c++) s += UIHelpers.createVSliderHTML(`mix-lvl${c}`, `CH${c}`, 0, 1.0, 0.01, m[`lvl${c}`]??1, 'lvl', 'blue');
            return `<div class="flex items-center justify-between pb-1 border-b border-slate-800"><span class="text-[8px] text-slate-400 font-semibold uppercase">CHANNELS</span><div class="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800"><button id="mix-dec-btn" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold">−</button><span class="w-5 text-center text-[10px] font-mono font-bold text-cyan-300">${m.channels||2}</span><button id="mix-inc-btn" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold">＋</button></div></div><div class="flex items-center justify-between py-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80 mt-1 gap-1">${s}</div>`;
        },
        bindEvents: (m, ctx, cb) => {
            for (let c = 1; c <= (m.channels||2); c++) UIHelpers.bindSlider(`mix-lvl${c}`, v => v.toFixed(2), v => { m[`lvl${c}`] = v; cb(); });
            document.getElementById('mix-dec-btn')?.addEventListener('click', () => { if ((m.channels||2) > 2) { ctx.removeConnectionsForPort(`wave_in${m.channels}`); m.channels--; ctx.reRenderModal(); cb(); } });
            document.getElementById('mix-inc-btn')?.addEventListener('click', () => { if ((m.channels||2) < 4) { m.channels = (m.channels||2) + 1; ctx.reRenderModal(); cb(); } });
        }
    },
    SLIDER: {
        color: 'emerald',
        defaults: () => ({ type: 'SLIDER', vol: 0.70 }),
        ports: () => ({ in: [], out: [{ port: 'cv_out', color: 'bg-yellow-400' }] }),
        schema: { color: 'emerald', sliders: [{ key: 'vol', label: 'VAL', min: 0, max: 1.0, step: 0.01, default: 0.70, unit: 'out', format: v => v.toFixed(2) }] },
        renderGrid: (m) => `<div class="flex items-end justify-center w-full px-1.5 pointer-events-none"><div class="w-3.5 h-7 rounded-sm p-[1px] flex flex-col justify-end border border-slate-600 bg-slate-950/40"><div class="w-full bg-gradient-to-t from-blue-600 to-cyan-400" style="height: ${Math.round((m.vol??0.7)*100)}%;"></div></div></div>`
    },
    NOISE: {
        color: 'emerald',
        defaults: () => ({ type: 'NOISE', noiseType: 'white', tone: 8000, level: 0.8 }),
        ports: () => ({ in: [], out: [{ port: 'wave_out', color: 'bg-blue-500' }] }),
        schema: {
            color: 'emerald',
            groups: [{ key: 'noiseType', label: 'Color', cols: 3, options: [{ val: 'white', label: 'WHT' }, { val: 'pink', label: 'PNK' }, { val: 'brown', label: 'BRN' }] }],
            sliders: [
                { key: 'tone', label: 'TONE', min: 200, max: 16000, step: 100, default: 8000, unit: 'hz', format: v => (v>=1000?`${(v/1000).toFixed(1)}k`:Math.round(v))+'hz' },
                { key: 'level', label: 'LEVEL', min: 0, max: 1.0, step: 0.01, default: 0.8, unit: 'lvl', format: v => v.toFixed(2) }
            ]
        },
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400"><span class="text-[9px] font-bold uppercase">${(m.noiseType||'white').substring(0,3)}</span><span class="text-[13px] font-mono font-bold">${(m.level??0.8).toFixed(2)}</span></div>`
    },
    CLK: {
        color: 'rose',
        defaults: () => ({ type: 'CLK', div: 'x2', pulseWidthMs: 15, limitPct: 90 }),
        ports: () => ({ in: [], out: [{ port: 'gate_out', color: 'bg-red-500' }] }),
        renderGrid: (m, ctx) => {
            const bpm = ctx?.bpm || 120, mult = parseFloat(String(m.div||'x2').replace('x','')) || 2;
            const intMs = Math.round((60.0/bpm/mult)*1000);
            const limPct = m.limitPct ?? 90;
            const maxMs = Math.max(1, Math.round(intMs * (limPct / 100)));
            const curP = m.pulseWidthMs ?? 15;
            const effMs = Math.min(curP, maxMs);
            return `<div class="flex flex-col items-center justify-center leading-tight gap-0.5 pointer-events-none text-cyan-400"><span class="text-[15px] font-mono font-bold">${m.div||'x2'}</span><span class="text-[10px] font-mono font-semibold">${effMs}ms</span></div>`;
        },
        renderModal: (m, ctx) => {
            const bpm = ctx?.bpm || 120, mult = parseInt(String(m.div||'x2').replace('x',''))||2, intMs = Math.round((60.0/bpm/mult)*1000);
            const limPct = m.limitPct ?? 90;
            const maxAllowedMs = Math.max(1, Math.round(intMs * (limPct / 100)));
            const curPulse = m.pulseWidthMs ?? 15;
            const isClamped = curPulse > maxAllowedMs;
            const effectiveMs = isClamped ? maxAllowedMs : curPulse;
            return `
                <div class="flex flex-col gap-1.5 p-1">
                    <div id="clk-banner" class="w-full py-1 rounded text-center text-[9.5px] font-mono font-bold border transition-colors ${isClamped ? 'bg-amber-950/80 text-amber-300 border-amber-500/70' : 'bg-rose-950/80 text-rose-300 border-rose-500/70'}">
                        GATE: ${effectiveMs}ms / ${intMs}ms
                    </div>
                    <div class="flex items-center justify-around bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 gap-1">
                        ${UIHelpers.createVSliderHTML('clk-gate', 'PULSE', 2, 1500, 1, curPulse, 'ms', 'rose', false, `${curPulse}ms`)}
                        ${UIHelpers.createVSliderHTML('clk-limit', 'LIMIT', 10, 99, 1, limPct, '%', 'amber', false, `${limPct}%`)}
                        ${UIHelpers.createVSliderHTML('clk-rate', 'MULT', 1, 8, 1, mult, 'x', 'rose', false, `x${mult}`)}
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const updateBanner = () => {
                const bpm = ctx?.bpm || 120;
                const mult = parseInt(String(m.div || 'x2').replace('x', '')) || 2;
                const intMs = Math.round((60.0 / bpm / mult) * 1000);
                const limPct = m.limitPct ?? 90;
                const maxAllowedMs = Math.max(1, Math.round(intMs * (limPct / 100)));
                const curPulse = m.pulseWidthMs ?? 15;
                const isClamped = curPulse > maxAllowedMs;
                const effMs = isClamped ? maxAllowedMs : curPulse;

                const banner = document.getElementById('clk-banner');
                if (banner) {
                    banner.className = `w-full py-1 rounded text-center text-[9.5px] font-mono font-bold border transition-colors ${
                        isClamped ? 'bg-amber-950/80 text-amber-300 border-amber-500/70' : 'bg-rose-950/80 text-rose-300 border-rose-500/70'
                    }`;
                    banner.textContent = `GATE: ${effMs}ms / ${intMs}ms`;
                }
            };

            UIHelpers.bindSlider('clk-gate', v => `${Math.round(v)}ms`, v => {
                m.pulseWidthMs = Math.round(v);
                updateBanner();
                cb();
            });
            UIHelpers.bindSlider('clk-limit', v => `${Math.round(v)}%`, v => {
                m.limitPct = Math.round(v);
                updateBanner();
                cb();
            });
            UIHelpers.bindSlider('clk-rate', v => `x${Math.round(v)}`, v => {
                m.div = `x${Math.round(v)}`;
                updateBanner();
                cb();
            });
        }
    },
    THROUGH: {
        color: 'amber',
        defaults: () => ({ type: 'THROUGH', state: true }),
        ports: () => ({
            in: [{ port: 'wave_in', color: 'bg-blue-500' }],
            out: [{ port: 'wave_out', color: 'bg-blue-500' }]
        }),
        UI_STATES: {
            true:  { badgeCls: 'bg-amber-500/20 text-amber-300', badgeLabel: 'THRU', btnCls: 'bg-amber-500 text-slate-950 border-amber-300', btnText: 'PASSING (THRU)' },
            false: { badgeCls: 'bg-slate-950 text-slate-600',       badgeLabel: 'MUTE', btnCls: 'bg-black text-slate-500 border-slate-800',       btnText: 'MUTED (OFF)' }
        },
        renderGrid: (m) => {
            const st = MODULE_REGISTRY.THROUGH.UI_STATES[m.state !== false];
            return `<div class="flex items-center justify-center w-full h-full pointer-events-none"><div class="w-7 h-5 rounded border border-slate-600 flex items-center justify-center ${st.badgeCls} font-bold text-[8px] tracking-tight">${st.badgeLabel}</div></div>`;
        },
        renderModal: (m, ctx) => {
            const st = MODULE_REGISTRY.THROUGH.UI_STATES[m.state !== false];
            return `<div class="flex flex-col items-center p-2"><button id="toggle-switch-btn" class="w-full py-2 rounded-lg font-bold text-xs border ${st.btnCls}">${st.btnText}</button></div>`;
        },
        bindEvents: (m, ctx, cb) => { document.getElementById('toggle-switch-btn')?.addEventListener('click', () => { m.state = !m.state; ctx.reRenderModal(); cb(); }); }
    },
    MATH1: {
        color: 'purple',
        MODES: ['ABS', 'FLOOR', 'CEIL', 'ROUND', 'INT'],
        defaults: () => ({ type: 'MATH1', mode: 'ABS', valA: 0.0 }),
        ports: () => ({
            in: [{ port: 'a', color: 'bg-yellow-400' }],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        renderGrid: (m) => `
            <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400">
                <span class="text-[9px] font-bold uppercase text-purple-400 tracking-tight">${m.mode || 'ABS'}</span>
                <span class="math-disp-val text-[12px] font-mono font-bold text-cyan-300 tracking-tight">+0.00</span>
            </div>`,
        updateLive: (cell, data) => {
            const d = cell.querySelector('.math-disp-val');
            if (d && data?.values) d.textContent = (data.values[0] >= 0 ? '+' : '') + Number(data.values[0] || 0).toFixed(2);
        },
        renderModal: (m, ctx) => {
            const pA = ctx.patched?.has('a');
            const curMode = m.mode || 'ABS';
            const fmt = v => (v >= 0 ? '+' : '') + Number(v || 0).toFixed(2);
            return `
                <div class="space-y-1.5 p-0.5">
                    <div>
                        <div class="text-[7.5px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Functions (A)</div>
                        <div class="grid grid-cols-5 gap-0.5">
                            ${MODULE_REGISTRY.MATH1.MODES.map(md => `
                                <button class="math1-mode-btn py-0.5 rounded text-[8px] font-bold border transition-colors ${curMode === md ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-mode="${md}">${md}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="pt-0.5">
                        <button id="math1-val-a" class="w-full py-1 px-1.5 rounded border text-[9px] font-mono font-bold flex items-center justify-between ${pA ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 border-purple-500/60 text-purple-200 active:bg-purple-900'}">
                            <span class="text-[7.5px] text-slate-400">CONSTANT A</span>
                            <span>${pA ? 'EXT' : fmt(m.valA ?? 0.0)}</span>
                        </button>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            document.querySelectorAll('.math1-mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    m.mode = e.currentTarget.dataset.mode;
                    ctx.reRenderModal();
                    cb();
                });
            });
            const btn = document.getElementById('math1-val-a');
            if (btn && !ctx.patched?.has('a')) {
                btn.addEventListener('click', async () => {
                    const res = await ctx.prompt('CONSTANT A', String(m.valA ?? 0.0));
                    if (res !== null && res !== '') {
                        const num = parseFloat(res);
                        if (!isNaN(num)) {
                            m.valA = num;
                            ctx.reRenderModal();
                            cb();
                        }
                    }
                });
            }
        }
    },
    MATH2: {
        color: 'purple',
        ARITHMETIC_MODES: ['ADD', 'DIFF', 'MULTI', 'MOD', 'A^B', 'MIN', 'MAX'],
        COMPARISON_MODES: ['<', '<=', '==', '>=', '>'],
        defaults: () => ({ type: 'MATH2', mode: 'ADD', valA: 0.0, valB: 1.0 }),
        ports: () => ({
            in: [
                { port: 'b', color: 'bg-yellow-400' },
                { port: 'a', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        renderPorts: (m, renderP, ports) => `
            <div class="absolute left-[3px] bottom-[3px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                ${renderP(ports.in || [])}
            </div>
            <div class="absolute right-[3px] bottom-[3px] flex items-center pointer-events-auto z-10">
                ${renderP(ports.out || [])}
            </div>`,
        renderGrid: (m) => {
            const mode = m.mode || 'ADD';
            const escMode = mode === '<' ? '&lt;' : (mode === '<=' ? '&lt;=' : mode);
            return `
            <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400">
                <span class="text-[9px] font-bold uppercase text-purple-400 tracking-tight">${escMode}</span>
                <span class="math-disp-val text-[12px] font-mono font-bold text-cyan-300 tracking-tight">+0.00</span>
            </div>`;
        },
        updateLive: (cell, data) => {
            const d = cell.querySelector('.math-disp-val');
            if (d && data?.values) d.textContent = (data.values[0] >= 0 ? '+' : '') + Number(data.values[0] || 0).toFixed(2);
        },
        renderModal: (m, ctx) => {
            const pA = ctx.patched?.has('a'), pB = ctx.patched?.has('b');
            const curMode = m.mode || 'ADD';
            const fmt = v => (v >= 0 ? '+' : '') + Number(v || 0).toFixed(2);
            return `
                <div class="space-y-1.5 p-0.5">
                    <div>
                        <div class="text-[7.5px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Arithmetic</div>
                        <div class="grid grid-cols-4 gap-0.5">
                            ${MODULE_REGISTRY.MATH2.ARITHMETIC_MODES.map(md => `
                                <button class="math2-mode-btn py-0.5 rounded text-[8px] font-bold border transition-colors ${curMode === md ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-mode="${md}">${md}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <div class="text-[7.5px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Comparison (A vs B)</div>
                        <div class="grid grid-cols-5 gap-0.5">
                            ${MODULE_REGISTRY.MATH2.COMPARISON_MODES.map(md => `
                                <button class="math2-mode-btn py-0.5 rounded text-[8.5px] font-mono font-bold border transition-colors ${curMode === md ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-mode="${md}">${md === '<' ? '&lt;' : (md === '<=' ? '&lt;=' : md)}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button id="math2-val-a" class="py-1 px-1.5 rounded border text-[9px] font-mono font-bold flex items-center justify-between ${pA ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 border-purple-500/60 text-purple-200 active:bg-purple-900'}">
                            <span class="text-[7.5px] text-slate-400">A</span>
                            <span>${pA ? 'EXT' : fmt(m.valA ?? 0.0)}</span>
                        </button>
                        <button id="math2-val-b" class="py-1 px-1.5 rounded border text-[9px] font-mono font-bold flex items-center justify-between ${pB ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 border-purple-500/60 text-purple-200 active:bg-purple-900'}">
                            <span class="text-[7.5px] text-slate-400">B</span>
                            <span>${pB ? 'EXT' : fmt(m.valB ?? 1.0)}</span>
                        </button>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            document.querySelectorAll('.math2-mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    m.mode = e.currentTarget.dataset.mode;
                    ctx.reRenderModal();
                    cb();
                });
            });
            const setupValBtn = (id, key, defVal) => {
                const btn = document.getElementById(id);
                const portName = key.replace('val', '').toLowerCase();
                if (btn && !ctx.patched?.has(portName)) {
                    btn.addEventListener('click', async () => {
                        const res = await ctx.prompt(`CONSTANT ${portName.toUpperCase()}`, String(m[key] ?? defVal));
                        if (res !== null && res !== '') {
                            const num = parseFloat(res);
                            if (!isNaN(num)) {
                                m[key] = num;
                                ctx.reRenderModal();
                                cb();
                            }
                        }
                    });
                }
            };
            setupValBtn('math2-val-a', 'valA', 0.0);
            setupValBtn('math2-val-b', 'valB', 1.0);
        }
    },
    SH: {
        color: 'fuchsia',
        defaults: () => ({ type: 'SH', glide: 0.0, scale: 1.0, polarity: 'unipolar' }),
        ports: () => ({
            in: [
                { port: 'sig_in', color: 'bg-yellow-400' },
                { port: 'trig_in', color: 'bg-orange-500' }
            ],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        schema: {
            color: 'fuchsia',
            groups: [{ key: 'polarity', label: 'Internal Source', cols: 2, options: [{ val: 'unipolar', label: 'UNI (0〜1V)' }, { val: 'bipolar', label: 'BI (±1V)' }] }],
            sliders: [
                { key: 'glide', label: 'GLIDE', min: 0.0, max: 0.5, step: 0.01, default: 0.0, unit: 's', color: 'fuchsia', format: v => v<=0.001?'OFF':Math.round(v*1000)+'ms' },
                { key: 'scale', label: 'SCALE', min: -3.0, max: 3.0, step: 0.05, default: 1.0, unit: 'x', color: 'fuchsia', format: v => (v>=0?'+':'')+v.toFixed(2) }
            ]
        },
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400"><span class="text-[8px] font-bold uppercase">S&amp;H</span><span class="sh-disp-val text-[14px] text-cyan-300 font-mono font-bold">+0.00</span></div>`,
        updateLive: (cell, data) => { const d = cell.querySelector('.sh-disp-val'); if (d && data?.values) d.textContent = (data.values[0]>=0?'+':'') + Number(data.values[0]||0).toFixed(2); },
        renderModal: (m, ctx) => `
            <div class="flex items-center justify-between pb-1 border-b border-slate-800 px-1">
                <span class="text-[8px] font-mono text-fuchsia-300 font-bold">${ctx.patched?.has('sig_in')?'EXT SIGNAL':'INTERNAL NOISE'}</span>
                <button id="sh-trig-btn" class="px-2 py-0.5 rounded text-[8.5px] font-bold bg-fuchsia-600 text-white border border-fuchsia-400">TRIG</button>
            </div>${UIHelpers.renderSchemaModal(m, ctx, MODULE_REGISTRY.SH.schema)}`,
        bindEvents: (m, ctx, cb) => {
            UIHelpers.bindSchemaEvents(m, ctx, MODULE_REGISTRY.SH.schema, cb);
            document.getElementById('sh-trig-btn')?.addEventListener('click', () => ctx.triggerManualSample?.());
        }
    },
    SCOPE: {
        color: 'cyan',
        defaults: () => ({ type: 'SCOPE', timeSpan: 0.05, vRange: 5.0, trigMode: 'auto', displayMode: 'time', ySpread: 0.2 }),
        ports: () => ({
            in: [
                { port: 'in2', color: 'bg-yellow-400', badgeColor: 'bg-purple-400' },
                { port: 'in1', color: 'bg-yellow-400', badgeColor: 'bg-cyan-400' },
                { port: 'trig', color: 'bg-orange-500' }
            ],
            out: []
        }),
        renderPorts: (m, renderP, ports) => {
            const chPorts = (ports.in || []).filter(p => p.port !== 'trig');
            const trigPort = (ports.in || []).filter(p => p.port === 'trig');
            return `
                <div class="absolute left-[3px] bottom-[3px] flex items-end gap-1 pointer-events-auto z-20">
                    <div class="flex flex-col-reverse gap-1.5 items-center">
                        ${renderP(chPorts)}
                    </div>
                    <div class="flex items-center">
                        ${renderP(trigPort)}
                    </div>
                </div>`;
        },
        T_STEPS: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
        formatTime: (v) => v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(1)}s`,
        renderGrid: (m) => `
            <div class="absolute inset-0.5 bg-slate-950 rounded-sm border border-slate-800/90 overflow-hidden z-0 pointer-events-none">
                <canvas class="scope-canvas w-full h-full block" width="120" height="120"></canvas>
            </div>`,
        updateLive: (cell, data, isP, modal, m) => {
            if (!data?.buf1) return;
            const cvs = cell.querySelector('.scope-canvas'); if (!cvs) return;
            const ctx2d = cvs.getContext('2d'), w = cvs.width, h = cvs.height;
            ctx2d.clearRect(0, 0, w, h);

            // Center grid
            ctx2d.strokeStyle = '#1e293b'; ctx2d.lineWidth = 0.8; ctx2d.beginPath();
            ctx2d.moveTo(0, h / 2); ctx2d.lineTo(w, h / 2);
            ctx2d.moveTo(w / 2, 0); ctx2d.lineTo(w / 2, h);
            ctx2d.stroke();

            const vR = m.vRange || 5.0;
            const b1 = data.buf1, b2 = data.buf2, trg = data.trigBuf;
            const len = b1.length;

            if (m.displayMode === 'xy') {
                // Lissajous XY Mode (X = in1, Y = in2)
                ctx2d.lineWidth = 1.4; ctx2d.strokeStyle = '#10b981'; ctx2d.beginPath();
                let lastX = w / 2, lastY = h / 2;
                for (let i = 0; i < len; i++) {
                    const x = Math.max(1, Math.min(w - 1, (w / 2) + ((b1[i] / vR) * (w * 0.44))));
                    const y = Math.max(1, Math.min(h - 1, (h / 2) - ((b2[i] / vR) * (h * 0.44))));
                    if (i === 0) ctx2d.moveTo(x, y);
                    else ctx2d.lineTo(x, y);
                    if (i === len - 1) {
                        lastX = x;
                        lastY = y;
                    }
                }
                ctx2d.stroke();

                // High-luminance, high-saturation phosphor beam spot
                ctx2d.save();
                ctx2d.shadowColor = '#00ffaa';
                ctx2d.shadowBlur = 6;
                ctx2d.fillStyle = '#ffffff';
                ctx2d.beginPath();
                ctx2d.arc(lastX, lastY, 1.4, 0, Math.PI * 2);
                ctx2d.fill();
                ctx2d.restore();
            } else {
                // Dual Trace Time Domain Mode
                let startIdx = 0;
                if ((m.trigMode || 'auto') === 'auto' && trg) {
                    for (let i = 0; i < Math.min(trg.length - 2, 128); i++) {
                        if (trg[i] < 0 && trg[i + 1] >= 0) { startIdx = i; break; }
                    }
                }
                const drawPts = len - startIdx;
                const sW = w / Math.max(1, drawPts - 1);
                const sp = m.ySpread ?? 0.2;

                // CH2 (Purple) - shifts DOWN with spread
                ctx2d.lineWidth = 1.2; ctx2d.strokeStyle = '#c084fc'; ctx2d.beginPath();
                for (let i = 0; i < drawPts; i++) {
                    const idx = startIdx + i;
                    const y = Math.max(1, Math.min(h - 1, (h / 2) - (((b2[idx] / vR) - sp) * (h * 0.44))));
                    i === 0 ? ctx2d.moveTo(i * sW, y) : ctx2d.lineTo(i * sW, y);
                }
                ctx2d.stroke();

                // CH1 (Cyan) - shifts UP with spread
                ctx2d.lineWidth = 1.4; ctx2d.strokeStyle = '#22d3ee'; ctx2d.beginPath();
                for (let i = 0; i < drawPts; i++) {
                    const idx = startIdx + i;
                    const y = Math.max(1, Math.min(h - 1, (h / 2) - (((b1[idx] / vR) + sp) * (h * 0.44))));
                    i === 0 ? ctx2d.moveTo(i * sW, y) : ctx2d.lineTo(i * sW, y);
                }
                ctx2d.stroke();
            }
        },
        renderModal: (m) => {
            const T = MODULE_REGISTRY.SCOPE.T_STEPS;
            let tIdx = T.findIndex(t => Math.abs(t - (m.timeSpan || 0.05)) < 0.0005);
            if (tIdx === -1) tIdx = 4;
            const isLiss = m.displayMode === 'xy';
            const fmtT = MODULE_REGISTRY.SCOPE.formatTime;
            const curSpread = m.ySpread ?? 0.2;
            return `
                <div class="space-y-1.5 p-0.5">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div class="flex items-center gap-1">
                            <button id="scope-mode-time" class="px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${!isLiss ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-800 text-slate-400 border-slate-700'}">DUAL</button>
                            <button id="scope-mode-liss" class="px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${isLiss ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}">LISS (XY)</button>
                        </div>
                        <button id="scope-trig-btn" class="px-2 py-0.5 rounded text-[8px] font-bold border transition-colors ${m.trigMode === 'free' ? 'bg-amber-600 text-white border-amber-500' : 'bg-cyan-600 text-white border-cyan-500'}">TRIG: ${(m.trigMode || 'auto').toUpperCase()}</button>
                    </div>
                    <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 gap-1">
                        <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tight truncate w-full text-center">TIME</span>
                            <span id="scope-time-disp" class="text-[9px] text-cyan-300 font-mono font-bold cursor-ns-resize hover:bg-slate-800/80 px-0.5 py-0.5 rounded">${fmtT(T[tIdx])}</span>
                            <div class="h-24 flex items-center justify-center my-0.5">
                                <input type="range" id="scope-time-step" min="0" max="${T.length - 1}" step="1" value="${tIdx}" class="native-vslider accent-cyan-500">
                            </div>
                            <span class="text-[8px] font-mono text-slate-400">SPAN</span>
                        </div>
                        ${UIHelpers.createVSliderHTML('scope-volt', 'SCALE', 0.5, 10.0, 0.5, m.vRange || 5.0, 'v', 'cyan')}
                        ${UIHelpers.createVSliderHTML('scope-spread', 'Y SPREAD', 0.0, 1.0, 0.02, curSpread, 'sep', 'purple', isLiss, curSpread.toFixed(2))}
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const T = MODULE_REGISTRY.SCOPE.T_STEPS;
            const fmtT = MODULE_REGISTRY.SCOPE.formatTime;
            document.getElementById('scope-mode-time')?.addEventListener('click', () => { m.displayMode = 'time'; ctx.reRenderModal(); cb(); });
            document.getElementById('scope-mode-liss')?.addEventListener('click', () => { m.displayMode = 'xy'; ctx.reRenderModal(); cb(); });
            document.getElementById('scope-trig-btn')?.addEventListener('click', () => { m.trigMode = m.trigMode === 'free' ? 'auto' : 'free'; ctx.reRenderModal(); cb(); });

            document.getElementById('scope-time-step')?.addEventListener('input', (e) => {
                m.timeSpan = T[parseInt(e.target.value)] || 0.05;
                const d = document.getElementById('scope-time-disp'); if (d) d.textContent = fmtT(m.timeSpan);
                cb();
            });
            UIHelpers.bindSlider('scope-volt', v => v.toFixed(1), v => { m.vRange = v; cb(); });
            UIHelpers.bindSlider('scope-spread', v => v.toFixed(2), v => { m.ySpread = v; cb(); });
        }
    },
    MON: {
        color: 'blue',
        defaults: () => ({ type: 'MON' }),
        ports: () => ({
            in: [
                { port: 'in4', color: 'bg-yellow-400' },
                { port: 'in3', color: 'bg-yellow-400' },
                { port: 'in2', color: 'bg-yellow-400' },
                { port: 'in1', color: 'bg-yellow-400' }
            ],
            out: []
        }),
        renderPorts: (m, renderP, ports) => `
            <div class="absolute left-[3px] bottom-[3px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                ${renderP(ports.in || [])}
            </div>`,
        renderGrid: () => `<div class="flex flex-col justify-center gap-0.5 w-full h-full py-2.5 pl-3.5 pr-1 pointer-events-none select-none">${[1,2,3,4].map(i => `<div class="flex items-center justify-center h-2.5 bg-slate-950/50 rounded-sm border border-slate-800/70"><span class="mon-val-${i} text-[8px] font-mono text-cyan-300 font-bold leading-none">+0.00</span></div>`).join('')}</div>`,
        updateLive: (cell, data) => {
            if (!data?.values) return;
            for (let c = 1; c <= 4; c++) {
                const el = cell.querySelector(`.mon-val-${c}`);
                if (el) el.textContent = (data.values[c-1]>=0?'+':'') + Number(data.values[c-1]||0).toFixed(2);
            }
        },
        renderModal: () => `<div class="text-[9px] text-slate-400 p-2 text-center">4チャンネル CV/オーディオ信号リアルタイムモニター</div>`
    },
    SPK: {
        color: 'amber',
        defaults: () => ({ type: 'SPK', masterVol: 0.12 }),
        ports: () => ({
            in: [{ port: 'wave_in', color: 'bg-blue-500' }],
            out: []
        }),
        schema: { color: 'amber', sliders: [{ key: 'masterVol', label: 'MASTER', min: 0, max: 0.5, step: 0.01, default: 0.12, unit: 'vol', format: v => Math.round(v * 100) + '%' }] },
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-none gap-1 pointer-events-none text-amber-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><span class="text-[11px] font-mono font-bold">${Math.round((m.masterVol??0.12)*100)}%</span></div>`
    },
    KEY: {
        color: 'sky',
        defaults: () => ({ type: 'KEY', octave: 4, lastNote: 'C4', currentMidi: 60 }),
        ports: () => ({
            in: [],
            out: [
                { port: 'cv_out', color: 'bg-yellow-400' },
                { port: 'gate_out', color: 'bg-orange-500' }
            ]
        }),
        WHITE_KEYS: [{n:'B',s:-1},{n:'C',s:0},{n:'D',s:2},{n:'E',s:4},{n:'F',s:5},{n:'G',s:7},{n:'A',s:9},{n:'B',s:11},{n:'C',s:12},{n:'D',s:14}],
        BLACK_KEYS: [{s:-2,l:0},{s:1,l:20},{s:3,l:30},{s:6,l:50},{s:8,l:60},{s:10,l:70},{s:13,l:90},{s:15,l:100}],
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center leading-tight gap-0.5 pointer-events-none text-cyan-400"><span class="text-[9px] font-bold text-sky-300">KEYBOARD</span><span class="text-[14px] font-mono font-bold text-white">${m.lastNote||'C4'}</span></div>`,
        renderModal: (m) => {
            const W = MODULE_REGISTRY.KEY.WHITE_KEYS, B = MODULE_REGISTRY.KEY.BLACK_KEYS;
            return `
                <div class="space-y-2">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div class="flex items-center gap-1.5"><span class="text-[8px] text-slate-400 uppercase font-semibold">OCTAVE</span>
                        <button id="key-oct-down" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold">−</button>
                        <span id="key-oct-disp" class="w-5 text-center text-[10px] font-mono font-bold text-cyan-300">${m.octave||4}</span>
                        <button id="key-oct-up" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold">＋</button></div>
                        <span class="text-[9px] font-mono font-bold text-sky-300" id="key-active-note">${m.lastNote||'C4'}</span>
                    </div>
                    <div class="relative h-28 bg-slate-950 rounded-lg border border-slate-800 flex select-none touch-none overflow-hidden" id="kb-box">
                        ${W.map(k => `<div class="flex-1 bg-slate-200 active:bg-cyan-300 border border-slate-400 rounded-b flex flex-col justify-end items-center pb-1 cursor-pointer" data-semi="${k.s}"><span class="text-[7.5px] font-bold text-slate-700 pointer-events-none">${k.n}</span></div>`).join('')}
                        <div class="absolute inset-0 pointer-events-none">${B.map(bk => `<div class="absolute h-16 bg-slate-900 border border-slate-700 rounded-b pointer-events-auto cursor-pointer active:bg-cyan-600 shadow-md" style="left:${bk.l}%;width:6.8%;transform:translateX(-50%);" data-semi="${bk.s}"></div>`).join('')}</div>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const octD = document.getElementById('key-oct-disp'), nD = document.getElementById('key-active-note');
            document.getElementById('key-oct-down')?.addEventListener('click', () => { if ((m.octave||4) > 1) { m.octave--; if (octD) octD.textContent = m.octave; cb(); } });
            document.getElementById('key-oct-up')?.addEventListener('click', () => { if ((m.octave||4) < 7) { m.octave++; if (octD) octD.textContent = m.octave; cb(); } });
            const play = (s, isDown) => {
                const midi = ((m.octave||4) + 1) * 12 + s;
                const name = `${UIHelpers.NOTES[((s%12)+12)%12]}${Math.floor(midi/12)-1}`;
                m.lastNote = name; if (nD && isDown) nD.textContent = name;
                ctx.sendKeyNote?.(midi, isDown); if (isDown) cb();
            };
            const kb = document.getElementById('kb-box');
            if (kb) {
                let activeKey = null;
                kb.onpointerdown = (e) => {
                    const k = e.target.closest('[data-semi]'); if (!k) return;
                    activeKey = k; kb.setPointerCapture(e.pointerId); play(parseInt(k.dataset.semi), true);
                };
                const stop = (e) => {
                    if (activeKey) { play(parseInt(activeKey.dataset.semi), false); activeKey = null; }
                    try { kb.releasePointerCapture(e.pointerId); } catch(err){}
                };
                kb.onpointerup = stop; kb.onpointercancel = stop;
            }
        }
    },
    SEQ: {
        color: 'blue',
        defaults: () => ({
            type: 'SEQ',
            quantize: true,
            steps: Array.from({ length: 8 }, (_, i) => ({
                cv: i === 0 ? 0 : 0.25,
                active: true,
                cvActive: true,
                gate: true
            }))
        }),
        ports: () => ({
            in: [{ port: 'gate_in', color: 'bg-red-500' }],
            out: [
                { port: 'cv_out', color: 'bg-yellow-400' },
                { port: 'gate_out', color: 'bg-orange-500' }
            ]
        }),
        renderGrid: (m) => `<div class="flex items-end justify-center gap-[2px] w-full px-1 pointer-events-none">${(m.steps||[]).map((st, i) => {
            const val = typeof st === 'number' ? st : (st?.cv ?? 0);
            const isAct = typeof st === 'object' ? (st.active !== false) : true;
            const h = isAct ? Math.max(6, Math.min(100, Math.round((val / 2.0) * 100))) : 4;
            const barColor = isAct ? 'bg-gradient-to-t from-blue-600 to-cyan-400' : 'bg-slate-800';
            return `<div class="flex-1 h-7 rounded-sm p-[1px] flex flex-col justify-end border border-slate-600 bg-slate-950/40 relative" data-step-bar="${i}"><div class="w-full ${barColor} rounded-xs" style="height: ${h}%;"></div></div>`;
        }).join('')}</div>`,
        updateLive: (cell, data, isP, modal) => {
            const step = data?.step ?? -1;
            cell.querySelectorAll('[data-step-bar]').forEach((b, i) => {
                const cur = isP && i === step;
                b.classList.toggle('border-cyan-300', cur);
                b.classList.toggle('ring-1', cur);
                b.classList.toggle('ring-cyan-400/80', cur);
            });
            modal?.querySelectorAll('[data-step-col]').forEach((col, i) => {
                const cur = isP && i === step;
                col.classList.toggle('border-cyan-400', cur);
                col.classList.toggle('bg-slate-800/90', cur);
                col.classList.toggle('border-slate-800', !cur);
            });
        },
        renderModal: (m) => `
            <div id="seq-modal-root" class="space-y-1.5">
                <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span class="text-[8px] text-slate-400 uppercase font-semibold">8-STEP SEQUENCER</span>
                    <button id="seq-qlz-btn" class="px-2 py-0.5 rounded text-[8.5px] font-bold border transition-colors ${m.quantize!==false?'bg-cyan-600 text-white border-cyan-500':'bg-slate-800 text-slate-400 border-slate-700'}">QLZ: ${m.quantize!==false?'ON':'OFF'}</button>
                </div>
                <div class="flex items-center justify-between py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 overflow-x-auto">
                    ${(m.steps||[]).map((st, i) => `
                        <div data-step-col="${i}" class="flex flex-col items-center gap-1 flex-1 min-w-[34px] bg-slate-900/60 p-1 rounded-lg border border-slate-800 transition-colors">
                            <span id="seq-slider-${i}-disp" class="text-[8.5px] text-cyan-300 font-mono font-bold cursor-ns-resize touch-none select-none hover:bg-slate-800/80 px-1 py-0.5 rounded transition-colors" title="上下ドラッグで微調整">${m.quantize!==false?UIHelpers.cvToNoteName(st.cv??0):(st.cv??0).toFixed(2)}</span>
                            <input type="range" data-seq-slider="${i}" id="seq-slider-${i}" min="0" max="2.0" step="${m.quantize!==false?0.083333:0.01}" value="${st.cv??0}" class="native-vslider accent-blue-500 !h-16">
                            <div class="flex flex-col gap-0.5 w-full">
                                <button data-act="gate" data-step="${i}" class="text-[6.5px] font-bold py-0.5 rounded border transition-colors ${st.gate!==false?'bg-sky-950 text-sky-300 border-sky-500/80':'bg-slate-950 text-slate-600 border-slate-800'}">GATE</button>
                                <button data-act="cvActive" data-step="${i}" class="text-[7px] font-bold py-0.5 rounded border transition-colors ${st.cvActive!==false?'bg-cyan-950 text-cyan-300 border-cyan-500/80':'bg-slate-950 text-slate-600 border-slate-800'}">CV</button>
                                <button data-act="active" data-step="${i}" class="text-[6.5px] font-bold py-0.5 rounded border transition-colors ${st.active!==false?'bg-blue-950 text-blue-300 border-blue-500/80':'bg-slate-950 text-slate-600 border-slate-800'}">STEP</button>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`,
        bindEvents: (m, ctx, cb) => {
            const root = document.getElementById('seq-modal-root');
            if (!root) return;
            root.addEventListener('click', (e) => {
                if (e.target.closest('#seq-qlz-btn')) {
                    m.quantize = !(m.quantize !== false);
                    ctx.reRenderModal();
                    cb();
                    return;
                }
                const btn = e.target.closest('[data-act]');
                if (btn) {
                    const idx = parseInt(btn.dataset.step), act = btn.dataset.act;
                    if (!isNaN(idx) && m.steps[idx]) {
                        m.steps[idx][act] = !(m.steps[idx][act] !== false);
                        ctx.reRenderModal();
                        cb();
                    }
                }
            });
            root.addEventListener('input', (e) => {
                const sl = e.target.closest('[data-seq-slider]');
                if (sl) {
                    const idx = parseInt(sl.dataset.seqSlider), val = parseFloat(sl.value);
                    if (!isNaN(idx) && m.steps[idx]) {
                        m.steps[idx].cv = val;
                        const disp = document.getElementById(`seq-slider-${idx}-disp`);
                        if (disp) disp.textContent = m.quantize !== false ? UIHelpers.cvToNoteName(val) : val.toFixed(2);
                        cb();
                    }
                }
            });
            (m.steps || []).forEach((st, i) => {
                UIHelpers.bindScrubber(`seq-slider-${i}-disp`, `seq-slider-${i}`, v => m.quantize !== false ? UIHelpers.cvToNoteName(v) : v.toFixed(2), v => {
                    st.cv = v;
                    cb();
                });
            });
        }
    },
    PAT: {
        color: 'sky',
        defaults: () => ({
            type: 'PAT',
            pattern: 'c2 c2 c2 c2',
            cycleBeats: 4,
            gateLen: 0.8,
            presetName: '4-on-floor'
        }),
        ports: () => ({
            in: [],
            out: [
                { port: 'cv_out', color: 'bg-yellow-400' },
                { port: 'gate_out', color: 'bg-orange-500' }
            ]
        }),
        renderGrid: (m) => {
            const pat = m.pattern || 'c2 c2 c2 c2';
            const renderedHtml = renderPatternHighlightedHTML(pat);
            return `
                <div class="flex flex-col items-center justify-center w-full h-full px-0.5 overflow-hidden pointer-events-none">
                    <div class="pat-track-container w-full overflow-hidden flex items-center justify-start h-5">
                        <div class="pat-marquee-track text-[9.5px] font-mono font-bold text-cyan-300">
                            <span class="mr-6 inline-flex items-center gap-1">${renderedHtml}</span>
                            <span class="mr-6 inline-flex items-center gap-1">${renderedHtml}</span>
                        </div>
                    </div>
                </div>`;
        },
        updateLive: (cell, data, isP, modal) => {
            const activeIdx = isP ? (data?.activeIdx ?? -1) : -1;

            // Real-time highlight in grid cell marquee
            cell.querySelectorAll('[data-pat-tok]').forEach(el => {
                const idx = parseInt(el.dataset.patTok, 10);
                el.classList.toggle('pat-tok-active', idx === activeIdx);
            });

            // Real-time highlight in modal preview / input overlay
            if (modal) {
                modal.querySelectorAll('[data-pat-tok]').forEach(el => {
                    const idx = parseInt(el.dataset.patTok, 10);
                    el.classList.toggle('pat-tok-active', idx === activeIdx);
                });
            }
        },
        renderModal: (m) => {
            const pat = m.pattern || 'c2 c2 c2 c2';
            const beats = m.cycleBeats || 4;
            const gatePct = Math.round((m.gateLen ?? 0.8) * 100);
            const showPresets = m._showPresets === true;
            const showHints = m._showHints === true;

            return `
                <div id="pat-modal-root" class="space-y-1.5 p-0.5">
                    <!-- Top Bar: Left Action Buttons (Revert & Send), Right Controls (Cycle & Gate) -->
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800 gap-2">
                        <div class="flex items-center gap-1">
                            <button id="pat-revert-btn" disabled class="w-6 h-6 shrink-0 rounded text-[11px] font-bold border transition flex items-center justify-center opacity-40 pointer-events-none bg-slate-900 text-slate-600 border-slate-800" title="元の文字列に戻す (REVERT)">
                                ↺
                            </button>
                            <button id="pat-apply-btn" class="w-6 h-6 shrink-0 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-bold border border-slate-700 transition flex items-center justify-center cursor-pointer" title="流し込み (SEND / Enter)">
                                ↵
                            </button>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                                <span class="text-[7.5px] text-slate-400 uppercase">CYCLE:</span>
                                <select id="pat-beats-select" class="bg-slate-900 text-cyan-300 font-mono text-[8px] font-bold rounded px-1 py-0.5 border border-slate-700">
                                    <option value="1" ${beats === 1 ? 'selected' : ''}>1 BEAT (1/4)</option>
                                    <option value="2" ${beats === 2 ? 'selected' : ''}>2 BEATS (2/4)</option>
                                    <option value="4" ${beats === 4 ? 'selected' : ''}>4 BEATS (1 BAR)</option>
                                    <option value="8" ${beats === 8 ? 'selected' : ''}>8 BEATS (2 BARS)</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                                <span class="text-[7.5px] text-slate-400 uppercase">GATE:</span>
                                <input type="range" id="pat-gate-slider" min="10" max="95" step="5" value="${gatePct}" class="w-14 h-1 accent-cyan-400 cursor-pointer">
                                <span id="pat-gate-disp" class="text-[8px] font-mono font-bold text-cyan-300 min-w-[24px] text-right">${gatePct}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Pattern Text Input (Full Width) with Inverted Live Highlight Overlay -->
                    <div class="relative w-full flex items-center min-w-0 h-7 bg-slate-950 border border-cyan-500/70 rounded-lg shadow-inner overflow-hidden">
                        <!-- Real Text Input (receives pointer events & typing) -->
                        <input type="text" id="pat-code-input" value="${pat}" placeholder="e.g. [c2 ~ c2 ~] [c2 ~ c2 ~] [c2 ~ c2 ~] [c2 ~ c2 eb2]" class="w-full h-full bg-transparent font-mono text-cyan-300 px-2 text-[9.5px] font-bold tracking-tight focus:outline-none focus:ring-1 focus:ring-cyan-400 transition relative z-10">
                        <!-- Live Highlight Overlay (on top when not editing, pointer-events-none) -->
                        <div id="pat-highlight-overlay" class="absolute inset-0 flex items-center px-2 font-mono text-[9.5px] font-bold tracking-tight bg-slate-950 overflow-x-auto whitespace-nowrap pointer-events-none select-none z-20">
                            <div id="pat-highlight-content" class="inline-flex items-center gap-1 text-cyan-300">
                                ${renderPatternHighlightedHTML(pat)}
                            </div>
                        </div>
                    </div>

                    <!-- Accordion Toggle Headers -->
                    <div class="flex items-center justify-between pt-0.5 border-t border-slate-800/80 px-0.5">
                        <button id="pat-toggle-presets" class="flex items-center gap-1 text-[7.5px] font-bold text-slate-400 hover:text-cyan-300 uppercase tracking-wider transition">
                            <span class="text-[6.5px] font-mono text-cyan-400">${showPresets ? '▼' : '▶'}</span>
                            <span>PRESETS</span>
                        </button>
                        <button id="pat-toggle-hints" class="flex items-center gap-1 text-[7.5px] font-bold text-slate-400 hover:text-cyan-300 uppercase tracking-wider transition">
                            <span class="text-[6.5px] font-mono text-cyan-400">${showHints ? '▼' : '▶'}</span>
                            <span>HINTS</span>
                        </button>
                    </div>

                    <!-- Presets Grid (Collapsible) -->
                    ${showPresets ? `
                    <div class="grid grid-cols-4 sm:grid-cols-6 gap-1 pt-0.5 animate-fadeIn">
                        ${STRUDEL_PRESETS.map((p) => `
                            <button class="pat-preset-btn h-6 px-1.5 bg-slate-800/90 hover:bg-cyan-950/80 border border-slate-700 hover:border-cyan-500/80 rounded flex items-center justify-center transition group truncate" data-pattern="${p.pattern}" title="${p.name}: ${p.pattern}">
                                <span class="text-[7.5px] font-bold text-cyan-300 group-hover:text-white truncate pointer-events-none">${p.name}</span>
                            </button>
                        `).join('')}
                    </div>
                    ` : ''}

                    <!-- Mini Cheat Sheet (Collapsible) -->
                    ${showHints ? `
                    <div class="flex items-center justify-between bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800/60 text-[6.5px] font-mono text-slate-400 pt-0.5 animate-fadeIn">
                        <span><b class="text-cyan-300">c2 eb2</b> 音名</span>
                        <span><b class="text-cyan-300">~</b> 休符</span>
                        <span><b class="text-cyan-300">[c2 e2 g2]</b> 3連符/分割</span>
                        <span><b class="text-cyan-300">c2*4</b> 連打</span>
                        <span><b class="text-cyan-300">c2(3,8)</b> ユークリッド</span>
                        <span><b class="text-cyan-300">c2?0.7</b> 確率</span>
                    </div>
                    ` : ''}
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const root = document.getElementById('pat-modal-root');
            if (!root) return;

            const input = document.getElementById('pat-code-input');
            const overlay = document.getElementById('pat-highlight-overlay');
            const overlayContent = document.getElementById('pat-highlight-content');
            const revertBtn = document.getElementById('pat-revert-btn');
            const applyBtn = document.getElementById('pat-apply-btn');
            const selectBeats = document.getElementById('pat-beats-select');
            const gateSlider = document.getElementById('pat-gate-slider');
            const gateDisp = document.getElementById('pat-gate-disp');

            const setEditing = (editing) => {
                if (overlay) {
                    if (editing) {
                        overlay.classList.add('hidden');
                        if (input) input.style.color = '#67e8f9';
                    } else {
                        overlay.classList.remove('hidden');
                        if (overlayContent) {
                            overlayContent.innerHTML = renderPatternHighlightedHTML(m.pattern || '');
                        }
                        if (input) input.style.color = 'transparent';
                    }
                }
            };

            setEditing(false);

            const updateButtonStates = () => {
                const currentSaved = m.pattern || '';
                const isDirty = (input?.value ?? '') !== currentSaved;
                if (revertBtn) {
                    if (isDirty) {
                        revertBtn.disabled = false;
                        revertBtn.className = 'w-6 h-6 shrink-0 rounded text-[11px] font-bold border transition flex items-center justify-center cursor-pointer bg-amber-950/90 hover:bg-amber-900 text-amber-300 border-amber-500/80 shadow-sm';
                    } else {
                        revertBtn.disabled = true;
                        revertBtn.className = 'w-6 h-6 shrink-0 rounded text-[11px] font-bold border transition flex items-center justify-center opacity-40 pointer-events-none bg-slate-900 text-slate-600 border-slate-800';
                    }
                }
                if (applyBtn) {
                    if (isDirty) {
                        applyBtn.className = 'w-6 h-6 shrink-0 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded text-[11px] border border-cyan-300 shadow-md shadow-cyan-500/40 transition flex items-center justify-center cursor-pointer';
                    } else {
                        applyBtn.className = 'w-6 h-6 shrink-0 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-bold border border-slate-700 transition flex items-center justify-center cursor-pointer';
                    }
                }
            };

            const doApply = (val) => {
                const newPat = val !== undefined ? val : (input?.value ?? '');
                m.pattern = newPat;
                if (input) input.value = newPat;
                setEditing(false);
                input?.blur();
                updateButtonStates();
                cb();
            };

            input?.addEventListener('focus', () => {
                setEditing(true);
            });

            input?.addEventListener('input', () => {
                setEditing(true);
                updateButtonStates();
            });

            input?.addEventListener('blur', () => {
                const isDirty = (input?.value ?? '') !== (m.pattern || '');
                if (!isDirty) {
                    setEditing(false);
                }
            });

            revertBtn?.addEventListener('click', () => {
                if (input) input.value = m.pattern || '';
                setEditing(false);
                input?.blur();
                updateButtonStates();
            });

            applyBtn?.addEventListener('click', () => {
                doApply();
            });

            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doApply();
                }
            });

            selectBeats?.addEventListener('change', (e) => {
                m.cycleBeats = parseInt(e.target.value, 10) || 4;
                ctx.reRenderModal();
                cb();
            });

            gateSlider?.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                m.gateLen = val / 100.0;
                if (gateDisp) gateDisp.textContent = `${val}%`;
                cb();
            });

            // Toggle presets accordion
            document.getElementById('pat-toggle-presets')?.addEventListener('click', () => {
                m._showPresets = !m._showPresets;
                ctx.reRenderModal();
            });

            // Toggle hints accordion
            document.getElementById('pat-toggle-hints')?.addEventListener('click', () => {
                m._showHints = !m._showHints;
                ctx.reRenderModal();
            });

            root.querySelectorAll('.pat-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const patStr = btn.dataset.pattern;
                    if (patStr !== undefined) {
                        doApply(patStr);
                    }
                });
            });
        }
    },
    CHORD: {
        color: 'purple',
        CHORD_TYPES: {
            'maj':  { label: 'MAJ',  semis: [0, 4, 7, 12] },
            'min':  { label: 'MIN',  semis: [0, 3, 7, 12] },
            '7th':  { label: '7TH',  semis: [0, 4, 7, 10] },
            'Maj7': { label: 'MAJ7', semis: [0, 4, 7, 11] },
            'm7':   { label: 'm7',   semis: [0, 3, 7, 10] },
            'sus4': { label: 'SUS4', semis: [0, 5, 7, 12] },
            'dim7': { label: 'DIM7', semis: [0, 3, 6, 9] },
            '5th':  { label: '5TH',  semis: [0, 7, 12, 19] }
        },
        VOICINGS: {
            'close': [0, 0, 0, 0],
            'drop2': [0, -12, 0, 0],
            'open':  [0, 0, 12, 12]
        },
        defaults: () => ({ type: 'CHORD', chord: 'm7', rootMidi: 48, voicing: 'close' }),
        ports: () => ({
            in: [{ port: 'cv_in', color: 'bg-yellow-400' }],
            out: [
                { port: 'cv_out1', color: 'bg-yellow-400' },
                { port: 'cv_out2', color: 'bg-yellow-400' },
                { port: 'cv_out3', color: 'bg-yellow-400' },
                { port: 'cv_out4', color: 'bg-yellow-400' }
            ]
        }),
        renderPorts: (m, renderP, ports) => `
            <div class="absolute left-[3px] bottom-[3px] flex items-center pointer-events-auto z-10">
                ${renderP(ports.in || [])}
            </div>
            <div class="absolute right-[3px] bottom-[3px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                ${renderP(ports.out || [])}
            </div>`,
        renderGrid: (m, ctx) => {
            const info = MODULE_REGISTRY.CHORD.CHORD_TYPES[m.chord || 'm7'] || MODULE_REGISTRY.CHORD.CHORD_TYPES['m7'];
            const isPatched = ctx?.patched?.has('cv_in');
            const rootName = isPatched ? 'EXT' : UIHelpers.cvToNoteName(((m.rootMidi ?? 48) - 24) / 12.0);
            return `
                <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-purple-300">
                    <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">CHORD CV</span>
                    <span class="text-[12px] font-mono font-bold text-cyan-300">${rootName} ${info.label}</span>
                    <div class="flex items-center gap-0.5 text-[7px] font-mono text-purple-400">
                        <span>1-4 CV OUT</span>
                    </div>
                </div>`;
        },
        renderModal: (m, ctx) => {
            const chords = Object.entries(MODULE_REGISTRY.CHORD.CHORD_TYPES).map(([val, item]) => ({ val, label: item.label }));
            const voicings = [
                { val: 'close', label: 'CLOSE' },
                { val: 'drop2', label: 'DROP 2' },
                { val: 'open',  label: 'OPEN' }
            ];
            const isP = ctx.patched?.has('cv_in');
            const curRoot = m.rootMidi ?? 48;
            const rootName = UIHelpers.cvToNoteName((curRoot - 24) / 12.0);

            return `
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span class="text-[8px] text-slate-400 font-semibold uppercase">ROOT NOTE</span>
                        <span class="text-[9px] font-mono font-bold text-yellow-300">${isP ? 'EXT CV (PATCHED)' : rootName}</span>
                    </div>
                    <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 ${isP ? 'opacity-30 pointer-events-none' : ''}">
                        ${UIHelpers.createVSliderHTML('chord-root-slider', 'ROOT', 24, 72, 1, curRoot, 'note', 'purple', isP, rootName)}
                    </div>
                    <div>
                        <label class="block text-[8px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">Chord Type</label>
                        <div class="grid grid-cols-4 gap-0.5">
                            ${chords.map(c => `<button class="chord-type-btn py-0.5 rounded text-[7.5px] font-bold border transition-colors ${m.chord === c.val ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${c.val}">${c.label}</button>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="block text-[8px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">Voicing</label>
                        <div class="grid grid-cols-3 gap-0.5">
                            ${voicings.map(v => `<button class="chord-voice-btn py-0.5 rounded text-[8px] font-bold border transition-colors ${(m.voicing || 'close') === v.val ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${v.val}">${v.label}</button>`).join('')}
                        </div>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            UIHelpers.bindButtonGroup('.chord-type-btn', 'bg-purple-600 text-white border-purple-500', 'bg-slate-800 text-slate-400 border-slate-700', val => {
                m.chord = val;
                ctx.reRenderModal();
                cb();
            });
            UIHelpers.bindButtonGroup('.chord-voice-btn', 'bg-purple-600 text-white border-purple-500', 'bg-slate-800 text-slate-400 border-slate-700', val => {
                m.voicing = val;
                ctx.reRenderModal();
                cb();
            });
            if (!ctx.patched?.has('cv_in')) {
                UIHelpers.bindSlider('chord-root-slider', v => UIHelpers.cvToNoteName((Math.round(v) - 24) / 12.0), v => {
                    m.rootMidi = Math.round(v);
                    cb();
                });
            }
        }
    },
    SUB: {
        color: 'cyan',
        defaults: () => ({ type: 'SUB', targetPage: 1 }),
        ports: (m, ctx) => {
            const allPins = [
                { port: 'L1', side: 'L' }, { port: 'L2', side: 'L' }, { port: 'L3', side: 'L' }, { port: 'L4', side: 'L' },
                { port: 'R1', side: 'R' }, { port: 'R2', side: 'R' }, { port: 'R3', side: 'R' }, { port: 'R4', side: 'R' },
                { port: 'B1', side: 'B' }, { port: 'B2', side: 'B' }, { port: 'B3', side: 'B' }, { port: 'B4', side: 'B' }
            ];
            const active = ctx?.subActivePorts;
            const visiblePins = active ? allPins.filter(p => active.has(p.port)) : allPins;
            const list = visiblePins.map(p => ({
                port: p.port,
                color: ctx?.getPortColor ? ctx.getPortColor(p.port) : 'bg-slate-500'
            }));
            return { in: list, out: list };
        },
        renderPorts: (m, renderP, ports) => {
            const allIn = ports.in || [];
            const portMap = {};
            allIn.forEach(p => { portMap[p.port] = p; });
            const renderSlot = (portName) => {
                const p = portMap[portName];
                if (p) return renderP([p]);
                return '<div class="w-2 h-2 pointer-events-none opacity-0"></div>';
            };
            const leftSlots = ['L2', 'L3', 'L4'].map(renderSlot).join('');
            const rightSlots = ['R2', 'R3', 'R4'].map(renderSlot).join('');
            const bottomSlots = ['L1', 'B1', 'B2', 'B3', 'B4', 'R1'].map(renderSlot).join('');
            return `
                <div class="absolute left-[3px] bottom-[16px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                    ${leftSlots}
                </div>
                <div class="absolute right-[3px] bottom-[16px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                    ${rightSlots}
                </div>
                <div class="absolute bottom-[3px] left-[3px] right-[3px] flex justify-between items-center pointer-events-auto z-10">
                    ${bottomSlots}
                </div>`;
        },
        renderGrid: () => `
            <div class="flex flex-col items-center justify-center leading-none pointer-events-none">
                <svg class="w-5 h-5 text-cyan-400 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <path d="M11 9h4a2 2 0 0 0 2-2V3"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="M7 21v-4a2 2 0 0 1 2-2h4"/>
                    <circle cx="15" cy="15" r="2"/>
                </svg>
            </div>`,
        renderModal: (m, ctx) => {
            const curP = m.targetPage ?? 1;
            return `
                <div class="space-y-2 p-1">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span class="text-[8px] text-slate-400 font-semibold uppercase">TARGET SUBPAGE</span>
                        <span class="text-[9px] font-mono font-bold text-cyan-300">PAGE ${curP}</span>
                    </div>
                    <div>
                        <label class="block text-[8px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">Select Page Number</label>
                        <div class="grid grid-cols-4 gap-1">
                            ${[1, 2, 3, 4].map(p => {
                                const pName = ctx?.pagesData ? ctx.pagesData[String(p)]?.name : null;
                                return `
                                <button class="sub-page-btn py-1 rounded text-[8.5px] font-bold border transition-colors flex flex-col items-center justify-center ${curP === p ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm shadow-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-page="${p}">
                                    <span>PAGE ${p}</span>
                                    ${pName ? `<span class="text-[7px] opacity-80 truncate max-w-[40px]">${pName}</span>` : ''}
                                </button>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="pt-1">
                        <button id="sub-open-page-btn" class="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg border border-cyan-400 text-xs font-bold shadow-md shadow-cyan-500/30 flex items-center justify-center gap-1.5 transition">
                            <span>OPEN SUBPATCH (PAGE ${curP})</span> →
                        </button>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            document.querySelectorAll('.sub-page-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    m.targetPage = parseInt(e.currentTarget.dataset.page) || 1;
                    ctx.reRenderModal();
                    cb();
                });
            });
            document.getElementById('sub-open-page-btn')?.addEventListener('click', () => {
                document.getElementById('shared-modal')?.classList.add('hidden');
                ctx.openSubpage?.(m.targetPage || 1);
            });
        },
        onDestroy: async (m, ctx) => {
            const target = m.targetPage ? String(m.targetPage) : null;
            if (!target || target === "0") return;
            const targetPageData = ctx.pagesData ? ctx.pagesData[target] : null;
            if (targetPageData?.modules) {
                const childIds = Object.keys(targetPageData.modules);
                for (const childId of childIds) {
                    await ctx.destroyModule?.(target, childId);
                }
            }
            ctx.destroyPage?.(target);
        }
    },
    SUB_IO: {
        color: 'emerald',
        defaults: () => ({ type: 'SUB_IO' }),
        ports: (m, ctx) => {
            const allPins = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4', 'B1', 'B2', 'B3', 'B4'];
            const list = allPins.map(pin => ({
                port: pin,
                color: ctx?.getPortColor ? ctx.getPortColor(pin) : 'bg-slate-500'
            }));
            return { in: list, out: list };
        },
        renderPorts: (m, renderP, ports) => {
            const allIn = ports.in || [];
            const portMap = {};
            allIn.forEach(p => { portMap[p.port] = p; });
            const renderSlot = (portName) => {
                const p = portMap[portName];
                if (p) return renderP([p]);
                return '<div class="w-2 h-2 pointer-events-none opacity-0"></div>';
            };
            const leftSlots = ['L2', 'L3', 'L4'].map(renderSlot).join('');
            const rightSlots = ['R2', 'R3', 'R4'].map(renderSlot).join('');
            const bottomSlots = ['L1', 'B1', 'B2', 'B3', 'B4', 'R1'].map(renderSlot).join('');
            return `
                <div class="absolute left-[3px] bottom-[16px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                    ${leftSlots}
                </div>
                <div class="absolute right-[3px] bottom-[16px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">
                    ${rightSlots}
                </div>
                <div class="absolute bottom-[3px] left-[3px] right-[3px] flex justify-between items-center pointer-events-auto z-10">
                    ${bottomSlots}
                </div>`;
        },
        renderGrid: () => `
            <div class="flex flex-col items-center justify-center leading-none pointer-events-none">
                <svg class="w-5 h-5 text-cyan-400 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <path d="M11 9h4a2 2 0 0 0 2-2V3"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="M7 21v-4a2 2 0 0 1 2-2h4"/>
                    <circle cx="15" cy="15" r="2"/>
                </svg>
            </div>`,
        renderModal: (m, ctx) => {
            const pageName = ctx?.getPageName ? ctx.getPageName() : (m.name || 'SUBPATCH');
            return `
                <div class="space-y-2 p-1">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span class="text-[8px] text-slate-400 font-semibold uppercase">SUBPATCH NAME</span>
                        <button id="sub-io-rename-btn" class="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 hover:bg-emerald-900 transition flex items-center gap-1">
                            <span class="font-mono font-bold">${pageName}</span>
                            <span class="text-[8px]">✏️</span>
                        </button>
                    </div>
                    <div class="text-center py-1">
                        <span class="text-[10px] font-bold text-emerald-300 uppercase">SUBPATCH I/O ROOT</span>
                        <p class="text-[8.5px] text-slate-400 mt-1">メイングリッドの SUB モジュールと12ピンで双方向通信します。</p>
                        <p class="text-[8px] text-amber-400/80 mt-0.5">※ このモジュールは削除できません（保護中）</p>
                    </div>
                    <div class="flex gap-1.5 pt-1">
                        <button id="sub-io-save-btn" class="flex-1 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded-lg border border-emerald-500/70 text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 transition">
                            <span>💾 ライブラリに保存 (CUSTOM)</span>
                        </button>
                    </div>
                    <div class="pt-0.5">
                        <button id="sub-io-back-btn" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg border border-emerald-400 text-xs font-bold shadow-md shadow-emerald-500/30 flex items-center justify-center gap-1.5 transition">
                            ← <span>RETURN TO MAIN (PAGE 0)</span>
                        </button>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            document.getElementById('sub-io-rename-btn')?.addEventListener('click', async () => {
                const curName = ctx.getPageName ? ctx.getPageName() : (m.name || 'SUBPATCH');
                const res = await ctx.prompt('SUBPATCH NAME', curName);
                if (res !== null && res.trim() !== '') {
                    ctx.setPageName?.(res.trim());
                    ctx.reRenderModal();
                    cb?.();
                }
            });
            document.getElementById('sub-io-save-btn')?.addEventListener('click', async () => {
                const curName = ctx.getPageName ? ctx.getPageName() : (m.name || 'SUBPATCH');
                const res = await ctx.prompt('SAVE SUBPATCH AS', curName);
                if (res !== null && res.trim() !== '') {
                    ctx.saveSubpatchToLibrary?.(res.trim());
                }
            });
            document.getElementById('sub-io-back-btn')?.addEventListener('click', () => {
                document.getElementById('shared-modal')?.classList.add('hidden');
                ctx.openSubpage?.(0);
            });
        }
    }
};

