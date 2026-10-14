// src/ui/managers/interaction-manager.js
import { safeClone, parseConn, generateModuleId, HIGHLIGHT_CLASSES, isSubModule } from '../../core/utils.js';
import { MODULE_REGISTRY } from '../../modules/registry.js';

export class InteractionManager {
    constructor(ui) {
        this.ui = ui;
        this.selectedModuleIds = [];
        this.isDragging = false;
        this.dropTargetIndex = null;
        this.dragMode = 'move';
        this.dragGroupOffsets = [];
        this.dragGroupValid = false;
        this.lastHighlightedCells = [];

        this._lastTap = 0;
        this._lastTapId = null;
        this._lastEmptyTap = 0;
        this._lastEmptyIdx = null;
        this._sX = 0;
        this._sY = 0;
        this._pTimer = null;
        this._lpTimer = null;
        this._copyTimer = null;
        this._dragCandidate = null;
        this.portLongPressed = false;
        this.moduleLongPressed = false;

        // Ready for future modes: 'edit', 'performance', 'visualizer'
        this.mode = 'edit';
    }

    updateSelectionClasses() {
        this.ui.gridBoard?.classList.toggle('has-selected-module', this.selectedModuleIds.length > 0);
        for (let i = 0; i < 40; i++) {
            const cell = document.getElementById(`cell-${i}`);
            if (!cell) continue;
            const mId = this.ui.gridMap[i];
            if (mId) {
                cell.classList.toggle('selected-module', this.selectedModuleIds.includes(mId));
            }
        }
        this.ui.updatePortHighlight();
    }

    updateDropHighlight() {
        this.lastHighlightedCells.forEach(c => c.classList.remove('drop-highlight-valid', 'drop-highlight-invalid', 'drop-highlight-copy-valid'));
        this.lastHighlightedCells = [];
        if (this.dropTargetIndex === null) return;
        const tR = Math.floor(this.dropTargetIndex / this.ui.COLS), tC = this.dropTargetIndex % this.ui.COLS;
        this.dragGroupValid = true;

        for (let off of this.dragGroupOffsets) {
            const r = tR + off.dRow, c = tC + off.dCol;
            if (r < 0 || r >= this.ui.ROWS || c < 0 || c >= this.ui.COLS) {
                this.dragGroupValid = false;
                break;
            }
            const occ = this.ui.gridMap[r * this.ui.COLS + c];
            if (this.dragMode === 'copy' && occ) {
                this.dragGroupValid = false;
                break;
            }
            if (this.dragMode === 'move' && occ && !this.selectedModuleIds.includes(occ)) {
                this.dragGroupValid = false;
                break;
            }
            const cell = document.getElementById(`cell-${r * this.ui.COLS + c}`);
            if (cell) this.lastHighlightedCells.push(cell);
        }

        const cls = !this.dragGroupValid ? HIGHLIGHT_CLASSES.invalid : HIGHLIGHT_CLASSES[this.dragMode];
        this.lastHighlightedCells.forEach(cell => cell.classList.add(cls));
    }

    bindGridEvents() {
        if (!this.ui.gridBoard) return;

        let hoverPortTimer = null;
        this.ui.gridBoard.addEventListener('pointerover', (e) => {
            const port = e.target.closest('.port');
            if (hoverPortTimer) {
                clearTimeout(hoverPortTimer);
                hoverPortTimer = null;
            }
            if (!port) return;
            const mId = port.dataset.moduleId, p = port.dataset.port;
            if (!mId || !p) return;
            const m = this.ui.modules[mId];
            if (m && isSubModule(m.type)) {
                hoverPortTimer = setTimeout(() => {
                    const info = this.ui.getPortDisplayInfo ? this.ui.getPortDisplayInfo(mId, p) : null;
                    if (info) {
                        const toastLabel = info.hasAlias ? info.label : p;
                        this.ui.showToast(`[${mId}] ${toastLabel}`, 1200);
                    }
                }, 300);
            }
        });
        this.ui.gridBoard.addEventListener('pointerout', (e) => {
            if (e.target.closest('.port')) {
                if (hoverPortTimer) {
                    clearTimeout(hoverPortTimer);
                    hoverPortTimer = null;
                }
            }
        });

        this.ui.gridBoard.addEventListener('click', async (e) => {
            const port = e.target.closest('.port');
            if (port) {
                if (this.portLongPressed) {
                    this.portLongPressed = false;
                    return;
                }
                if (this.selectedModuleIds.length > 0) {
                    this.ui.selectedTargetForConnection = null;
                    this.ui.updatePortHighlight();
                    return;
                }
                return this.ui.handlePortTap(port.dataset.moduleId, port.dataset.port);
            }
            if (this.ui.selectedTargetForConnection) {
                this.ui.selectedTargetForConnection = null;
                this.ui.updatePortHighlight();
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
                        const hasLocked = this.selectedModuleIds.some(id => this.ui.modules[id]?.type === 'SUB_IO');
                        if (hasLocked) {
                            this.selectedModuleIds = [];
                            this.updateSelectionClasses();
                            return this.ui.showToast('SUB_IO モジュールは削除できません（保護中）');
                        }
                        this.ui.saveHistory();
                        const targets = [...this.selectedModuleIds];
                        this.selectedModuleIds = [];
                        this.updateSelectionClasses();
                        this.ui._destroyCount = 0;
                        for (const id of targets) {
                            await this.ui.destroyModule(this.ui.currentPageId, id);
                        }
                        this.ui.updateAllCells();
                        this.ui.renderCables();
                        this.ui.showToast(`モジュールを破棄しました (${this.ui._destroyCount}個)`);
                        return;
                    }
                    this.selectedModuleIds = [];
                    this.updateSelectionClasses();
                    return;
                }
                if (this.ui.modules[mId]?.type === 'SUB_IO') {
                    return;
                }
                const now = Date.now();
                const isDoubleTap = (now - this._lastTap < 350 && this._lastTapId === mId);
                this._lastTap = now;
                this._lastTapId = mId;
                if (isDoubleTap) {
                    if (this.ui.modules[mId]?.type === 'SUB') {
                        this.ui.switchPage(this.ui.modules[mId].targetPage || 1);
                        return;
                    }
                    this.ui.openSettingsModal(mId);
                    return;
                }
                if (this.ui.modules[mId]?.type === 'THROUGH') {
                    this.ui.saveHistory();
                    this.ui.modules[mId].state = !(this.ui.modules[mId].state !== false);
                    this.ui.synth.updateModule(`${this.ui.currentPageId}/${mId}`, this.ui.modules[mId], this.ui.getPatchState(mId));
                    this.ui.renderCell(this.ui.modules[mId].row * this.ui.COLS + this.ui.modules[mId].col);
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
                if (now - this._lastEmptyTap < 350 && this._lastEmptyIdx === idx) this.ui.openAddModal(idx);
                this._lastEmptyTap = now;
                this._lastEmptyIdx = idx;
            }
        });

        this.ui.gridBoard.addEventListener('pointerdown', (e) => {
            this._sX = e.clientX;
            this._sY = e.clientY;
            const port = e.target.closest('.port');
            if (port) {
                const mId = port.dataset.moduleId, p = port.dataset.port;
                this._pTimer = setTimeout(() => {
                    this._pTimer = null;
                    const toRemove = this.ui.connections.filter(c => (c.from.moduleId === mId && c.from.port === p) || (c.to.moduleId === mId && c.to.port === p));
                    if (toRemove.length > 0) {
                        this.portLongPressed = true;
                        this.ui.selectedTargetForConnection = null;
                        this.ui.updatePortHighlight();
                        this.ui.saveHistory();
                        toRemove.forEach(c => {
                            this.ui.synth.disconnect(`${this.ui.currentPageId}/${c.from.moduleId}`, c.from.port, `${this.ui.currentPageId}/${c.to.moduleId}`, c.to.port);
                        });
                        this.ui.connections = this.ui.connections.filter(c => !((c.from.moduleId === mId && c.from.port === p) || (c.to.moduleId === mId && c.to.port === p)));

                        const affectedIds = new Set();
                        toRemove.forEach(c => {
                            affectedIds.add(c.from.moduleId);
                            affectedIds.add(c.to.moduleId);
                        });
                        affectedIds.forEach(id => {
                            if (this.ui.modules[id]) {
                                this.ui.cleanupMarkovWeights(id);
                                this.ui.synth.updateModule(`${this.ui.currentPageId}/${id}`, this.ui.modules[id], this.ui.getPatchState(id));
                            }
                        });

                        this.ui.persistCurrentPage();
                        if (this.ui.currentPageId !== 'PAGE 0' && this.ui.currentPageId !== '0') {
                            this.ui.cleanupOrphanSubConnections(this.ui.currentPageId);
                        }
                        this.ui.renderCables();
                        affectedIds.forEach(id => {
                            const mod = this.ui.modules[id];
                            if (mod) this.ui.renderCell(mod.row * this.ui.COLS + mod.col);
                        });
                        if (this.ui.activeDockModuleId && affectedIds.has(this.ui.activeDockModuleId)) this.ui.reRenderDockModal();
                        if (this.ui.activePopupModuleId && affectedIds.has(this.ui.activePopupModuleId)) this.ui.reRenderModal();
                        this.ui.updatePortHighlight();
                        this.ui.showToast('端子の結線を切断しました');
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
                this.selectedModuleIds = this.selectedModuleIds.includes(mId) ? this.selectedModuleIds.filter(x => x !== mId) : [...this.selectedModuleIds, mId];
                if (this.ui.selectedTargetForConnection) {
                    this.ui.selectedTargetForConnection = null;
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
                if (this.ui.selectedTargetForConnection) {
                    this.ui.selectedTargetForConnection = null;
                }
                this.updateSelectionClasses();
                this.isDragging = true;
                this.dragMode = 'move';

                const baseM = this.ui.modules[this._dragCandidate];
                this.dragGroupOffsets = this.selectedModuleIds.map(id => {
                    const mod = this.ui.modules[id];
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
            if (this.portLongPressed) {
                setTimeout(() => { this.portLongPressed = false; }, 80);
            }
            if (this.moduleLongPressed) {
                setTimeout(() => { this.moduleLongPressed = false; }, 80);
            }
            if (this.isDragging) {
                this.isDragging = false;
                this.lastHighlightedCells.forEach(c => c.classList.remove('drop-highlight-valid', 'drop-highlight-invalid', 'drop-highlight-copy-valid'));
                this.lastHighlightedCells = [];
                if (this.dropTargetIndex !== null && this.dragGroupValid) {
                    this.ui.saveHistory();
                    const tR = Math.floor(this.dropTargetIndex / this.ui.COLS), tC = this.dropTargetIndex % this.ui.COLS;
                    if (this.dragMode === 'copy') {
                        const idMap = {};
                        let subCopied = false;
                        let lastCopiedSubName = '';

                        this.dragGroupOffsets.forEach(off => {
                            const src = this.ui.modules[off.id];
                            const newId = generateModuleId(src.type, this.ui.modules);
                            idMap[off.id] = newId;
                            const copy = safeClone(src);
                            copy.id = newId;
                            copy.row = tR + off.dRow;
                            copy.col = tC + off.dCol;
                            MODULE_REGISTRY[copy.type]?.onClone?.(copy, src);

                            if (copy.type === 'SUB') {
                                subCopied = true;
                                const srcPageId = String(src.targetPage ?? 1);
                                const srcPageData = this.ui.pagesData[srcPageId];
                                const srcName = srcPageData?.name || `SUBPATCH ${srcPageId}`;

                                const res = this.ui.pageManager.createSubpatchInstance({
                                    pageData: srcPageData,
                                    name: srcName,
                                    subType: src.subType,
                                    manifest: src.manifest,
                                    col: tC + off.dCol,
                                    row: tR + off.dRow,
                                    moduleId: newId,
                                    skipBridgeLink: true
                                });
                                copy.targetPage = res.pageNum;
                                if (src.subType) copy.subType = src.subType;
                                if (src.manifest) copy.manifest = safeClone(src.manifest);
                                lastCopiedSubName = res.name;
                            } else {
                                this.ui.modules[newId] = copy;
                                this.ui.synth.addModule(`${this.ui.currentPageId}/${newId}`, copy.type, copy, this.ui.getPatchState(newId));
                            }
                        });

                        this.ui.connections.forEach(c => {
                            if (idMap[c.from.moduleId] && idMap[c.to.moduleId]) {
                                const nC = { from: { moduleId: idMap[c.from.moduleId], port: c.from.port }, to: { moduleId: idMap[c.to.moduleId], port: c.to.port } };
                                this.ui.connections.push(nC);
                                this.ui.synth.connect(`${this.ui.currentPageId}/${nC.from.moduleId}`, nC.from.port, `${this.ui.currentPageId}/${nC.to.moduleId}`, nC.to.port);
                            }
                        });

                        if (subCopied) {
                            this.ui.synth.linkSubBridges();
                            this.ui.showToast(`サブパッチ「${lastCopiedSubName}」を新規複製しました`);
                        } else {
                            this.ui.showToast(`${this.dragGroupOffsets.length}個コピーしました`);
                        }
                    } else {
                        this.dragGroupOffsets.forEach(off => {
                            const m = this.ui.modules[off.id];
                            m.row = tR + off.dRow;
                            m.col = tC + off.dCol;
                        });
                        this.ui.showToast(`${this.dragGroupOffsets.length}個移動しました`);
                    }
                    this.ui.syncGridMap();
                    this.selectedModuleIds = [];
                    this.ui.updateAllCells();
                    this.ui.renderCables();
                }
            }
        };

        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', () => {
            stopDrag();
            this.portLongPressed = false;
            this.moduleLongPressed = false;
        });
    }
}

