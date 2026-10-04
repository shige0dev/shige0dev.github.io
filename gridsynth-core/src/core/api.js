import { MODULE_REGISTRY } from '../modules/registry.js';
import { parseConn, isSameConn, safeClone } from './utils.js';
import { FACTORY_SUBPATCHES } from '../presets/subpatches.js';

export function initExternalAPI(ui, synth) {
    window.GridSynthAPI = {
        getCatalog: () => ({
            modules: Object.fromEntries(
                Object.entries(MODULE_REGISTRY).map(([t, def]) => [
                    t,
                    { type: t, ports: def.ports?.({}), schema: def.schema }
                ])
            ),
            subpatches: {
                factory: Object.values(FACTORY_SUBPATCHES),
                user: Object.values(ui.getUserSubpatches ? ui.getUserSubpatches() : {})
            }
        }),

        getState: () => ({
            bpm: synth.masterBPM,
            isPlaying: synth.isPlaying,
            currentPage: ui.currentPageId,
            pages: ui.pagesData,
            patch: ui.exportCurrentPreset()
        }),

        loadPatch: (patchJson) => {
            try {
                const data = typeof patchJson === 'string' ? JSON.parse(patchJson) : patchJson;
                ui.loadPatchData(data, 'API_PATCH');
                return { success: true };
            } catch (err) {
                return { success: false, error: err.message };
            }
        },

        exportPatch: () => ui.exportCurrentPreset(),

        switchPage: (page) => {
            try {
                ui.switchPage(page);
                return { success: true, page: ui.currentPageId };
            } catch (err) {
                return { success: false, error: err.message };
            }
        },

        setPageName: (page, name) => {
            const p = String(page);
            if (!ui.pagesData[p]) ui.pagesData[p] = { slots: {}, modules: {}, connections: [] };
            ui.pagesData[p].name = name;
            ui.updatePageNavUI();
            ui.updateAllCells();
            return { success: true, page: p, name };
        },

        setParam: (arg1, arg2, arg3, arg4) => {
            let p = "0", mId = null, prop = null, value = null;
            if (typeof arg1 === 'object' && arg1 !== null) {
                p = String(arg1.page ?? "0");
                mId = arg1.moduleId;
                prop = arg1.param;
                value = arg1.value;
            } else if (typeof arg1 === 'string' && arg1.includes('/')) {
                const parts = arg1.split('/');
                p = parts[0];
                mId = parts[1];
                prop = parts[2];
                value = arg2;
            } else {
                p = String(arg1);
                mId = arg2;
                prop = arg3;
                value = arg4;
            }

            const targetPageData = ui.pagesData[p];
            if (targetPageData?.modules && targetPageData.modules[mId]) {
                targetPageData.modules[mId][prop] = value;
                if (p === ui.currentPageId && ui.modules[mId]) {
                    ui.modules[mId][prop] = value;
                    ui.renderCell(ui.modules[mId].row * ui.COLS + ui.modules[mId].col);
                }
                synth.updateModule(`${p}/${mId}`, targetPageData.modules[mId], ui.getPatchState(mId, p));
                return { success: true, page: p, moduleId: mId, param: prop, value };
            }
            return { success: false, error: `Module '${mId}' not found on page '${p}'` };
        },

        connectCable: (arg1, arg2) => {
            let p = "0", from = null, to = null;
            if (typeof arg1 === 'object' && arg1 !== null && (arg1.from || arg1.connection)) {
                p = String(arg1.page ?? "0");
                if (arg1.connection) {
                    const c = parseConn(arg1.connection);
                    if (c) { from = c.from; to = c.to; }
                } else {
                    from = arg1.from;
                    to = arg1.to;
                }
            } else if (arg2 === undefined) {
                p = "0";
                const c = parseConn(arg1);
                if (c) { from = c.from; to = c.to; }
            } else {
                p = String(arg1);
                const c = parseConn(arg2);
                if (c) { from = c.from; to = c.to; }
            }

            if (!from || !to) return { success: false, error: "Invalid connection descriptor" };
            const cObj = { from, to };
            if (!ui.pagesData[p]) {
                ui.pagesData[p] = { slots: {}, modules: {}, connections: [] };
            }
            ui.pagesData[p].connections.push(cObj);
            synth.connect(`${p}/${from.moduleId}`, from.port, `${p}/${to.moduleId}`, to.port);
            if (p === ui.currentPageId) {
                ui.connections = ui.pagesData[p].connections;
                ui.renderCables();
            }
            return { success: true, page: p, connection: cObj };
        },

        disconnectCable: (arg1, arg2) => {
            let p = "0", from = null, to = null;
            if (typeof arg1 === 'object' && arg1 !== null && (arg1.from || arg1.connection)) {
                p = String(arg1.page ?? "0");
                if (arg1.connection) {
                    const c = parseConn(arg1.connection);
                    if (c) { from = c.from; to = c.to; }
                } else {
                    from = arg1.from;
                    to = arg1.to;
                }
            } else if (arg2 === undefined) {
                p = "0";
                const c = parseConn(arg1);
                if (c) { from = c.from; to = c.to; }
            } else {
                p = String(arg1);
                const c = parseConn(arg2);
                if (c) { from = c.from; to = c.to; }
            }

            if (!from || !to || !ui.pagesData[p]) return { success: false, error: "Invalid connection or page not found" };
            const cObj = { from, to };
            ui.pagesData[p].connections = ui.pagesData[p].connections.filter(x => !isSameConn(x, cObj));
            synth.disconnect(`${p}/${from.moduleId}`, from.port, `${p}/${to.moduleId}`, to.port);
            if (p === ui.currentPageId) {
                ui.connections = ui.pagesData[p].connections;
                ui.renderCables();
            }
            return { success: true, page: p, connection: cObj };
        },

        setPlayback: (arg1, arg2) => {
            let isPlaying = false, bpm = null;
            if (typeof arg1 === 'object' && arg1 !== null) {
                isPlaying = !!arg1.isPlaying;
                bpm = arg1.bpm;
            } else {
                isPlaying = !!arg1;
                bpm = arg2;
            }
            if (bpm) synth.setBPM(bpm);
            synth.setPlaybackState(isPlaying);
            return { success: true, isPlaying: synth.isPlaying, bpm: synth.masterBPM };
        },

        // Subpatch Library Management APIs (MCP / REST Ready)
        getSubpatches: () => ({
            factory: Object.values(FACTORY_SUBPATCHES),
            user: Object.values(ui.getUserSubpatches ? ui.getUserSubpatches() : {})
        }),

        saveUserSubpatch: (params) => {
            const pageId = String(params.pageId ?? ui.currentPageId);
            if (pageId === "0") return { success: false, error: "Cannot save main page 0 as subpatch" };
            const pData = ui.pagesData[pageId];
            if (!pData) return { success: false, error: `Subpage ${pageId} does not exist` };

            const name = (params.name || pData.name || `SUBPATCH ${pageId}`).trim();
            const id = params.id || `USER_SUB_${Date.now()}`;
            const template = {
                id,
                name,
                category: params.category || 'User Custom',
                isSystem: false,
                description: params.description || '',
                pins: params.pins || {},
                pageData: safeClone(pData)
            };
            template.pageData.name = name;

            ui.saveUserSubpatch(template);
            return { success: true, subpatch: template };
        },

        deleteUserSubpatch: (id) => {
            if (FACTORY_SUBPATCHES[id]) {
                return { success: false, error: "Cannot delete system factory subpatches" };
            }
            const ok = ui.deleteUserSubpatch(id);
            return { success: ok, id };
        },

        instantiateSubpatch: (params) => {
            const subId = params.subpatchId;
            const slotIdx = parseInt(params.slot ?? 0, 10);
            return ui.instantiateSubpatch(subId, slotIdx);
        },

        removeModule: async (params) => {
            let page = "0", mId = null;
            if (typeof params === 'object' && params !== null) {
                page = String(params.page ?? ui.currentPageId);
                mId = params.moduleId;
            } else if (typeof params === 'string' && params.includes('/')) {
                const parts = params.split('/');
                page = parts[0];
                mId = parts[1];
            } else {
                page = String(ui.currentPageId);
                mId = params;
            }
            if (!mId) return { success: false, error: "Module ID is required" };
            ui._destroyCount = 0;
            const ok = await ui.destroyModule(page, mId);
            if (ok) {
                ui.updateAllCells();
                ui.renderCables();
                ui.showToast(`モジュールを破棄しました (${ui._destroyCount}個)`);
            }
            return { success: ok, page, moduleId: mId, totalDestroyed: ui._destroyCount };
        }
    };

    window.addEventListener('message', async (e) => {
        const d = e.data;
        if (!d || d.type !== 'GRIDSYNTH_API_REQUEST') return;
        let res = null;
        try {
            if (d.action === 'SET_PARAM') {
                res = window.GridSynthAPI.setParam(d.payload);
            } else if (d.action === 'CONNECT') {
                res = window.GridSynthAPI.connectCable(d.payload);
            } else if (d.action === 'DISCONNECT') {
                res = window.GridSynthAPI.disconnectCable(d.payload);
            } else if (d.action === 'LOAD_PATCH') {
                res = window.GridSynthAPI.loadPatch(d.payload.patch);
            } else if (d.action === 'PLAY') {
                res = window.GridSynthAPI.setPlayback({ isPlaying: true, bpm: d.payload?.bpm });
            } else if (d.action === 'STOP') {
                res = window.GridSynthAPI.setPlayback({ isPlaying: false });
            } else if (d.action === 'GET_STATE') {
                res = window.GridSynthAPI.getState();
            } else if (d.action === 'INSTANTIATE_SUBPATCH') {
                res = window.GridSynthAPI.instantiateSubpatch(d.payload);
            } else if (d.action === 'REMOVE_MODULE') {
                res = await window.GridSynthAPI.removeModule(d.payload);
            }
            if (e.source && d.requestId) {
                e.source.postMessage({ type: 'GRIDSYNTH_API_RESPONSE', requestId: d.requestId, result: res }, '*');
            }
        } catch (err) {
            if (e.source && d.requestId) {
                e.source.postMessage({ type: 'GRIDSYNTH_API_RESPONSE', requestId: d.requestId, error: err.message }, '*');
            }
        }
    });
}
