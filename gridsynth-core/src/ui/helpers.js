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
    renderSchemaModal: (mod, ctx, s) => {
        let html = '';
        if (s.groups) {
            s.groups.forEach(g => {
                const cur = mod[g.key] || g.options[0].val;
                html += `
                    <div class="mb-1"><label class="block text-[8px] text-slate-400 mb-0.5 uppercase tracking-wider font-semibold">${g.label}</label>
                    <div class="grid grid-cols-${g.cols || g.options.length} gap-0.5">${g.options.map(o => `
                        <button class="schema-btn-${g.key} py-0.5 rounded text-[8px] font-bold border transition-colors ${cur === o.val ? `bg-${s.color}-600 text-white border-${s.color}-500` : 'bg-slate-800 text-slate-400 border-slate-700'}" data-val="${o.val}">${o.label}</button>`).join('')}
                    </div></div>`;
            });
        }
        if (s.sliders) {
            html += `<div class="flex items-center justify-around py-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 gap-1 mt-1">`;
            s.sliders.forEach(sl => {
                const isP = sl.cvPort && ctx.patched?.has(sl.cvPort);
                const v = isP ? (sl.patchedVal ?? sl.min) : (mod[sl.key] ?? sl.default);
                html += UIHelpers.createVSliderHTML(`schema-slider-${sl.key}`, sl.label, sl.min, sl.max, sl.step, v, isP ? 'PATCHED' : (sl.unit || ''), sl.color || s.color, isP, isP ? (sl.patchedText || 'EXT') : (sl.format ? sl.format(v) : Math.round(v)), sl.power || 1);
            });
            html += `</div>`;
        }
        return html;
    },
    bindSchemaEvents: (mod, ctx, s, onChange) => {
        s.groups?.forEach(g => {
            UIHelpers.bindButtonGroup(`.schema-btn-${g.key}`, `bg-${s.color}-600 text-white border-${s.color}-500`, 'bg-slate-800 text-slate-400 border-slate-700', val => { mod[g.key] = val; onChange(); });
        });
        s.sliders?.forEach(sl => {
            if (sl.cvPort && ctx.patched?.has(sl.cvPort)) return;
            UIHelpers.bindSlider(`schema-slider-${sl.key}`, sl.format || (v => Math.round(v)), val => { mod[sl.key] = val; onChange(); }, sl.power || 1, sl.min, sl.max);
        });
    }
};
