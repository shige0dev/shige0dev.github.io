// src/ui/managers/modal-manager.js
import { MODULE_REGISTRY } from '../../modules/registry.js';
import { FACTORY_SUBPATCHES } from '../../presets/subpatches.js';
import { UIHelpers } from '../helpers.js';
import { generateModuleId } from '../../core/utils.js';

export const MODAL_WIDTHS = {
    ADSR: 'w-[195px]',
    FM: 'w-[390px]',
    FM3OP: 'w-[390px]',
    FMx3: 'w-[390px]',
    FMCORE: 'w-[245px]'
};

export class ModalManager {
    constructor(ui) {
        this.ui = ui;
        this.activePopupModuleId = null;
        this.activeDockModuleId = null;
        this.isDockLocked = false;
        this._toastTimer = null;
    }

    showToast(msg, duration = 1800) {
        const t = document.getElementById('toast');
        if (!t) return Promise.resolve();
        t.textContent = msg;
        t.classList.remove('opacity-0');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        return new Promise(resolve => {
            this._toastTimer = setTimeout(() => {
                t.classList.add('opacity-0');
                setTimeout(resolve, 150);
            }, duration);
        });
    }

    openModal(idx, title, widthCls, renderFn) {
        const modal = document.getElementById('shared-modal');
        const content = document.getElementById('modal-content');
        if (!modal || !content) return;

        if (title === 'ADD MODULE') {
            content.style.width = 'calc(100% - 16px)';
            content.style.maxWidth = 'none';
            content.style.left = '8px';
            content.style.right = '8px';
            content.style.margin = '0';
            content.style.bottom = 'auto';
        } else {
            content.style.width = '';
            content.style.maxWidth = '';
            content.style.right = 'auto';
            content.style.bottom = 'auto';
            content.style.margin = '0';
        }

        content.className = `absolute bg-slate-900/95 border border-slate-700 rounded-xl ${widthCls} p-2 shadow-2xl backdrop-blur-md`;
        const titleEl = document.getElementById('modal-title');
        if (titleEl) titleEl.textContent = title;
        renderFn(document.getElementById('modal-body'));
        modal.classList.remove('hidden');

        requestAnimationFrame(() => {
            const cell = document.getElementById(`cell-${idx}`);
            const frame = document.getElementById('phone-frame');
            if (!cell || !frame) return;
            const cR = cell.getBoundingClientRect();
            const fR = frame.getBoundingClientRect();
            const pR = content.getBoundingClientRect();

            if (title === 'ADD MODULE') {
                content.style.left = '8px';
                content.style.right = '8px';
                content.style.width = 'calc(100% - 16px)';
                content.style.maxWidth = 'none';
                content.style.margin = '0';
                content.style.bottom = 'auto';
                const idealTop = (cR.top - fR.top) - pR.height - 8;
                const topPos = idealTop < 10 ? (cR.bottom - fR.top + 8) : idealTop;
                content.style.top = `${Math.max(6, Math.min(fR.height - pR.height - 52, topPos))}px`;
            } else {
                content.style.width = '';
                content.style.maxWidth = '';
                content.style.right = 'auto';
                content.style.margin = '0';
                content.style.bottom = 'auto';
                const idealLeft = (cR.left - fR.left) + (cR.width - pR.width) / 2;
                content.style.left = `${Math.max(6, Math.min(fR.width - pR.width - 6, idealLeft))}px`;

                const idealTop = (cR.top - fR.top) - pR.height - 8;
                const topPos = idealTop < 10 ? (cR.bottom - fR.top + 8) : idealTop;
                content.style.top = `${Math.max(6, Math.min(fR.height - pR.height - 52, topPos))}px`;
            }
        });
    }

    openSettingsModal(mId) {
        const m = this.ui.modules[mId];
        if (!m || m.type === 'SUB_IO') return;
        if (['KEY', 'SEQ', 'PAT'].includes(m.type)) {
            this.openDockModal(mId);
            return;
        }
        this.activePopupModuleId = mId;
        const widthCls = MODAL_WIDTHS[m.type] || 'w-[180px]';
        this.openModal(m.row * this.ui.COLS + m.col, m.type, widthCls, () => this.reRenderModal());
    }

    openDockModal(mId) {
        const m = this.ui.modules[mId];
        if (!m) return;
        this.activeDockModuleId = mId;
        const modal = document.getElementById('dock-modal');
        const content = document.getElementById('dock-content');
        const title = document.getElementById('dock-title');
        const icon = document.getElementById('dock-icon');
        const frame = document.getElementById('phone-frame');

        if (title) title.textContent = m.type === 'KEY' ? 'KEYBOARD' : (m.type === 'PAT' ? 'STRUDEL PATTERN' : 'SEQUENCER');
        if (icon) icon.setAttribute('data-lucide', m.type === 'KEY' ? 'music' : (m.type === 'PAT' ? 'code' : 'sliders'));
        modal?.classList.remove('hidden');
        this.reRenderDockModal();
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (content) {
            content.style.left = '8px';
            content.style.right = '8px';
            content.style.width = 'calc(100% - 16px)';
            content.style.maxWidth = 'none';
            content.style.margin = '0';
            content.style.bottom = 'auto';

            requestAnimationFrame(() => {
                if (!frame) return;
                const fR = frame.getBoundingClientRect();
                const cR = content.getBoundingClientRect();
                content.style.bottom = 'auto';
                content.style.top = `${Math.max(6, fR.height - cR.height - 52)}px`;
            });
        }
    }

    closeDockModal() {
        const modal = document.getElementById('dock-modal');
        modal?.classList.add('hidden');
        this.activeDockModuleId = null;
        this.setDockLock(false);
    }

    setDockLock(lock) {
        this.isDockLocked = lock;
        const btn = document.getElementById('dock-lock-btn');
        const backdrop = document.getElementById('dock-backdrop');
        if (btn) {
            btn.className = `h-5 px-1.5 rounded text-[8.5px] font-bold flex items-center gap-1 border transition-colors ${lock ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`;
        }
        if (backdrop) {
            backdrop.style.display = lock ? 'none' : 'block';
        }
    }

    createModuleContext(id, isDock = false) {
        return {
            id,
            patched: this.ui.getPatchState(id),
            bpm: this.ui.synth.masterBPM,
            currentPageId: this.ui.currentPageId,
            showToast: (msg) => this.showToast(msg),
            reRenderModal: isDock ? () => this.reRenderDockModal() : () => this.reRenderModal(),
            rebuildModule: () => this.ui.rebuildModule(id),
            removeConnectionsForPort: (p) => this.ui.removeConnectionsForPort(id, p),
            sendControl: (event) => this.ui.synth.sendControlEvent(id, event),
            sendKeyNote: (midi, isDown) => this.ui.synth.sendControlEvent(id, { type: 'NOTE', midi, isDown }),
            triggerManualSample: () => this.ui.synth.sendControlEvent(id, { type: 'TRIG' }),
            prompt: (t, init) => this.openCustomPrompt(t, init),
            openSubpage: (pId) => this.ui.switchPage(pId),
            saveSubpatchToLibrary: (name) => this.ui.saveCurrentSubpatchToLibrary(name),
            getPageName: () => this.ui.pagesData[this.ui.currentPageId]?.name || `SUBPATCH ${this.ui.currentPageId}`,
            setPageName: (name) => {
                if (!this.ui.pagesData[this.ui.currentPageId]) {
                    this.ui.pagesData[this.ui.currentPageId] = { slots: {}, modules: {}, connections: [] };
                }
                this.ui.pagesData[this.ui.currentPageId].name = name;
                this.ui.updatePageNavUI();
                this.ui.updateAllCells();
                this.showToast(`サブパッチ名を「${name}」に変更しました`);
            },
            pagesData: this.ui.pagesData
        };
    }

    reRenderDockModal() {
        const id = this.activeDockModuleId;
        const m = this.ui.modules[id];
        if (!m) return;
        const reg = MODULE_REGISTRY[m.type];
        const b = document.getElementById('dock-body');
        if (!reg || !b) return;

        b.className = "text-xs mt-1";
        const ctx = this.createModuleContext(id, true);
        const onChange = () => {
            this.ui.synth.updateModule(`${this.ui.currentPageId}/${id}`, m, this.ui.getPatchState(id));
            this.ui.renderCell(m.row * this.ui.COLS + m.col);
        };
        if (reg.renderModal) b.innerHTML = reg.renderModal(m, ctx);
        else if (reg.schema) b.innerHTML = UIHelpers.renderSchemaModal(m, ctx, reg.schema);
        if (reg.bindEvents) reg.bindEvents(m, ctx, onChange);
        else if (reg.schema) UIHelpers.bindSchemaEvents(m, ctx, reg.schema, onChange);
    }

    reRenderModal() {
        const id = this.activePopupModuleId;
        const m = this.ui.modules[id];
        if (!m) return;
        const reg = MODULE_REGISTRY[m.type];
        const b = document.getElementById('modal-body');
        if (!reg || !b) return;

        b.className = "text-xs mt-1";
        const ctx = this.createModuleContext(id, false);

        const updateModalTitle = () => {
            const titleEl = document.getElementById('modal-title');
            if (!titleEl) return;
            if (m.type === 'MARKOV') {
                const weights = Array.isArray(m.weights) ? m.weights : [0, 0, 0, 0];
                const patched = this.ui.getPatchState(id);
                const hasUnconnected = weights.some((w, idx) => Number(w) > 0 && !patched.has(`trig_out${idx + 1}`));
                if (hasUnconnected) {
                    titleEl.className = "text-[10px] font-bold text-rose-400 uppercase tracking-wider pointer-events-none flex items-center gap-1.5";
                    titleEl.innerHTML = `<span>MARKOV</span><span class="text-[8px] text-rose-300 bg-rose-950/80 border border-rose-500/50 px-1 py-0.2 rounded font-mono">⚠️ UNCONNECTED</span>`;
                } else {
                    titleEl.className = "text-[10px] font-bold text-cyan-300 uppercase tracking-wider pointer-events-none";
                    titleEl.textContent = "MARKOV";
                }
            } else {
                titleEl.className = "text-[10px] font-bold text-cyan-300 uppercase tracking-wider pointer-events-none";
                titleEl.textContent = m.type;
            }
        };

        const onChange = () => {
            this.ui.synth.updateModule(`${this.ui.currentPageId}/${id}`, m, this.ui.getPatchState(id));
            this.ui.renderCell(m.row * this.ui.COLS + m.col);
            updateModalTitle();
        };

        updateModalTitle();

        if (reg.renderModal) {
            b.innerHTML = reg.renderModal(m, ctx);
        } else if (reg.schema) {
            b.innerHTML = UIHelpers.renderSchemaModal(m, ctx, reg.schema);
        }

        if (reg.bindEvents) {
            reg.bindEvents(m, ctx, onChange);
        } else if (reg.schema) {
            UIHelpers.bindSchemaEvents(m, ctx, reg.schema, onChange);
        }
    }

    openAddModal(slotIdx) {
        this.openModal(slotIdx, 'ADD MODULE', 'w-[calc(100%-16px)]', (body) => {
            const isMain = this.ui.currentPageId === "0";
            const depth = this.ui.getNestingDepth(this.ui.currentPageId);
            const allowSub = depth < 3;

            const renderContent = () => {
                const basicTypes = Object.keys(MODULE_REGISTRY).filter(t => {
                    if (t === 'SUB') return false; // Placed under User Subpatch area
                    if (t === 'SUB_IO') return !isMain;
                    if (t === 'FM' || t === 'FM3OP') return false; // Aliases for FMx3
                    return true;
                });

                const userSubs = Object.values(this.ui.getUserSubpatches());
                const factorySubs = Object.values(FACTORY_SUBPATCHES);

                body.className = "flex flex-col gap-2 mt-0.5 max-h-[78vh] overflow-y-auto pr-0.5";
                body.innerHTML = `
                    <!-- 1. BASIC MODULES (8-column Grid) -->
                    <div>
                        <div class="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-0.5 flex items-center justify-between">
                            <span>BASIC MODULES</span>
                            ${!isMain ? '<span class="text-[7.5px] text-emerald-400 font-mono">SUBPAGE</span>' : ''}
                        </div>
                        <div class="grid grid-cols-8 gap-1">
                            ${basicTypes.map(type => {
                                const col = MODULE_REGISTRY[type]?.color || 'cyan';
                                return `<button data-type="${type}" class="h-6 py-0.5 px-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-${col}-500/60 rounded text-center text-${col}-300 text-[7.5px] font-bold tracking-tight transition truncate flex items-center justify-center">${type}</button>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- 2. FACTORY SUBPATCHES (4-column Grid, 2x width of basic modules) -->
                    ${allowSub ? `
                    <div class="border-t border-slate-800 pt-1.5 mt-0.5">
                        <div class="text-[8.5px] font-bold text-purple-300 uppercase tracking-wider mb-1 px-0.5 flex items-center">
                            <span>FACTORY SUBPATCH</span>
                        </div>
                        <div class="grid grid-cols-4 gap-1">
                            ${factorySubs.map(sub => `
                                <div class="h-6 bg-slate-800/90 hover:bg-purple-950/60 border border-slate-700/80 hover:border-purple-500/80 rounded flex items-center justify-between px-1 transition cursor-pointer factory-sub-item" data-id="${sub.id}">
                                    <span class="text-[7.5px] font-bold text-purple-300 truncate pointer-events-none">${sub.name}</span>
                                    <div class="flex items-center gap-0.5 shrink-0 ml-0.5">
                                        <button class="export-factory-sub-btn w-3.5 h-3.5 flex items-center justify-center bg-slate-900 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 text-[6.5px]" data-id="${sub.id}" title="JSONエクスポート(コピー)">📋</button>
                                        <button class="sub-info-btn w-3.5 h-3.5 flex items-center justify-center text-slate-400 hover:text-purple-300 rounded text-[7px] hover:bg-slate-700/80" data-id="${sub.id}" title="説明">ℹ️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 3. USER SUBPATCHES & HEADER NEW SUBPATCH BUTTON -->
                    ${allowSub ? `
                    <div class="border-t border-slate-800 pt-1.5 mt-0.5">
                        <div class="text-[8.5px] font-bold text-emerald-300 uppercase tracking-wider mb-1 px-0.5 flex items-center justify-between">
                            <span>USER STOCK (SUBPATCH)</span>
                            <div class="flex items-center gap-1">
                                <button class="import-user-sub-btn h-5 px-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/70 hover:border-purple-400 text-purple-300 rounded text-[8px] font-bold transition flex items-center gap-1 shadow-sm cursor-pointer" title="サブパッチJSONをインポートしてストックに登録">
                                    <span>📥 IMPORT</span>
                                </button>
                                <button data-type="SUB" class="h-5 px-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/70 hover:border-emerald-400 text-emerald-300 rounded text-[8px] font-bold transition flex items-center gap-1 shadow-sm">
                                    <span>➕ 新規作成</span>
                                </button>
                            </div>
                        </div>
                        ${userSubs.length > 0 ? `
                        <div class="grid grid-cols-4 gap-1 mt-1">
                            ${userSubs.map(sub => `
                                <div class="h-6 bg-slate-800/90 hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-500/80 rounded flex items-center justify-between px-1 transition cursor-pointer user-sub-item select-user-sub" data-id="${sub.id}">
                                    <span class="text-[7.5px] font-bold text-emerald-300 truncate pointer-events-none">${sub.name}</span>
                                    <div class="flex items-center gap-0.5 shrink-0 ml-0.5">
                                        <button class="export-user-sub-btn w-3.5 h-3.5 flex items-center justify-center bg-slate-900 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 text-[6.5px]" data-id="${sub.id}" title="JSONエクスポート(コピー)">📋</button>
                                        <button class="edit-user-sub-btn w-3.5 h-3.5 flex items-center justify-center bg-slate-900 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 text-[6.5px]" data-id="${sub.id}" title="中身を編集">✏️</button>
                                        <button class="delete-user-sub-btn w-3.5 h-3.5 flex items-center justify-center bg-red-950/70 hover:bg-red-900 text-red-300 rounded border border-red-700/60 text-[6.5px]" data-id="${sub.id}" title="削除">🗑️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                `;

                // Basic module & SUB click
                body.querySelectorAll('[data-type]').forEach(btn => btn.addEventListener('click', () => {
                    this.ui.saveHistory();
                    const type = btn.dataset.type;

                    if (type === 'SUB') {
                        const res = this.ui.pageManager.createSubpatchInstance({ slotIdx });
                        document.getElementById('shared-modal')?.classList.add('hidden');
                        this.ui.renderCell(slotIdx);
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        this.ui.updatePageNavUI();
                        this.showToast(`SUBPATCH「${res.name}」を追加しました`);
                        return;
                    }

                    const d = MODULE_REGISTRY[type].defaults();
                    const newId = generateModuleId(type, this.ui.modules);
                    d.id = newId;
                    d.col = slotIdx % this.ui.COLS;
                    d.row = Math.floor(slotIdx / this.ui.COLS);

                    this.ui.modules[newId] = d;
                    this.ui.syncGridMap();
                    this.ui.synth.addModule(`${this.ui.currentPageId}/${newId}`, type, d, this.ui.getPatchState(newId));

                    document.getElementById('shared-modal')?.classList.add('hidden');
                    this.ui.renderCell(slotIdx);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    this.ui.updatePageNavUI();
                    this.showToast(`${type} を追加しました`);
                }));

                // Factory subpatch click (Direct place)
                body.querySelectorAll('.factory-sub-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.sub-info-btn') || e.target.closest('.export-factory-sub-btn')) return;
                        const subId = item.dataset.id;
                        this.ui.instantiateSubpatch(subId, slotIdx);
                        document.getElementById('shared-modal')?.classList.add('hidden');
                    });
                });

                // Factory subpatch export
                body.querySelectorAll('.export-factory-sub-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = FACTORY_SUBPATCHES[subId];
                        if (sub) this.ui.openSubpatchExportModal(sub);
                    });
                });

                // Factory subpatch info button click (Toast description)
                body.querySelectorAll('.sub-info-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = FACTORY_SUBPATCHES[subId] || (this.ui.userSubpatches && this.ui.userSubpatches[subId]);
                        if (sub) {
                            this.showToast(`【${sub.name}】${sub.description || '説明なし'}`, 3000);
                        }
                    });
                });

                // User subpatch click (Direct place)
                body.querySelectorAll('.select-user-sub').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.edit-user-sub-btn') || e.target.closest('.delete-user-sub-btn') || e.target.closest('.export-user-sub-btn')) return;
                        const subId = item.dataset.id;
                        this.ui.instantiateSubpatch(subId, slotIdx);
                        document.getElementById('shared-modal')?.classList.add('hidden');
                    });
                });

                // User subpatch export
                body.querySelectorAll('.export-user-sub-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = this.ui.getUserSubpatches()[subId];
                        if (sub) this.ui.openSubpatchExportModal(sub);
                    });
                });

                // User subpatch import
                body.querySelector('.import-user-sub-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.ui.openSubpatchImportModal(() => renderContent());
                });

                // User subpatch edit (Place and immediately open internal subpatch page)
                body.querySelectorAll('.edit-user-sub-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const res = this.ui.instantiateSubpatch(subId, slotIdx);
                        if (res && res.success) {
                            document.getElementById('shared-modal')?.classList.add('hidden');
                            this.ui.switchPage(res.page);
                            this.showToast(`サブパッチ「${res.subpatch}」の編集画面を開きました（上部の STOCK ボタンで更新可能）`);
                        }
                    });
                });

                // User subpatch delete
                body.querySelectorAll('.delete-user-sub-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = this.ui.userSubpatches[subId];
                        if (!sub) return;
                        if (confirm(`サブパッチ「${sub.name}」をライブラリから削除しますか？\n（※配置済みのモジュールには影響しません）`)) {
                            this.ui.deleteUserSubpatch(subId);
                            renderContent();
                        }
                    });
                });
            };

            renderContent();
        });
    }

    openCustomPrompt(title, init) {
        return new Promise(res => {
            const md = document.getElementById('custom-prompt-modal');
            const inp = document.getElementById('prompt-input');
            const backdrop = document.getElementById('prompt-backdrop');
            if (!md || !inp || !backdrop) return res(null);

            document.getElementById('prompt-title')?.querySelector('span')?.replaceChildren(document.createTextNode(title));
            inp.value = init || '';
            md.classList.remove('hidden');
            inp.focus();
            inp.select();

            const finish = (val) => {
                md.classList.add('hidden');
                inp.onkeydown = null;
                backdrop.onclick = null;
                res(val);
            };

            inp.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finish(inp.value.trim());
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(null);
                }
            };
            backdrop.onclick = () => finish(null);
        });
    }

    openCustomAlert(title, message, details = []) {
        return new Promise(res => {
            const md = document.getElementById('custom-alert-modal');
            const titleEl = document.getElementById('alert-title');
            const msgEl = document.getElementById('alert-message');
            const detailsEl = document.getElementById('alert-details');
            const okBtn = document.getElementById('alert-ok-btn');
            const backdrop = document.getElementById('alert-backdrop');

            if (!md) {
                const fullMsg = details && details.length ? `${message}\n\n${details.join('\n')}` : message;
                alert(`${title}\n\n${fullMsg}`);
                return res();
            }

            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = message;
            if (detailsEl) {
                if (details && details.length > 0) {
                    detailsEl.classList.remove('hidden');
                    detailsEl.innerHTML = details.map(d => `<div class="truncate py-0.5 border-b border-slate-800/60 last:border-0">• ${d}</div>`).join('');
                } else {
                    detailsEl.classList.add('hidden');
                }
            }

            md.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();

            let keyHandler = null;
            const finish = () => {
                md.classList.add('hidden');
                if (okBtn) okBtn.onclick = null;
                if (backdrop) backdrop.onclick = null;
                if (keyHandler) window.removeEventListener('keydown', keyHandler);
                res();
            };

            keyHandler = (e) => {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    e.preventDefault();
                    finish();
                }
            };

            if (okBtn) okBtn.onclick = finish;
            if (backdrop) backdrop.onclick = finish;
            window.addEventListener('keydown', keyHandler);
        });
    }
}

