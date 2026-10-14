import { UIHelpers } from '../ui/helpers.js';
import { parseClockRate, normalizeSubPort } from '../core/utils.js';
import { CHORD_TYPES, CHORD_VOICINGS, CHORD_ORDER, VOICING_LABELS, VOICING_ORDER } from '../core/musical.js';
import { parseStrudelPattern, STRUDEL_PRESETS, renderPatternHighlightedHTML } from '../core/strudel-parser.js';

const renderMathModalUI = (m, ctx, modeGroups, valKeys) => {
    const curMode = m.mode || modeGroups[0].modes[0];
    const fmt = v => (v >= 0 ? '+' : '') + Number(v || 0).toFixed(2);
    return `
        <div class="space-y-1.5 p-0.5">
            ${modeGroups.map(g => `
                <div>
                    <div class="text-[7.5px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">${g.label}</div>
                    <div class="grid grid-cols-${g.cols} gap-0.5">
                        ${g.modes.map(md => `
                            <button class="math-mode-btn py-0.5 rounded text-[8px] font-bold border transition-colors ${curMode === md ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}" data-mode="${md}">${md === '<' ? '&lt;' : (md === '<=' ? '&lt;=' : md)}</button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            <div class="grid grid-cols-${valKeys.length} gap-1.5 pt-0.5">
                ${valKeys.map(k => {
                    const port = k.toLowerCase();
                    const p = ctx.patched?.has(port);
                    return `
                        <button id="math-val-${port}" class="py-1 px-1.5 rounded border text-[9px] font-mono font-bold flex items-center justify-between ${p ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 border-purple-500/60 text-purple-200 active:bg-purple-900'}">
                            <span class="text-[7.5px] text-slate-400">${valKeys.length > 1 ? k.toUpperCase() : 'CONSTANT ' + k.toUpperCase()}</span>
                            <span>${p ? 'EXT' : fmt(m[`val${k}`] ?? (k === 'B' ? 1.0 : 0.0))}</span>
                        </button>`;
                }).join('')}
            </div>
        </div>`;
};

const bindMathEventsUI = (m, ctx, cb, valKeys) => {
    document.querySelectorAll('.math-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            m.mode = e.currentTarget.dataset.mode;
            ctx.reRenderModal();
            cb();
        });
    });
    valKeys.forEach(k => {
        const port = k.toLowerCase();
        const btn = document.getElementById(`math-val-${port}`);
        if (btn && !ctx.patched?.has(port)) {
            btn.addEventListener('click', async () => {
                const res = await ctx.prompt(`CONSTANT ${k.toUpperCase()}`, String(m[`val${k}`] ?? (k === 'B' ? 1.0 : 0.0)));
                if (res !== null && res !== '') {
                    const num = parseFloat(res);
                    if (!isNaN(num)) {
                        m[`val${k}`] = num;
                        ctx.reRenderModal();
                        cb();
                    }
                }
            });
        }
    });
};
const renderMathGridUI = (m) => {
    const mode = m.mode || (m.type === 'MATH1' ? 'ABS' : 'ADD');
    const escMode = mode === '<' ? '&lt;' : (mode === '<=' ? '&lt;=' : mode);
    return `
        <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400">
            <span class="text-[9px] font-bold uppercase text-purple-400 tracking-tight">${escMode}</span>
            <span class="math-disp-val text-[12px] font-mono font-bold text-cyan-300 tracking-tight">+0.00</span>
        </div>`;
};

const updateMathLiveUI = (cell, data) => {
    const d = cell.querySelector('.math-disp-val');
    if (d && data?.values) d.textContent = (data.values[0] >= 0 ? '+' : '') + Number(data.values[0] || 0).toFixed(2);
};

export const ADSR_CURVES = {
    exp: { label: '⟍ EXP', attackCurve: 0.0, decayCurve: -0.75, releaseCurve: -0.75 },
    lin: { label: '＼ LIN', attackCurve: 0.0, decayCurve: 0.0, releaseCurve: 0.0 },
    log: { label: '⟋ LOG', attackCurve: 0.0, decayCurve: 0.75, releaseCurve: 0.75 }
};

export const MODULE_REGISTRY = {
    VCO: {
        color: 'blue',
        defaults: () => ({ type: 'VCO', channels: 1, quantize: true, wave: 'sawtooth', freq1: 220, freq2: 220, freq3: 220, freq4: 220 }),
        ports: (m) => ({ in: UIHelpers.getMultiPitchInPorts(m), out: [{ port: 'wave_out', color: 'bg-blue-500' }] }),
        renderGrid: (m) => {
            const isQ = m.quantize !== false;
            const f1 = m.freq1 || 220;
            const noteStr = isQ ? UIHelpers.midiToNoteName(UIHelpers.freqToMidi(f1)) : '';
            return `<div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-400">
                <span class="text-[9px] font-bold uppercase">${m.wave || 'SAW'}</span>
                ${isQ ? `<span class="text-[13px] font-mono font-bold text-white tracking-tight">${noteStr}</span><span class="text-[8.5px] font-mono text-cyan-400/80">${Math.round(f1)}hz</span>` : `<span class="text-[13px] font-mono font-bold tracking-tight">${Math.round(f1)}<span class="text-[9px] ml-0.5">hz</span></span>`}
            </div>`;
        },
        schema: {
            color: 'blue',
            header: {
                channel: { label: 'OSCS', max: 4 },
                toggle: { key: 'quantize', label: 'QLZ', default: true, color: 'cyan' }
            },
            groups: [
                {
                    key: 'wave',
                    label: 'Waveform',
                    cols: 4,
                    options: [
                        { val: 'sawtooth', label: 'SAW' },
                        { val: 'square', label: 'SQR' },
                        { val: 'sine', label: 'SIN' },
                        { val: 'triangle', label: 'TRI' }
                    ]
                }
            ],
            sliders: (m) => {
                const isQ = m.quantize !== false;
                const ch = Math.min(4, Math.max(1, m.channels || 1));
                return Array.from({ length: ch }, (_, i) => {
                    const c = i + 1;
                    const portName = c === 1 ? 'cv_in' : `cv_in${c}`;
                    return isQ ? {
                        key: `freq${c}`,
                        label: `OSC${c}`,
                        min: 24, max: 84, step: 1, default: 69,
                        unit: 'note',
                        cvPort: portName,
                        patchedText: '1V/OCT',
                        getVal: (mod) => UIHelpers.freqToMidi(mod[`freq${c}`] ?? 220),
                        setVal: (mod, v) => { mod[`freq${c}`] = UIHelpers.midiToFreq(Math.round(v)); },
                        format: (v) => UIHelpers.midiToNoteName(v)
                    } : {
                        key: `freq${c}`,
                        label: `OSC${c}`,
                        min: 40, max: 2000, step: 5, default: 220,
                        unit: 'hz',
                        cvPort: portName,
                        patchedText: '1V/OCT',
                        format: (v) => `${Math.round(v)}hz`
                    };
                });
            }
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
        renderGrid: (m, ctx) => `<div class="flex items-center justify-center w-full h-full pointer-events-none">${UIHelpers.renderPanelBars([{
            pct: (ctx?.patched?.has('cv_in') ? 0 : Math.round((m.level ?? 1) * 100)),
            innerCls: 'vca-meter-bar',
            width: 'w-3.5'
        }], { theme: 'cv' })}</div>`,
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
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports, { fold_cv: 5 }),
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
        schema: {
            color: 'sky',
            header: {
                channel: { label: 'TIMBRES', max: 4 },
                groups: [
                    {
                        key: 'wave',
                        options: [{ val: 'sine', label: 'SIN' }, { val: 'triangle', label: 'TRI' }]
                    }
                ]
            },
            sliders: (m) => {
                const ch = Math.min(4, Math.max(1, m.channels || 1));
                const pitchSliders = Array.from({ length: ch }, (_, i) => {
                    const c = i + 1;
                    const portName = c === 1 ? 'cv_in' : `cv_in${c}`;
                    return {
                        key: `freq${c}`,
                        label: `OSC${c}`,
                        min: 40, max: 2000, step: 5, default: 220,
                        unit: 'hz',
                        cvPort: portName,
                        patchedText: '1V/OCT',
                        format: (v) => `${Math.round(v)}hz`
                    };
                });
                return [
                    ...pitchSliders,
                    { key: 'fold', label: 'FOLD', min: 0, max: 5.0, step: 0.05, default: 1.5, unit: 'drv', color: 'amber', cvPort: 'fold_cv', patchedText: 'EXT', format: v => v.toFixed(2) },
                    { key: 'bias', label: 'BIAS', min: -1.0, max: 1.0, step: 0.02, default: 0.0, unit: 'dc', color: 'purple', format: v => v.toFixed(2) }
                ];
            }
        }
    },
    ADSR: {
        color: 'blue',
        defaults: () => ({
            type: 'ADSR',
            attack: 0.02,
            decay: 0.2,
            sustain: 0.6,
            release: 0.4,
            aCurve: 'exp',
            dCurve: 'exp',
            rCurve: 'exp',
            attackCurve: 0.0,
            decayCurve: -0.75,
            releaseCurve: -0.75
        }),
        onNormalize: (m) => {
            const curveVal = (c) => c === 'log' ? 0.75 : (c === 'exp' ? -0.75 : 0.0);
            if (!m.aCurve) {
                if (m.attackCurve !== undefined) m.aCurve = m.attackCurve > 0.15 ? 'log' : (m.attackCurve < -0.15 ? 'exp' : 'lin');
                else m.aCurve = m.curve || 'exp';
            }
            if (!m.dCurve) {
                if (m.decayCurve !== undefined) m.dCurve = m.decayCurve > 0.15 ? 'log' : (m.decayCurve < -0.15 ? 'exp' : 'lin');
                else m.dCurve = m.curve || 'exp';
            }
            if (!m.rCurve) {
                if (m.releaseCurve !== undefined) m.rCurve = m.releaseCurve > 0.15 ? 'log' : (m.releaseCurve < -0.15 ? 'exp' : 'lin');
                else m.rCurve = m.curve || 'exp';
            }
            m.attackCurve = curveVal(m.aCurve);
            m.decayCurve = curveVal(m.dCurve);
            m.releaseCurve = curveVal(m.rCurve);
        },
        ports: () => ({
            in: [{ port: 'gate_in', color: 'bg-orange-500' }],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        MAX_STAGES: [2, 3, 1, 5],
        renderSvgCurve: (m) => {
            const padX = 6, padY = 4, W = 160 - padX * 2, H = 40 - padY * 2;
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

            const curvePreset = ADSR_CURVES[m.curve || 'exp'] || ADSR_CURVES.exp;
            const attCurve = m.attackCurve ?? curvePreset.attackCurve;
            const decCurve = m.decayCurve ?? curvePreset.decayCurve;
            const relCurve = m.releaseCurve ?? curvePreset.releaseCurve;

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
                    const v = curveShape(t, -attCurve);
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
                    const v = 1.0 - curveShape(t, decCurve);
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
                    const v = 1.0 - curveShape(t, relCurve);
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

            const sepA = (wA >= 3 && (padX + wA) < maxX) ? `<line x1="${(padX + wA).toFixed(1)}" y1="${yTop}" x2="${(padX + wA).toFixed(1)}" y2="${yBot}" stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2"/>` : '';
            const sepD = (wD >= 3 && (padX + wA + wD) < maxX) ? `<line x1="${(padX + wA + wD).toFixed(1)}" y1="${yTop}" x2="${(padX + wA + wD).toFixed(1)}" y2="${yBot}" stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2"/>` : '';
            const sepS = ((padX + wA + wD + wS) < maxX) ? `<line x1="${(padX + wA + wD + wS).toFixed(1)}" y1="${yTop}" x2="${(padX + wA + wD + wS).toFixed(1)}" y2="${yBot}" stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2"/>` : '';

            const dotA = (padX + wA) <= maxX ? `<circle cx="${(padX + wA).toFixed(1)}" cy="${yTop}" r="2" fill="#38bdf8" />` : '';
            const dotD = (padX + wA + wD) <= maxX ? `<circle cx="${(padX + wA + wD).toFixed(1)}" cy="${ySus.toFixed(1)}" r="1.5" fill="#0284c7" />` : '';
            const dotS = (padX + wA + wD + wS) <= maxX ? `<circle cx="${(padX + wA + wD + wS).toFixed(1)}" cy="${ySus.toFixed(1)}" r="1.5" fill="#0284c7" />` : '';
            const dotR = (padX + wA + wD + wS + wR) <= maxX ? `<circle cx="${(padX + wA + wD + wS + wR).toFixed(1)}" cy="${yBot}" r="1.5" fill="#0284c7" />` : '';

            return `
                <svg viewBox="0 0 160 40" class="w-full h-10 select-none">
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
                    <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                    ${dotA}
                    ${dotD}
                    ${dotS}
                    ${dotR}
                </svg>
            `;
        },
        renderModal: (m, ctx) => {
            MODULE_REGISTRY.ADSR.onNormalize?.(m);
            const vTime = m._viewTime ?? 1.0;
            const sliderVal = Math.pow(Math.max(0, Math.min(1, (vTime - 0.02) / 9.98)), 1 / 2.5);

            const aCurve = m.aCurve || 'exp';
            const dCurve = m.dCurve || 'exp';
            const rCurve = m.rCurve || 'exp';

            const renderCurveCol = (stageKey, curVal, label) => {
                const options = ['log', 'lin', 'exp'];
                return `
                    <div class="flex flex-col bg-slate-950/70 p-1 rounded-lg border border-slate-800">
                        <span class="text-[7.5px] font-bold text-center text-cyan-300 pb-0.5 border-b border-slate-800/80">${label}</span>
                        <div class="flex flex-col gap-0.5 mt-0.5">
                            ${options.map(opt => {
                                const isSel = curVal === opt;
                                return `
                                    <button class="adsr-curve-stage-btn py-1 px-0.5 rounded text-[7.5px] font-bold border transition-colors ${isSel ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}" data-stage="${stageKey}" data-val="${opt}">
                                        ${opt.toUpperCase()}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            };

            return `
                <div id="adsr-curve-container" class="mb-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col gap-1">
                    <div id="adsr-svg-wrap" class="w-full flex items-center justify-center">
                        ${MODULE_REGISTRY.ADSR.renderSvgCurve(m)}
                    </div>
                    <div class="flex items-center gap-1 px-1 pt-0.5 border-t border-slate-800/80">
                        <span class="text-[7.5px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">VIEW TIME</span>
                        <input type="range" id="adsr-view-time-slider" min="0" max="1" step="0.005" value="${sliderVal.toFixed(3)}" class="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400">
                        <span id="adsr-view-time-disp" class="text-[8px] font-mono text-cyan-300 font-bold min-w-[32px] text-right">${UIHelpers.formatTime(vTime)}</span>
                    </div>
                </div>

                <!-- CURVE: A用 D用 R用 横並び (上から LOG, LIN, EXP) -->
                <div class="my-1">
                    <label class="block text-[8px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">CURVE</label>
                    <div class="grid grid-cols-3 gap-1">
                        ${renderCurveCol('a', aCurve, 'A')}
                        ${renderCurveCol('d', dCurve, 'D')}
                        ${renderCurveCol('r', rCurve, 'R')}
                    </div>
                </div>

                <!-- Sliders A, D, S, R (Vertical) -->
                <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 mt-1">
                    ${UIHelpers.createVSliderHTML('adsr-slider-attack', 'A', 0.0005, 2.0, 0.001, m.attack ?? 0.02, 'time', 'blue', false, UIHelpers.formatTime(m.attack ?? 0.02), 2.5)}
                    ${UIHelpers.createVSliderHTML('adsr-slider-decay', 'D', 0.005, 3.0, 0.005, m.decay ?? 0.2, 'time', 'blue', false, UIHelpers.formatTime(m.decay ?? 0.2), 2.5)}
                    ${UIHelpers.createVSliderHTML('adsr-slider-sustain', 'S', 0.0, 1.0, 0.01, m.sustain ?? 0.6, 'lvl', 'blue', false, (m.sustain ?? 0.6).toFixed(2), 1)}
                    ${UIHelpers.createVSliderHTML('adsr-slider-release', 'R', 0.005, 5.0, 0.005, m.release ?? 0.4, 'time', 'blue', false, UIHelpers.formatTime(m.release ?? 0.4), 2.5)}
                </div>
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

            document.querySelectorAll('.adsr-curve-stage-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const stage = e.currentTarget.dataset.stage;
                    const val = e.currentTarget.dataset.val;
                    if (stage === 'a') m.aCurve = val;
                    else if (stage === 'd') m.dCurve = val;
                    else if (stage === 'r') m.rCurve = val;
                    MODULE_REGISTRY.ADSR.onNormalize(m);
                    if (svgWrap) svgWrap.innerHTML = MODULE_REGISTRY.ADSR.renderSvgCurve(m);
                    cb();
                    ctx.reRenderModal();
                });
            });

            const onSliderChange = () => {
                if (svgWrap) svgWrap.innerHTML = MODULE_REGISTRY.ADSR.renderSvgCurve(m);
                cb();
            };

            UIHelpers.bindSlider('adsr-slider-attack', UIHelpers.formatTime, v => { m.attack = v; onSliderChange(); }, 2.5, 0.0005, 2.0);
            UIHelpers.bindScrubber('adsr-slider-attack-disp', 'adsr-slider-attack', UIHelpers.formatTime, v => { m.attack = v; onSliderChange(); }, 2.5, 0.0005, 2.0);

            UIHelpers.bindSlider('adsr-slider-decay', UIHelpers.formatTime, v => { m.decay = v; onSliderChange(); }, 2.5, 0.005, 3.0);
            UIHelpers.bindScrubber('adsr-slider-decay-disp', 'adsr-slider-decay', UIHelpers.formatTime, v => { m.decay = v; onSliderChange(); }, 2.5, 0.005, 3.0);

            UIHelpers.bindSlider('adsr-slider-sustain', v => v.toFixed(2), v => { m.sustain = v; onSliderChange(); }, 1, 0.0, 1.0);
            UIHelpers.bindScrubber('adsr-slider-sustain-disp', 'adsr-slider-sustain', v => v.toFixed(2), v => { m.sustain = v; onSliderChange(); }, 1, 0.0, 1.0);

            UIHelpers.bindSlider('adsr-slider-release', UIHelpers.formatTime, v => { m.release = v; onSliderChange(); }, 2.5, 0.005, 5.0);
            UIHelpers.bindScrubber('adsr-slider-release-disp', 'adsr-slider-release', UIHelpers.formatTime, v => { m.release = v; onSliderChange(); }, 2.5, 0.005, 5.0);
        },
        renderGrid: (m) => `<div class="flex items-center justify-center w-full h-full pointer-events-none">${UIHelpers.renderPanelBars(
            [m.attack ?? 0.02, m.decay ?? 0.2, m.sustain ?? 0.6, m.release ?? 0.4].map((v, i) => ({
                pct: Math.max(5, Math.min(100, Math.round((v / (MODULE_REGISTRY.ADSR.MAX_STAGES[i] ?? 1)) * 100))),
                innerCls: `adsr-bar-${i}`,
                attrs: `data-adsr-bar="${i}"`,
                width: 'w-2'
            })),
            { gapCls: 'gap-1.5', theme: 'cv' }
        )}</div>`,
        updateLive: (cell, data) => {
            const stage = data?.stage ?? -1;
            const now = performance.now();
            if (!cell._adsrState) cell._adsrState = { lastStage: -1, attFlashUntil: 0, susFlashUntil: 0 };

            // Guarantee Attack lights up on note onset even if attack time is 0s
            if (data?.attackTriggered || (stage === 0 && cell._adsrState.lastStage !== 0)) {
                cell._adsrState.attFlashUntil = now + 60;
            }

            // Guarantee Sustain lights up when release begins
            if (stage === 3 && cell._adsrState.lastStage !== 3) {
                cell._adsrState.susFlashUntil = now + 60;
            }
            cell._adsrState.lastStage = stage;

            const isAttActive = (stage === 0) || (now < cell._adsrState.attFlashUntil);
            const isSusActive = (stage === 2) || (now < cell._adsrState.susFlashUntil);

            cell.querySelectorAll('[data-adsr-bar]').forEach((bar, i) => {
                let isAct = (i === stage);
                if (i === 0) isAct = isAttActive;
                else if (i === 2) isAct = isSusActive;
                bar.classList.toggle('bar-active', isAct);
            });
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
        schema: {
            color: 'indigo',
            header: {
                groups: [
                    {
                        key: 'syncMode',
                        reRender: true,
                        options: [
                            { val: 'free', label: 'FREE (Hz)' },
                            { val: 'sync', label: 'SYNC (BPM)' }
                        ]
                    },
                    {
                        key: 'polarity',
                        options: [
                            { val: 'bipolar', label: 'BI (±)' },
                            { val: 'unipolar', label: 'UNI (+)' }
                        ]
                    }
                ]
            },
            groups: [
                {
                    key: 'waveType',
                    label: 'Waveform',
                    cols: 5,
                    options: [
                        { val: 'sine', label: 'SIN' },
                        { val: 'triangle', label: 'TRI' },
                        { val: 'sawtooth', label: 'SAW' },
                        { val: 'ramp', label: 'RAMP' },
                        { val: 'square', label: 'SQR' }
                    ]
                }
            ],
            sliders: (m) => {
                const isSync = m.syncMode === 'sync';
                const divs = MODULE_REGISTRY.LFO.DIVISIONS;
                const rateSlider = isSync ? {
                    key: 'division',
                    label: 'BEAT',
                    min: 0, max: divs.length - 1, step: 1, default: 4,
                    unit: 'DIV',
                    getVal: (mod) => {
                        const idx = divs.indexOf(mod.division || '1/4');
                        return idx === -1 ? 4 : idx;
                    },
                    setVal: (mod, v) => {
                        mod.division = divs[Math.round(v)] || '1/4';
                    },
                    format: (v) => divs[Math.round(v)] || '1/4'
                } : {
                    key: 'rate',
                    label: 'RATE',
                    min: 0.05, max: 30.0, step: 0.05, default: 2.0,
                    unit: 'hz',
                    format: (v) => `${Number(v).toFixed(2)}hz`
                };
                return [
                    rateSlider,
                    { key: 'phase', label: 'PHASE', min: 0, max: 360, step: 1, default: 0, unit: 'deg', format: (v) => `${Math.round(v)}°` },
                    { key: 'depth', label: 'DEPTH', min: 0, max: 5.0, step: 0.05, default: 1.0, unit: 'cv', format: (v) => Number(v).toFixed(2) },
                    { key: 'duty', label: 'DUTY', min: 0.05, max: 0.95, step: 0.01, default: 0.5, unit: '%', format: (v) => `${Math.round(v * 100)}%` }
                ];
            }
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
                { port: 'sig_in', color: 'bg-yellow-400' },
                { port: 'time_cv', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        schema: {
            color: 'teal',
            sliders: [
                { key: 'timeMs', label: 'DELAY', min: 0, max: 2000, step: 1, default: 50, unit: 'ms', cvPort: 'time_cv', patchedVal: 50, patchedText: 'EXT CV', format: v => `${Math.round(v)}ms` }
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
            in: Array.from({ length: m.channels || 2 }, (_, i) => ({ port: `wave_in${i+1}`, pin: 4 + i, color: 'bg-blue-500' })),
            out: [{ port: 'wave_out', pin: 9, color: 'bg-blue-500' }]
        }),
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports),
        renderGrid: (m) => `<div class="flex items-center justify-center w-full h-full pointer-events-none"><div class="mix-bars-wrap flex items-center justify-center px-1.5 py-1 rounded border border-transparent transition-all duration-150">${UIHelpers.renderPanelBars(
            Array.from({ length: m.channels || 2 }, (_, i) => ({
                pct: Math.round((m[`lvl${i + 1}`] ?? 1) * 100),
                width: 'w-2'
            })),
            { gapCls: 'gap-1.5', theme: 'cv' }
        )}</div></div>`,
        updateLive: (cell, data) => {
            const port = cell.querySelector('[data-port="wave_out"]');
            if (!port) return;
            const isClipping = !!data?.isClipping;
            if (port._isClipping !== isClipping) {
                port._isClipping = isClipping;
                port.classList.toggle('port-clipping', isClipping);
            }
        },
        schema: {
            color: 'blue',
            header: {
                channel: { label: 'CHANNELS', min: 2, max: 4, portPrefix: 'wave_in' }
            },
            sliders: (m) => {
                const ch = Math.min(4, Math.max(2, m.channels || 2));
                return Array.from({ length: ch }, (_, i) => ({
                    key: `lvl${i + 1}`,
                    label: `CH${i + 1}`,
                    min: 0, max: 1.0, step: 0.01, default: 1.0,
                    unit: 'lvl',
                    format: v => v.toFixed(2)
                }));
            }
        }
    },
    SLIDER: {
        color: 'emerald',
        defaults: () => ({ type: 'SLIDER', vol: 0.70 }),
        ports: () => ({ in: [], out: [{ port: 'cv_out', color: 'bg-yellow-400' }] }),
        schema: { color: 'emerald', sliders: [{ key: 'vol', label: 'VAL', min: 0, max: 1.0, step: 0.01, default: 0.70, unit: 'out', format: v => v.toFixed(2) }] },
        renderGrid: (m) => `<div class="flex items-center justify-center w-full h-full pointer-events-none">${UIHelpers.renderPanelBars([
            {
                pct: Math.round((m.vol ?? 0.7) * 100),
                width: 'w-3.5'
            }
        ], { theme: 'cv' })}</div>`
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
        RATES: ['/16', '/8', '/7', '/6', '/5', '/4', '/3', '/2', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x16'],
        defaults: () => ({ type: 'CLK', div: 'x2', pulseWidthMs: 15, limitPct: 90 }),
        ports: () => ({ in: [], out: [{ port: 'gate_out', color: 'bg-red-500' }] }),
        renderGrid: (m, ctx) => {
            const bpm = ctx?.bpm || 120, mult = parseClockRate(m.div || 'x2');
            const intMs = Math.round((60.0 / bpm / mult) * 1000);
            const limPct = m.limitPct ?? 90;
            const maxMs = Math.max(1, Math.round(intMs * (limPct / 100)));
            const curP = m.pulseWidthMs ?? 15;
            const effMs = Math.min(curP, maxMs);
            return `<div class="flex flex-col items-center justify-center leading-tight gap-0.5 pointer-events-none text-cyan-400"><span class="text-[15px] font-mono font-bold">${m.div || 'x2'}</span><span class="text-[10px] font-mono font-semibold">${effMs}ms</span></div>`;
        },
        renderModal: (m, ctx) => {
            const bpm = ctx?.bpm || 120, mult = parseClockRate(m.div || 'x2'), intMs = Math.round((60.0 / bpm / mult) * 1000);
            const limPct = m.limitPct ?? 90;
            const maxAllowedMs = Math.max(1, Math.round(intMs * (limPct / 100)));
            const curPulse = m.pulseWidthMs ?? 15;
            const isClamped = curPulse > maxAllowedMs;
            const effectiveMs = isClamped ? maxAllowedMs : curPulse;

            const rates = MODULE_REGISTRY.CLK.RATES;
            let rateIdx = rates.indexOf(m.div || 'x2');
            if (rateIdx === -1) {
                let closestIdx = 8, minDiff = Infinity;
                rates.forEach((r, idx) => {
                    const diff = Math.abs(parseClockRate(r) - mult);
                    if (diff < minDiff) { minDiff = diff; closestIdx = idx; }
                });
                rateIdx = closestIdx;
            }
            const curRateStr = rates[rateIdx];

            return `
                <div class="flex flex-col gap-1.5 p-1">
                    <div id="clk-banner" class="w-full py-1 rounded text-center text-[9.5px] font-mono font-bold border transition-colors ${isClamped ? 'bg-amber-950/80 text-amber-300 border-amber-500/70' : 'bg-rose-950/80 text-rose-300 border-rose-500/70'}">
                        GATE: ${effectiveMs}ms / ${intMs}ms
                    </div>
                    <div class="flex items-center justify-around bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 gap-1">
                        ${UIHelpers.createVSliderHTML('clk-gate', 'PULSE', 2, 1500, 1, curPulse, 'ms', 'rose', false, `${curPulse}ms`)}
                        ${UIHelpers.createVSliderHTML('clk-limit', 'LIMIT', 10, 90, 1, Math.min(90, limPct), '%', 'amber', false, `${Math.min(90, limPct)}%`)}
                        ${UIHelpers.createVSliderHTML('clk-rate', 'RATE', 0, rates.length - 1, 1, rateIdx, '', 'rose', false, curRateStr)}
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const rates = MODULE_REGISTRY.CLK.RATES;
            const updateBanner = () => {
                const bpm = ctx?.bpm || 120;
                const mult = parseClockRate(m.div || 'x2');
                const intMs = Math.round((60.0 / bpm / mult) * 1000);
                const limPct = Math.min(90, m.limitPct ?? 90);
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
                m.limitPct = Math.min(90, Math.round(v));
                updateBanner();
                cb();
            });
            UIHelpers.bindSlider('clk-rate', v => {
                const idx = Math.min(rates.length - 1, Math.max(0, Math.round(v)));
                return rates[idx];
            }, v => {
                const idx = Math.min(rates.length - 1, Math.max(0, Math.round(v)));
                m.div = rates[idx];
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
        renderGrid: renderMathGridUI,
        updateLive: updateMathLiveUI,
        renderModal: (m, ctx) => renderMathModalUI(m, ctx, [{ label: 'Functions (A)', cols: 5, modes: MODULE_REGISTRY.MATH1.MODES }], ['A']),
        bindEvents: (m, ctx, cb) => bindMathEventsUI(m, ctx, cb, ['A'])
    },
    MATH2: {
        color: 'purple',
        ARITHMETIC_MODES: ['ADD', 'DIFF', 'MULTI', 'MOD', 'A^B', 'MIN', 'MAX'],
        COMPARISON_MODES: ['<', '<=', '==', '>=', '>'],
        defaults: () => ({ type: 'MATH2', mode: 'ADD', valA: 0.0, valB: 1.0 }),
        ports: () => ({
            in: [
                { port: 'a', color: 'bg-yellow-400' },
                { port: 'b', color: 'bg-yellow-400' }
            ],
            out: [{ port: 'cv_out', color: 'bg-yellow-400' }]
        }),
        renderGrid: renderMathGridUI,
        updateLive: updateMathLiveUI,
        renderModal: (m, ctx) => renderMathModalUI(m, ctx, [
            { label: 'Arithmetic', cols: 4, modes: MODULE_REGISTRY.MATH2.ARITHMETIC_MODES },
            { label: 'Comparison (A vs B)', cols: 5, modes: MODULE_REGISTRY.MATH2.COMPARISON_MODES }
        ], ['A', 'B']),
        bindEvents: (m, ctx, cb) => bindMathEventsUI(m, ctx, cb, ['A', 'B'])
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
                { port: 'in1', pin: 4, color: 'bg-yellow-400' },
                { port: 'trig', pin: 5, color: 'bg-orange-500' },
                { port: 'in2', pin: 3, color: 'bg-yellow-400' }
            ],
            out: []
        }),
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports),
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

                // Upper terminal (in2 / b2) - shifts UP
                ctx2d.lineWidth = 1.2; ctx2d.strokeStyle = '#c084fc'; ctx2d.beginPath();
                for (let i = 0; i < drawPts; i++) {
                    const idx = startIdx + i;
                    const y = Math.max(1, Math.min(h - 1, (h / 2) - (((b2[idx] / vR) + sp) * (h * 0.44))));
                    i === 0 ? ctx2d.moveTo(i * sW, y) : ctx2d.lineTo(i * sW, y);
                }
                ctx2d.stroke();

                // Lower terminal (in1 / b1) - shifts DOWN
                ctx2d.lineWidth = 1.4; ctx2d.strokeStyle = '#22d3ee'; ctx2d.beginPath();
                for (let i = 0; i < drawPts; i++) {
                    const idx = startIdx + i;
                    const y = Math.max(1, Math.min(h - 1, (h / 2) - (((b1[idx] / vR) - sp) * (h * 0.44))));
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
                { port: 'in1', color: 'bg-yellow-400' },
                { port: 'in2', color: 'bg-yellow-400' },
                { port: 'in3', color: 'bg-yellow-400' },
                { port: 'in4', color: 'bg-yellow-400' }
            ],
            out: []
        }),
        renderGrid: () => `<div class="flex flex-col justify-center gap-0.5 w-full h-full py-2.5 pl-3.5 pr-1 pointer-events-none select-none">${[4,3,2,1].map(i => `<div class="flex items-center justify-center h-2.5 bg-slate-950/50 rounded-sm border border-slate-800/70"><span class="mon-val-${i} text-[8px] font-mono text-cyan-300 font-bold leading-none">+0.00</span></div>`).join('')}</div>`,
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
            in: [
                { port: 'wave_in_l', pin: 4, color: 'bg-blue-500' },
                { port: 'wave_in_r', pin: 5, color: 'bg-blue-500' }
            ],
            out: []
        }),
        schema: { color: 'amber', sliders: [{ key: 'masterVol', label: 'MASTER', min: 0, max: 0.5, step: 0.01, default: 0.12, unit: 'vol', format: v => Math.round(v * 100) + '%' }] },
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports),
        renderGrid: (m) => `<div class="flex flex-col items-center justify-center w-full h-full pointer-events-none text-cyan-400 gap-1 pt-0.5">
            ${UIHelpers.renderPanelBars([
                {
                    pct: 0,
                    innerCls: 'spk-meter-l transition-all duration-75',
                    width: 'w-2.5'
                },
                {
                    pct: 0,
                    innerCls: 'spk-meter-r transition-all duration-75',
                    width: 'w-2.5'
                }
            ], { heightCls: 'h-6', gapCls: 'gap-1.5' })}
            <span class="spk-vol-val text-[8px] font-mono font-bold text-cyan-300 bg-slate-950/85 px-1 py-[0.5px] rounded border border-slate-700/80 leading-none shadow-sm select-none">${Math.round((m.masterVol??0.12)*100)}%</span>
        </div>`,
        updateLive: (cell, data, isP, modal, m) => {
            const barL = cell.querySelector('.spk-meter-l');
            const barR = cell.querySelector('.spk-meter-r');
            if (barL && data?.peakL !== undefined) {
                barL.style.height = `${Math.max(0, Math.min(100, Math.round(data.peakL * 200)))}%`;
            }
            if (barR && data?.peakR !== undefined) {
                barR.style.height = `${Math.max(0, Math.min(100, Math.round(data.peakR * 200)))}%`;
            }
            const volTxt = cell.querySelector('.spk-vol-val');
            if (volTxt && m) {
                volTxt.textContent = `${Math.round((m.masterVol ?? 0.12) * 100)}%`;
            }
        }
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
        onNormalize: (m) => {
            if (Array.isArray(m.steps) && typeof m.steps[0] === 'number') {
                m.steps = m.steps.map(cv => ({ cv, active: true, cvActive: true, gate: true }));
            }
        },
        ports: () => ({
            in: [{ port: 'gate_in', color: 'bg-red-500' }],
            out: [
                { port: 'cv_out', color: 'bg-yellow-400' },
                { port: 'gate_out', color: 'bg-orange-500' }
            ]
        }),
        renderGrid: (m) => `<div class="flex items-center justify-center w-full h-full pointer-events-none">
            ${UIHelpers.renderPanelBars(
                (m.steps || []).map((st, i) => {
                    const val = typeof st === 'number' ? st : (st?.cv ?? 0);
                    const isAct = typeof st === 'object' ? (st.active !== false) : true;
                    const h = isAct ? Math.max(6, Math.min(100, Math.round((val / 2.0) * 100))) : 4;
                    const barColor = isAct ? 'bg-gradient-to-t from-amber-600 to-yellow-400' : 'bg-slate-800';
                    return {
                        pct: h,
                        color: barColor,
                        width: 'flex-1',
                        attrs: `data-step-bar="${i}"`
                    };
                }),
                {
                    gapCls: 'gap-px',
                    containerCls: 'w-[50px]',
                    theme: 'cv'
                }
            )}
        </div>`,
        updateLive: (cell, data, isP, modal) => {
            const step = data?.step ?? -1;
            cell.querySelectorAll('[data-step-bar]').forEach((b, i) => {
                b.classList.toggle('bar-active', isP && i === step);
            });
            modal?.querySelectorAll('[data-step-col]').forEach((col, i) => {
                const cur = isP && i === step;
                col.classList.toggle('border-yellow-400', cur);
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
                    ${(m.steps||[]).map((st, i) => {
                        const val = typeof st === 'number' ? st : (st?.cv ?? 0);
                        const isAct = typeof st === 'object' ? (st.active !== false) : true;
                        const isCvAct = typeof st === 'object' ? (st.cvActive !== false) : true;
                        const isGateAct = typeof st === 'object' ? (st.gate !== false) : true;
                        return `
                        <div data-step-col="${i}" class="flex flex-col items-center gap-1 flex-1 min-w-[34px] p-1 rounded-lg border transition-all ${isAct ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-950/80 border-slate-800/40 opacity-40 grayscale'}">
                            <span id="seq-slider-${i}-disp" class="text-[8.5px] ${isAct ? 'text-cyan-300' : 'text-slate-500'} font-mono font-bold cursor-ns-resize touch-none select-none hover:bg-slate-800/80 px-1 py-0.5 rounded transition-colors" title="上下ドラッグで微調整">${m.quantize!==false?UIHelpers.cvToNoteName(val):val.toFixed(2)}</span>
                            <input type="range" data-seq-slider="${i}" id="seq-slider-${i}" min="0" max="2.0" step="${m.quantize!==false?0.083333:0.01}" value="${val}" class="native-vslider ${isAct ? 'accent-blue-500' : 'accent-slate-600'} !h-16">
                            <div class="flex flex-col gap-0.5 w-full">
                                <button data-act="gate" data-step="${i}" class="text-[6.5px] font-bold py-0.5 rounded border transition-colors ${!isAct ? 'bg-slate-950 text-slate-600 border-slate-800' : (isGateAct ? 'bg-sky-950 text-sky-300 border-sky-500/80' : 'bg-slate-950 text-slate-600 border-slate-800')}">GATE</button>
                                <button data-act="cvActive" data-step="${i}" class="text-[7px] font-bold py-0.5 rounded border transition-colors ${!isAct ? 'bg-slate-950 text-slate-600 border-slate-800' : (isCvAct ? 'bg-cyan-950 text-cyan-300 border-cyan-500/80' : 'bg-slate-950 text-slate-600 border-slate-800')}">CV</button>
                                <button data-act="active" data-step="${i}" class="text-[6.5px] font-bold py-0.5 rounded border transition-colors ${isAct ? 'bg-blue-950 text-blue-300 border-blue-500/80' : 'bg-slate-950 text-slate-500 border-slate-800'}">STEP</button>
                            </div>
                        </div>`;
                    }).join('')}
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
        CHORD_TYPES,
        VOICINGS: CHORD_VOICINGS,
        defaults: () => ({ type: 'CHORD', chord: 'min', rootMidi: 48, voicing: 'close' }),
        ports: () => ({
            in: [
                { port: 'cv_in', color: 'bg-yellow-400' },
                { port: 'type_cv', color: 'bg-yellow-400' },
                { port: 'voice_cv', color: 'bg-yellow-400' }
            ],
            out: [
                { port: 'cv_out1', color: 'bg-yellow-400' },
                { port: 'cv_out2', color: 'bg-yellow-400' },
                { port: 'cv_out3', color: 'bg-yellow-400' },
                { port: 'cv_out4', color: 'bg-yellow-400' }
            ]
        }),
        renderGrid: (m, ctx) => {
            const chordKey = m.chord || 'min';
            const info = CHORD_TYPES[chordKey] || CHORD_TYPES['min'];
            const voiceKey = m.voicing || 'close';
            const voiceInfo = VOICING_LABELS[voiceKey] || VOICING_LABELS['close'];
            const isPatched = ctx?.patched?.has('cv_in');
            const rootName = isPatched ? 'EXT' : UIHelpers.cvToNoteName(((m.rootMidi ?? 48) - 24) / 12.0);
            return `
                <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-purple-300">
                    <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">CHORD CV</span>
                    <span class="text-[12px] font-mono font-bold text-cyan-300 chord-live-name">${rootName} ${info.label}</span>
                    <div class="flex items-center gap-1 text-[7px] font-mono text-purple-400">
                        <span class="chord-live-bin font-bold text-yellow-300/90">${info.binary}</span>
                        <span class="text-slate-500">•</span>
                        <span class="chord-live-voice">${voiceInfo.label}</span>
                    </div>
                </div>`;
        },
        renderModal: (m, ctx) => {
            const chords = CHORD_ORDER.map(val => ({ val, ...CHORD_TYPES[val] }));
            const voicings = VOICING_ORDER.map(val => ({ val, ...VOICING_LABELS[val] }));
            const isRootPatched = ctx.patched?.has('cv_in');
            const isTypePatched = ctx.patched?.has('type_cv');
            const isVoicePatched = ctx.patched?.has('voice_cv');
            const curRoot = m.rootMidi ?? 48;
            const rootName = UIHelpers.cvToNoteName((curRoot - 24) / 12.0);

            const curChord = m.chord || 'min';
            const curVoice = m.voicing || 'close';

            return `
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span class="text-[8px] text-slate-400 font-semibold uppercase">ROOT NOTE (1V/OCT)</span>
                        <span class="text-[9px] font-mono font-bold text-yellow-300">${isRootPatched ? 'EXT CV (PATCHED)' : rootName}</span>
                    </div>
                    <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 ${isRootPatched ? 'opacity-30 pointer-events-none' : ''}">
                        ${UIHelpers.createVSliderHTML('chord-root-slider', 'ROOT', 24, 72, 1, curRoot, 'note', 'purple', isRootPatched, rootName)}
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-0.5">
                            <label class="block text-[8px] text-slate-400 uppercase tracking-wider font-semibold">Chord Type (0-7V)</label>
                            <span class="text-[8px] font-mono ${isTypePatched ? 'text-yellow-300 font-bold' : 'text-slate-500'}">${isTypePatched ? 'EXT CV (PATCHED)' : '3-BIT BINARY'}</span>
                        </div>
                        <div class="grid grid-cols-4 gap-1">
                            ${chords.map(c => {
                                const isSel = curChord === c.val;
                                return `
                                    <button class="chord-type-btn py-1 px-1 rounded flex flex-col items-center justify-center border transition-all ${isSel ? 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}" data-val="${c.val}">
                                        <span class="text-[7px] font-mono ${isSel ? 'text-purple-200' : 'text-slate-500'} pointer-events-none">${c.binary}</span>
                                        <span class="text-[8.5px] font-bold pointer-events-none">${c.label}</span>
                                    </button>`;
                            }).join('')}
                        </div>
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-0.5">
                            <label class="block text-[8px] text-slate-400 uppercase tracking-wider font-semibold">Voicing (0-3V)</label>
                            <span class="text-[8px] font-mono ${isVoicePatched ? 'text-yellow-300 font-bold' : 'text-slate-500'}">${isVoicePatched ? 'EXT CV (PATCHED)' : '2-BIT BINARY'}</span>
                        </div>
                        <div class="grid grid-cols-4 gap-1">
                            ${voicings.map(v => {
                                const isSel = curVoice === v.val;
                                return `
                                    <button class="chord-voice-btn py-1 px-1 rounded flex flex-col items-center justify-center border transition-all ${isSel ? 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}" data-val="${v.val}">
                                        <span class="text-[7px] font-mono ${isSel ? 'text-purple-200' : 'text-slate-500'} pointer-events-none">${v.binary}</span>
                                        <span class="text-[8px] font-bold pointer-events-none">${v.label}</span>
                                    </button>`;
                            }).join('')}
                        </div>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            UIHelpers.bindButtonGroup('.chord-type-btn', 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/50', 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800', val => {
                m.chord = val;
                ctx.reRenderModal();
                cb();
            });
            UIHelpers.bindButtonGroup('.chord-voice-btn', 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/50', 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800', val => {
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
        },
        updateLive: (cell, data, isPlaying, modalEl, m) => {
            if (!data) return;
            const cIdx = data.activeChordIdx ?? (m.chord ? CHORD_ORDER.indexOf(m.chord) : 0);
            const vIdx = data.activeVoiceIdx ?? (m.voicing ? VOICING_ORDER.indexOf(m.voicing) : 0);
            const cKey = CHORD_ORDER[cIdx] || 'min';
            const vKey = VOICING_ORDER[vIdx] || 'close';
            const cInfo = CHORD_TYPES[cKey];
            const vInfo = VOICING_LABELS[vKey];

            const nameEl = cell?.querySelector('.chord-live-name');
            const binEl = cell?.querySelector('.chord-live-bin');
            const voiceEl = cell?.querySelector('.chord-live-voice');
            if (nameEl && cInfo) {
                const isRootP = cell?.querySelector('.cable-jack[data-port="cv_in"]')?.classList.contains('connected');
                const rootName = isRootP ? 'EXT' : UIHelpers.cvToNoteName(((m.rootMidi ?? 48) - 24) / 12.0);
                nameEl.textContent = `${rootName} ${cInfo.label}`;
            }
            if (binEl && cInfo) binEl.textContent = cInfo.binary;
            if (voiceEl && vInfo) voiceEl.textContent = vInfo.label;

            if (modalEl) {
                modalEl.querySelectorAll('.chord-type-btn').forEach(btn => {
                    const isCur = btn.dataset.val === cKey;
                    btn.classList.toggle('ring-1', isCur);
                    btn.classList.toggle('ring-yellow-400', isCur);
                });
                modalEl.querySelectorAll('.chord-voice-btn').forEach(btn => {
                    const isCur = btn.dataset.val === vKey;
                    btn.classList.toggle('ring-1', isCur);
                    btn.classList.toggle('ring-yellow-400', isCur);
                });
            }
        }
    },
    SUB: {
        color: 'cyan',
        defaults: () => ({ type: 'SUB', targetPage: 1 }),
        ports: (m, ctx) => {
            const allPins = [
                { port: 'PIN1_in', slot: 1 }, { port: 'PIN2_in', slot: 2 }, { port: 'PIN3_in', slot: 3 },
                { port: 'PIN4_in', slot: 4 }, { port: 'PIN5_in', slot: 5 }, { port: 'PIN6_in', slot: 6 },
                { port: 'PIN7_out', slot: 7 }, { port: 'PIN8_out', slot: 8 }, { port: 'PIN9_out', slot: 9 },
                { port: 'PIN10_out', slot: 10 }, { port: 'PIN11_out', slot: 11 }, { port: 'PIN12_out', slot: 12 }
            ];
            const active = ctx?.subActivePorts;
            const visiblePins = active ? allPins.filter(p => active.has(p.port) || active.has(`PIN${p.slot}`) || active.has(`PIN${p.slot}_in`) || active.has(`PIN${p.slot}_out`)) : allPins;
            const inList = visiblePins.filter(p => p.slot <= 6).map(p => ({
                port: p.port,
                color: ctx?.getPortColor ? ctx.getPortColor(p.port) : 'bg-slate-500'
            }));
            const outList = visiblePins.filter(p => p.slot >= 7).map(p => ({
                port: p.port,
                color: ctx?.getPortColor ? ctx.getPortColor(p.port) : 'bg-slate-500'
            }));
            return { in: inList, out: outList };
        },
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports),
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
            const existingPages = ctx?.pagesData ? Object.keys(ctx.pagesData).map(Number).filter(n => n > 0 && !isNaN(n)) : [];
            const availablePages = Array.from(new Set([1, 2, 3, 4, curP, ...existingPages])).sort((a, b) => a - b);
            return `
                <div class="space-y-2 p-1">
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span class="text-[8px] text-slate-400 font-semibold uppercase">TARGET SUBPAGE</span>
                        <span class="text-[9px] font-mono font-bold text-cyan-300">PAGE ${curP}${m.subType ? ` (${m.subType})` : ''}</span>
                    </div>
                    <div>
                        <label class="block text-[8px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">Select Page Number</label>
                        <div class="grid grid-cols-4 gap-1">
                            ${availablePages.map(p => {
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
            const allPins = [
                { port: 'PIN1_out', slot: 1 }, { port: 'PIN2_out', slot: 2 }, { port: 'PIN3_out', slot: 3 },
                { port: 'PIN4_out', slot: 4 }, { port: 'PIN5_out', slot: 5 }, { port: 'PIN6_out', slot: 6 },
                { port: 'PIN7_in', slot: 7 }, { port: 'PIN8_in', slot: 8 }, { port: 'PIN9_in', slot: 9 },
                { port: 'PIN10_in', slot: 10 }, { port: 'PIN11_in', slot: 11 }, { port: 'PIN12_in', slot: 12 }
            ];
            const outList = allPins.filter(p => p.slot <= 6).map(p => ({
                port: p.port,
                color: ctx?.getPortColor ? ctx.getPortColor(p.port) : 'bg-slate-500'
            }));
            const inList = allPins.filter(p => p.slot >= 7).map(p => ({
                port: p.port,
                color: ctx?.getPortColor ? ctx.getPortColor(p.port) : 'bg-slate-500'
            }));
            return { in: inList, out: outList };
        },
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports),
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
                        <p class="text-[8.5px] text-slate-400 mt-1">メイングリッドの SUB モジュールと12本の対称端子で通信します。</p>
                        <div class="mt-1.5 p-1 bg-slate-950/80 rounded border border-slate-800 text-[7.5px] text-left text-slate-300 space-y-0.5">
                            <div><span class="font-mono text-cyan-300 font-bold">PIN1〜6 [OUT]</span>: 親からの送り (CV / Gate / Clock)</div>
                            <div><span class="font-mono text-emerald-300 font-bold">PIN7〜12 [IN]</span>: 親への戻り (Audio L/R / Mod還元)</div>
                            <div class="text-[7px] text-slate-400 pt-0.5">左: PIN1〜3 (上➔下) / 下: PIN4〜9 (左➔右) / 右: PIN10〜12 (下➔上)</div>
                        </div>
                        <p class="text-[8px] text-amber-400/80 mt-1">※ このモジュールは削除できません（保護中）</p>
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
    },
    MARKOV: {
        color: 'emerald',
        defaults: () => ({
            type: 'MARKOV',
            state: 0,
            initOn: false,
            stateVal: 1.0,
            rootMidi: 60,
            quantize: true,
            holdClocks: 1,
            stayWeight: 10,
            weights: [0, 0, 0, 0]
        }),
        onConnect: (m, { port, isSource }) => {
            if (isSource && (port.startsWith('transition_out') || port.startsWith('trig_out'))) {
                const numStr = port.replace(/^(transition_out|trig_out)/, '');
                if (numStr) {
                    const outIdx = parseInt(numStr, 10) - 1;
                    if (!m.weights) m.weights = [0, 0, 0, 0];
                    if (m.weights[outIdx] === 0 || m.weights[outIdx] === undefined) {
                        m.weights[outIdx] = 10;
                    }
                }
            }
        },
        onDisconnect: (m, { patchState }) => {
            if (m.weights) {
                for (let idx = 1; idx <= 4; idx++) {
                    const hasConn = patchState?.has(`transition_out${idx}`) || patchState?.has(`trig_out${idx}`);
                    if (!hasConn && m.weights[idx - 1] === 10) {
                        m.weights[idx - 1] = 0;
                    }
                }
            }
        },
        onClone: (copy) => {
            copy.initOn = false;
            copy.state = 0;
        },
        onNormalize: (m) => {
            m.state = m.initOn ? 1 : 0;
        },
        onExport: (clean, orig) => {
            clean.state = orig.initOn ? 1 : 0;
        },
        ports: (m) => {
            const weights = m?.weights || [0, 0, 0, 0];
            return {
                in: [
                    { port: 'clk_in', pin: 4, color: 'bg-rose-500' },
                    { port: 'transition_in', pin: 5, color: 'bg-amber-500' }
                ],
                out: [
                    { port: 'transition_out1', pin: 6, color: (weights[0] > 0) ? 'bg-amber-500' : 'bg-slate-500' },
                    { port: 'transition_out2', pin: 7, color: (weights[1] > 0) ? 'bg-amber-500' : 'bg-slate-500' },
                    { port: 'transition_out3', pin: 8, color: (weights[2] > 0) ? 'bg-amber-500' : 'bg-slate-500' },
                    { port: 'transition_out4', pin: 9, color: (weights[3] > 0) ? 'bg-amber-500' : 'bg-slate-500' },
                    { port: 'trig_out', pin: 10, color: 'bg-rose-500' },
                    { port: 'gate_out', pin: 11, color: 'bg-rose-500' },
                    { port: 'cv_out', pin: 12, color: 'bg-yellow-400' }
                ]
            };
        },
        renderPorts: (m, renderP, ports) => UIHelpers.renderChassisPorts(renderP, ports),
        renderGrid: (m) => {
            const isQ = m.quantize !== false;
            const rootM = m.rootMidi ?? 60;
            const noteStr = isQ ? UIHelpers.midiToNoteName(rootM) : (m.stateVal ?? 1.0).toFixed(2) + 'V';
            const isOn = (m.state || 0) === 1;
            const holdC = m.holdClocks ?? 1;

            const boxCls = isOn
                ? 'bg-emerald-500/25 text-white border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                : 'bg-slate-950/80 text-slate-600 border-slate-800';

            return `
                <div class="relative flex items-center justify-center w-full h-full pointer-events-none">
                    ${holdC > 1 ? `<span class="absolute top-1 right-1 text-[7.5px] font-mono font-bold text-emerald-400/80 leading-none">${holdC}c</span>` : ''}
                    <div class="markov-state-box w-8 h-8 rounded-md border flex items-center justify-center font-mono font-bold text-[10px] tracking-tight transition-all duration-75 select-none ${boxCls}">
                        ${noteStr}
                    </div>
                </div>`;
        },
        renderModal: (m, ctx) => {
            const isQ = m.quantize !== false;
            const rootM = m.rootMidi ?? 60;
            const noteStr = UIHelpers.midiToNoteName(rootM);
            const isInit = !!m.initOn;
            const holdC = m.holdClocks ?? 1;

            const wStay = m.stayWeight ?? 10;
            const weights = m.weights || [0, 0, 0, 0];

            let totalW = Math.max(0, wStay);
            for (let i = 0; i < 4; i++) {
                totalW += Math.max(0, weights[i] || 0);
            }
            if (totalW === 0) totalW = 1;

            const pctStay = Math.round((wStay / totalW) * 100);
            const pcts = [];
            for (let i = 0; i < 4; i++) {
                pcts.push(Math.round(((weights[i] || 0) / totalW) * 100));
            }

            return `
                <div class="space-y-1.5">
                    <!-- Top Buttons: RESET & QLZ -->
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <button id="markov-init-btn" class="px-2.5 py-1 rounded text-[8.5px] font-bold border transition-colors ${isInit ? 'bg-emerald-700 text-white border-emerald-400 shadow-sm' : 'bg-slate-800 text-slate-400 border-slate-700'}">RESET: ${isInit ? 'ON' : 'OFF'}</button>
                        <button id="markov-qlz-btn" class="px-2.5 py-1 rounded text-[8.5px] font-bold border transition-colors ${isQ ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700'}">QLZ: ${isQ ? 'ON' : 'OFF'}</button>
                    </div>

                    <!-- Hold Clocks Stepper Row (Dropped below buttons) -->
                    <div class="flex items-center justify-between px-2 py-1 bg-slate-950/60 rounded-lg border border-slate-800/80">
                        <span class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">HOLD CLOCKS</span>
                        <div class="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shadow-inner">
                            <button id="markov-hold-dec" class="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center leading-none select-none cursor-pointer">−</button>
                            <span id="markov-hold-val" class="w-4 text-center text-[9.5px] font-mono font-bold text-emerald-400 select-none">${holdC}</span>
                            <button id="markov-hold-inc" class="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center leading-none select-none cursor-pointer">＋</button>
                            <span class="text-[7.5px] font-mono text-slate-500 uppercase ml-0.5">CLK</span>
                        </div>
                    </div>

                    <!-- CV Out & Transition Weights Unified Row -->
                    <div class="bg-slate-950/40 p-2 rounded-xl border border-slate-800 space-y-1.5">
                        <div class="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider pb-0.5 border-b border-slate-800/80">
                            <span>CV OUT & TRANSITION WEIGHTS</span>
                        </div>

                        <div class="flex items-center justify-around gap-1 pt-1">
                            <!-- Output CV / Pitch (Far Left) -->
                            ${isQ
                                ? UIHelpers.createVSliderHTML('markov-pitch', 'PITCH', 24, 84, 1, rootM, 'note', 'emerald', false, noteStr)
                                : UIHelpers.createVSliderHTML('markov-val', 'VOLTAGE', 0.0, 5.0, 0.05, m.stateVal ?? 1.0, 'V', 'emerald', false, (m.stateVal ?? 1.0).toFixed(2) + 'V')
                            }

                            <div class="w-[1px] h-28 bg-slate-800/80 self-center mx-0.5"></div>

                            <!-- Stay Slider -->
                            <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                                <span class="text-[8px] font-bold text-slate-300 uppercase tracking-tight truncate w-full text-center">STAY</span>
                                <span id="markov-p-stay" class="text-[9px] text-emerald-300 font-mono font-bold">${pctStay}%</span>
                                <div class="h-24 flex items-center justify-center my-0.5">
                                    <input type="range" id="markov-w-stay" min="0" max="100" step="1" value="${wStay}" class="native-vslider accent-emerald-500">
                                </div>
                                <span class="text-[7.5px] font-mono text-slate-400 truncate">自己</span>
                            </div>

                            <!-- Output 1..4 Sliders (OUT 1 to OUT 4 from left to right, matching bottom PIN6..PIN9) -->
                            ${[0, 1, 2, 3].map(idx => `
                                <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
                                    <span class="text-[8px] font-bold text-slate-300 uppercase tracking-tight truncate w-full text-center">OUT ${idx + 1}</span>
                                    <span id="markov-p-${idx}" class="text-[9px] text-emerald-300 font-bold font-mono">${pcts[idx]}%</span>
                                    <div class="h-24 flex items-center justify-center my-0.5">
                                        <input type="range" id="markov-w-${idx}" min="0" max="100" step="1" value="${weights[idx] ?? 0}" class="native-vslider accent-emerald-500 markov-w-slider" data-idx="${idx}">
                                    </div>
                                    <span class="text-[7.5px] font-mono text-slate-400 truncate">CH ${idx + 1}</span>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>`;
        },
        bindEvents: (m, ctx, cb) => {
            const isQ = m.quantize !== false;

            document.getElementById('markov-init-btn')?.addEventListener('click', () => {
                m.initOn = !m.initOn;
                m.state = m.initOn ? 1 : 0;
                ctx.reRenderModal();
                cb();
            });

            document.getElementById('markov-hold-dec')?.addEventListener('click', () => {
                const cur = m.holdClocks ?? 1;
                if (cur > 1) {
                    m.holdClocks = cur - 1;
                    const el = document.getElementById('markov-hold-val');
                    if (el) el.textContent = m.holdClocks;
                    cb();
                }
            });

            document.getElementById('markov-hold-inc')?.addEventListener('click', () => {
                const cur = m.holdClocks ?? 1;
                if (cur < 32) {
                    m.holdClocks = cur + 1;
                    const el = document.getElementById('markov-hold-val');
                    if (el) el.textContent = m.holdClocks;
                    cb();
                }
            });

            document.getElementById('markov-qlz-btn')?.addEventListener('click', () => {
                m.quantize = !isQ;
                ctx.reRenderModal();
                cb();
            });

            if (isQ) {
                UIHelpers.bindSlider('markov-pitch', v => UIHelpers.midiToNoteName(Math.round(v)), v => {
                    m.rootMidi = Math.round(v);
                    m.stateVal = (m.rootMidi - 24) / 12.0;
                    cb();
                });
            } else {
                UIHelpers.bindSlider('markov-val', v => v.toFixed(2) + 'V', v => {
                    m.stateVal = v;
                    cb();
                });
            }

            const updatePcts = () => {
                const wStay = m.stayWeight ?? 10;
                const weights = m.weights || [0, 0, 0, 0];
                let totalW = Math.max(0, wStay);
                for (let i = 0; i < 4; i++) {
                    totalW += Math.max(0, weights[i] || 0);
                }
                if (totalW === 0) totalW = 1;

                const pStayEl = document.getElementById('markov-p-stay');
                if (pStayEl) pStayEl.textContent = `${Math.round((wStay / totalW) * 100)}%`;

                for (let i = 0; i < 4; i++) {
                    const pEl = document.getElementById(`markov-p-${i}`);
                    if (pEl) {
                        pEl.textContent = `${Math.round(((weights[i] || 0) / totalW) * 100)}%`;
                    }
                }
            };

            document.getElementById('markov-w-stay')?.addEventListener('input', (e) => {
                m.stayWeight = parseFloat(e.target.value) || 0;
                updatePcts();
                cb();
            });

            document.querySelectorAll('.markov-w-slider').forEach(sl => {
                sl.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.idx, 10);
                    if (!m.weights) m.weights = [0, 0, 0, 0];
                    m.weights[idx] = parseFloat(e.target.value) || 0;
                    updatePcts();
                    cb();
                });
            });
        },
        updateLive: (cell, readData, isPlaying, modalEl, m) => {
            const isOn = (readData?.state || 0) === 1;
            const box = cell.querySelector('.markov-state-box');
            if (box) {
                if (isOn) {
                    box.className = 'markov-state-box w-8 h-8 rounded-md border flex items-center justify-center font-mono font-bold text-[10px] tracking-tight transition-all duration-75 select-none bg-emerald-500/25 text-white border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]';
                } else {
                    box.className = 'markov-state-box w-8 h-8 rounded-md border flex items-center justify-center font-mono font-bold text-[10px] tracking-tight transition-all duration-75 select-none bg-slate-950/80 text-slate-600 border-slate-800';
                }
            }
        }
    },
    FMx3: {
        color: 'cyan',
        ALGORITHMS: [
            { id: 1, label: '1: 3➔2➔1', name: 'CASCADE', desc: 'Op3 ➔ Op2 ➔ Op1 ➔ OUT (直列FM/金属音/複雑倍音)' },
            { id: 2, label: '2: (3+2)➔1', name: 'DUAL MOD', desc: '(Op3 + Op2) ➔ Op1 ➔ OUT (並列変調/王道パーカッション)' },
            { id: 3, label: '3: 3+(2➔1)', name: 'FM+LAYER', desc: 'Op3 + (Op2 ➔ Op1) ➔ OUT (FM＋ノイズ/スネア/アタック直足し)' }
        ],
        defaults: () => ({
            type: 'FMx3',
            algorithm: 1,
            rootMidi: 48,
            op1: { ratio: 1.0, level: 0.85, attack: 0.005, decay: 0.4, sustain: 0.0, release: 0.1, aCurve: 'exp', dCurve: 'exp', rCurve: 'exp' },
            op2: { ratio: 2.0, level: 1.5, attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.05, aCurve: 'exp', dCurve: 'exp', rCurve: 'exp' },
            op3: { ratio: 3.5, level: 1.8, feedback: 0.0, wave: 'sine', attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.02, aCurve: 'exp', dCurve: 'exp', rCurve: 'exp' }
        }),
        onNormalize: (m) => {
            const curveVal = (c) => c === 'log' ? 0.75 : (c === 'exp' ? -0.75 : 0.0);
            const normOp = (op, def) => {
                if (!op) op = { ...def };
                if (op.ratio === undefined) op.ratio = def.ratio;
                if (op.level === undefined) op.level = def.level;
                if (op.attack === undefined) op.attack = def.attack;
                if (op.decay === undefined) op.decay = def.decay;
                if (op.sustain === undefined) op.sustain = def.sustain;
                if (op.release === undefined) op.release = def.release;
                if (!op.aCurve) op.aCurve = op.curve || 'exp';
                if (!op.dCurve) op.dCurve = op.curve || 'exp';
                if (!op.rCurve) op.rCurve = op.curve || 'exp';
                op.attackCurve = curveVal(op.aCurve);
                op.decayCurve = curveVal(op.dCurve);
                op.releaseCurve = curveVal(op.rCurve);
                return op;
            };
            m.op1 = normOp(m.op1, { ratio: 1.0, level: 0.85, attack: 0.005, decay: 0.4, sustain: 0.0, release: 0.1, aCurve: 'exp', dCurve: 'exp', rCurve: 'exp' });
            m.op2 = normOp(m.op2, { ratio: 2.0, level: 1.5, attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.05, aCurve: 'exp', dCurve: 'exp', rCurve: 'exp' });
            m.op3 = normOp(m.op3, { ratio: 3.5, level: 1.8, feedback: 0.0, wave: 'sine', attack: 0.005, decay: 0.05, sustain: 0.0, release: 0.02, aCurve: 'exp', dCurve: 'exp', rCurve: 'exp' });
            if (m.algorithm === undefined) m.algorithm = 1;
            else m.algorithm = Math.max(1, Math.min(3, Math.round(m.algorithm)));
            if (m.rootMidi === undefined) m.rootMidi = 48;
        },
        ports: () => ({
            in: [
                { port: 'gate_in', color: 'bg-orange-500' },
                { port: 'pitch_in', color: 'bg-yellow-400' }
            ],
            out: [
                { port: 'wave_out', color: 'bg-blue-500' }
            ]
        }),
        renderGrid: (m, ctx) => {
            const op1 = m.op1 || { ratio: 1.0 };
            const op2 = m.op2 || { ratio: 2.0 };
            const op3 = m.op3 || { ratio: 3.5, wave: 'sine' };
            const isNz = op3.wave === 'noise';
            const alg = m.algorithm || 1;
            const rootM = m.rootMidi || 48;
            const noteStr = UIHelpers.midiToNoteName(rootM);
            const isPitchPatched = ctx?.patched?.has('pitch_in') || ctx?.patched?.has('cv_in');

            return `
                <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-300">
                    <div class="flex items-center gap-1">
                        <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">FM x3</span>
                        <span class="px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-[7px] font-mono font-bold text-cyan-300">A${alg}</span>
                    </div>
                    <span class="text-[12px] font-mono font-bold text-white tracking-tight">${isPitchPatched ? 'EXT CV' : noteStr}</span>
                    <div class="flex items-center gap-0.5 text-[7px] font-mono text-cyan-400/90">
                        <span>${Number(op1.ratio).toFixed(1)}</span>
                        <span class="text-slate-600">:</span>
                        <span>${Number(op2.ratio).toFixed(1)}</span>
                        <span class="text-slate-600">:</span>
                        <span class="${isNz ? 'text-amber-400 font-bold' : ''}">${isNz ? 'NZ' : Number(op3.ratio).toFixed(1)}</span>
                    </div>
                </div>`;
        },
        renderModal: (m, ctx) => {
            MODULE_REGISTRY.FMx3.onNormalize?.(m);
            const curAlg = m.algorithm || 1;
            const algs = MODULE_REGISTRY.FMx3.ALGORITHMS;
            const curAlgInfo = algs.find(a => a.id === curAlg) || algs[0];

            const isNz = m.op3.wave === 'noise';
            const isPitchPatched = ctx?.patched?.has('pitch_in') || ctx?.patched?.has('cv_in');
            const rootM = m.rootMidi || 48;
            const rootName = UIHelpers.midiToNoteName(rootM);

            const renderMiniVSlider = (id, label, min, max, step, val, accentColor, formattedDisp, power = 1) => {
                let sMin = min, sMax = max, sStep = step, sVal = val;
                if (power && power !== 1) {
                    sMin = 0; sMax = 1; sStep = 0.001;
                    const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
                    sVal = Math.pow(norm, 1 / power);
                }
                return `
                    <div class="flex flex-col items-center justify-between h-full min-w-[17px] flex-1">
                        <span class="text-[6.5px] font-bold text-slate-400 uppercase tracking-tight leading-none">${label}</span>
                        <span id="${id}-disp" class="text-[7.5px] font-mono font-bold text-${accentColor}-300 cursor-ns-resize touch-none select-none hover:bg-slate-800/80 px-0.5 rounded leading-none py-0.5" title="上下ドラッグで微調整">${formattedDisp}</span>
                        <div class="flex items-center justify-center my-0.5">
                            <input type="range" id="${id}" min="${sMin}" max="${sMax}" step="${sStep}" value="${sVal}" class="native-vslider-sm accent-${accentColor}-400">
                        </div>
                    </div>
                `;
            };

            const renderMiniPlaceholder = (label = 'FB') => `
                <div class="flex flex-col items-center justify-between h-full min-w-[17px] flex-1 opacity-20 pointer-events-none">
                    <span class="text-[6.5px] font-bold text-slate-600 uppercase tracking-tight leading-none">${label}</span>
                    <span class="text-[7.5px] font-mono text-slate-600 leading-none py-0.5">—</span>
                    <div class="w-[14px] h-[48px] flex items-center justify-center my-0.5">
                        <div class="w-[1px] h-full bg-slate-800/60"></div>
                    </div>
                </div>
            `;

            const renderCurveBlock = (opNum, opData, accentColor) => {
                const stages = [
                    { key: 'a', label: 'A', cur: opData.aCurve || 'exp' },
                    { key: 'd', label: 'D', cur: opData.dCurve || 'exp' },
                    { key: 'r', label: 'R', cur: opData.rCurve || 'exp' }
                ];
                const opts = ['log', 'lin', 'exp'];

                return `
                    <div class="flex flex-col justify-between h-full pl-1 border-l border-slate-800/80 shrink-0">
                        <span class="text-[6px] font-bold text-slate-400 uppercase tracking-tight text-center leading-none">CURVE</span>
                        <div class="flex items-center gap-1">
                            ${stages.map(st => `
                                <div class="flex flex-col items-center gap-0.5">
                                    <span class="text-[6px] font-bold text-${accentColor}-300 leading-none">${st.label}</span>
                                    <div class="flex flex-col gap-0.5">
                                        ${opts.map(opt => {
                                            const isSel = st.cur === opt;
                                            return `
                                                <button class="fm-curve-btn w-[21px] h-[13px] rounded text-[6px] font-bold border transition-colors leading-none flex items-center justify-center ${isSel ? `bg-${accentColor}-600 text-white border-${accentColor}-400 shadow-sm shadow-${accentColor}-500/40` : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}" data-op="${opNum}" data-stage="${st.key}" data-val="${opt}">
                                                    ${opt.toUpperCase()}
                                                </button>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            };

            return `
                <div class="space-y-1.5 select-none">
                    <!-- Top: Algorithm Selector -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[8px] text-slate-400 uppercase font-bold tracking-wider">ALGORITHM</span>
                            <span class="text-[7.5px] font-mono text-cyan-300 font-bold truncate max-w-[200px]" id="fm-alg-desc">${curAlgInfo.desc}</span>
                        </div>
                        <div class="grid grid-cols-3 gap-1">
                            ${algs.map(a => {
                                const isSel = curAlg === a.id;
                                return `
                                    <button class="fm-alg-btn py-1 px-0.5 rounded text-[7.5px] font-bold border transition-all ${isSel ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm shadow-cyan-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}" data-val="${a.id}">
                                        ${a.label}
                                    </button>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Operator Console with Vertical Root Note on Right -->
                    <div class="flex gap-1.5 items-stretch">
                        <!-- Operators (Top-to-Bottom: OP3, OP2, OP1) -->
                        <div class="flex flex-col gap-1.5 flex-1 min-w-0">
                            <!-- OP 3 Row (Modulator 2) -->
                            <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-950/70 border border-slate-800/80 h-[74px]">
                                <div class="flex flex-col items-center justify-between h-full w-[38px] shrink-0 pr-1 border-r border-slate-800/80">
                                    <div class="flex flex-col items-center">
                                        <span class="text-[8px] font-bold text-amber-300 uppercase tracking-tight leading-none">OP 3</span>
                                        <span class="text-[6.5px] font-mono text-slate-400 leading-tight">MOD 2</span>
                                    </div>
                                    <button id="fm-op3-wave-btn" class="w-full py-0.5 rounded text-[6.5px] font-bold border transition-colors ${isNz ? 'bg-amber-500 text-slate-950 border-amber-300 font-extrabold shadow-sm' : 'bg-slate-900 text-slate-300 border-slate-700'}" title="波形切替 (Sine / White Noise)">
                                        ${isNz ? 'NOISE' : 'SINE'}
                                    </button>
                                </div>

                                <div class="flex items-center justify-around flex-1 h-full gap-0.5">
                                    ${renderMiniVSlider('fm-op3-level', 'LEVEL', 0.0, 5.0, 0.05, m.op3.level, 'amber', Number(m.op3.level).toFixed(2))}
                                    ${renderMiniVSlider('fm-op3-ratio', 'RATIO', 0.25, 16.0, 0.25, m.op3.ratio, 'amber', Number(m.op3.ratio).toFixed(2))}
                                    ${renderMiniVSlider('fm-op3-fb', 'FB', 0.0, 1.0, 0.02, m.op3.feedback || 0, 'amber', Math.round((m.op3.feedback || 0) * 100) + '%')}
                                    <div class="w-[1px] h-[52px] bg-slate-800/60 mx-0.5 shrink-0"></div>
                                    ${renderMiniVSlider('fm-op3-a', 'A', 0.0005, 2.0, 0.001, m.op3.attack, 'amber', UIHelpers.formatTime(m.op3.attack), 2.5)}
                                    ${renderMiniVSlider('fm-op3-d', 'D', 0.005, 3.0, 0.005, m.op3.decay, 'amber', UIHelpers.formatTime(m.op3.decay), 2.5)}
                                    ${renderMiniVSlider('fm-op3-s', 'S', 0.0, 1.0, 0.01, m.op3.sustain, 'amber', Number(m.op3.sustain).toFixed(2))}
                                    ${renderMiniVSlider('fm-op3-r', 'R', 0.005, 5.0, 0.005, m.op3.release, 'amber', UIHelpers.formatTime(m.op3.release), 2.5)}
                                </div>

                                ${renderCurveBlock(3, m.op3, 'amber')}
                            </div>

                            <!-- OP 2 Row (Modulator 1) -->
                            <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-950/70 border border-slate-800/80 h-[74px]">
                                <div class="flex flex-col items-center justify-center h-full w-[38px] shrink-0 pr-1 border-r border-slate-800/80">
                                    <span class="text-[8px] font-bold text-purple-300 uppercase tracking-tight leading-none">OP 2</span>
                                    <span class="text-[6.5px] font-mono text-slate-400 leading-tight">MOD 1</span>
                                </div>

                                <div class="flex items-center justify-around flex-1 h-full gap-0.5">
                                    ${renderMiniVSlider('fm-op2-level', 'LEVEL', 0.0, 5.0, 0.05, m.op2.level, 'purple', Number(m.op2.level).toFixed(2))}
                                    ${renderMiniVSlider('fm-op2-ratio', 'RATIO', 0.25, 16.0, 0.25, m.op2.ratio, 'purple', Number(m.op2.ratio).toFixed(2))}
                                    ${renderMiniPlaceholder('FB')}
                                    <div class="w-[1px] h-[52px] bg-slate-800/60 mx-0.5 shrink-0"></div>
                                    ${renderMiniVSlider('fm-op2-a', 'A', 0.0005, 2.0, 0.001, m.op2.attack, 'purple', UIHelpers.formatTime(m.op2.attack), 2.5)}
                                    ${renderMiniVSlider('fm-op2-d', 'D', 0.005, 3.0, 0.005, m.op2.decay, 'purple', UIHelpers.formatTime(m.op2.decay), 2.5)}
                                    ${renderMiniVSlider('fm-op2-s', 'S', 0.0, 1.0, 0.01, m.op2.sustain, 'purple', Number(m.op2.sustain).toFixed(2))}
                                    ${renderMiniVSlider('fm-op2-r', 'R', 0.005, 5.0, 0.005, m.op2.release, 'purple', UIHelpers.formatTime(m.op2.release), 2.5)}
                                </div>

                                ${renderCurveBlock(2, m.op2, 'purple')}
                            </div>

                            <!-- OP 1 Row (Carrier) -->
                            <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-950/70 border border-slate-800/80 h-[74px]">
                                <div class="flex flex-col items-center justify-center h-full w-[38px] shrink-0 pr-1 border-r border-slate-800/80">
                                    <span class="text-[8px] font-bold text-cyan-300 uppercase tracking-tight leading-none">OP 1</span>
                                    <span class="text-[6.5px] font-mono text-slate-400 leading-tight">CARRIER</span>
                                </div>

                                <div class="flex items-center justify-around flex-1 h-full gap-0.5">
                                    ${renderMiniVSlider('fm-op1-level', 'LEVEL', 0.0, 1.0, 0.01, m.op1.level, 'cyan', Number(m.op1.level).toFixed(2))}
                                    ${renderMiniVSlider('fm-op1-ratio', 'RATIO', 0.25, 16.0, 0.25, m.op1.ratio, 'cyan', Number(m.op1.ratio).toFixed(2))}
                                    ${renderMiniPlaceholder('FB')}
                                    <div class="w-[1px] h-[52px] bg-slate-800/60 mx-0.5 shrink-0"></div>
                                    ${renderMiniVSlider('fm-op1-a', 'A', 0.0005, 2.0, 0.001, m.op1.attack, 'cyan', UIHelpers.formatTime(m.op1.attack), 2.5)}
                                    ${renderMiniVSlider('fm-op1-d', 'D', 0.005, 3.0, 0.005, m.op1.decay, 'cyan', UIHelpers.formatTime(m.op1.decay), 2.5)}
                                    ${renderMiniVSlider('fm-op1-s', 'S', 0.0, 1.0, 0.01, m.op1.sustain, 'cyan', Number(m.op1.sustain).toFixed(2))}
                                    ${renderMiniVSlider('fm-op1-r', 'R', 0.005, 5.0, 0.005, m.op1.release, 'cyan', UIHelpers.formatTime(m.op1.release), 2.5)}
                                </div>

                                ${renderCurveBlock(1, m.op1, 'cyan')}
                            </div>
                        </div>

                        <!-- Right Column: Vertical ROOT NOTE Slider (Disabled when pitch_in is patched) -->
                        <div class="flex flex-col items-center justify-between p-1 bg-slate-950/70 border border-slate-800/80 rounded-lg w-[38px] shrink-0 ${isPitchPatched ? 'opacity-30 pointer-events-none' : ''}">
                            <div class="flex flex-col items-center">
                                <span class="text-[7px] font-bold text-yellow-400 uppercase tracking-tight text-center leading-tight">ROOT</span>
                                <span class="text-[6px] font-mono text-slate-400 leading-tight">NOTE</span>
                            </div>
                            <span id="fm-root-slider-disp" class="text-[8.5px] font-mono font-bold text-yellow-300 cursor-ns-resize touch-none select-none hover:bg-slate-800/80 px-0.5 rounded leading-none py-0.5" title="上下ドラッグで微調整">${isPitchPatched ? 'EXT' : rootName}</span>
                            <div class="flex items-center justify-center flex-1 my-1">
                                <input type="range" id="fm-root-slider" min="24" max="72" step="1" value="${rootM}" class="native-vslider accent-yellow-400" ${isPitchPatched ? 'disabled' : ''} style="height: 140px;">
                            </div>
                            <span class="text-[6.5px] font-mono text-slate-500 uppercase text-center leading-tight">${isPitchPatched ? 'EXT CV' : '1V/OCT'}</span>
                        </div>
                    </div>
                </div>
            `;
        },
        bindEvents: (m, ctx, cb) => {
            // Algorithm buttons
            document.querySelectorAll('.fm-alg-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    m.algorithm = parseInt(e.currentTarget.dataset.val, 10) || 1;
                    cb();
                    ctx.reRenderModal();
                });
            });

            // Op3 Noise toggle
            document.getElementById('fm-op3-wave-btn')?.addEventListener('click', () => {
                if (!m.op3) m.op3 = {};
                m.op3.wave = (m.op3.wave === 'noise') ? 'sine' : 'noise';
                cb();
                ctx.reRenderModal();
            });

            // Curve buttons
            document.querySelectorAll('.fm-curve-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const opNum = e.currentTarget.dataset.op;
                    const stage = e.currentTarget.dataset.stage;
                    const val = e.currentTarget.dataset.val;
                    const opKey = `op${opNum}`;
                    if (!m[opKey]) m[opKey] = {};
                    m[opKey][`${stage}Curve`] = val;
                    cb();
                    ctx.reRenderModal();
                });
            });

            // Bind Operator Sliders
            [1, 2, 3].forEach(opNum => {
                const opKey = `op${opNum}`;
                const isCarrier = (opNum === 1);

                // Level / Index
                UIHelpers.bindSlider(`fm-op${opNum}-level`, v => v.toFixed(2), v => {
                    m[opKey].level = v;
                    cb();
                }, 1, 0.0, isCarrier ? 1.0 : 5.0);

                // Ratio
                UIHelpers.bindSlider(`fm-op${opNum}-ratio`, v => v.toFixed(2), v => {
                    m[opKey].ratio = v;
                    cb();
                }, 1, 0.25, 16.0);

                // ADSR (A, D, S, R)
                UIHelpers.bindSlider(`fm-op${opNum}-a`, UIHelpers.formatTime, v => {
                    m[opKey].attack = v;
                    cb();
                }, 2.5, 0.0005, 2.0);

                UIHelpers.bindSlider(`fm-op${opNum}-d`, UIHelpers.formatTime, v => {
                    m[opKey].decay = v;
                    cb();
                }, 2.5, 0.005, 3.0);

                UIHelpers.bindSlider(`fm-op${opNum}-s`, v => v.toFixed(2), v => {
                    m[opKey].sustain = v;
                    cb();
                }, 1, 0.0, 1.0);

                UIHelpers.bindSlider(`fm-op${opNum}-r`, UIHelpers.formatTime, v => {
                    m[opKey].release = v;
                    cb();
                }, 2.5, 0.005, 5.0);
            });

            // Op3 Feedback
            UIHelpers.bindSlider('fm-op3-fb', v => Math.round(v * 100) + '%', v => {
                if (!m.op3) m.op3 = {};
                m.op3.feedback = v;
                cb();
            }, 1, 0.0, 1.0);

            // Vertical Root Midi Slider
            UIHelpers.bindSlider('fm-root-slider', UIHelpers.midiToNoteName, v => {
                m.rootMidi = Math.round(v);
                cb();
            }, 1, 24, 72);
        }
    },
    FMCORE: {
        color: 'cyan',
        defaults: () => ({
            type: 'FMCORE',
            level: 0.85,
            ratio: 1.0,
            fine: 0,
            index: 1.0,
            feedback: 0.0,
            rootMidi: 48
        }),
        onNormalize: (m) => {
            if (m.level === undefined) m.level = 0.85;
            if (m.ratio === undefined) m.ratio = 1.0;
            if (m.fine === undefined) m.fine = 0;
            if (m.index === undefined) m.index = 1.0;
            if (m.feedback === undefined) m.feedback = 0.0;
            if (m.rootMidi === undefined) m.rootMidi = 48;
        },
        ports: () => ({
            in: [
                { port: 'pitch_in', color: 'bg-yellow-400' },
                { port: 'mod_in', color: 'bg-blue-500' },
                { port: 'index_cv', color: 'bg-yellow-400' }
            ],
            out: [
                { port: 'wave_out', color: 'bg-blue-500' }
            ]
        }),
        renderPorts: (m, renderP, ports) => UIHelpers.renderStandardPorts(renderP, ports.in || [], ports.out || []),
        renderGrid: (m, ctx) => {
            const rootM = m.rootMidi ?? 48;
            const noteStr = UIHelpers.midiToNoteName(rootM);
            const isPitchPatched = ctx?.patched?.has('pitch_in') || ctx?.patched?.has('cv_in');
            const hasMod = ctx?.patched?.has('mod_in') || ctx?.patched?.has('wave_in');
            const ratioStr = Number(m.ratio ?? 1.0).toFixed(2);
            const idxStr = Number(m.index ?? 1.0).toFixed(1);

            return `
                <div class="flex flex-col items-center justify-center leading-none gap-0.5 pointer-events-none text-cyan-300">
                    <div class="flex items-center gap-1">
                        <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">FM CORE</span>
                        ${hasMod ? '<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>' : ''}
                    </div>
                    <span class="text-[12px] font-mono font-bold text-white tracking-tight">${isPitchPatched ? 'EXT CV' : noteStr}</span>
                    <div class="flex items-center gap-1 text-[7.5px] font-mono text-cyan-400/90">
                        <span>x${ratioStr}</span>
                        <span class="text-slate-600">|</span>
                        <span>idx:${idxStr}</span>
                    </div>
                </div>`;
        },
        renderModal: (m, ctx) => {
            MODULE_REGISTRY.FMCORE.onNormalize?.(m);
            const rootM = m.rootMidi ?? 48;
            const rootName = UIHelpers.midiToNoteName(rootM);
            const isPitchPatched = ctx?.patched?.has('pitch_in') || ctx?.patched?.has('cv_in');
            const isIdxPatched = ctx?.patched?.has('index_cv') || ctx?.patched?.has('idx_cv');
            const isModPatched = ctx?.patched?.has('mod_in') || ctx?.patched?.has('wave_in');

            return `
                <div class="space-y-1.5 select-none">
                    <!-- Top Info Header -->
                    <div class="flex items-center justify-between pb-1 border-b border-slate-800">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[8.5px] font-bold text-cyan-400 uppercase tracking-wider">PM OPERATOR</span>
                            ${isModPatched ? '<span class="px-1 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-[6.5px] font-mono text-cyan-300 font-bold">MOD IN</span>' : ''}
                        </div>
                        <span class="text-[7.5px] font-mono text-slate-400">SINE CARRIER</span>
                    </div>

                    <!-- 6 Vertical Sliders: ROOT -> LEVEL -> RATIO -> INDEX -> FB -> FINE -->
                    <div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1">
                        ${UIHelpers.createVSliderHTML('fmcore-root', 'ROOT', 24, 72, 1, rootM, 'note', 'yellow', isPitchPatched, isPitchPatched ? 'EXT' : rootName)}
                        ${UIHelpers.createVSliderHTML('fmcore-level', 'LEVEL', 0.0, 1.0, 0.01, m.level ?? 0.85, 'lvl', 'cyan', false, Number(m.level ?? 0.85).toFixed(2))}
                        ${UIHelpers.createVSliderHTML('fmcore-ratio', 'RATIO', 0.25, 16.0, 0.25, m.ratio ?? 1.0, 'rat', 'cyan', false, Number(m.ratio ?? 1.0).toFixed(2))}
                        ${UIHelpers.createVSliderHTML('fmcore-index', 'INDEX', 0.0, 5.0, 0.05, m.index ?? 1.0, 'idx', 'amber', isIdxPatched, isIdxPatched ? 'EXT CV' : Number(m.index ?? 1.0).toFixed(2))}
                        ${UIHelpers.createVSliderHTML('fmcore-fb', 'FB', 0.0, 1.0, 0.01, m.feedback ?? 0.0, 'fb', 'amber', false, Math.round((m.feedback ?? 0) * 100) + '%')}
                        ${UIHelpers.createVSliderHTML('fmcore-fine', 'FINE', -50, 50, 1, m.fine ?? 0, 'cent', 'cyan', false, ((m.fine ?? 0) > 0 ? '+' : '') + Math.round(m.fine ?? 0) + 'c')}
                    </div>
                </div>
            `;
        },
        bindEvents: (m, ctx, cb) => {
            UIHelpers.bindSlider('fmcore-root', UIHelpers.midiToNoteName, v => { m.rootMidi = Math.round(v); cb(); }, 1, 24, 72);
            UIHelpers.bindSlider('fmcore-level', v => v.toFixed(2), v => { m.level = v; cb(); }, 1, 0.0, 1.0);
            UIHelpers.bindSlider('fmcore-ratio', v => v.toFixed(2), v => { m.ratio = v; cb(); }, 1, 0.25, 16.0);
            UIHelpers.bindSlider('fmcore-index', v => v.toFixed(2), v => { m.index = v; cb(); }, 1, 0.0, 5.0);
            UIHelpers.bindSlider('fmcore-fb', v => Math.round(v * 100) + '%', v => { m.feedback = v; cb(); }, 1, 0.0, 1.0);
            UIHelpers.bindSlider('fmcore-fine', v => ((v > 0 ? '+' : '') + Math.round(v) + 'c'), v => { m.fine = Math.round(v); cb(); }, 1, -50, 50);
        }
    }
};

// Aliases for backward compatibility
MODULE_REGISTRY.FM = MODULE_REGISTRY.FMx3;
MODULE_REGISTRY.FM3OP = MODULE_REGISTRY.FMx3;



