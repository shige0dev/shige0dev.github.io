import { safeClone, parseConn, connKey, isSameConn, generateModuleId, HIGHLIGHT_CLASSES, resolveConnectionSignalType, isSubModule, normalizeSubPort, getSubPortAlias } from '../core/utils.js';
import { parsePatch, exportPatch, resolveSubpatchTemplate } from '../core/patch.js';
import { MODULE_REGISTRY } from '../modules/registry.js';
import { UIHelpers } from './helpers.js';
import { getDefaultPresets } from '../presets/default.js';
import { FACTORY_SUBPATCHES, findSubpatchTemplate } from '../presets/subpatches.js';
import { PresetManager } from './managers/preset-manager.js';
import { ModalManager } from './managers/modal-manager.js';
import { CableManager } from './managers/cable-manager.js';
import { PageManager } from './managers/page-manager.js';
import { InteractionManager } from './managers/interaction-manager.js';

export const LIVE_TYPES = ['VCA', 'MATH1', 'MATH2', 'SH', 'SCOPE', 'MON', 'SEQ', 'ADSR', 'PAT', 'MARKOV', 'SPK', 'CHORD', 'MIX'];

export class UIController {
    constructor(synth) {
        this.synth = synth;
        this.COLS = 5;
        this.ROWS = 8;
        this.gridMap = Array(40).fill(null);
        this.cells = new Array(40);
        this._lastUiUpdate = 0;

        this.presetManager = new PresetManager(this);
        this.modalManager = new ModalManager(this);
        this.cableManager = new CableManager(this);
        this.pageManager = new PageManager(this);
        this.interactionManager = new InteractionManager(this);

        this.initDOM();
        this.bindGlobalEvents();
        this.loadActivePreset();
        this.uiUpdateLoop(0);
    }

    get modules() { return this.pageManager.currentPageData.modules; }
    set modules(v) { this.pageManager.currentPageData.modules = v || {}; }
    get connections() { return this.pageManager.currentPageData.connections; }
    set connections(v) { this.pageManager.currentPageData.connections = v || []; }

    get presets() { return this.presetManager.presets; }
    get presetOrder() { return this.presetManager.presetOrder; }
    set presetOrder(v) { this.presetManager.presetOrder = v; }
    get currentPresetKey() { return this.presetManager.currentPresetKey; }
    set currentPresetKey(v) { this.presetManager.currentPresetKey = v; }
    get DEMO_KEYS() { return this.presetManager.DEMO_KEYS; }
    get demoAccordionOpen() { return this.presetManager.demoAccordionOpen; }
    set demoAccordionOpen(v) { this.presetManager.demoAccordionOpen = v; }
    get userSubpatches() { return this.presetManager.userSubpatches; }
    set userSubpatches(v) { this.presetManager.userSubpatches = v; }
    get activePopupModuleId() { return this.modalManager.activePopupModuleId; }
    set activePopupModuleId(v) { this.modalManager.activePopupModuleId = v; }
    get activeDockModuleId() { return this.modalManager.activeDockModuleId; }
    set activeDockModuleId(v) { this.modalManager.activeDockModuleId = v; }
    get isDockLocked() { return this.modalManager.isDockLocked; }
    set isDockLocked(v) { this.modalManager.isDockLocked = v; }
    get selectedTargetForConnection() { return this.cableManager.selectedTargetForConnection; }
    set selectedTargetForConnection(v) { this.cableManager.selectedTargetForConnection = v; }
    get pagesData() { return this.pageManager.pagesData; }
    set pagesData(v) { this.pageManager.pagesData = v; }
    get currentPageId() { return this.pageManager.currentPageId; }
    set currentPageId(v) { this.pageManager.currentPageId = v; }
    get pageStack() { return this.pageManager.pageStack; }
    set pageStack(v) { this.pageManager.pageStack = v; }
    get historyStack() { return this.pageManager.historyStack; }
    set historyStack(v) { this.pageManager.historyStack = v; }
    get selectedModuleIds() { return this.interactionManager.selectedModuleIds; }
    set selectedModuleIds(v) { this.interactionManager.selectedModuleIds = v; }
    get isDragging() { return this.interactionManager.isDragging; }
    set isDragging(v) { this.interactionManager.isDragging = v; }
    get dropTargetIndex() { return this.interactionManager.dropTargetIndex; }
    set dropTargetIndex(v) { this.interactionManager.dropTargetIndex = v; }
    get dragMode() { return this.interactionManager.dragMode; }
    set dragMode(v) { this.interactionManager.dragMode = v; }
    get dragGroupOffsets() { return this.interactionManager.dragGroupOffsets; }
    set dragGroupOffsets(v) { this.interactionManager.dragGroupOffsets = v; }
    get dragGroupValid() { return this.interactionManager.dragGroupValid; }
    set dragGroupValid(v) { this.interactionManager.dragGroupValid = v; }
    get lastHighlightedCells() { return this.interactionManager.lastHighlightedCells; }
    set lastHighlightedCells(v) { this.interactionManager.lastHighlightedCells = v; }

    getNestingDepth(pageId) {
        return this.pageManager.getNestingDepth(pageId);
    }

    getNextAvailablePageId() {
        return this.pageManager.getNextAvailablePageId();
    }

    updatePresetDisplay(name, bpm) {
        if (name) {
            const nameEl = document.getElementById('current-preset-name');
            if (nameEl) nameEl.textContent = name;
        }
        if (bpm) {
            const bpmDisp = document.getElementById('master-bpm-disp');
            if (bpmDisp) bpmDisp.textContent = bpm;
        }
    }

    static parsePatch(patchData, cols = 5, userSubpatches = null) {
        return parsePatch(patchData, cols, userSubpatches);
    }

    initDOM() {
        this.gridBoard = document.getElementById('grid-board');
        this.cableCanvas = document.getElementById('cable-canvas');
        this.gridBoard.innerHTML = '';
        for (let i = 0; i < 40; i++) {
            const c = document.createElement('div');
            c.id = `cell-${i}`;
            c.dataset.index = i;
            this.cells[i] = c;
            this.gridBoard.appendChild(c);
        }
        const savedOp = parseFloat(localStorage.getItem('gridsynth_cable_opacity'));
        this.cableOpacity = (!isNaN(savedOp) && [1.0, 0.2].some(s => Math.abs(s - savedOp) < 0.05)) ? savedOp : 1.0;
        this.setCableOpacity(this.cableOpacity);
    }

    setCableOpacity(op) {
        this.cableOpacity = op;
        if (this.cableCanvas) {
            this.cableCanvas.style.opacity = '1';
        }
        const ind = document.getElementById('cable-opacity-indicator');
        if (ind) {
            ind.style.opacity = String(op);
        }
        localStorage.setItem('gridsynth_cable_opacity', String(op));
        this.renderCables();
    }

    showToast(msg, duration = 1800) {
        return this.modalManager.showToast(msg, duration);
    }

    getSubManifest(moduleId, pageId = null) {
        const pId = String(pageId ?? this.currentPageId);
        const pData = this.pagesData[pId];
        const mod = (pId === this.currentPageId ? this.modules[moduleId] : pData?.modules?.[moduleId]) || null;
        if (!mod) return null;

        if (mod.manifest) return mod.manifest;

        if (mod.type === 'SUB') {
            const targetPage = String(mod.targetPage ?? 1);
            const targetPData = this.pagesData[targetPage];
            if (targetPData?.manifest) return targetPData.manifest;

            const tId = mod.subType || targetPData?.subType || targetPData?.sourceTemplateId;
            if (tId) {
                const tmpl = resolveSubpatchTemplate(tId, this.userSubpatches);
                if (tmpl?.manifest) return tmpl.manifest;
            }
        } else if (mod.type === 'SUB_IO') {
            if (pData?.manifest) return pData.manifest;
            const tId = pData?.subType || pData?.sourceTemplateId;
            if (tId) {
                const tmpl = resolveSubpatchTemplate(tId, this.userSubpatches);
                if (tmpl?.manifest) return tmpl.manifest;
            }
        }
        return null;
    }

    getPortDisplayInfo(moduleId, port, pageId = null) {
        const pId = String(pageId ?? this.currentPageId);
        const mod = (pId === this.currentPageId ? this.modules[moduleId] : this.pagesData[pId]?.modules?.[moduleId]) || null;
        if (!mod) return { label: port, desc: null, hasAlias: false };

        if (isSubModule(mod.type)) {
            const manifest = this.getSubManifest(moduleId, pId);
            const aliasInfo = getSubPortAlias(port, mod.type, manifest);
            if (aliasInfo && aliasInfo.alias) {
                return {
                    label: aliasInfo.label,
                    desc: aliasInfo.desc,
                    alias: aliasInfo.alias,
                    aliasUpper: aliasInfo.aliasUpper,
                    pin: aliasInfo.pin,
                    physicalPort: aliasInfo.physicalPort,
                    hasAlias: true
                };
            }
            const norm = normalizeSubPort(port, mod.type, manifest);
            return {
                label: norm,
                desc: null,
                alias: null,
                aliasUpper: null,
                pin: aliasInfo?.pin || null,
                physicalPort: norm,
                hasAlias: false
            };
        }

        return {
            label: port,
            desc: null,
            hasAlias: false
        };
    }

    getPatchState(mId, pageId = this.currentPageId) {
        const s = new Set();
        const pId = String(pageId);
        const conns = pId === this.currentPageId ? this.connections : (this.pagesData[pId]?.connections || []);
        const isSub = isSubModule(mId);
        conns.forEach(c => {
            const connObj = typeof c === 'string' ? parseConn(c) : c;
            if (connObj) {
                if (connObj.to.moduleId === mId) {
                    s.add(connObj.to.port);
                    if (isSub) {
                        const norm = normalizeSubPort(connObj.to.port);
                        s.add(norm);
                    }
                }
                if (connObj.from.moduleId === mId) {
                    s.add(connObj.from.port);
                    if (isSub) {
                        const norm = normalizeSubPort(connObj.from.port);
                        s.add(norm);
                    }
                }
            }
        });
        return s;
    }

    persistCurrentPage() {
        return this.pageManager.persistCurrentPage();
    }

    switchPage(pageId, isBackAction = false) {
        return this.pageManager.switchPage(pageId, isBackAction);
    }

    updatePageNavUI() {
        return this.pageManager.updatePageNavUI();
    }

    saveHistory() {
        return this.pageManager.saveHistory();
    }

    undo() {
        return this.pageManager.undo();
    }

    syncGridMap() {
        this.gridMap.fill(null);
        Object.entries(this.modules).forEach(([id, m]) => {
            const idx = m.row * this.COLS + m.col;
            if (idx >= 0 && idx < 40) this.gridMap[idx] = id;
        });
    }

    updatePortHighlight() {
        return this.cableManager.updatePortHighlight();
    }

    updateSelectionClasses() {
        return this.interactionManager.updateSelectionClasses();
    }

    getSubActivePorts(m) {
        return this.cableManager.getSubActivePorts(m);
    }

    cleanupOrphanSubConnections(subPageId = null) {
        return this.cableManager.cleanupOrphanSubConnections(subPageId);
    }

    getConnectedPortColor(mId, portName, m) {
        return this.cableManager.getConnectedPortColor(mId, portName, m);
    }

    renderCell(idx) {
        const cell = this.cells[idx] || document.getElementById(`cell-${idx}`);
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
                const isSel = !this.selectedModuleIds.length && this.selectedTargetForConnection && this.selectedTargetForConnection.moduleId === mId && (this.selectedTargetForConnection.port === p.port || (isSubModule(mId) && normalizeSubPort(this.selectedTargetForConnection.port) === normalizeSubPort(p.port)));
                let isOpp = false;
                let oppStyle = '';
                if (!this.selectedModuleIds.length && this.selectedTargetForConnection && !isSel) {
                    const sel = this.selectedTargetForConnection;
                    const matchConn = this.connections.find(c => {
                        const o = typeof c === 'string' ? parseConn(c) : c;
                        if (!o) return false;
                        const isFromSub = isSubModule(o.from.moduleId);
                        const isToSub = isSubModule(o.to.moduleId);
                        const oFromPort = isFromSub ? normalizeSubPort(o.from.port) : o.from.port;
                        const oToPort = isToSub ? normalizeSubPort(o.to.port) : o.to.port;
                        const selPort = isSubModule(sel.moduleId) ? normalizeSubPort(sel.port) : sel.port;
                        const curPort = isSubModule(mId) ? normalizeSubPort(p.port) : p.port;

                        return (o.from.moduleId === sel.moduleId && oFromPort === selPort && o.to.moduleId === mId && oToPort === curPort) ||
                               (o.to.moduleId === sel.moduleId && oToPort === selPort && o.from.moduleId === mId && oFromPort === curPort);
                    });
                    if (matchConn) {
                        isOpp = true;
                        const sig = resolveConnectionSignalType(typeof matchConn === 'string' ? parseConn(matchConn) : matchConn);
                        oppStyle = `--conn-bright: ${sig.brightStroke || '#ffffff'}; --conn-glow: ${sig.stroke || '#38bdf8'};`;
                    }
                }
                let portTitle = `${mId}:${p.port}`;
                if (isSubModule(m.type)) {
                    const info = this.getPortDisplayInfo(mId, p.port);
                    portTitle = `${mId}:${info.label}`;
                }
                const portEl = `<div class="w-2 h-2 rounded-full ${p.color} border border-slate-950/90 shadow-sm shadow-black/60 port cursor-pointer hover:scale-150 transition relative z-10 flex items-center justify-center before:absolute before:inset-[-6px] ${isSel ? 'port-selected' : ''} ${isOpp ? 'port-connected-highlight' : ''}" style="${oppStyle}" data-module-id="${mId}" data-port="${p.port}" title="${portTitle}"></div>`;
                if (p.badgeColor) {
                    return `<div class="relative inline-flex items-center justify-center"><span class="absolute -top-[1.5px] -left-[1.5px] w-[3.5px] h-[3.5px] rounded-full ${p.badgeColor} pointer-events-none z-0 ring-[0.5px] ring-black/70"></span>${portEl}</div>`;
                }
                return portEl;
            }).join('');

            const portsHTML = reg.renderPorts ? reg.renderPorts(m, renderP, ports) : UIHelpers.renderStandardPorts(renderP, ports.in || [], ports.out || []);

            let titleHTML = '';
            if (m.type !== 'SCOPE') {
                if (m.type === 'SUB' || m.type === 'SUB_IO') {
                    const displayName = m.type === 'SUB'
                        ? (ctx?.pagesData ? ctx.pagesData[String(m.targetPage ?? 1)]?.name : null) || `SUBPATCH ${m.targetPage ?? 1}`
                        : (ctx?.pageName || `SUBPATCH ${this.currentPageId}`);
                    titleHTML = `
                        <div class="absolute top-[2px] left-0 right-0 px-1 flex justify-center items-center pointer-events-none z-20">
                            <span class="w-full text-center font-bold text-[7.5px] tracking-tight text-white truncate select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">${displayName}</span>
                        </div>`;
                } else {
                    let titleClass = 'text-black font-bold';
                    let extraTitleAttrs = '';
                    if (m.type === 'MARKOV') {
                        const weights = Array.isArray(m.weights) ? m.weights : [0, 0, 0, 0];
                        const patched = ctx.patched;
                        const hasUnconnected = weights.some((w, idx) => Number(w) > 0 && !patched.has(`transition_out${idx + 1}`) && !patched.has(`trig_out${idx + 1}`));
                        if (hasUnconnected) {
                            titleClass = 'text-rose-500 font-extrabold drop-shadow-[0_0_2px_rgba(244,63,94,0.9)] animate-pulse';
                            extraTitleAttrs = 'title="未結線の出力端子にウエイトが設定されています"';
                        }
                    }
                    titleHTML = `
                        <div class="absolute top-[2px] left-[2px] right-[2px] flex justify-center items-center pointer-events-none z-20">
                            <span class="${titleClass} text-[8px] tracking-wider select-none truncate" ${extraTitleAttrs}>${m.type}</span>
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
        return this.cableManager.renderCables();
    }

    handlePortTap(mId, pName) {
        return this.cableManager.handlePortTap(mId, pName);
    }

    openModal(idx, title, widthCls, renderFn) {
        return this.modalManager.openModal(idx, title, widthCls, renderFn);
    }

    openSettingsModal(mId) {
        return this.modalManager.openSettingsModal(mId);
    }

    openDockModal(mId) {
        return this.modalManager.openDockModal(mId);
    }

    closeDockModal() {
        return this.modalManager.closeDockModal();
    }

    setDockLock(lock) {
        return this.modalManager.setDockLock(lock);
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

    createModuleContext(id, isDock = false) {
        return this.modalManager.createModuleContext(id, isDock);
    }

    reRenderDockModal() {
        return this.modalManager.reRenderDockModal();
    }

    cleanupMarkovWeights(modId) {
        const mod = this.modules[modId];
        if (mod) {
            MODULE_REGISTRY[mod.type]?.onDisconnect?.(mod, { patchState: this.getPatchState(modId) });
        }
    }

    removeConnectionsForPort(mId, port) {
        return this.cableManager.removeConnectionsForPort(mId, port);
    }

    async destroyModule(pageId, moduleId) {
        const pId = String(pageId ?? this.currentPageId);
        const pData = this.pagesData[pId];

        const mod = pData?.modules?.[moduleId];
        if (!mod) return false;

        // 1. Disconnect and remove all connections attached to this module
        const conns = pData.connections || [];
        const toRemove = conns.filter(c => c.from.moduleId === moduleId || c.to.moduleId === moduleId);
        toRemove.forEach(c => {
            this.synth.disconnect(`${pId}/${c.from.moduleId}`, c.from.port, `${pId}/${c.to.moduleId}`, c.to.port);
        });
        pData.connections = conns.filter(c => c.from.moduleId !== moduleId && c.to.moduleId !== moduleId);

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
        delete pData.modules[moduleId];
        if (pData.slots) {
            Object.entries(pData.slots).forEach(([slotIdx, mId]) => {
                if (mId === moduleId) delete pData.slots[slotIdx];
            });
        }
        if (pId === this.currentPageId) {
            this.syncGridMap();
        }

        this._destroyCount = (this._destroyCount || 0) + 1;
        return true;
    }

    destroyPage(targetPageId) {
        return this.pageManager.destroyPage(targetPageId);
    }

    reRenderModal() {
        return this.modalManager.reRenderModal();
    }

    getUserSubpatches() {
        return this.presetManager.getUserSubpatches();
    }

    saveUserSubpatch(template, isOverwrite = false) {
        return this.presetManager.saveUserSubpatch(template, isOverwrite);
    }

    deleteUserSubpatch(id) {
        return this.presetManager.deleteUserSubpatch(id);
    }

    saveCurrentSubpatchToLibrary(customName) {
        return this.presetManager.saveCurrentSubpatchToLibrary(customName);
    }

    openSubpatchExportModal(template) {
        return this.presetManager.openSubpatchExportModal(template);
    }

    openSubpatchImportModal(onImported) {
        return this.presetManager.openSubpatchImportModal(onImported);
    }

    instantiateSubpatch(subpatchId, slotIdx) {
        return this.pageManager.instantiateSubpatch(subpatchId, slotIdx);
    }

    openAddModal(slotIdx) {
        return this.modalManager.openAddModal(slotIdx);
    }

    openCustomPrompt(title, init) {
        return this.modalManager.openCustomPrompt(title, init);
    }

    openCustomAlert(title, message, details = []) {
        return this.modalManager.openCustomAlert(title, message, details);
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

        const frame = document.getElementById('phone-frame');
        const makeDraggable = (headerEl, contentEl, minMargin = 4, isFullWidth = false) => {
            if (!headerEl || !contentEl || !frame) return;
            let drag = false, dX = 0, dY = 0, initL = 0, initT = 0;
            headerEl.addEventListener('pointerdown', (e) => {
                if (e.target.closest('#dock-lock-btn') || e.target.closest('#dock-close-btn')) return;
                e.preventDefault();
                drag = true;
                headerEl.setPointerCapture(e.pointerId);
                dX = e.clientX;
                dY = e.clientY;
                contentEl.style.bottom = 'auto';
                initL = parseFloat(contentEl.style.left) || contentEl.offsetLeft;
                initT = parseFloat(contentEl.style.top) || contentEl.offsetTop;
            });
            headerEl.addEventListener('pointermove', (e) => {
                if (!drag) return;
                const fR = frame.getBoundingClientRect(), cR = contentEl.getBoundingClientRect();
                const lockX = typeof isFullWidth === 'function' ? isFullWidth() : !!isFullWidth;
                if (!lockX) {
                    contentEl.style.left = `${Math.max(minMargin, Math.min(fR.width - cR.width - minMargin, initL + e.clientX - dX))}px`;
                }
                contentEl.style.top = `${Math.max(minMargin, Math.min(fR.height - cR.height - minMargin, initT + e.clientY - dY))}px`;
                contentEl.style.bottom = 'auto';
            });
            const stop = (e) => {
                if (drag) {
                    drag = false;
                    try { headerEl.releasePointerCapture(e.pointerId); } catch (err) {}
                }
            };
            headerEl.addEventListener('pointerup', stop);
            headerEl.addEventListener('pointercancel', stop);
        };

        makeDraggable(document.getElementById('dock-header'), document.getElementById('dock-content'), 4, true);
        makeDraggable(document.getElementById('modal-header'), document.getElementById('modal-content'), 6, () => {
            const titleEl = document.getElementById('modal-title');
            return titleEl?.textContent === 'ADD MODULE';
        });

        document.getElementById('cable-opacity-btn')?.addEventListener('click', () => {
            const steps = [1.0, 0.2];
            let idx = steps.findIndex(s => Math.abs(s - this.cableOpacity) < 0.05);
            if (idx === -1) idx = 0;
            const nextIdx = (idx + 1) % steps.length;
            this.setCableOpacity(steps[nextIdx]);
        });

        document.getElementById('audio-power-btn')?.addEventListener('click', async () => {
            await this.synth.init();
            const btn = document.getElementById('audio-power-btn');
            if (this.synth.isRunning()) {
                this.synth.suspend();
                this.synth.clearAllBuffers();
                btn.className = "h-7 w-7 bg-slate-900 text-slate-400 rounded-lg border border-slate-700 flex items-center justify-center shrink-0";
                this.showToast('AUDIO STOPPED');
            } else {
                this.synth.resume();
                if (!this.synth.hasModules()) {
                    this.synth.rebuildAll(this.pagesData, (pId, id) => this.getPatchState(id, pId));
                }
                btn.className = "h-7 w-7 bg-red-950 text-red-400 rounded-lg border border-red-500 shadow-md shadow-red-500/40 flex items-center justify-center shrink-0";
                this.showToast('AUDIO RUNNING');
            }
        });

        document.getElementById('seq-play-btn')?.addEventListener('click', async () => {
            await this.synth.init();
            this.synth.resume();
            if (!this.synth.hasModules()) {
                this.synth.rebuildAll(this.pagesData, (pId, id) => this.getPatchState(id, pId));
            }
            this.synth.setPlaybackState(true);
            document.getElementById('seq-play-btn').className = "h-7 w-7 bg-red-950 text-red-400 rounded-lg border border-red-500 shadow-md shadow-red-500/40 flex items-center justify-center shrink-0";
        });

        document.getElementById('seq-stop-btn')?.addEventListener('click', () => {
            this.synth.setPlaybackState(false);
            this.synth.clearAllBuffers();
            document.getElementById('seq-play-btn').className = "h-7 w-7 bg-slate-900 text-slate-400 rounded-lg border border-slate-700 flex items-center justify-center shrink-0";
        });

        document.getElementById('seq-reset-btn')?.addEventListener('click', () => {
            this.synth.resetSequencers();
            this.synth.clearAllBuffers();
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

        this.interactionManager.bindGridEvents();

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
            const curName = this.pagesData[this.currentPageId]?.name || `SUBPATCH_${Date.now().toString().slice(-4)}`;
            const res = await this.openCustomPrompt('STOCK SUBPATCH', curName);
            if (res !== null && res.trim() !== '') {
                this.saveCurrentSubpatchToLibrary(res.trim());
            }
        });
        document.getElementById('preset-trigger-btn')?.addEventListener('click', () => {
            this.renderPresetList();
            document.getElementById('preset-manager-modal').classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
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
        document.getElementById('preset-ai-spec-top-btn')?.addEventListener('click', () => this.openAiSpecModal());
        document.getElementById('main-ai-spec-btn')?.addEventListener('click', () => this.openAiSpecModal());
        document.getElementById('json-io-backdrop')?.addEventListener('click', () => document.getElementById('json-io-modal')?.classList.add('hidden'));
        document.getElementById('close-json-io-btn')?.addEventListener('click', () => document.getElementById('json-io-modal')?.classList.add('hidden'));
    }

    updateDropHighlight() {
        return this.interactionManager.updateDropHighlight();
    }

    exportCurrentPreset() {
        return this.presetManager.exportCurrentPreset();
    }

    loadPatchData(p, name = null) {
        return this.presetManager.loadPatchData(p, name);
    }

    loadActivePreset() {
        return this.presetManager.loadActivePreset();
    }

    savePresetsDB() {
        return this.presetManager.savePresetsDB();
    }

    saveCurrentPatch() {
        return this.presetManager.saveCurrentPatch();
    }

    createNewPatch() {
        return this.presetManager.createNewPatch();
    }

    openJsonExportModal() {
        return this.presetManager.openJsonExportModal();
    }

    openJsonImportModal() {
        return this.presetManager.openJsonImportModal();
    }

    openAiSpecModal() {
        return this.presetManager.openAiSpecModal();
    }

    renderPresetList() {
        return this.presetManager.renderPresetList();
    }

    collectLiveStates() {
        const states = {};
        if (!this.synth.audioWorkletReady && !this.synth.ctx) return states;

        Object.values(this.modules).forEach(m => {
            if (!LIVE_TYPES.includes(m.type)) return;
            const fullId = `${this.currentPageId}/${m.id}`;
            const inst = this.synth.modules[fullId] || this.synth.modules[m.id];
            if (inst?.read) {
                states[m.id] = inst.read();
            }
        });
        return states;
    }

    renderLiveGrid(liveStates) {
        const modalEl = this.activePopupModuleId ? document.getElementById('modal-content') : null;
        const dockEl = this.activeDockModuleId ? document.getElementById('dock-content') : null;

        Object.values(this.modules).forEach(m => {
            const readData = liveStates[m.id];
            if (!readData) return;
            const reg = MODULE_REGISTRY[m.type];
            if (reg?.updateLive) {
                const idx = m.row * this.COLS + m.col;
                const cell = this.cells[idx] || document.getElementById(`cell-${idx}`);
                const targetModal = m.id === this.activeDockModuleId ? dockEl : modalEl;
                if (cell) reg.updateLive(cell, readData, this.synth.isPlaying, targetModal, m);
            }
        });
    }

    uiUpdateLoop(timestamp = 0) {
        requestAnimationFrame((t) => this.uiUpdateLoop(t));

        if (timestamp - this._lastUiUpdate < 32) return;
        this._lastUiUpdate = timestamp;

        const liveStates = this.collectLiveStates();
        this.renderLiveGrid(liveStates);

        // Extension point for Performance Mode / Visualizer mode
        if (typeof this.onLiveFrame === 'function') {
            this.onLiveFrame(liveStates, this.synth.isPlaying);
        }
    }
}
