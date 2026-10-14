// src/ui/managers/page-manager.js
import { safeClone, generateModuleId, parseConn } from '../../core/utils.js';
import { parsePatch } from '../../core/patch.js';
import { FACTORY_SUBPATCHES, findSubpatchTemplate } from '../../presets/subpatches.js';

export class PageManager {
    constructor(ui) {
        this.ui = ui;
        this.currentPageId = "0";
        this.pagesData = { "0": { slots: {}, modules: {}, connections: [] } };
        this.pageStack = [];
        this.historyStack = [];
    }

    getNestingDepth(pageId) {
        let pId = String(pageId ?? this.currentPageId);
        let depth = 0;
        const visited = new Set();
        while (pId !== "0" && !visited.has(pId)) {
            visited.add(pId);
            let parentPageId = null;
            for (const [pKey, pData] of Object.entries(this.pagesData)) {
                const mods = pKey === this.currentPageId ? this.ui.modules : (pData?.modules || {});
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

    getNextAvailablePageId() {
        const existing = new Set(Object.keys(this.pagesData));
        Object.values(this.pagesData).forEach(p => {
            Object.values(p.modules || {}).forEach(m => {
                if (m && m.type === 'SUB' && m.targetPage) existing.add(String(m.targetPage));
            });
        });
        Object.values(this.ui.modules).forEach(m => {
            if (m && m.type === 'SUB' && m.targetPage) existing.add(String(m.targetPage));
        });
        let num = 1;
        while (existing.has(String(num))) num++;
        return num;
    }

    get currentPageData() {
        const cId = String(this.currentPageId);
        if (!this.pagesData[cId]) {
            this.pagesData[cId] = {
                name: cId === "0" ? "MAIN" : `SUBPATCH ${cId}`,
                slots: {},
                modules: {},
                connections: []
            };
        }
        return this.pagesData[cId];
    }

    persistCurrentPage() {
        const cur = this.currentPageData;
        const slots = {};
        Object.entries(cur.modules || {}).forEach(([id, m]) => {
            const slotIdx = m.row * this.ui.COLS + m.col;
            slots[String(slotIdx)] = id;
        });
        cur.slots = slots;
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
            this.ui.synth.addModule(`${targetId}/SUB_IO1`, 'SUB_IO', ioMod, this.ui.getPatchState('SUB_IO1', targetId));
        }

        const targetData = this.pagesData[targetId];
        this.ui.modules = targetData.modules || {};
        this.ui.connections = targetData.connections || [];
        this.ui.selectedModuleIds = [];
        this.ui.selectedTargetForConnection = null;

        this.ui.syncGridMap();
        this.ui.updateAllCells();
        this.ui.renderCables();
        this.updatePageNavUI();

        const pName = this.pagesData[targetId]?.name;
        this.ui.showToast(targetId === "0" ? 'MAIN' : (pName || `SUBPATCH ${targetId}`));
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
        this.persistCurrentPage();
        this.historyStack.push({
            pageId: this.currentPageId,
            pagesData: safeClone(this.pagesData)
        });
        if (this.historyStack.length > 10) this.historyStack.shift();
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.removeAttribute('disabled');
            undoBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        }
    }

    undo() {
        if (!this.historyStack.length) return;
        const prev = this.historyStack.pop();
        this.currentPageId = prev.pageId || "0";
        this.pagesData = prev.pagesData || { "0": { slots: {}, modules: {}, connections: [] } };
        const curPage = this.pagesData[this.currentPageId] || { slots: {}, modules: {}, connections: [] };
        this.ui.modules = curPage.modules || {};
        this.ui.connections = curPage.connections || [];
        this.ui.syncGridMap();
        this.ui.synth.rebuildAll(this.pagesData, (p, id) => this.ui.getPatchState(id, p));
        this.ui.updateAllCells();
        this.ui.renderCables();
        this.updatePageNavUI();
        if (!this.historyStack.length) {
            const undoBtn = document.getElementById('undo-btn');
            if (undoBtn) {
                undoBtn.setAttribute('disabled', 'true');
                undoBtn.classList.add('opacity-40', 'cursor-not-allowed');
            }
        }
        this.ui.showToast('元に戻しました (UNDO)');
    }

    destroyPage(targetPageId) {
        const pId = String(targetPageId);
        if (pId === "0") return; // Page 0 (MAIN) cannot be destroyed

        // If the user was viewing this destroyed page, navigate back to Page 0 safely
        if (this.currentPageId === pId) {
            this.currentPageId = "0";
            const mainPage = this.pagesData["0"] || { slots: {}, modules: {}, connections: [] };
            this.ui.modules = mainPage.modules || {};
            this.ui.connections = mainPage.connections || [];
            this.ui.syncGridMap();
            this.updatePageNavUI();
            this.ui.updateAllCells();
            this.ui.renderCables();
        }

        // Completely delete subpage container from memory
        delete this.pagesData[pId];
    }

    resolveUniqueSubpatchName(preferredName) {
        const cleanBase = (preferredName || 'SUBPATCH').replace(/_\d+$/, '');
        const allNames = Object.values(this.pagesData).map(p => p.name).filter(Boolean);
        if (!allNames.includes(cleanBase)) return cleanBase;
        let suffix = 1;
        while (allNames.includes(`${cleanBase}_${suffix}`)) {
            suffix++;
        }
        return `${cleanBase}_${suffix}`;
    }

    createSubpatchInstance({ pageData, name, slotIdx, col, row, moduleId, subType, manifest, skipBridgeLink = false } = {}) {
        const newPageNum = this.getNextAvailablePageId();
        const newPageId = String(newPageNum);

        const subName = name ? this.resolveUniqueSubpatchName(name) : `SUBPATCH ${newPageId}`;

        let clonedPageData;
        if (pageData) {
            if (pageData.pages) {
                const normalized = parsePatch(pageData, this.ui.COLS, this.ui.userSubpatches);
                clonedPageData = normalized.pages["0"] || normalized.pages[Object.keys(normalized.pages)[0]];
            } else if (pageData.modules) {
                const normalized = parsePatch({ pages: { "0": pageData } }, this.ui.COLS, this.ui.userSubpatches);
                clonedPageData = normalized.pages["0"];
            } else {
                const normalized = parsePatch({ pages: { "0": pageData } }, this.ui.COLS, this.ui.userSubpatches);
                clonedPageData = normalized.pages["0"];
            }
        } else {
            const ioMod = { type: 'SUB_IO', id: 'SUB_IO1', col: 2, row: 0 };
            clonedPageData = {
                slots: { "2": "SUB_IO1" },
                modules: { "SUB_IO1": ioMod },
                connections: []
            };
        }

        clonedPageData.name = subName;
        if (subType) clonedPageData.subType = subType;
        if (manifest) clonedPageData.manifest = safeClone(manifest);
        this.pagesData[newPageId] = clonedPageData;

        const c = col !== undefined ? col : (slotIdx !== undefined ? slotIdx % this.ui.COLS : 0);
        const r = row !== undefined ? row : (slotIdx !== undefined ? Math.floor(slotIdx / this.ui.COLS) : 0);
        const newId = moduleId || generateModuleId('SUB', this.ui.modules);

        const subMod = {
            type: 'SUB',
            id: newId,
            col: c,
            row: r,
            targetPage: newPageNum
        };
        if (subType) subMod.subType = subType;
        if (manifest) subMod.manifest = safeClone(manifest);

        this.ui.modules[newId] = subMod;
        this.ui.syncGridMap();

        // Incrementally instantiate subpage audio nodes without stopping playback
        Object.entries(clonedPageData.modules || {}).forEach(([mId, m]) => {
            const fullId = `${newPageId}/${mId}`;
            this.ui.synth.addModule(fullId, m.type, m, this.ui.getPatchState(mId, newPageId));
        });

        (clonedPageData.connections || []).forEach(cItem => {
            const connObj = parseConn(cItem);
            if (connObj) {
                this.ui.synth.connect(
                    `${newPageId}/${connObj.from.moduleId}`, connObj.from.port,
                    `${newPageId}/${connObj.to.moduleId}`, connObj.to.port
                );
            }
        });

        // Add main SUB module and link bridges
        this.ui.synth.addModule(`${this.currentPageId}/${newId}`, 'SUB', subMod, this.ui.getPatchState(newId));
        if (!skipBridgeLink) {
            this.ui.synth.linkSubBridges();
        }

        return {
            success: true,
            pageId: newPageId,
            pageNum: newPageNum,
            moduleId: newId,
            subMod,
            pageData: clonedPageData,
            name: subName
        };
    }

    instantiateSubpatch(subpatchId, slotIdx) {
        const template = findSubpatchTemplate(subpatchId) || (this.ui.userSubpatches && this.ui.userSubpatches[subpatchId]);
        if (!template) {
            return { success: false, error: `Subpatch template '${subpatchId}' not found` };
        }
        const depth = this.getNestingDepth(this.currentPageId);
        if (depth >= 3) {
            this.ui.showToast("サブパッチの最大階層（3階層）に達したためこれ以上ネストできません");
            return { success: false, error: "Max subpatch nesting depth (3) reached" };
        }

        this.saveHistory();
        const res = this.createSubpatchInstance({
            pageData: template.pageData,
            name: template.name,
            subType: template.subType || template.id,
            manifest: template.manifest,
            slotIdx
        });

        if (res && res.pageId && this.pagesData[res.pageId]) {
            this.pagesData[res.pageId].sourceTemplateId = subpatchId;
            this.pagesData[res.pageId].subType = template.subType || template.id;
            if (template.manifest) {
                this.pagesData[res.pageId].manifest = safeClone(template.manifest);
            }
        }

        this.ui.renderCell(slotIdx);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        this.persistCurrentPage();
        this.ui.showToast(`サブパッチ「${res.name}」を配置しました`);
        return { success: true, page: res.pageNum, pageId: res.pageId, moduleId: res.moduleId, subpatch: res.name };
    }
}

