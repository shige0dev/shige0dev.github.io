export const UIHelpers = {
    NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    midiToNoteName: (midi) => {
        const m = Math.round(midi);
        const n = UIHelpers.NOTES[((m % 12) + 12) % 12];
        const oct = Math.floor(m / 12) - 1;
        return `${n}${oct}`;
    },
    midiToFreq: (midi) => 440 * Math.pow(2, (midi - 69) / 12),
    freqToMidi: (freq) => Math.round(69 + 12 * Math.log2(Math.max(10, freq) / 440)),
    formatTime: (v) => {
        if (v < 0.01) return (v * 1000).toFixed(1) + 'ms';
        if (v < 1.0) return Math.round(v * 1000) + 'ms';
        return v.toFixed(2) + 's';
    },
    createVSliderHTML: (id, label, min, max, step, val, unitStr, accentColor = 'cyan', isPatched = false, customDisp = null, power = 1) => {
        const disp = customDisp ?? (Math.abs(val) < 10 && step < 1 ? Number(val).toFixed(2) : Math.round(val));
        let sMin = min, sMax = max, sStep = step, sVal = val;
        if (power && power !== 1) {
            sMin = 0; sMax = 1; sStep = 0.001;
            const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
            sVal = Math.pow(norm, 1 / power);
        }
        return `
            <div class="flex flex-col items-center gap-1 flex-1 min-w-0 ${isPatched ? 'opacity-30 pointer-events-none' : ''}">
                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tight truncate w-full text-center">${label}</span>
                <span id="${id}-disp" class="text-[9px] text-${accentColor}-300 font-mono font-bold cursor-ns-resize touch-none select-none hover:bg-slate-800/80 px-0.5 py-0.5 rounded transition-colors">${disp}</span>
                <div class="h-24 flex items-center justify-center my-0.5">
                    <input type="range" id="${id}" min="${sMin}" max="${sMax}" step="${sStep}" value="${sVal}" class="native-vslider accent-${accentColor}-500" ${isPatched ? 'disabled' : ''}>
                </div>
                <span class="text-[8px] font-mono text-slate-400 truncate">${unitStr}</span>
            </div>`;
    },
    bindScrubber: (dispId, sliderId, formatter, cb, power = 1, min = 0, max = 100) => {
        const disp = typeof dispId === 'string' ? document.getElementById(dispId) : dispId;
        const slider = typeof sliderId === 'string' ? document.getElementById(sliderId) : sliderId;
        if (!disp || !slider) return;
        let isScrub = false, startY = 0, startVal = 0;
        disp.addEventListener('pointerdown', (e) => {
            if (slider.disabled) return;
            e.preventDefault(); e.stopPropagation(); isScrub = true;
            disp.setPointerCapture(e.pointerId); startY = e.clientY; startVal = parseFloat(slider.value) || 0;
            disp.classList.add('ring-1', 'ring-yellow-400/80', 'bg-yellow-950/60', 'text-yellow-200');
        });
        disp.addEventListener('pointermove', (e) => {
            if (!isScrub) return;
            const sMin = parseFloat(slider.min) || 0, sMax = parseFloat(slider.max) || 100, sStep = parseFloat(slider.step) || 1;
            if (power && power !== 1) {
                const delta = (startY - e.clientY) / 400;
                let u = Math.max(0, Math.min(1, startVal + delta));
                slider.value = u;
                let v = min + (max - min) * Math.pow(u, power);
                disp.textContent = formatter ? formatter(v) : (v < 1 ? v.toFixed(3) : v.toFixed(2));
                cb(v);
            } else {
                const fineStep = sStep * 0.1 || 0.001, delta = (startY - e.clientY) * ((sMax - sMin) / 1000);
                let n = Math.max(sMin, Math.min(sMax, Math.round((startVal + delta) / fineStep) * fineStep));
                slider.value = n;
                disp.textContent = formatter ? formatter(n) : n.toFixed(fineStep < 0.1 ? 2 : 1);
                cb(n);
            }
        });
        const stop = (e) => {
            if (!isScrub) return; isScrub = false;
            try { disp.releasePointerCapture(e.pointerId); } catch(err){}
            disp.classList.remove('ring-1', 'ring-yellow-400/80', 'bg-yellow-950/60', 'text-yellow-200');
        };
        disp.addEventListener('pointerup', stop); disp.addEventListener('pointercancel', stop);
    },
    bindSlider: (id, formatter, cb, power = 1, min = 0, max = 100) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', (e) => {
            const raw = parseFloat(e.target.value);
            let v = raw;
            if (power && power !== 1) {
                v = min + (max - min) * Math.pow(Math.max(0, Math.min(1, raw)), power);
            }
            const disp = document.getElementById(`${id}-disp`);
            if (disp) disp.textContent = formatter(v);
            cb(v);
        });
        UIHelpers.bindScrubber(`${id}-disp`, id, formatter, cb, power, min, max);
    },
    bindButtonGroup: (selector, activeCls, inactiveCls, cb) => {
        document.querySelectorAll(selector).forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll(selector).forEach(b => b.className = `${b.className.replace(activeCls, '').replace(inactiveCls, '')} ${inactiveCls}`);
                e.target.className = `${e.target.className.replace(inactiveCls, '')} ${activeCls}`;
                cb(e.target.dataset.val);
            });
        });
    },
    cvToNoteName: (cv) => {
        const s = Math.round(cv * 12);
        return `${UIHelpers.NOTES[((s % 12) + 12) % 12]}${1 + Math.floor(s / 12)}`;
    },
    getMultiPitchInPorts: (m, maxCh = 4) => {
        const ch = Math.min(maxCh, Math.max(1, m?.channels || 1));
        const inPorts = [];
        for (let c = 1; c <= ch; c++) inPorts.push({ port: c === 1 ? 'cv_in' : `cv_in${c}`, color: 'bg-yellow-400' });
        return inPorts;
    },
    createChannelControlHTML: (prefix, label, ch) => `
        <div class="flex items-center gap-1.5">
            <span class="text-[8px] text-slate-400 font-semibold uppercase">${label}</span>
            <div class="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                <button id="${prefix}-dec-btn" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold">−</button>
                <span class="w-4 text-center text-[10px] font-mono font-bold text-cyan-300">${ch}</span>
                <button id="${prefix}-inc-btn" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold">＋</button>
            </div>
        </div>`,
    bindChannelControl: (prefix, m, ctx, maxCh = 4, cb) => {
        const ch = Math.min(maxCh, Math.max(1, m.channels || 1));
        document.getElementById(`${prefix}-dec-btn`)?.addEventListener('click', () => {
            if (ch > 1) {
                ctx.removeConnectionsForPort(ch === 2 ? 'cv_in2' : `cv_in${ch}`);
                m.channels = ch - 1;
                ctx.rebuildModule?.();
                ctx.reRenderModal();
                cb();
            }
        });
        document.getElementById(`${prefix}-inc-btn`)?.addEventListener('click', () => {
            if (ch < maxCh) {
                m.channels = ch + 1;
                ctx.rebuildModule?.();
                ctx.reRenderModal();
                cb();
            }
        });
    },
    renderPitchSlidersHTML: (m, ctx, prefix, accentColor = 'blue', isQ = false) => {
        const ch = Math.min(4, Math.max(1, m.channels || 1));
        let html = '';
        for (let c = 1; c <= ch; c++) {
            const portName = c === 1 ? 'cv_in' : `cv_in${c}`;
            const isP = ctx.patched?.has(portName);
            const curFreq = m[`freq${c}`] ?? 220;
            if (isQ) {
                const curMidi = isP ? 24 : UIHelpers.freqToMidi(curFreq);
                html += UIHelpers.createVSliderHTML(`${prefix}-freq${c}`, `OSC${c}`, 24, 84, 1, curMidi, isP ? 'PATCHED' : 'note', accentColor, isP, isP ? '1V/OCT' : UIHelpers.midiToNoteName(curMidi));
            } else {
                const v = isP ? 32.7 : curFreq;
                html += UIHelpers.createVSliderHTML(`${prefix}-freq${c}`, `OSC${c}`, 40, 2000, 5, v, isP ? 'PATCHED' : 'hz', accentColor, isP, isP ? '1V/OCT' : `${Math.round(v)}hz`);
            }
        }
        return html;
    },
    bindPitchSliders: (m, ctx, prefix, isQ = false, cb) => {
        const ch = Math.min(4, Math.max(1, m.channels || 1));
        for (let c = 1; c <= ch; c++) {
            const portName = c === 1 ? 'cv_in' : `cv_in${c}`;
            if (!ctx.patched?.has(portName)) {
                if (isQ) {
                    UIHelpers.bindSlider(`${prefix}-freq${c}`, v => UIHelpers.midiToNoteName(v), v => {
                        m[`freq${c}`] = UIHelpers.midiToFreq(Math.round(v));
                        cb();
                    });
                } else {
                    UIHelpers.bindSlider(`${prefix}-freq${c}`, v => `${Math.round(v)}hz`, v => {
                        m[`freq${c}`] = v;
                        cb();
                    });
                }
            }
        }
    },
    renderSchemaModal: (mod, ctx, schemaDef) => {
        const s = typeof schemaDef === 'function' ? schemaDef(mod, ctx) : schemaDef;
        let html = '';

        // 1. Header controls (channel selector, toggles, inline group buttons)
        if (s.header) {
            const h = s.header;
            let leftHtml = '';
            let rightHtml = '';

            // Channel count control: e.g. { label: 'OSCS', min: 1, max: 4 }
            if (h.channel) {
                const ch = Math.min(h.channel.max || 4, Math.max(h.channel.min || 1, mod.channels || 1));
                leftHtml = `
                    <div class="flex items-center gap-1.5">
                        <span class="text-[8px] text-slate-400 font-semibold uppercase">${h.channel.label || 'CH'}</span>
                        <div class="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                            <button id="schema-header-ch-dec" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold leading-none">−</button>
                            <span class="w-4 text-center text-[10px] font-mono font-bold text-cyan-300">${ch}</span>
                            <button id="schema-header-ch-inc" class="w-4 h-4 rounded bg-slate-800 text-[10px] font-bold leading-none">＋</button>
                        </div>
                    </div>`;
            }

            // Header Toggle button: e.g. { key: 'quantize', label: 'QLZ', color: 'cyan' }
            if (h.toggle) {
                const t = h.toggle;
                const isVal = mod[t.key] !== false;
                const tColor = t.color || 'cyan';
                rightHtml = `<button id="schema-header-toggle-${t.key}" class="px-2 py-0.5 rounded text-[8.5px] font-bold border transition-colors ${isVal ? `bg-${tColor}-600 text-white border-${tColor}-500` : 'bg-slate-800 text-slate-400 border-slate-700'}">${t.label}: ${isVal ? (t.onText || 'ON') : (t.offText || 'OFF')}</button>`;
            }

            // Header button groups: e.g. [ { key: 'syncMode', options: [...] }, { key: 'polarity', options: [...] } ]
            if (h.groups && h.groups.length > 0) {
                const renderHGroup = (g) => {
                    const cur = mod[g.key] ?? g.options[0].val;
                    return `<div class="flex items-center gap-0.5">${g.options.map(o => `
                        <button class="schema-header-btn-${g.key} px-1.5 py-0.5 rounded text-[7.5px] font-bold border transition-colors ${cur === o.val ? `bg-${s.color}-600 text-white border-${s.color}-500 shadow-sm shadow-${s.color}-500/30` : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${o.val}">${o.label}</button>
                    `).join('')}</div>`;
                };

                if (!leftHtml) {
                    leftHtml = renderHGroup(h.groups[0]);
                    if (h.groups.length > 1 && !rightHtml) {
                        rightHtml = renderHGroup(h.groups[1]);
                    }
                } else if (!rightHtml) {
                    rightHtml = renderHGroup(h.groups[0]);
                }
            }

            if (leftHtml || rightHtml) {
                html += `<div class="flex items-center justify-between pb-1 border-b border-slate-800">${leftHtml}${rightHtml}</div>`;
            }
        }

        // 2. Body Groups
        const groups = typeof s.groups === 'function' ? s.groups(mod, ctx) : (s.groups || []);
        if (groups.length > 0) {
            groups.forEach(g => {
                const cur = mod[g.key] ?? g.options[0].val;
                html += `
                    <div class="my-1.5"><label class="block text-[8px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">${g.label}</label>
                    <div class="grid grid-cols-${g.cols || g.options.length} gap-0.5">${g.options.map(o => `
                        <button class="schema-btn-${g.key} py-0.5 rounded text-[8px] font-bold border transition-colors ${cur === o.val ? `bg-${s.color}-600 text-white border-${s.color}-500 shadow-sm shadow-${s.color}-500/30` : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${o.val}">${o.label}</button>`).join('')}
                    </div></div>`;
            });
        }

        // 3. Body Sliders
        const sliders = typeof s.sliders === 'function' ? s.sliders(mod, ctx) : (s.sliders || []);
        if (sliders.length > 0) {
            html += `<div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 mt-1">`;
            sliders.forEach(sl => {
                const isP = sl.cvPort && ctx.patched?.has(sl.cvPort);
                const curRaw = sl.getVal ? sl.getVal(mod) : (mod[sl.key] ?? sl.default ?? sl.min);
                const v = isP ? (sl.patchedVal ?? sl.min) : curRaw;
                const customText = isP ? (sl.patchedText || 'EXT') : (sl.format ? sl.format(v) : null);
                html += UIHelpers.createVSliderHTML(
                    `schema-slider-${sl.key}`,
                    sl.label,
                    sl.min,
                    sl.max,
                    sl.step,
                    v,
                    isP ? 'PATCHED' : (sl.unit || ''),
                    sl.color || s.color,
                    isP,
                    customText,
                    sl.power || 1
                );
            });
            html += `</div>`;
        }
        return html;
    },
    bindSchemaEvents: (mod, ctx, schemaDef, onChange) => {
        const s = typeof schemaDef === 'function' ? schemaDef(mod, ctx) : schemaDef;

        // 1. Header events
        if (s.header) {
            const h = s.header;
            if (h.channel) {
                const minCh = h.channel.min || 1;
                const maxCh = h.channel.max || 4;
                const portPrefix = h.channel.portPrefix;

                document.getElementById('schema-header-ch-dec')?.addEventListener('click', () => {
                    const ch = Math.min(maxCh, Math.max(minCh, mod.channels || 1));
                    if (ch > minCh) {
                        const dropPort = portPrefix === 'wave_in' ? `wave_in${ch}` : (ch === 2 ? 'cv_in2' : `cv_in${ch}`);
                        ctx.removeConnectionsForPort?.(dropPort);
                        mod.channels = ch - 1;
                        ctx.rebuildModule?.();
                        ctx.reRenderModal();
                        onChange();
                    }
                });

                document.getElementById('schema-header-ch-inc')?.addEventListener('click', () => {
                    const ch = Math.min(maxCh, Math.max(minCh, mod.channels || 1));
                    if (ch < maxCh) {
                        mod.channels = ch + 1;
                        ctx.rebuildModule?.();
                        ctx.reRenderModal();
                        onChange();
                    }
                });
            }

            if (h.toggle) {
                const t = h.toggle;
                document.getElementById(`schema-header-toggle-${t.key}`)?.addEventListener('click', () => {
                    mod[t.key] = !(mod[t.key] !== false);
                    ctx.reRenderModal();
                    onChange();
                });
            }

            if (h.groups) {
                h.groups.forEach(g => {
                    UIHelpers.bindButtonGroup(
                        `.schema-header-btn-${g.key}`,
                        `bg-${s.color}-600 text-white border-${s.color}-500 shadow-sm shadow-${s.color}-500/30`,
                        'bg-slate-800 text-slate-400 border-slate-700',
                        val => {
                            mod[g.key] = val;
                            if (g.reRender) ctx.reRenderModal();
                            onChange();
                        }
                    );
                });
            }
        }

        // 2. Body Groups
        const groups = typeof s.groups === 'function' ? s.groups(mod, ctx) : (s.groups || []);
        groups.forEach(g => {
            UIHelpers.bindButtonGroup(
                `.schema-btn-${g.key}`,
                `bg-${s.color}-600 text-white border-${s.color}-500 shadow-sm shadow-${s.color}-500/30`,
                'bg-slate-800 text-slate-400 border-slate-700',
                val => {
                    mod[g.key] = val;
                    if (g.reRender) ctx.reRenderModal();
                    onChange();
                }
            );
        });

        // 3. Body Sliders
        const sliders = typeof s.sliders === 'function' ? s.sliders(mod, ctx) : (s.sliders || []);
        sliders.forEach(sl => {
            if (sl.cvPort && ctx.patched?.has(sl.cvPort)) return;
            const setter = sl.setVal || ((m, v) => { m[sl.key] = v; });
            const fmt = sl.format || (v => Math.round(v));

            UIHelpers.bindSlider(
                `schema-slider-${sl.key}`,
                fmt,
                val => {
                    setter(mod, val);
                    if (sl.reRender) ctx.reRenderModal();
                    onChange();
                },
                sl.power || 1,
                sl.min,
                sl.max
            );
        });
    },
    /**
     * Standard 12-pin chassis terminal renderer (PIN1 - PIN12).
     *
     * Physical Chassis Grid:
     * - Left Edge: PIN3 (bottom 16px), PIN2 (bottom 30px), PIN1 (bottom 44px)
     * - Bottom Edge: PIN4 (left), PIN5, PIN6, PIN7, PIN8, PIN9 (right) [6 slots justify-between]
     * - Right Edge: PIN10 (bottom 16px), PIN11 (bottom 30px), PIN12 (bottom 44px)
     */
    renderChassisPorts: (renderP, portsOrIn = {}, outPortsOrMap = null, customPinMap = null) => {
        let inPorts = [];
        let outPorts = [];
        let pinMap = null;

        if (Array.isArray(portsOrIn)) {
            inPorts = portsOrIn;
            outPorts = Array.isArray(outPortsOrMap) ? outPortsOrMap : [];
            pinMap = (!Array.isArray(outPortsOrMap) && outPortsOrMap && typeof outPortsOrMap === 'object') ? outPortsOrMap : customPinMap;
        } else if (portsOrIn && typeof portsOrIn === 'object') {
            inPorts = portsOrIn.in || [];
            outPorts = portsOrIn.out || [];
            pinMap = (outPortsOrMap && typeof outPortsOrMap === 'object' && !Array.isArray(outPortsOrMap)) ? outPortsOrMap : customPinMap;
        }
        const allPorts = [...inPorts, ...outPorts];

        const parsePin = (val) => {
            if (!val) return null;
            if (typeof val === 'number' && val >= 1 && val <= 12) return val;
            if (typeof val === 'string') {
                const m = val.match(/^PIN?([1-9]|1[0-2])(?:_(?:in|out))?$/i);
                if (m) return parseInt(m[1], 10);
            }
            return null;
        };

        const pinSlots = new Array(13).fill(null);
        const unassignedIn = [];
        const unassignedOut = [];

        // 1. Assign ports with explicit pin definitions or pinMap
        allPorts.forEach(p => {
            const mappedPin = pinMap ? pinMap[p.port] : null;
            const explicit = parsePin(p.pin ?? mappedPin ?? p.port);
            if (explicit) {
                pinSlots[explicit] = p;
            } else if (inPorts.includes(p)) {
                unassignedIn.push(p);
            } else {
                unassignedOut.push(p);
            }
        });

        // 2. Default fallback mapping for inputs: PIN4, PIN3, PIN2, PIN1, PIN5, PIN6
        const defaultInOrder = [4, 3, 2, 1, 5, 6];
        let inIdx = 0;
        unassignedIn.forEach(p => {
            while (inIdx < defaultInOrder.length && pinSlots[defaultInOrder[inIdx]]) {
                inIdx++;
            }
            if (inIdx < defaultInOrder.length) {
                pinSlots[defaultInOrder[inIdx]] = p;
                inIdx++;
            }
        });

        // 3. Default fallback mapping for outputs: PIN9, PIN10, PIN11, PIN12, PIN8, PIN7
        const defaultOutOrder = [9, 10, 11, 12, 8, 7];
        let outIdx = 0;
        unassignedOut.forEach(p => {
            while (outIdx < defaultOutOrder.length && pinSlots[defaultOutOrder[outIdx]]) {
                outIdx++;
            }
            if (outIdx < defaultOutOrder.length) {
                pinSlots[defaultOutOrder[outIdx]] = p;
                outIdx++;
            }
        });

        const emptySlot = '<div class="w-2 h-2 pointer-events-none opacity-0"></div>';
        const renderSlot = (slotNum) => {
            const p = pinSlots[slotNum];
            return p ? renderP([p]) : emptySlot;
        };

        let html = '';

        // Left Edge: PIN3, PIN2, PIN1 (bottom to top)
        if (pinSlots[1] || pinSlots[2] || pinSlots[3]) {
            const leftPins = [3, 2, 1].map(renderSlot).join('');
            html += `<div class="absolute left-[3px] bottom-[16px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">${leftPins}</div>`;
        }

        // Right Edge: PIN10, PIN11, PIN12 (bottom to top)
        if (pinSlots[10] || pinSlots[11] || pinSlots[12]) {
            const rightPins = [10, 11, 12].map(renderSlot).join('');
            html += `<div class="absolute right-[3px] bottom-[16px] flex flex-col-reverse gap-1.5 items-center pointer-events-auto z-10">${rightPins}</div>`;
        }

        // Bottom Edge: PIN4, PIN5, PIN6, PIN7, PIN8, PIN9 (6 slots fixed)
        if (pinSlots[4] || pinSlots[5] || pinSlots[6] || pinSlots[7] || pinSlots[8] || pinSlots[9]) {
            const bottomPins = [4, 5, 6, 7, 8, 9].map(renderSlot).join('');
            html += `<div class="absolute bottom-[3px] left-[3px] right-[3px] flex justify-between items-center pointer-events-auto z-10">${bottomPins}</div>`;
        }

        return html;
    },
    renderStandardPorts: (renderP, inPorts = [], outPorts = []) => {
        return UIHelpers.renderChassisPorts(renderP, { in: inPorts, out: outPorts });
    },
    /**
     * Renders standardized module panel bars (VCA, ADSR, SEQ, SPK, MIX, SLIDER).
     * Height is standardized to h-7 (28px) across all modules.
     */
    renderPanelBars: (bars = [], options = {}) => {
        const heightCls = options.heightCls || 'h-7';
        const defaultWidth = options.widthCls || 'w-2';
        const gapCls = options.gapCls || 'gap-1.5';
        const theme = options.theme || 'audio';
        const themeColor = theme === 'cv'
            ? 'bg-gradient-to-t from-amber-600 to-yellow-400'
            : 'bg-gradient-to-t from-blue-600 to-cyan-400';
        const defaultColor = options.color || themeColor;

        const barsHTML = bars.map(bar => {
            const b = typeof bar === 'number' ? { pct: bar } : (bar || {});
            const pct = Math.max(0, Math.min(100, Math.round(b.pct ?? 0)));
            const w = b.width || defaultWidth;
            const color = b.color || defaultColor;
            const innerCls = b.innerCls || '';
            const outerCls = b.outerCls || '';
            const attrs = b.attrs ? ` ${b.attrs}` : '';
            return `<div class="${w} ${heightCls} rounded-sm p-[1px] flex flex-col justify-end border border-slate-600 bg-slate-950/40 relative panel-bar-slot ${outerCls}"${attrs}><div class="w-full ${color} rounded-xs ${innerCls}" style="height: ${pct}%;"></div></div>`;
        }).join('');

        if (options.noWrapper) return barsHTML;
        const containerCls = options.containerCls || '';
        return `<div class="flex items-end justify-center ${gapCls} ${containerCls}">${barsHTML}</div>`;
    }
};

