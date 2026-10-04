import { safeClone, parseConn, connKey, isSameConn, generateModuleId, HIGHLIGHT_CLASSES } from '../core/utils.js';
import { MODULE_REGISTRY } from '../modules/registry.js';
import { UIHelpers } from './helpers.js';
import { getDefaultPresets } from '../presets/default.js';
import { FACTORY_SUBPATCHES } from '../presets/subpatches.js';

export class UIController {
    constructor(synth) {
        this.synth = synth;
        this.COLS = 5;
        this.ROWS = 8;
        this.currentPageId = "0";
        this.pagesData = { "0": { slots: {}, modules: {}, connections: [] } };
        this.modules = {};
        this.gridMap = Array(40).fill(null);
        this.connections = [];
        this.historyStack = [];
        this.selectedModuleIds = [];
        this.selectedTargetForConnection = null;
        this.activePopupModuleId = null;
        this.activeDockModuleId = null;
        this.isDockLocked = false;
        this.isDragging = false;
        this.dropTargetIndex = null;
        this.dragMode = 'move';
        this.dragGroupOffsets = [];
        this.dragGroupValid = false;
        this.lastHighlightedCells = [];
        this._toastTimer = null;
        this._lastUiUpdate = 0;
        this.DEMO_KEYS = [
            '01_DELAY_TECHNO',
            '02_KEYBOARD_LEAD',
            '03_WAVEFOLD_VERB',
            '04_RANDOM_SH_DELAY',
            '05_SUBPATCH_MULTI_GROOVE',
            '06_STRUDEL_HOUSE_BASSLINE'
        ];
        this.demoAccordionOpen = false;
        this.pageStack = [];

        try {
            this.userSubpatches = JSON.parse(localStorage.getItem('gridsynth_user_subpatches')) || {};
        } catch (e) {
            this.userSubpatches = {};
        }

        try {
            const stored = JSON.parse(localStorage.getItem('gridsynth_presets_db')) || {};
            this.presets = {};
            Object.entries(stored).forEach(([k, v]) => {
                if (v && v.pages && v.pages["0"]) {
                    this.presets[k] = v;
                }
            });
        } catch (e) {
            this.presets = {};
        }

        // Clean up obsolete/old legacy demo keys
        const oldLegacyKeys = [
            'DEMO_01', 'DEMO_02', 'DEMO_03', 'DEMO_04', 'DEMO_05', 'DEMO_06', 'DEMO_07',
            'DEMO_01_DELAY_TECHNO', 'DEMO_02_KEYBOARD_LEAD', 'DEMO_03_WAVEFOLD_VERB', 'DEMO_04_RANDOM_SH_DELAY', 'DEMO_05_MULTI_GROOVE', 'DEMO_06_HOUSE_BASSLINE',
            'DEMO01_DELAY_TECHNO', 'DEMO02_KEYBOARD_LEAD', 'DEMO03_WAVEFOLD_VERB', 'DEMO04_RANDOM_SH_DELAY', 'DEMO05_MULTI_GROOVE', 'DEMO06_HOUSE_BASSLINE'
        ];
        oldLegacyKeys.forEach(oldKey => {
            delete this.presets[oldKey];
        });

        const defs = getDefaultPresets();
        this.DEMO_KEYS.forEach(k => {
            this.presets[k] = defs[k];
        });

        try {
            const order = JSON.parse(localStorage.getItem('gridsynth_preset_order')) || [];
            this.presetOrder = order.filter(k => this.presets[k] && !oldLegacyKeys.includes(k));
            this.DEMO_KEYS.forEach(k => {
                if (!this.presetOrder.includes(k)) this.presetOrder.push(k);
            });
        } catch (e) {
            this.presetOrder = [...this.DEMO_KEYS];
        }

        this.currentPresetKey = this.presets['01_DELAY_TECHNO'] ? '01_DELAY_TECHNO' : (this.presetOrder[0] || Object.keys(this.presets)[0]);

        this.initDOM();
        this.bindGlobalEvents();
        this.loadActivePreset();
        this.uiUpdateLoop(0);
    }

    getNestingDepth(pageId) {
        let pId = String(pageId ?? this.currentPageId);
        let depth = 0;
        const visited = new Set();
        while (pId !== "0" && !visited.has(pId)) {
            visited.add(pId);
            let parentPageId = null;
            for (const [pKey, pData] of Object.entries(this.pagesData)) {
                const mods = pKey === this.currentPageId ? this.modules : (pData?.modules || {});
                for (const m of Object.values(mods)) {
                    if (m && m.type === 'SUB' && String(m.targetPage) === pId) {
                        parentPageId = String(pKey);
                        break;
                    }
                }
                if (parentPageId !== null) break;
            }
            if (parentPageId !== null) {
                depth++;
                pId = parentPageId;
            } else {
                break;
            }
        }
        return depth;
    }

    static parsePatch(patchData, cols = 5) {
        if (!patchData) return { bpm: 120, pages: { "0": { slots: {}, modules: {}, connections: [] } } };
        const rawPages = patchData.pages || { "0": patchData };
        const parsedPages = {};

        Object.entries(rawPages).forEach(([pageId, pData]) => {
            const resolvedMods = {};
            const slots = pData.slots || {};
            const rawMods = pData.modules || {};

            Object.entries(slots).forEach(([slotStr, id]) => {
                const slotIdx = parseInt(slotStr, 10);
                const raw = rawMods[id] || {};
                const type = raw.type || id.replace(/[0-9]/g, '').toUpperCase();
                const def = MODULE_REGISTRY[type]?.defaults ? MODULE_REGISTRY[type].defaults() : { type };
                const mod = Object.assign({}, def, raw, {
                    type,
                    id,
                    col: slotIdx % cols,
                    row: Math.floor(slotIdx / cols)
                });
                if (Array.isArray(mod.steps) && typeof mod.steps[0] === 'number') {
                    mod.steps = mod.steps.map(cv => ({ cv, active: true, cvActive: true, gate: true }));
                }
                resolvedMods[id] = mod;
            });

            const connections = (pData.connections || []).map(parseConn).filter(Boolean);
            parsedPages[pageId] = {
                name: pData.name || '',
                slots: { ...slots },
                modules: resolvedMods,
                connections
            };
        });

        if (!parsedPages["0"]) {
            parsedPages["0"] = { name: '', slots: {}, modules: {}, connections: [] };
        }

        return {
            bpm: patchData.bpm || 120,
            pages: parsedPages
        };
    }

    initDOM() {
        this.gridBoard = document.getElementById('grid-board');
        this.cableCanvas = document.getElementById('cable-canvas');
        this.gridBoard.innerHTML = '';
        for (let i = 0; i < 40; i++) {
            const c = document.createElement('div');
            c.id = `cell-${i}`;
            c.dataset.index = i;
            this.gridBoard.appendChild(c);
        }
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

    getPatchState(mId, pageId = this.currentPageId) {
        const s = new Set();
        const pId = String(pageId);
        const conns = pId === this.currentPageId ? this.connections : (this.pagesData[pId]?.connections || []);
        conns.forEach(c => {
            const connObj = typeof c === 'string' ? parseConn(c) : c;
            if (connObj) {
                if (connObj.to.moduleId === mId) s.add(connObj.to.port);
                if (connObj.from.moduleId === mId) s.add(connObj.from.port);
            }
        });
        return s;
    }

    persistCurrentPage() {
        const curId = String(this.currentPageId);
        const slots = {};
        Object.entries(this.modules).forEach(([id, m]) => {
            const slotIdx = m.row * this.COLS + m.col;
            slots[String(slotIdx)] = id;
        });
        const prevName = this.pagesData[curId]?.name || (curId === "0" ? '' : `SUBPATCH ${curId}`);
        this.pagesData[curId] = {
            name: prevName,
            slots,
            modules: this.modules,
            connections: this.connections
        };
    }

    switchPage(pageId, isBackAction = false) {
        const targetId = String(pageId);
        if (this.currentPageId === targetId) return;

        this.persistCurrentPage();

        if (isBackAction) {
            // Already popped from pageStack
        } else {
            if (this.currentPageId !== targetId) {
                if (!this.pageStack) this.pageStack = [];
                this.pageStack.push(this.currentPageId);
            }
        }

        if (targetId === "0") {
            this.pageStack = [];
        }

        this.currentPageId = targetId;

        if (!this.pagesData[targetId]) {
            const ioMod = {
                type: 'SUB_IO',
                id: 'SUB_IO1',
                col: 2,
                row: 0
            };
            this.pagesData[targetId] = {
                name: `SUBPATCH ${targetId}`,
                slots: { "2": "SUB_IO1" },
                modules: { "SUB_IO1": ioMod },
                connections: []
            };
            this.synth.addModule(`${targetId}/SUB_IO1`, 'SUB_IO', ioMod, this.getPatchState('SUB_IO1', targetId));
        }

        const targetData = this.pagesData[targetId];
        this.modules = targetData.modules || {};
        this.connections = targetData.connections || [];
        this.selectedModuleIds = [];
        this.selectedTargetForConnection = null;

        this.syncGridMap();
        this.updateAllCells();
        this.renderCables();
        this.updatePageNavUI();

        const pName = this.pagesData[targetId]?.name;
        this.showToast(targetId === "0" ? 'MAIN' : (pName || `SUBPATCH ${targetId}`));
    }

    updatePageNavUI() {
        const curId = String(this.currentPageId);
        const isMain = curId === "0";
        const backBtn = document.getElementById('page-nav-back-btn');
        const titleEl = document.getElementById('page-nav-title');
        const renameBtn = document.getElementById('page-nav-rename-btn');
        const saveBtn = document.getElementById('page-nav-save-btn');

        if (backBtn) {
            backBtn.style.display = isMain ? 'none' : 'inline-flex';
            backBtn.classList.toggle('hidden', isMain);
            if (!isMain) {
                const parentId = (this.pageStack && this.pageStack.length > 0) ? this.pageStack[this.pageStack.length - 1] : "0";
                const parentName = parentId === "0" ? "MAIN" : (this.pagesData[parentId]?.name || `SUB ${parentId}`);
                backBtn.innerHTML = `<i data-lucide="arrow-left" class="w-3 h-3"></i><span>${parentName}</span>`;
            }
        }
        if (renameBtn) {
            renameBtn.style.display = isMain ? 'none' : 'inline-flex';
            renameBtn.classList.toggle('hidden', isMain);
        }
        if (saveBtn) {
            saveBtn.style.display = isMain ? 'none' : 'inline-flex';
            saveBtn.classList.toggle('hidden', isMain);
        }
        if (titleEl) {
            const curName = this.pagesData[curId]?.name;
            if (isMain) {
                titleEl.innerHTML = `<span>MAIN</span>`;
                titleEl.className = "text-[10px] font-bold text-slate-200 uppercase tracking-widest select-none";
                titleEl.title = "";
            } else {
                const displayName = curName || `SUBPATCH ${curId}`;
                titleEl.innerHTML = `<span class="cursor-pointer hover:text-emerald-300 transition underline decoration-dotted decoration-emerald-500/60 underline-offset-2">${displayName}</span>`;
                titleEl.className = "text-[10px] font-bold text-emerald-400 uppercase tracking-wider cursor-pointer flex items-center";
                titleEl.title = "クリックしてサブパッチ名を変更";
            }
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    saveHistory() {
        this.historyStack.push({
            pageId: this.currentPageId,
            pagesData: safeClone(this.pagesData),
            modules: safeClone(this.modules),
            connections: safeClone(this.connections)
        });
        if (this.historyStack.length > 10) this.historyStack.shift();
        document.getElementById('undo-btn')?.removeAttribute('disabled');
        document.getElementById('undo-btn')?.classList.remove('opacity-40', 'cursor-not-allowed');
    }

    undo() {
        if (!this.historyStack.length) return;
        const prev = this.historyStack.pop();
        this.currentPageId = prev.pageId || "0";
        this.pagesData = prev.pagesData || { "0": { slots: {}, modules: prev.modules, connections: prev.connections } };
        this.modules = prev.modules;
        this.connections = prev.connections;
        this.syncGridMap();
        this.synth.rebuildAll(this.pagesData, (p, id) => this.getPatchState(id, p));
        this.updateAllCells();
        this.renderCables();
        this.updatePageNavUI();
        if (!this.historyStack.length) {
            document.getElementById('undo-btn')?.setAttribute('disabled', 'true');
            document.getElementById('undo-btn')?.classList.add('opacity-40', 'cursor-not-allowed');
        }
        this.showToast('元に戻しました (UNDO)');
    }

    syncGridMap() {
        this.gridMap.fill(null);
        Object.entries(this.modules).forEach(([id, m]) => {
            const idx = m.row * this.COLS + m.col;
            if (idx >= 0 && idx < 40) this.gridMap[idx] = id;
        });
    }

    updatePortHighlight() {
        document.querySelectorAll('.port').forEach(el => el.classList.remove('port-selected'));
        if (this.selectedModuleIds.length > 0) {
            this.selectedTargetForConnection = null;
            return;
        }
        if (this.selectedTargetForConnection) {
            const { moduleId, port } = this.selectedTargetForConnection;
            const el = document.querySelector(`[data-module-id="${moduleId}"][data-port="${port}"]`);
            if (el) el.classList.add('port-selected');
        }
    }

    updateSelectionClasses() {
        this.gridBoard?.classList.toggle('has-selected-module', this.selectedModuleIds.length > 0);
        for (let i = 0; i < 40; i++) {
            const cell = document.getElementById(`cell-${i}`);
            if (!cell) continue;
            const mId = this.gridMap[i];
            if (mId) {
                cell.classList.toggle('selected-module', this.selectedModuleIds.includes(mId));
            }
        }
        this.updatePortHighlight();
    }

    getSubActivePorts(m) {
        if (!m || m.type !== 'SUB') return null;
        const targetPage = String(m.targetPage ?? 1);
        const active = new Set();
        const subConns = (this.currentPageId === targetPage) ? this.connections : (this.pagesData[targetPage]?.connections || []);
        subConns.forEach(c => {
            const o = typeof c === 'string' ? parseConn(c) : c;
            if (o) {
                if (o.from.moduleId.startsWith('SUB_IO')) active.add(o.from.port);
                if (o.to.moduleId.startsWith('SUB_IO')) active.add(o.to.port);
            }
        });
        return active;
    }

    cleanupOrphanSubConnections(subPageId = null) {
        const pId = String(subPageId ?? this.currentPageId);
        if (pId === "0") return;

        if (this.currentPageId === pId) {
            this.persistCurrentPage();
        }

        const subConns = (pId === this.currentPageId) ? this.connections : (this.pagesData[pId]?.connections || []);
        const activeIOPorts = new Set();
        subConns.forEach(c => {
            const o = typeof c === 'string' ? parseConn(c) : c;
            if (o) {
                if (o.from.moduleId.startsWith('SUB_IO')) activeIOPorts.add(o.from.port);
                if (o.to.moduleId.startsWith('SUB_IO')) activeIOPorts.add(o.to.port);
            }
        });

        Object.entries(this.pagesData).forEach(([parentPId, pData]) => {
            if (parentPId === pId || !pData?.modules) return;
            const subMods = Object.entries(pData.modules).filter(([_, mod]) => mod.type === 'SUB' && String(mod.targetPage ?? 1) === pId);
            if (!subMods.length) return;

            let parentConns = (parentPId === this.currentPageId) ? this.connections : (pData.connections || []);
            const orphanConns = [];

            parentConns.forEach(c => {
                const o = typeof c === 'string' ? parseConn(c) : c;
                if (!o) return;
                for (const [subModId, _] of subMods) {
                    if (o.from.moduleId === subModId && !activeIOPorts.has(o.from.port)) {
                        orphanConns.push(c);
                        break;
                    }
                    if (o.to.moduleId === subModId && !activeIOPorts.has(o.to.port)) {
                        orphanConns.push(c);
                        break;
                    }
                }
            });

            if (orphanConns.length > 0) {
                orphanConns.forEach(c => {
                    const o = typeof c === 'string' ? parseConn(c) : c;
                    if (o) {
                        this.synth.disconnect(`${parentPId}/${o.from.moduleId}`, o.from.port, `${parentPId}/${o.to.moduleId}`, o.to.port);
                    }
                });

                const remaining = parentConns.filter(c => !orphanConns.includes(c));
                if (parentPId === this.currentPageId) {
                    this.connections = remaining;
                    this.renderCables();
                    this.updateAllCells();
                }
                pData.connections = remaining;
            }
        });
    }

    getConnectedPortColor(mId, portName, m) {
        const isSub = m?.type === 'SUB';
        const isSubIO = m?.type === 'SUB_IO';
        if (!isSub && !isSubIO) return 'bg-slate-500';

        const findColorInConns = (conns, modId, targetModMap) => {
            for (const c of conns) {
                const o = typeof c === 'string' ? parseConn(c) : c;
                if (!o) continue;
                let other = null;
                if (o.from.moduleId === modId && o.from.port === portName) {
                    other = o.to;
                } else if (o.to.moduleId === modId && o.to.port === portName) {
                    other = o.from;
                }
                if (other) {
                    const otherMod = targetModMap[other.moduleId];
                    if (otherMod) {
                        const reg = MODULE_REGISTRY[otherMod.type];
                        if (reg) {
                            const otherPorts = reg.ports(otherMod);
                            const match = [...(otherPorts.in || []), ...(otherPorts.out || [])].find(p => p.port === other.port);
                            if (match && match.color && match.color !== 'bg-slate-500') return match.color;
                        }
                    }
                    const pLower = other.port.toLowerCase();
                    if (pLower.includes('gate') || pLower.includes('trig') || pLower === 'reset') return 'bg-orange-500';
                    if (pLower.includes('cv') || pLower.includes('pitch') || pLower === 'a' || pLower === 'b' || pLower.startsWith('time') || pLower.startsWith('fold') || pLower.startsWith('in')) return 'bg-yellow-400';
                    if (pLower.includes('wave') || pLower.startsWith('out')) return 'bg-blue-500';
                }
            }
            return null;
        };

        if (isSub) {
            const p0Conns = this.currentPageId === "0" ? this.connections : (this.pagesData["0"]?.connections || []);
            const p0Mods = this.currentPageId === "0" ? this.modules : (this.pagesData["0"]?.modules || {});
            const c0 = findColorInConns(p0Conns, mId, p0Mods);
            if (c0) return c0;

            const targetPage = String(m?.targetPage ?? 1);
            const subConns = this.currentPageId === targetPage ? this.connections : (this.pagesData[targetPage]?.connections || []);
            const subMods = this.currentPageId === targetPage ? this.modules : (this.pagesData[targetPage]?.modules || {});
            const ioModId = Object.keys(subMods).find(k => subMods[k].type === 'SUB_IO') || 'SUB_IO1';
            const cSub = findColorInConns(subConns, ioModId, subMods);
            if (cSub) return cSub;
        } else if (isSubIO) {
            const curConns = this.connections;
            const curMods = this.modules;
            const cCur = findColorInConns(curConns, mId, curMods);
            if (cCur) return cCur;

            const p0Conns = this.pagesData["0"]?.connections || [];
            const p0Mods = this.pagesData["0"]?.modules || {};
            const subModEntry = Object.entries(p0Mods).find(([_, mod]) => mod.type === 'SUB' && String(mod.targetPage ?? 1) === this.currentPageId);
            if (subModEntry) {
                const c0 = findColorInConns(p0Conns, subModEntry[0], p0Mods);
                if (c0) return c0;
            }
        }

        return 'bg-slate-500';
    }

    renderCell(idx) {
        const cell = document.getElementById(`cell-${idx}`);
        if (!cell) return;
        const mId = this.gridMap[idx], m = mId ? this.modules[mId] : null;
        cell.className = `grid-cell relative aspect-square border transition-all select-none overflow-hidden touch-none ${m ? `border-slate-600 bg-white/10 backdrop-blur-sm shadow-md shadow-black/50 ${this.selectedModuleIds.includes(mId)?'selected-module':''}` : 'border-dashed border-slate-700/50 cursor-pointer empty-cell'}`;
        if (m) {
            cell.dataset.renderedState = 'module';
            const reg = MODULE_REGISTRY[m.type];
            if (!reg) return;
            const ctx = {
                id: mId,
                patched: this.getPatchState(mId),
                bpm: this.synth.masterBPM,
                subActivePorts: m.type === 'SUB' ? this.getSubActivePorts(m) : null,
                getPortColor: (portName) => this.getConnectedPortColor(mId, portName, m),
                pageName: this.pagesData[this.currentPageId]?.name || '',
                pagesData: this.pagesData
            };
            const ports = reg.ports(m, ctx);
            const renderP = (arr) => arr.map(p => {
                const isSel = !this.selectedModuleIds.length && this.selectedTargetForConnection && this.selectedTargetForConnection.moduleId === mId && this.selectedTargetForConnection.port === p.port;
                const portEl = `<div class="w-2 h-2 rounded-full ${p.color} border border-slate-950/90 shadow-sm shadow-black/60 port cursor-pointer hover:scale-150 transition relative z-10 flex items-center justify-center before:absolute before:inset-[-4px] ${isSel ? 'port-selected' : ''}" data-module-id="${mId}" data-port="${p.port}"></div>`;
                if (p.badgeColor) {
                    return `<div class="relative inline-flex items-center justify-center"><span class="absolute -top-[1.5px] -left-[1.5px] w-[3.5px] h-[3.5px] rounded-full ${p.badgeColor} pointer-events-none z-0 ring-[0.5px] ring-black/70"></span>${portEl}</div>`;
                }
                return portEl;
            }).join('');

            const portsHTML = reg.renderPorts ? reg.renderPorts(m, renderP, ports) : `
                <div class="absolute bottom-[2px] left-[2px] right-[2px] flex justify-between items-end pointer-events-none z-10 px-0.5">
                    <div class="flex items-center gap-1.5 pointer-events-auto">${renderP(ports.in||[])}</div>
                    <div class="flex items-center gap-1.5 pointer-events-auto">${renderP(ports.out||[])}</div>
                </div>`;

            let titleHTML = '';
            if (m.type !== 'SCOPE') {
                if (m.type === 'SUB') {
                    const target = m.targetPage ?? 1;
                    const targetName = ctx?.pagesData ? ctx.pagesData[String(target)]?.name : null;
                    const displayName = targetName || `SUBPATCH ${target}`;
                    titleHTML = `
                        <div class="absolute top-[2px] left-0 right-0 px-1 flex justify-center items-center pointer-events-none z-20">
                            <span class="w-full text-center font-bold text-[7.5px] tracking-tight text-white truncate select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">${displayName}</span>
                        </div>`;
                } else if (m.type === 'SUB_IO') {
                    const displayName = ctx?.pageName || `SUBPATCH ${this.currentPageId}`;
                    titleHTML = `
                        <div class="absolute top-[2px] left-0 right-0 px-1 flex justify-center items-center pointer-events-none z-20">
                            <span class="w-full text-center font-bold text-[7.5px] tracking-tight text-white truncate select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">${displayName}</span>
                        </div>`;
                } else {
                    titleHTML = `
                        <div class="absolute top-[2px] left-[2px] right-[2px] flex justify-center items-center pointer-events-none z-20">
                            <span class="font-bold text-[8px] tracking-wider text-black select-none truncate">${m.type}</span>
                        </div>`;
                }
            }
            cell.innerHTML = `
                ${titleHTML}
                <div class="absolute inset-0 flex flex-col items-center justify-center module-body cursor-pointer p-1 z-0" data-module-id="${mId}">${reg.renderGrid(m, ctx)}</div>
                ${portsHTML}`;
        } else {
            if (cell.dataset.renderedState !== 'empty') {
                cell.dataset.renderedState = 'empty';
                cell.innerHTML = `<div class="absolute inset-0 flex items-center justify-center font-bold text-sm text-black opacity-20 pointer-events-none">${String(idx).padStart(2, '0')}</div>`;
            }
        }
    }

    updateAllCells() {
        this.gridBoard?.classList.toggle('has-selected-module', this.selectedModuleIds.length > 0);
        for (let i = 0; i < 40; i++) this.renderCell(i);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        this.updatePortHighlight();
    }

    renderCables() {
        if (!this.cableCanvas) return;
        this.cableCanvas.innerHTML = '';
        const cr = this.cableCanvas.getBoundingClientRect();
        this.connections.forEach(conn => {
            const fEl = document.querySelector(`[data-module-id="${conn.from.moduleId}"][data-port="${conn.from.port}"]`);
            const tEl = document.querySelector(`[data-module-id="${conn.to.moduleId}"][data-port="${conn.to.port}"]`);
            if (!fEl || !tEl) return;
            const r1 = fEl.getBoundingClientRect(), r2 = tEl.getBoundingClientRect();
            const x1 = r1.left + r1.width/2 - cr.left, y1 = r1.top + r1.height/2 - cr.top;
            const x2 = r2.left + r2.width/2 - cr.left, y2 = r2.top + r2.height/2 - cr.top;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const curveY = Math.max(Math.sqrt((x2-x1)**2 + (y2-y1)**2) * 0.4, 15);
            path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + curveY}, ${x2} ${y2 + curveY}, ${x2} ${y2}`);

            let strokeColor = '#38bdf8';
            const p = conn.to.port.toLowerCase();
            const fp = conn.from.port.toLowerCase();
            if (p.includes('gate') || fp.includes('gate')) {
                strokeColor = (p.includes('gate_in') && conn.to.moduleId.startsWith('SEQ')) || (fp.includes('gate_out') && conn.from.moduleId.startsWith('CLK')) ? '#f43f5e' : '#f59e0b';
            } else if (p.includes('trig') || fp.includes('trig')) {
                strokeColor = '#f59e0b';
            } else if (p.includes('cv') || fp.includes('cv') || p === 'a' || p === 'b' || p.startsWith('in')) {
                strokeColor = '#eab308';
            }

            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '4');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            this.cableCanvas.appendChild(path);
        });
    }

    handlePortTap(mId, pName) {
        const cur = { moduleId: mId, port: pName };
        if (!this.selectedTargetForConnection) {
            this.selectedTargetForConnection = cur;
            this.updatePortHighlight();
            this.showToast(`[${mId}:${pName}] 接続先をタップしてください`);
        } else {
            const first = this.selectedTargetForConnection;
            if (first.moduleId === cur.moduleId && first.port === cur.port) {
                this.selectedTargetForConnection = null;
                this.updatePortHighlight();
                this.showToast('接続をキャンセルしました');
                return;
            }
            if (first.moduleId === cur.moduleId) {
                this.showToast('同モジュール間は接続不可');
            } else {
                const m1 = this.modules[first.moduleId], m2 = this.modules[cur.moduleId];
                const isSub1 = m1?.type === 'SUB' || m1?.type === 'SUB_IO';
                const isSub2 = m2?.type === 'SUB' || m2?.type === 'SUB_IO';
                const isOut = (m, p) => {
                    if (!m) return false;
                    const ctx = {
                        id: m.id,
                        subActivePorts: m.type === 'SUB' ? this.getSubActivePorts(m) : null,
                        getPortColor: (pName) => this.getConnectedPortColor(m.id, pName, m)
                    };
                    return MODULE_REGISTRY[m?.type]?.ports(m, ctx)?.out?.some(x => x.port === p);
                };

                let src = null, dst = null;
                if (isSub1 && isSub2) {
                    src = first;
                    dst = cur;
                } else if (isSub1) {
                    const m2Out = isOut(m2, cur.port);
                    if (m2Out) {
                        src = cur;
                        dst = first;
                    } else {
                        src = first;
                        dst = cur;
                    }
                } else if (isSub2) {
                    const m1Out = isOut(m1, first.port);
                    if (m1Out) {
                        src = first;
                        dst = cur;
                    } else {
                        src = cur;
                        dst = first;
                    }
                } else {
                    const o1 = isOut(m1, first.port), o2 = isOut(m2, cur.port);
                    if (o1 === o2) {
                        this.showToast('IN同士/OUT同士は接続不可');
                        this.selectedTargetForConnection = null;
                        this.updatePortHighlight();
                        return;
                    }
                    src = o1 ? first : cur;
                    dst = o1 ? cur : first;
                }

                const cand = { from: src, to: dst };
                if (this.connections.some(c => isSameConn(c, cand))) {
                    this.showToast('既に接続されています');
                } else {
                    this.saveHistory();
                    this.connections.push(cand);
                    this.synth.connect(`${this.currentPageId}/${src.moduleId}`, src.port, `${this.currentPageId}/${dst.moduleId}`, dst.port);
                    this.synth.updateModule(`${this.currentPageId}/${src.moduleId}`, this.modules[src.moduleId], this.getPatchState(src.moduleId));
                    this.synth.updateModule(`${this.currentPageId}/${dst.moduleId}`, this.modules[dst.moduleId], this.getPatchState(dst.moduleId));
                    this.persistCurrentPage();
                    this.cleanupOrphanSubConnections(this.currentPageId);
                    this.updateAllCells();
                    this.renderCables();
                    this.showToast('結線しました');
                }
            }
            this.selectedTargetForConnection = null;
            this.updatePortHighlight();
        }
    }

    openModal(idx, title, widthCls, renderFn) {
        const modal = document.getElementById('shared-modal'), content = document.getElementById('modal-content');
        content.className = `absolute bg-slate-900/95 border border-slate-700 rounded-xl ${widthCls} p-2 shadow-2xl backdrop-blur-md`;
        document.getElementById('modal-title').textContent = title;
        renderFn(document.getElementById('modal-body'));
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            const cell = document.getElementById(`cell-${idx}`), frame = document.getElementById('phone-frame');
            if (!cell || !frame) return;
            const cR = cell.getBoundingClientRect(), fR = frame.getBoundingClientRect(), pR = content.getBoundingClientRect();
            if (title === 'ADD MODULE') {
                content.style.left = '8px';
                content.style.right = '8px';
                content.style.margin = '0 auto';
                content.style.top = `${Math.max(6, Math.min(fR.height - pR.height - 6, cR.top - fR.top - pR.height - 8))}px`;
            } else {
                content.style.right = 'auto';
                content.style.margin = '0';
                content.style.left = `${Math.max(6, Math.min(fR.width - pR.width - 6, (cR.left - fR.left) + cR.width/2 - pR.width/2))}px`;
                content.style.top = `${Math.max(6, Math.min(fR.height - pR.height - 6, cR.top - fR.top - pR.height - 8))}px`;
            }
        });
    }

    openSettingsModal(mId) {
        const m = this.modules[mId];
        if (!m || m.type === 'SUB_IO') return;
        if (['KEY', 'SEQ', 'PAT'].includes(m.type)) {
            this.openDockModal(mId);
            return;
        }
        this.activePopupModuleId = mId;
        const isMedium = ['CHORD', 'FOLD', 'MATH', 'MATH1', 'MATH2', 'CVDELAY', 'LFO'].includes(m.type);
        const isVco = m.type === 'VCO';
        const isClk = m.type === 'CLK';
        const isScope = m.type === 'SCOPE';
        const isSub = m.type === 'SUB';
        const isAdsr = m.type === 'ADSR';
        const widthCls = isAdsr ? 'w-[290px]' : (isScope ? 'w-[200px]' : (isVco || isSub ? 'w-[200px]' : (isClk ? 'w-[190px]' : (isMedium ? 'w-[230px]' : 'w-[150px]'))));
        this.openModal(m.row * this.COLS + m.col, m.type, widthCls, () => this.reRenderModal());
    }

    openDockModal(mId) {
        const m = this.modules[mId];
        if (!m) return;
        this.activeDockModuleId = mId;
        const modal = document.getElementById('dock-modal'), content = document.getElementById('dock-content');
        const title = document.getElementById('dock-title'), icon = document.getElementById('dock-icon');
        const frame = document.getElementById('phone-frame');
        if (title) title.textContent = m.type === 'KEY' ? 'KEYBOARD' : (m.type === 'PAT' ? 'STRUDEL PATTERN' : 'SEQUENCER');
        if (icon) icon.setAttribute('data-lucide', m.type === 'KEY' ? 'music' : (m.type === 'PAT' ? 'code' : 'sliders'));
        modal?.classList.remove('hidden');
        this.reRenderDockModal();
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (content && frame) {
            content.style.bottom = 'auto';
            content.style.left = '8px';
            content.style.right = '8px';
            content.style.margin = '0 auto';
            requestAnimationFrame(() => {
                const fR = frame.getBoundingClientRect(), cR = content.getBoundingClientRect();
                content.style.top = `${Math.max(10, fR.height - cR.height - 46)}px`;
            });
        }
    }

    closeDockModal() {
        const modal = document.getElementById('dock-modal');
        modal?.classList.add('hidden');
        this.activeDockModuleId = null;
        this.setDockLock(false);
        const content = document.getElementById('dock-content');
        if (content) {
            content.style.top = '';
            content.style.bottom = '';
        }
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

    rebuildModule(id) {
        const m = this.modules[id];
        if (!m) return;
        const fullId = `${this.currentPageId}/${id}`;
        this.synth.addModule(fullId, m.type, m, this.getPatchState(id));
        this.connections
            .filter(c => c.from.moduleId === id || c.to.moduleId === id)
            .forEach(c => this.synth.connect(`${this.currentPageId}/${c.from.moduleId}`, c.from.port, `${this.currentPageId}/${c.to.moduleId}`, c.to.port));
        this.renderCables();
    }

    reRenderDockModal() {
        const id = this.activeDockModuleId, m = this.modules[id];
        if (!m) return;
        const reg = MODULE_REGISTRY[m.type], b = document.getElementById('dock-body');
        if (!reg || !b) return;
        b.className = "text-xs mt-1";
        const ctx = {
            id, patched: this.getPatchState(id),
            bpm: this.synth.masterBPM,
            reRenderModal: () => {
                this.reRenderDockModal();
                const content = document.getElementById('dock-content'), frame = document.getElementById('phone-frame');
                if (content && frame) {
                    requestAnimationFrame(() => {
                        const fR = frame.getBoundingClientRect(), cR = content.getBoundingClientRect();
                        const maxTop = fR.height - cR.height - 46;
                        const curTop = parseFloat(content.style.top) || maxTop;
                        content.style.top = `${Math.max(10, Math.min(curTop, maxTop))}px`;
                    });
                }
            },
            rebuildModule: () => this.rebuildModule(id),
            removeConnectionsForPort: (p) => this.removeConnectionsForPort(id, p),
            sendKeyNote: (midi, isDown) => this.synth.setKeyNote(id, midi, isDown),
            triggerManualSample: () => this.synth.triggerManualSample(id),
            prompt: (t, init) => this.openCustomPrompt(t, init),
            openSubpage: (pId) => this.switchPage(pId),
            saveSubpatchToLibrary: (name) => this.saveCurrentSubpatchToLibrary(name),
            getPageName: () => this.pagesData[this.currentPageId]?.name || `SUBPATCH ${this.currentPageId}`,
            setPageName: (name) => {
                if (!this.pagesData[this.currentPageId]) this.pagesData[this.currentPageId] = { slots: {}, modules: {}, connections: [] };
                this.pagesData[this.currentPageId].name = name;
                this.updatePageNavUI();
                this.updateAllCells();
                this.showToast(`サブパッチ名を「${name}」に変更しました`);
            },
            pagesData: this.pagesData
        };
        const onChange = () => {
            this.synth.updateModule(`${this.currentPageId}/${id}`, m, this.getPatchState(id));
            this.renderCell(m.row * this.COLS + m.col);
        };
        if (reg.renderModal) b.innerHTML = reg.renderModal(m, ctx);
        else if (reg.schema) b.innerHTML = UIHelpers.renderSchemaModal(m, ctx, reg.schema);
        if (reg.bindEvents) reg.bindEvents(m, ctx, onChange);
        else if (reg.schema) UIHelpers.bindSchemaEvents(m, ctx, reg.schema, onChange);
    }

    removeConnectionsForPort(mId, port) {
        const toRemove = this.connections.filter(c => (c.to.moduleId===mId && c.to.port===port) || (c.from.moduleId===mId && c.from.port===port));
        toRemove.forEach(c => this.synth.disconnect(`${this.currentPageId}/${c.from.moduleId}`, c.from.port, `${this.currentPageId}/${c.to.moduleId}`, c.to.port));
        this.connections = this.connections.filter(c => !((c.to.moduleId===mId && c.to.port===port) || (c.from.moduleId===mId && c.from.port===port)));
        this.persistCurrentPage();
        this.cleanupOrphanSubConnections(this.currentPageId);
        this.renderCables();
        this.updateAllCells();
    }

    async destroyModule(pageId, moduleId) {
        const pId = String(pageId ?? this.currentPageId);
        let mod = null;
        const pData = this.pagesData[pId];

        if (pId === this.currentPageId) {
            mod = this.modules[moduleId];
        } else {
            mod = pData?.modules?.[moduleId];
        }
        if (!mod) return false;

        // 1. Disconnect and remove all connections attached to this module
        if (pId === this.currentPageId) {
            const toRemove = this.connections.filter(c => c.from.moduleId === moduleId || c.to.moduleId === moduleId);
            toRemove.forEach(c => {
                this.synth.disconnect(`${pId}/${c.from.moduleId}`, c.from.port, `${pId}/${c.to.moduleId}`, c.to.port);
            });
            this.connections = this.connections.filter(c => c.from.moduleId !== moduleId && c.to.moduleId !== moduleId);
            if (pData) pData.connections = this.connections;
        } else if (pData) {
            const conns = pData.connections || [];
            const toRemove = conns.filter(c => c.from.moduleId === moduleId || c.to.moduleId === moduleId);
            toRemove.forEach(c => {
                this.synth.disconnect(`${pId}/${c.from.moduleId}`, c.from.port, `${pId}/${c.to.moduleId}`, c.to.port);
            });
            pData.connections = conns.filter(c => c.from.moduleId !== moduleId && c.to.moduleId !== moduleId);
        }

        this.cleanupOrphanSubConnections(pId);

        // 2. Module-specific lifecycle teardown (SUB cleans up its subordinate subpage & modules)
        const reg = MODULE_REGISTRY[mod.type];
        if (reg?.onDestroy) {
            await reg.onDestroy(mod, {
                pageId: pId,
                destroyModule: async (childPId, childMId) => await this.destroyModule(childPId, childMId),
                destroyPage: (targetPId) => this.destroyPage(targetPId),
                pagesData: this.pagesData
            });
        }

        // 3. Remove Web Audio Engine node
        this.synth.removeModule(`${pId}/${moduleId}`);

        // 4. Remove module from data structures
        if (pId === this.currentPageId) {
            delete this.modules[moduleId];
            this.syncGridMap();
            if (pData?.modules) delete pData.modules[moduleId];
        } else if (pData?.modules) {
            delete pData.modules[moduleId];
            if (pData.slots) {
                Object.entries(pData.slots).forEach(([slotIdx, mId]) => {
                    if (mId === moduleId) delete pData.slots[slotIdx];
                });
            }
        }

        this._destroyCount = (this._destroyCount || 0) + 1;
        return true;
    }

    destroyPage(targetPageId) {
        const pId = String(targetPageId);
        if (pId === "0") return; // Page 0 (MAIN) cannot be destroyed

        // If the user was viewing this destroyed page, navigate back to Page 0 safely
        if (this.currentPageId === pId) {
            this.currentPageId = "0";
            const mainPage = this.pagesData["0"] || { slots: {}, modules: {}, connections: [] };
            this.modules = mainPage.modules || {};
            this.connections = mainPage.connections || [];
            this.syncGridMap();
            this.updatePageNavUI();
            this.updateAllCells();
            this.renderCables();
        }

        // Completely delete subpage container from memory
        delete this.pagesData[pId];
    }

    reRenderModal() {
        const id = this.activePopupModuleId, m = this.modules[id];
        if (!m) return;
        const reg = MODULE_REGISTRY[m.type], b = document.getElementById('modal-body');
        if (!reg || !b) return;
        b.className = "text-xs mt-1";
        const ctx = {
            id, patched: this.getPatchState(id),
            bpm: this.synth.masterBPM,
            reRenderModal: () => this.reRenderModal(),
            rebuildModule: () => this.rebuildModule(id),
            removeConnectionsForPort: (p) => this.removeConnectionsForPort(id, p),
            sendKeyNote: (midi, isDown) => this.synth.setKeyNote(id, midi, isDown),
            triggerManualSample: () => this.synth.triggerManualSample(id),
            prompt: (t, init) => this.openCustomPrompt(t, init),
            openSubpage: (pId) => this.switchPage(pId),
            saveSubpatchToLibrary: (name) => this.saveCurrentSubpatchToLibrary(name),
            getPageName: () => this.pagesData[this.currentPageId]?.name || `SUBPATCH ${this.currentPageId}`,
            setPageName: (name) => {
                if (!this.pagesData[this.currentPageId]) this.pagesData[this.currentPageId] = { slots: {}, modules: {}, connections: [] };
                this.pagesData[this.currentPageId].name = name;
                this.updatePageNavUI();
                this.updateAllCells();
                this.showToast(`サブパッチ名を「${name}」に変更しました`);
            },
            pagesData: this.pagesData
        };
        const onChange = () => {
            this.synth.updateModule(`${this.currentPageId}/${id}`, m, this.getPatchState(id));
            this.renderCell(m.row * this.COLS + m.col);
        };

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

    getUserSubpatches() {
        return this.userSubpatches || {};
    }

    saveUserSubpatch(template, isOverwrite = false) {
        if (!this.userSubpatches) this.userSubpatches = {};
        this.userSubpatches[template.id] = template;
        localStorage.setItem('gridsynth_user_subpatches', JSON.stringify(this.userSubpatches));
        if (isOverwrite) {
            this.showToast(`サブパッチ「${template.name}」を上書き保存しました`);
        } else {
            this.showToast(`サブパッチ「${template.name}」をライブラリに保存しました`);
        }
    }

    deleteUserSubpatch(id) {
        if (this.userSubpatches && this.userSubpatches[id]) {
            const name = this.userSubpatches[id].name;
            delete this.userSubpatches[id];
            localStorage.setItem('gridsynth_user_subpatches', JSON.stringify(this.userSubpatches));
            this.showToast(`サブパッチ「${name}」を削除しました`);
            return true;
        }
        return false;
    }

    saveCurrentSubpatchToLibrary(customName) {
        if (this.currentPageId === "0") {
            this.showToast("メインページはサブパッチとして保存できません");
            return;
        }
        this.persistCurrentPage();
        const pData = this.pagesData[this.currentPageId];
        if (!pData) return;
        const name = (customName || pData.name || `SUBPATCH ${this.currentPageId}`).trim();
        if (!name) return;

        // Check for existing user subpatch with the same name (case-insensitive)
        const userSubs = this.getUserSubpatches();
        const existingEntry = Object.values(userSubs).find(s => s && s.name && s.name.trim().toLowerCase() === name.toLowerCase());

        const id = existingEntry ? existingEntry.id : `USER_SUB_${Date.now()}`;
        const isOverwrite = !!existingEntry;

        const template = {
            id,
            name,
            category: 'User Custom',
            isSystem: false,
            description: `${Object.keys(pData.modules || {}).length} modules`,
            pins: {},
            pageData: safeClone(pData)
        };
        template.pageData.name = name;
        this.saveUserSubpatch(template, isOverwrite);
    }

    instantiateSubpatch(subpatchId, slotIdx) {
        const template = FACTORY_SUBPATCHES[subpatchId] || (this.userSubpatches && this.userSubpatches[subpatchId]);
        if (!template) {
            return { success: false, error: `Subpatch template '${subpatchId}' not found` };
        }
        const depth = this.getNestingDepth(this.currentPageId);
        if (depth >= 3) {
            this.showToast("サブパッチの最大階層（3階層）に達したためこれ以上ネストできません");
            return { success: false, error: "Max subpatch nesting depth (3) reached" };
        }

        this.saveHistory();
        const existingPageIds = new Set(Object.keys(this.pagesData));
        Object.values(this.pagesData).forEach(p => {
            Object.values(p.modules || {}).forEach(m => {
                if (m && m.type === 'SUB' && m.targetPage) existingPageIds.add(String(m.targetPage));
            });
        });
        Object.values(this.modules).forEach(m => {
            if (m && m.type === 'SUB' && m.targetPage) existingPageIds.add(String(m.targetPage));
        });
        let newPageNum = 1;
        while (existingPageIds.has(String(newPageNum))) newPageNum++;
        const newPageId = String(newPageNum);

        // Normalize template pageData through parsePatch ensuring all module defaults and connection objects are identical to standard SUB
        const normalized = UIController.parsePatch({ pages: { "0": template.pageData } }, this.COLS);
        const clonedPageData = normalized.pages["0"];
        clonedPageData.name = template.name;
        this.pagesData[newPageId] = clonedPageData;

        const newId = generateModuleId('SUB', this.modules);
        const subMod = {
            type: 'SUB',
            id: newId,
            col: slotIdx % this.COLS,
            row: Math.floor(slotIdx / this.COLS),
            targetPage: newPageNum
        };
        this.modules[newId] = subMod;
        this.syncGridMap();

        // Incrementally instantiate subpage audio nodes without stopping playback
        Object.entries(clonedPageData.modules || {}).forEach(([mId, m]) => {
            const fullId = `${newPageId}/${mId}`;
            this.synth.addModule(fullId, m.type, m, this.getPatchState(mId, newPageId));
        });

        (clonedPageData.connections || []).forEach(c => {
            this.synth.connect(
                `${newPageId}/${c.from.moduleId}`, c.from.port,
                `${newPageId}/${c.to.moduleId}`, c.to.port
            );
        });

        // Add main SUB module and link bridges
        this.synth.addModule(`${this.currentPageId}/${newId}`, 'SUB', subMod, this.getPatchState(newId));
        this.synth.linkSubBridges();

        this.renderCell(slotIdx);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        this.persistCurrentPage();
        this.showToast(`サブパッチ「${template.name}」を配置しました`);
        return { success: true, page: newPageNum, moduleId: newId, subpatch: template.name };
    }

    openAddModal(slotIdx) {
        this.openModal(slotIdx, 'ADD MODULE', 'w-[calc(100%-16px)] max-w-[420px]', (body) => {
            const isMain = this.currentPageId === "0";
            const depth = this.getNestingDepth(this.currentPageId);
            const allowSub = depth < 3;

            const renderContent = () => {
                const basicTypes = Object.keys(MODULE_REGISTRY).filter(t => {
                    if (t === 'SUB') return false; // Placed under User Subpatch area
                    if (t === 'SUB_IO') return !isMain;
                    return true;
                });

                const userSubs = Object.values(this.getUserSubpatches());
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
                                    <button class="sub-info-btn w-3.5 h-3.5 flex items-center justify-center text-slate-400 hover:text-purple-300 rounded text-[7px] shrink-0 ml-0.5 hover:bg-slate-700/80" data-id="${sub.id}" title="説明">ℹ️</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 3. USER SUBPATCHES & HEADER NEW SUBPATCH BUTTON -->
                    ${allowSub ? `
                    <div class="border-t border-slate-800 pt-1.5 mt-0.5">
                        <div class="text-[8.5px] font-bold text-emerald-300 uppercase tracking-wider mb-1 px-0.5 flex items-center justify-between">
                            <span>USER SUBPATCH</span>
                            <button data-type="SUB" class="h-5 px-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/70 hover:border-emerald-400 text-emerald-300 rounded text-[8px] font-bold transition flex items-center gap-1 shadow-sm">
                                <span>➕ 新規作成</span>
                            </button>
                        </div>
                        ${userSubs.length > 0 ? `
                        <div class="grid grid-cols-4 gap-1 mt-1">
                            ${userSubs.map(sub => `
                                <div class="h-6 bg-slate-800/90 hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-500/80 rounded flex items-center justify-between px-1 transition cursor-pointer user-sub-item select-user-sub" data-id="${sub.id}">
                                    <span class="text-[7.5px] font-bold text-emerald-300 truncate pointer-events-none">${sub.name}</span>
                                    <div class="flex items-center gap-0.5 shrink-0 ml-0.5">
                                        <button class="rename-user-sub-btn w-3.5 h-3.5 flex items-center justify-center bg-slate-900 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-[6.5px]" data-id="${sub.id}" title="リネーム">✏️</button>
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
                    this.saveHistory();
                    const type = btn.dataset.type, d = MODULE_REGISTRY[type].defaults();
                    const newId = generateModuleId(type, this.modules);
                    d.id = newId;
                    d.col = slotIdx % this.COLS;
                    d.row = Math.floor(slotIdx / this.COLS);

                    if (type === 'SUB') {
                        const existingPageIds = new Set(Object.keys(this.pagesData));
                        Object.values(this.pagesData).forEach(p => {
                            Object.values(p.modules || {}).forEach(m => {
                                if (m && m.type === 'SUB' && m.targetPage) existingPageIds.add(String(m.targetPage));
                            });
                        });
                        Object.values(this.modules).forEach(m => {
                            if (m && m.type === 'SUB' && m.targetPage) existingPageIds.add(String(m.targetPage));
                        });
                        let newPageNum = 1;
                        while (existingPageIds.has(String(newPageNum))) newPageNum++;
                        d.targetPage = newPageNum;

                        const newPageId = String(newPageNum);
                        const ioMod = { type: 'SUB_IO', id: 'SUB_IO1', col: 2, row: 0 };
                        this.pagesData[newPageId] = {
                            name: `SUBPATCH ${newPageId}`,
                            slots: { "2": "SUB_IO1" },
                            modules: { "SUB_IO1": ioMod },
                            connections: []
                        };
                        this.synth.addModule(`${newPageId}/SUB_IO1`, 'SUB_IO', ioMod, this.getPatchState('SUB_IO1', newPageId));
                    }

                    this.modules[newId] = d;
                    this.syncGridMap();
                    this.synth.addModule(`${this.currentPageId}/${newId}`, type, d, this.getPatchState(newId));
                    if (type === 'SUB') this.synth.linkSubBridges();

                    document.getElementById('shared-modal')?.classList.add('hidden');
                    this.renderCell(slotIdx);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    this.updatePageNavUI();
                    this.showToast(`${type === 'SUB' ? 'SUBPATCH' : type} を追加しました`);
                }));

                // Factory subpatch click (Direct place)
                body.querySelectorAll('.factory-sub-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.sub-info-btn')) return;
                        const subId = item.dataset.id;
                        this.instantiateSubpatch(subId, slotIdx);
                        document.getElementById('shared-modal')?.classList.add('hidden');
                    });
                });

                // Factory subpatch info button click (Toast description)
                body.querySelectorAll('.sub-info-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = FACTORY_SUBPATCHES[subId] || (this.userSubpatches && this.userSubpatches[subId]);
                        if (sub) {
                            this.showToast(`【${sub.name}】${sub.description || '説明なし'}`, 3000);
                        }
                    });
                });

                // User subpatch click (Direct place)
                body.querySelectorAll('.select-user-sub').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.rename-user-sub-btn') || e.target.closest('.delete-user-sub-btn')) return;
                        const subId = item.dataset.id;
                        this.instantiateSubpatch(subId, slotIdx);
                        document.getElementById('shared-modal')?.classList.add('hidden');
                    });
                });

                // User subpatch rename
                body.querySelectorAll('.rename-user-sub-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = this.userSubpatches[subId];
                        if (!sub) return;
                        const res = await this.openCustomPrompt('RENAME SUBPATCH', sub.name);
                        if (res !== null && res.trim() !== '') {
                            sub.name = res.trim();
                            if (sub.pageData) sub.pageData.name = res.trim();
                            this.saveUserSubpatch(sub);
                            renderContent();
                        }
                    });
                });

                // User subpatch delete
                body.querySelectorAll('.delete-user-sub-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subId = btn.dataset.id;
                        const sub = this.userSubpatches[subId];
                        if (!sub) return;
                        if (confirm(`サブパッチ「${sub.name}」をライブラリから削除しますか？\n（※配置済みのモジュールには影響しません）`)) {
                            this.deleteUserSubpatch(subId);
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
            const md = document.getElementById('custom-prompt-modal'), inp = document.getElementById('prompt-input');
            const backdrop = document.getElementById('prompt-backdrop');
            document.getElementById('prompt-title').querySelector('span').textContent = title;
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

    bindGlobalEvents() {
        document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
        document.getElementById('close-modal-bg')?.addEventListener('click', () => {
            document.getElementById('shared-modal')?.classList.add('hidden');
            this.activePopupModuleId = null;
        });

        document.getElementById('dock-close-btn')?.addEventListener('click', () => this.closeDockModal());
        document.getElementById('dock-backdrop')?.addEventListener('click', () => {
            if (!this.isDockLocked) this.closeDockModal();
        });
        document.getElementById('dock-lock-btn')?.addEventListener('click', () => {
            this.setDockLock(!this.isDockLocked);
        });

        const dH = document.getElementById('dock-header'), dC = document.getElementById('dock-content'), frame = document.getElementById('phone-frame');
        if (dH && dC && frame) {
            let dDrag = false, dX = 0, dY = 0, initL = 0, initT = 0;
            dH.addEventListener('pointerdown', (e) => {
                if (e.target.closest('#dock-lock-btn') || e.target.closest('#dock-close-btn')) return;
                e.preventDefault();
                dDrag = true;
                dH.setPointerCapture(e.pointerId);
                dX = e.clientX;
                dY = e.clientY;
                initL = parseFloat(dC.style.left) || dC.offsetLeft;
                initT = parseFloat(dC.style.top) || dC.offsetTop;
            });
            dH.addEventListener('pointermove', (e) => {
                if (!dDrag) return;
                const fR = frame.getBoundingClientRect(), cR = dC.getBoundingClientRect();
                dC.style.left = `${Math.max(4, Math.min(fR.width - cR.width - 4, initL + e.clientX - dX))}px`;
                dC.style.top = `${Math.max(4, Math.min(fR.height - cR.height - 4, initT + e.clientY - dY))}px`;
            });
            const stopDD = (e) => {
                if (dDrag) {
                    dDrag = false;
                    try { dH.releasePointerCapture(e.pointerId); } catch(err){}
                }
            };
            dH.addEventListener('pointerup', stopDD);
            dH.addEventListener('pointercancel', stopDD);
        }

        const mH = document.getElementById('modal-header'), mC = document.getElementById('modal-content');
        if (mH && mC && frame) {
            let mDrag = false, mX = 0, mY = 0, initL = 0, initT = 0;
            mH.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                mDrag = true;
                mH.setPointerCapture(e.pointerId);
                mX = e.clientX;
                mY = e.clientY;
                initL = parseFloat(mC.style.left) || mC.offsetLeft;
                initT = parseFloat(mC.style.top) || mC.offsetTop;
            });
            mH.addEventListener('pointermove', (e) => {
                if (!mDrag) return;
                const fR = frame.getBoundingClientRect(), cR = mC.getBoundingClientRect();
                mC.style.left = `${Math.max(6, Math.min(fR.width - cR.width - 6, initL + e.clientX - mX))}px`;
                mC.style.top = `${Math.max(6, Math.min(fR.height - cR.height - 6, initT + e.clientY - mY))}px`;
            });
            const stopMD = (e) => {
                if (mDrag) {
                    mDrag = false;
                    try { mH.releasePointerCapture(e.pointerId); } catch(err){}
                }
            };
            mH.addEventListener('pointerup', stopMD);
            mH.addEventListener('pointercancel', stopMD);
        }

        document.getElementById('audio-power-btn')?.addEventListener('click', async () => {
            await this.synth.init();
            const btn = document.getElementById('audio-power-btn');
            if (this.synth.ctx.state === 'running') {
                this.synth.suspend();
                btn.className = "h-7 w-7 bg-slate-900 text-slate-400 rounded-lg border border-slate-700 flex items-center justify-center shrink-0";
                this.showToast('AUDIO STOPPED');
            } else {
                this.synth.resume();
                if (Object.keys(this.synth.modules).length === 0) {
                    this.synth.rebuildAll(this.pagesData, (pId, id) => this.getPatchState(id, pId));
                }
                btn.className = "h-7 w-7 bg-red-950 text-red-400 rounded-lg border border-red-500 shadow-md shadow-red-500/40 flex items-center justify-center shrink-0";
                this.showToast('AUDIO RUNNING');
            }
        });

        document.getElementById('seq-play-btn')?.addEventListener('click', async () => {
            await this.synth.init();
            this.synth.resume();
            if (Object.keys(this.synth.modules).length === 0) {
                this.synth.rebuildAll(this.pagesData, (pId, id) => this.getPatchState(id, pId));
            }
            this.synth.setPlaybackState(true);
            document.getElementById('seq-play-btn').className = "h-7 w-7 bg-red-950 text-red-400 rounded-lg border border-red-500 shadow-md shadow-red-500/40 flex items-center justify-center shrink-0";
        });

        document.getElementById('seq-stop-btn')?.addEventListener('click', () => {
            this.synth.setPlaybackState(false);
            document.getElementById('seq-play-btn').className = "h-7 w-7 bg-slate-900 text-slate-400 rounded-lg border border-slate-700 flex items-center justify-center shrink-0";
        });

        document.getElementById('seq-reset-btn')?.addEventListener('click', () => {
            this.synth.resetSequencers();
            this.showToast('RESET (Step 1)');
        });

        const bpmBox = document.getElementById('master-bpm-container'), bpmDisp = document.getElementById('master-bpm-disp');
        let bpmDrag = false, startY = 0, startBpm = 120;
        bpmBox?.addEventListener('pointerdown', (e) => {
            bpmDrag = true;
            startY = e.clientY;
            startBpm = this.synth.masterBPM || 120;
            bpmBox.setPointerCapture(e.pointerId);
        });
        bpmBox?.addEventListener('pointermove', (e) => {
            if (!bpmDrag) return;
            const delta = Math.round((startY - e.clientY) / 5);
            const n = Math.max(40, Math.min(260, startBpm + delta));
            bpmDisp.textContent = n;
            this.synth.setBPM(n);
            Object.values(this.modules).forEach(m => {
                if (m.type === 'CLK') this.renderCell(m.row * this.COLS + m.col);
            });
            if (this.activePopupModuleId && this.modules[this.activePopupModuleId]?.type === 'CLK') {
                this.reRenderModal();
            }
        });
        const stopBpm = (e) => {
            if (bpmDrag) {
                bpmDrag = false;
                try { bpmBox.releasePointerCapture(e.pointerId); } catch(err){}
            }
        };
        bpmBox?.addEventListener('pointerup', stopBpm);
        bpmBox?.addEventListener('pointercancel', stopBpm);

        this.gridBoard.addEventListener('click', async (e) => {
            const port = e.target.closest('.port');
            if (port) {
                if (this.portLongPressed) {
                    this.portLongPressed = false;
                    return;
                }
                if (this.selectedModuleIds.length > 0) {
                    this.selectedTargetForConnection = null;
                    this.updatePortHighlight();
                    return;
                }
                return this.handlePortTap(port.dataset.moduleId, port.dataset.port);
            }
            if (this.selectedTargetForConnection) {
                this.selectedTargetForConnection = null;
                this.updatePortHighlight();
            }
            const body = e.target.closest('.module-body');
            if (body) {
                const mId = body.dataset.moduleId;
                if (this.moduleLongPressed) {
                    this.moduleLongPressed = false;
                    return;
                }
                if (this.selectedModuleIds.length > 0) {
                    if (this.selectedModuleIds.includes(mId)) {
                        const hasLocked = this.selectedModuleIds.some(id => this.modules[id]?.type === 'SUB_IO');
                        if (hasLocked) {
                            this.selectedModuleIds = [];
                            this.updateSelectionClasses();
                            return this.showToast('SUB_IO モジュールは削除できません（保護中）');
                        }
                        this.saveHistory();
                        const targets = [...this.selectedModuleIds];
                        this.selectedModuleIds = [];
                        this.updateSelectionClasses();
                        this._destroyCount = 0;
                        for (const id of targets) {
                            await this.destroyModule(this.currentPageId, id);
                        }
                        this.updateAllCells();
                        this.renderCables();
                        this.showToast(`モジュールを破棄しました (${this._destroyCount}個)`);
                        return;
                    }
                    this.selectedModuleIds = [];
                    this.updateSelectionClasses();
                    return;
                }
                if (this.modules[mId]?.type === 'SUB_IO') {
                    return;
                }
                const now = Date.now();
                const isDoubleTap = (now - this._lastTap < 350 && this._lastTapId === mId);
                this._lastTap = now;
                this._lastTapId = mId;
                if (isDoubleTap) {
                    if (this.modules[mId]?.type === 'SUB') {
                        this.switchPage(this.modules[mId].targetPage || 1);
                        return;
                    }
                    this.openSettingsModal(mId);
                    return;
                }
                if (this.modules[mId]?.type === 'THROUGH') {
                    this.saveHistory();
                    this.modules[mId].state = !(this.modules[mId].state !== false);
                    this.synth.updateModule(`${this.currentPageId}/${mId}`, this.modules[mId], this.getPatchState(mId));
                    this.renderCell(this.modules[mId].row*this.COLS+this.modules[mId].col);
                    return;
                }
                return;
            }
            const empty = e.target.closest('.empty-cell');
            if (empty) {
                if (this.selectedModuleIds.length > 0) {
                    this.selectedModuleIds = [];
                    this.updateSelectionClasses();
                    return;
                }
                const idx = parseInt(empty.dataset.index), now = Date.now();
                if (now - this._lastEmptyTap < 350 && this._lastEmptyIdx === idx) this.openAddModal(idx);
                this._lastEmptyTap = now;
                this._lastEmptyIdx = idx;
            }
        });

        this.gridBoard.addEventListener('pointerdown', (e) => {
            this._sX = e.clientX;
            this._sY = e.clientY;
            const port = e.target.closest('.port');
            if (port) {
                const mId = port.dataset.moduleId, p = port.dataset.port;
                this._pTimer = setTimeout(() => {
                    this.portLongPressed = true;
                    const toRemove = this.connections.filter(c => (c.from.moduleId===mId&&c.from.port===p) || (c.to.moduleId===mId&&c.to.port===p));
                    if (toRemove.length > 0) {
                        this.saveHistory();
                        toRemove.forEach(c => {
                            this.synth.disconnect(`${this.currentPageId}/${c.from.moduleId}`, c.from.port, `${this.currentPageId}/${c.to.moduleId}`, c.to.port);
                        });
                        this.connections = this.connections.filter(c => !((c.from.moduleId===mId&&c.from.port===p) || (c.to.moduleId===mId&&c.to.port===p)));

                        const affectedIds = new Set();
                        toRemove.forEach(c => {
                            affectedIds.add(c.from.moduleId);
                            affectedIds.add(c.to.moduleId);
                        });
                        affectedIds.forEach(id => {
                            if (this.modules[id]) {
                                this.synth.updateModule(`${this.currentPageId}/${id}`, this.modules[id], this.getPatchState(id));
                            }
                        });

                        this.persistCurrentPage();
                        if (this.currentPageId !== 'PAGE 0' && this.currentPageId !== '0') {
                            this.cleanupOrphanSubConnections(this.currentPageId);
                        }
                        this.renderCables();
                        this.updateAllCells();
                        this.showToast('端子の結線を切断しました');
                    }
                }, 500);
                return;
            }
            const body = e.target.closest('.module-body');
            if (!body) return;
            const mId = body.dataset.moduleId;
            this._dragCandidate = mId;
            this._lpTimer = setTimeout(() => {
                this._lpTimer = null;
                this.moduleLongPressed = true;
                this.selectedModuleIds = this.selectedModuleIds.includes(mId) ? this.selectedModuleIds.filter(x => x!==mId) : [...this.selectedModuleIds, mId];
                if (this.selectedTargetForConnection) {
                    this.selectedTargetForConnection = null;
                }
                this.updateSelectionClasses();
            }, 400);
        });

        window.addEventListener('pointermove', (e) => {
            if (this._pTimer && (Math.abs(e.clientX - this._sX) > 8 || Math.abs(e.clientY - this._sY) > 8)) {
                clearTimeout(this._pTimer);
                this._pTimer = null;
            }
            if (!this.isDragging && this._dragCandidate && (Math.abs(e.clientX - this._sX) > 8 || Math.abs(e.clientY - this._sY) > 8)) {
                if (this._lpTimer) {
                    clearTimeout(this._lpTimer);
                    this._lpTimer = null;
                }
                if (!this.selectedModuleIds.includes(this._dragCandidate)) this.selectedModuleIds = [this._dragCandidate];
                if (this.selectedTargetForConnection) {
                    this.selectedTargetForConnection = null;
                }
                this.updateSelectionClasses();
                this.isDragging = true;
                this.dragMode = 'move';

                const baseM = this.modules[this._dragCandidate];
                this.dragGroupOffsets = this.selectedModuleIds.map(id => {
                    const mod = this.modules[id];
                    return { id, dRow: mod && baseM ? mod.row - baseM.row : 0, dCol: mod && baseM ? mod.col - baseM.col : 0 };
                });

                this._copyTimer = setTimeout(() => {
                    if (this.isDragging) {
                        this.dragMode = 'copy';
                        this.updateDropHighlight();
                    }
                }, 1200);
            }
            if (this.isDragging) {
                const targetCell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.grid-cell');
                const nIdx = targetCell ? parseInt(targetCell.dataset.index) : null;
                if (this.dropTargetIndex !== nIdx) {
                    this.dropTargetIndex = nIdx;
                    if (this.dragMode !== 'move') this.dragMode = 'move';
                    if (this._copyTimer) {
                        clearTimeout(this._copyTimer);
                        this._copyTimer = null;
                    }
                    if (nIdx !== null) {
                        this._copyTimer = setTimeout(() => {
                            if (this.isDragging) {
                                this.dragMode = 'copy';
                                this.updateDropHighlight();
                            }
                        }, 1200);
                    }
                    this.updateDropHighlight();
                }
            }
        });

        const stopDrag = () => {
            if (this._pTimer) {
                clearTimeout(this._pTimer);
                this._pTimer = null;
            }
            if (this._lpTimer) {
                clearTimeout(this._lpTimer);
                this._lpTimer = null;
            }
            if (this._copyTimer) {
                clearTimeout(this._copyTimer);
                this._copyTimer = null;
            }
            this._dragCandidate = null;
            if (this.isDragging) {
                this.isDragging = false;
                this.lastHighlightedCells.forEach(c => c.classList.remove('drop-highlight-valid','drop-highlight-invalid','drop-highlight-copy-valid'));
                this.lastHighlightedCells = [];
                if (this.dropTargetIndex !== null && this.dragGroupValid) {
                    this.saveHistory();
                    const tR = Math.floor(this.dropTargetIndex / this.COLS), tC = this.dropTargetIndex % this.COLS;
                    if (this.dragMode === 'copy') {
                        const idMap = {};
                        let subCopied = false;
                        let lastCopiedSubName = '';

                        this.dragGroupOffsets.forEach(off => {
                            const src = this.modules[off.id];
                            const newId = generateModuleId(src.type, this.modules);
                            idMap[off.id] = newId;
                            const copy = safeClone(src);
                            copy.id = newId;
                            copy.row = tR + off.dRow;
                            copy.col = tC + off.dCol;

                            if (copy.type === 'SUB') {
                                subCopied = true;
                                const existingPageIds = new Set(Object.keys(this.pagesData));
                                Object.values(this.modules).forEach(m => {
                                    if (m.type === 'SUB' && m.targetPage) existingPageIds.add(String(m.targetPage));
                                });
                                let newPageNum = 1;
                                while (existingPageIds.has(String(newPageNum))) newPageNum++;
                                const newPageId = String(newPageNum);

                                const srcPageId = String(src.targetPage ?? 1);
                                const srcPageData = this.pagesData[srcPageId];
                                const srcName = srcPageData?.name || `SUBPATCH ${srcPageId}`;

                                const baseName = srcName.replace(/_\d+$/, '');
                                const allPageNames = Object.values(this.pagesData).map(p => p.name).filter(Boolean);
                                let suffixNum = 1;
                                while (allPageNames.includes(`${baseName}_${suffixNum}`)) {
                                    suffixNum++;
                                }
                                const newSubName = `${baseName}_${suffixNum}`;
                                lastCopiedSubName = newSubName;

                                const clonedPageData = srcPageData ? safeClone(srcPageData) : {
                                    slots: { "2": "SUB_IO1" },
                                    modules: { "SUB_IO1": { type: 'SUB_IO', id: 'SUB_IO1', col: 2, row: 0 } },
                                    connections: []
                                };
                                clonedPageData.name = newSubName;
                                this.pagesData[newPageId] = clonedPageData;
                                copy.targetPage = newPageNum;

                                // Instantiate new subpage audio nodes incrementally without interrupting existing playback
                                Object.entries(clonedPageData.modules || {}).forEach(([mId, m]) => {
                                    const fullId = `${newPageId}/${mId}`;
                                    this.synth.addModule(fullId, m.type, m, this.getPatchState(mId, newPageId));
                                });

                                (clonedPageData.connections || []).forEach(c => {
                                    const connObj = parseConn(c);
                                    if (connObj) {
                                        this.synth.connect(
                                            `${newPageId}/${connObj.from.moduleId}`, connObj.from.port,
                                            `${newPageId}/${connObj.to.moduleId}`, connObj.to.port
                                        );
                                    }
                                });
                            }

                            this.modules[newId] = copy;
                            this.synth.addModule(`${this.currentPageId}/${newId}`, copy.type, copy, this.getPatchState(newId));
                        });

                        this.connections.forEach(c => {
                            if (idMap[c.from.moduleId] && idMap[c.to.moduleId]) {
                                const nC = { from: { moduleId: idMap[c.from.moduleId], port: c.from.port }, to: { moduleId: idMap[c.to.moduleId], port: c.to.port } };
                                this.connections.push(nC);
                                this.synth.connect(`${this.currentPageId}/${nC.from.moduleId}`, nC.from.port, `${this.currentPageId}/${nC.to.moduleId}`, nC.to.port);
                            }
                        });

                        if (subCopied) {
                            this.synth.linkSubBridges();
                            this.showToast(`サブパッチ「${lastCopiedSubName}」を新規複製しました`);
                        } else {
                            this.showToast(`${this.dragGroupOffsets.length}個コピーしました`);
                        }
                    } else {
                        this.dragGroupOffsets.forEach(off => {
                            const m = this.modules[off.id];
                            m.row = tR + off.dRow;
                            m.col = tC + off.dCol;
                        });
                        this.showToast(`${this.dragGroupOffsets.length}個移動しました`);
                    }
                    this.syncGridMap();
                    this.selectedModuleIds = [];
                    this.updateAllCells();
                    this.renderCables();
                }
            }
        };
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', stopDrag);

        document.getElementById('page-nav-back-btn')?.addEventListener('click', () => {
            if (!this.pageStack) this.pageStack = [];
            const prevPage = this.pageStack.length > 0 ? this.pageStack.pop() : "0";
            this.switchPage(prevPage, true);
        });
        const handleRenameSubpatch = async () => {
            if (this.currentPageId === "0") return;
            const curName = this.pagesData[this.currentPageId]?.name || `SUBPATCH ${this.currentPageId}`;
            const res = await this.openCustomPrompt('SUBPATCH NAME', curName);
            if (res !== null && res.trim() !== '') {
                this.saveHistory();
                if (!this.pagesData[this.currentPageId]) this.pagesData[this.currentPageId] = { slots: {}, modules: {}, connections: [] };
                this.pagesData[this.currentPageId].name = res.trim();
                this.updatePageNavUI();
                this.updateAllCells();
                this.showToast(`サブパッチ名を「${res.trim()}」に変更しました`);
            }
        };
        document.getElementById('page-nav-title')?.addEventListener('click', handleRenameSubpatch);
        document.getElementById('page-nav-rename-btn')?.addEventListener('click', handleRenameSubpatch);
        document.getElementById('page-nav-save-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (this.currentPageId === "0") return;
            const curName = this.pagesData[this.currentPageId]?.name || `USER_SUB_${Date.now().toString().slice(-4)}`;
            const res = await this.openCustomPrompt('ユーザー登録名', curName);
            if (res !== null && res.trim() !== '') {
                this.saveCurrentSubpatchToLibrary(res.trim());
            }
        });
        document.getElementById('preset-trigger-btn')?.addEventListener('click', () => {
            this.renderPresetList();
            document.getElementById('preset-manager-modal').classList.remove('hidden');
        });
        document.getElementById('close-preset-bg')?.addEventListener('click', () => document.getElementById('preset-manager-modal').classList.add('hidden'));
        document.getElementById('close-preset-modal-btn')?.addEventListener('click', () => document.getElementById('preset-manager-modal').classList.add('hidden'));
        document.getElementById('preset-new-top-btn')?.addEventListener('click', () => this.createNewPatch());
        document.getElementById('preset-save-top-btn')?.addEventListener('click', () => this.saveCurrentPatch());
        document.getElementById('preset-saveas-top-btn')?.addEventListener('click', async () => {
            const name = await this.openCustomPrompt('SAVE AS', `PATCH_${Date.now().toString().slice(-4)}`);
            if (name) {
                this.presets[name] = this.exportCurrentPreset();
                this.presetOrder.unshift(name);
                this.currentPresetKey = name;
                this.savePresetsDB();
                this.loadActivePreset();
                this.renderPresetList();
                this.showToast(`"${name}" を保存しました`);
            }
        });
        document.getElementById('preset-export-top-btn')?.addEventListener('click', () => this.openJsonExportModal());
        document.getElementById('preset-import-top-btn')?.addEventListener('click', () => this.openJsonImportModal());
        document.getElementById('json-io-backdrop')?.addEventListener('click', () => document.getElementById('json-io-modal')?.classList.add('hidden'));
        document.getElementById('close-json-io-btn')?.addEventListener('click', () => document.getElementById('json-io-modal')?.classList.add('hidden'));
    }

    updateDropHighlight() {
        this.lastHighlightedCells.forEach(c => c.classList.remove('drop-highlight-valid','drop-highlight-invalid','drop-highlight-copy-valid'));
        this.lastHighlightedCells = [];
        if (this.dropTargetIndex === null) return;
        const tR = Math.floor(this.dropTargetIndex / this.COLS), tC = this.dropTargetIndex % this.COLS;
        this.dragGroupValid = true;

        for (let off of this.dragGroupOffsets) {
            const r = tR + off.dRow, c = tC + off.dCol;
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) {
                this.dragGroupValid = false;
                break;
            }
            const occ = this.gridMap[r * this.COLS + c];
            if (this.dragMode === 'copy' && occ) {
                this.dragGroupValid = false;
                break;
            }
            if (this.dragMode === 'move' && occ && !this.selectedModuleIds.includes(occ)) {
                this.dragGroupValid = false;
                break;
            }
            const cell = document.getElementById(`cell-${r * this.COLS + c}`);
            if (cell) this.lastHighlightedCells.push(cell);
        }

        const cls = !this.dragGroupValid ? HIGHLIGHT_CLASSES.invalid : HIGHLIGHT_CLASSES[this.dragMode];
        this.lastHighlightedCells.forEach(cell => cell.classList.add(cls));
    }

    exportCurrentPreset() {
        this.persistCurrentPage();
        const exportPages = {};

        Object.entries(this.pagesData).forEach(([pId, pData]) => {
            const slots = {}, cleanMods = {};
            Object.entries(pData.modules || {}).forEach(([id, m]) => {
                const slotIdx = m.row * this.COLS + m.col;
                slots[String(slotIdx)] = id;
                const { col, row, id: _id, ...props } = m;
                cleanMods[id] = { type: m.type, ...safeClone(props) };
            });
            exportPages[pId] = {
                name: pData.name || '',
                slots,
                modules: cleanMods,
                connections: (pData.connections || []).map(parseConn).filter(Boolean)
            };
        });

        return {
            bpm: this.synth.masterBPM,
            pages: exportPages
        };
    }

    loadPatchData(p, name = null) {
        if (!p) return;
        if (name) {
            this.currentPresetKey = name;
            this.presets[name] = p;
        }
        document.getElementById('current-preset-name').textContent = this.currentPresetKey;
        const parsed = UIController.parsePatch(p, this.COLS);
        if (parsed.bpm) {
            this.synth.setBPM(parsed.bpm);
            const bpmDisp = document.getElementById('master-bpm-disp');
            if (bpmDisp) bpmDisp.textContent = parsed.bpm;
        }
        this.pagesData = parsed.pages;
        this.currentPageId = "0";
        this.modules = this.pagesData["0"]?.modules || {};
        this.connections = this.pagesData["0"]?.connections || [];
        this.syncGridMap();
        this.synth.rebuildAll(this.pagesData, (pId, id) => this.getPatchState(id, pId));
        this.updateAllCells();
        this.updatePageNavUI();
        setTimeout(() => this.renderCables(), 50);
    }

    loadActivePreset() {
        const p = this.presets[this.currentPresetKey];
        if (p) this.loadPatchData(p);
    }

    savePresetsDB() {
        try {
            localStorage.setItem('gridsynth_presets_db', JSON.stringify(this.presets));
            localStorage.setItem('gridsynth_preset_order', JSON.stringify(this.presetOrder));
        } catch (e) {
            console.warn('Preset storage save error:', e);
        }
    }

    saveCurrentPatch() {
        if (this.DEMO_KEYS.includes(this.currentPresetKey)) return this.showToast('DEMOプリセットは上書きできません');
        this.presets[this.currentPresetKey] = this.exportCurrentPreset();
        this.savePresetsDB();
        this.showToast(`"${this.currentPresetKey}" を上書き保存しました`);
    }

    createNewPatch() {
        const name = `PATCH_${Date.now().toString().slice(-4)}`;
        this.presets[name] = {
            bpm: 120,
            pages: {
                "0": {
                    slots: { "4": "SPK1" },
                    modules: { "SPK1": { type: "SPK" } },
                    connections: []
                }
            }
        };
        this.presetOrder.unshift(name);
        this.currentPresetKey = name;
        this.savePresetsDB();
        this.loadActivePreset();
        this.renderPresetList();
        this.showToast(`新規作成: ${name}`);
    }

    openJsonExportModal() {
        const modal = document.getElementById('json-io-modal');
        const title = document.getElementById('json-io-title');
        const icon = document.getElementById('json-io-icon');
        const textarea = document.getElementById('json-io-textarea');
        const footer = document.getElementById('json-io-footer');
        if (!modal || !textarea) return;

        const patchData = this.exportCurrentPreset();
        const jsonStr = JSON.stringify(patchData, null, 2);

        if (title) title.textContent = `PATCH JSON EXPORT (${this.currentPresetKey})`;
        if (icon) icon.setAttribute('data-lucide', 'download');
        textarea.value = jsonStr;
        textarea.readOnly = true;

        if (footer) {
            const pageCount = Object.keys(patchData.pages || {}).length;
            footer.innerHTML = `
                <div class="text-[8px] text-slate-400 font-mono flex items-center gap-2">
                    <span>PAGES: ${pageCount}</span>
                    <span>BPM: ${patchData.bpm || 120}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button id="json-copy-btn" class="h-6 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[9px] rounded-lg transition flex items-center gap-1 shadow-md shadow-cyan-600/30 cursor-pointer">
                        <i data-lucide="copy" class="w-3 h-3 pointer-events-none"></i>
                        <span id="json-copy-btn-text" class="pointer-events-none">COPY TO CLIPBOARD</span>
                    </button>
                    <button id="json-close-btn" class="h-6 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] rounded-lg transition border border-slate-700 cursor-pointer">
                        CLOSE
                    </button>
                </div>
            `;

            document.getElementById('json-copy-btn')?.addEventListener('click', () => {
                navigator.clipboard.writeText(jsonStr).then(() => {
                    const btnText = document.getElementById('json-copy-btn-text');
                    if (btnText) btnText.textContent = 'COPIED! ✅';
                    this.showToast('パッチJSONをクリップボードにコピーしました');
                    setTimeout(() => {
                        const bt = document.getElementById('json-copy-btn-text');
                        if (bt) bt.textContent = 'COPY TO CLIPBOARD';
                    }, 2000);
                }).catch(() => {
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    this.showToast('選択部分をコピーしました');
                });
            });

            document.getElementById('json-close-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
            textarea.focus();
            textarea.select();
        }, 50);
    }

    openJsonImportModal() {
        const modal = document.getElementById('json-io-modal');
        const title = document.getElementById('json-io-title');
        const icon = document.getElementById('json-io-icon');
        const textarea = document.getElementById('json-io-textarea');
        const footer = document.getElementById('json-io-footer');
        if (!modal || !textarea) return;

        if (title) title.textContent = 'PATCH JSON IMPORT';
        if (icon) icon.setAttribute('data-lucide', 'upload');
        textarea.value = '';
        textarea.placeholder = 'ここにパッチの JSON テキストを貼り付けてください...';
        textarea.readOnly = false;

        if (footer) {
            footer.innerHTML = `
                <button id="json-paste-btn" class="h-6 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer">
                    <i data-lucide="clipboard" class="w-3 h-3 pointer-events-none"></i>PASTE
                </button>
                <div class="flex items-center gap-1.5">
                    <button id="json-apply-load-btn" class="h-6 px-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[9px] rounded-lg transition flex items-center gap-1 shadow-md shadow-purple-600/30 cursor-pointer">
                        <i data-lucide="play" class="w-3 h-3 pointer-events-none"></i>
                        <span>LOAD (現在の画面に展開)</span>
                    </button>
                    <button id="json-apply-saveas-btn" class="h-6 px-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[9px] rounded-lg transition flex items-center gap-1 cursor-pointer">
                        <i data-lucide="file-plus" class="w-3 h-3 pointer-events-none"></i>
                        <span>SAVE AS NEW</span>
                    </button>
                </div>
            `;

            document.getElementById('json-paste-btn')?.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        textarea.value = text;
                        this.showToast('クリップボードから貼り付けました');
                    }
                } catch (e) {
                    this.showToast('貼り付けは手動 (Ctrl+V) で行ってください');
                }
            });

            const parseAndValidate = () => {
                const text = textarea.value.trim();
                if (!text) {
                    this.showToast('JSONテキストが空です');
                    return null;
                }
                try {
                    const parsed = JSON.parse(text);
                    if (!parsed.pages && !parsed["0"] && !parsed.slots && !parsed.modules) {
                        this.showToast('パッチ形式が無効です');
                        return null;
                    }
                    return parsed;
                } catch (err) {
                    this.showToast('JSONの構文エラーです: ' + err.message);
                    return null;
                }
            };

            document.getElementById('json-apply-load-btn')?.addEventListener('click', () => {
                const data = parseAndValidate();
                if (data) {
                    this.saveHistory();
                    this.loadPatchData(data);
                    modal.classList.add('hidden');
                    document.getElementById('preset-manager-modal')?.classList.add('hidden');
                    this.showToast('パッチを読み込みました');
                }
            });

            document.getElementById('json-apply-saveas-btn')?.addEventListener('click', async () => {
                const data = parseAndValidate();
                if (data) {
                    const name = await this.openCustomPrompt('SAVE AS NEW PATCH', `IMPORT_${Date.now().toString().slice(-4)}`);
                    if (name) {
                        this.saveHistory();
                        this.presets[name] = data;
                        this.presetOrder.unshift(name);
                        this.currentPresetKey = name;
                        this.savePresetsDB();
                        this.loadActivePreset();
                        this.renderPresetList();
                        modal.classList.add('hidden');
                        document.getElementById('preset-manager-modal')?.classList.add('hidden');
                        this.showToast(`"${name}" として保存・展開しました`);
                    }
                }
            });
        }

        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
            textarea.focus();
        }, 50);
    }

    renderPresetList() {
        const c = document.getElementById('preset-list-container');
        c.innerHTML = '';
        const userKeys = this.presetOrder.filter(k => !this.DEMO_KEYS.includes(k));
        userKeys.forEach(k => {
            const item = document.createElement('div');
            item.className = `flex items-center justify-between py-1 px-2 mb-1 rounded border ${k === this.currentPresetKey ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'} cursor-pointer text-xs`;
            item.innerHTML = `<span class="truncate">${k}</span><div class="flex items-center gap-1 shrink-0"><button class="rename-p text-violet-400 hover:text-white px-1">✎</button><button class="copy-p text-amber-400 hover:text-white px-1">📋</button><button class="del-p text-rose-400 hover:text-white px-1">✕</button></div>`;
            item.addEventListener('click', async (e) => {
                if (e.target.classList.contains('del-p')) {
                    delete this.presets[k];
                    this.presetOrder = this.presetOrder.filter(x => x!==k);
                    this.savePresetsDB();
                    this.renderPresetList();
                    return;
                }
                if (e.target.classList.contains('copy-p')) {
                    const nK = `${k}_COPY`;
                    this.presets[nK] = safeClone(this.presets[k]);
                    this.presetOrder.unshift(nK);
                    this.savePresetsDB();
                    this.renderPresetList();
                    return;
                }
                if (e.target.classList.contains('rename-p')) {
                    const ren = await this.openCustomPrompt('RENAME', k);
                    if (ren && ren !== k) {
                        this.presets[ren] = this.presets[k];
                        delete this.presets[k];
                        const idx = this.presetOrder.indexOf(k);
                        if (idx !== -1) this.presetOrder[idx] = ren;
                        if (this.currentPresetKey === k) this.currentPresetKey = ren;
                        this.savePresetsDB();
                        this.renderPresetList();
                    }
                    return;
                }
                this.currentPresetKey = k;
                this.loadActivePreset();
                document.getElementById('preset-manager-modal').classList.add('hidden');
            });
            c.appendChild(item);
        });

        const dHeader = document.createElement('div');
        dHeader.className = 'flex items-center justify-between px-2 py-1 mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800/40 rounded cursor-pointer';
        dHeader.innerHTML = `<span>DEMO PRESETS</span><span>${this.demoAccordionOpen?'▲':'▼'}</span>`;
        dHeader.onclick = () => {
            this.demoAccordionOpen = !this.demoAccordionOpen;
            this.renderPresetList();
        };
        c.appendChild(dHeader);

        if (this.demoAccordionOpen) {
            this.DEMO_KEYS.forEach(k => {
                const item = document.createElement('div');
                item.className = `flex items-center justify-between py-1 px-2 my-1 rounded border ${k === this.currentPresetKey ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold' : 'bg-slate-800/40 border-slate-700/40 text-slate-400'} cursor-pointer text-xs`;
                item.innerHTML = `<span>${k}</span>`;
                item.onclick = () => {
                    this.currentPresetKey = k;
                    this.loadActivePreset();
                    document.getElementById('preset-manager-modal').classList.add('hidden');
                };
                c.appendChild(item);
            });
        }
    }

    uiUpdateLoop(timestamp = 0) {
        requestAnimationFrame((t) => this.uiUpdateLoop(t));

        if (timestamp - this._lastUiUpdate < 32) return;
        this._lastUiUpdate = timestamp;

        if (this.synth.audioWorkletReady || this.synth.ctx) {
            const modalEl = this.activePopupModuleId ? document.getElementById('modal-content') : null;
            const dockEl = this.activeDockModuleId ? document.getElementById('dock-content') : null;
            const liveTypes = ['VCA', 'MATH', 'MATH1', 'MATH2', 'SH', 'SCOPE', 'MON', 'SEQ', 'ADSR', 'PAT'];
            Object.values(this.modules).forEach(m => {
                if (!liveTypes.includes(m.type)) return;
                const fullId = `${this.currentPageId}/${m.id}`;
                const inst = this.synth.modules[fullId] || this.synth.modules[m.id];
                const reg = MODULE_REGISTRY[m.type];
                if (inst?.read && reg?.updateLive) {
                    const cell = document.getElementById(`cell-${m.row * this.COLS + m.col}`);
                    const targetModal = m.id === this.activeDockModuleId ? dockEl : modalEl;
                    if (cell) reg.updateLive(cell, inst.read(), this.synth.isPlaying, targetModal, m);
                }
            });
        }
    }
}
