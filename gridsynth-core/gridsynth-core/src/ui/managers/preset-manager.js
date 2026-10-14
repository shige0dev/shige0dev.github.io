import { safeClone, parseConn } from '../../core/utils.js';
import { parsePatch, exportPatch, createDefaultPatchData, checkMarkovUnconnectedWeights } from '../../core/patch.js';
import { getDefaultPresets } from '../../presets/default.js';
import { AI_PATCH_SPEC_CONTENT } from '../../presets/ai-spec-content.js';

export class PresetManager {
    constructor(ui) {
        this.ui = ui;
        const defs = getDefaultPresets();
        this.DEMO_KEYS = Object.keys(defs);
        this.demoAccordionOpen = false;

        try {
            this.userSubpatches = JSON.parse(localStorage.getItem('gridsynth_user_subpatches')) || {};
        } catch (e) {
            this.userSubpatches = {};
        }

        try {
            const stored = JSON.parse(localStorage.getItem('gridsynth_presets_db')) || {};
            this.presets = {};
            Object.entries(stored).forEach(([k, v]) => {
                if (v && v.pages && v.pages["0"] && !k.startsWith('DEMO')) {
                    this.presets[k] = v;
                }
            });
        } catch (e) {
            this.presets = {};
        }

        this.DEMO_KEYS.forEach(k => {
            this.presets[k] = defs[k];
        });

        try {
            const order = JSON.parse(localStorage.getItem('gridsynth_preset_order')) || [];
            this.presetOrder = order.filter(k => this.presets[k] && !k.startsWith('DEMO'));
            this.DEMO_KEYS.forEach(k => {
                if (!this.presetOrder.includes(k)) this.presetOrder.push(k);
            });
        } catch (e) {
            this.presetOrder = [...this.DEMO_KEYS];
        }

        this.currentPresetKey = this.presets['01_DELAY_TECHNO'] ? '01_DELAY_TECHNO' : (this.presetOrder[0] || Object.keys(this.presets)[0]);
    }

    getUserSubpatches() {
        return this.userSubpatches || {};
    }

    saveUserSubpatch(template, isOverwrite = false) {
        if (!this.userSubpatches) this.userSubpatches = {};
        this.userSubpatches[template.id] = template;
        localStorage.setItem('gridsynth_user_subpatches', JSON.stringify(this.userSubpatches));
        if (isOverwrite) {
            this.ui.showToast(`サブパッチ「${template.name}」を上書きストックしました`);
        } else {
            this.ui.showToast(`サブパッチ「${template.name}」をストックしました（＋ ADD MODULE から呼び出せます）`);
        }
    }

    deleteUserSubpatch(id) {
        if (this.userSubpatches && this.userSubpatches[id]) {
            const name = this.userSubpatches[id].name;
            delete this.userSubpatches[id];
            localStorage.setItem('gridsynth_user_subpatches', JSON.stringify(this.userSubpatches));
            this.ui.showToast(`サブパッチ「${name}」を削除しました`);
            return true;
        }
        return false;
    }

    saveCurrentSubpatchToLibrary(customName) {
        if (this.ui.currentPageId === "0") {
            this.ui.showToast("メインページはサブパッチとして保存できません");
            return;
        }
        this.ui.persistCurrentPage();
        const pData = this.ui.pagesData[this.ui.currentPageId];
        if (!pData) return;
        const name = (customName || pData.name || `SUBPATCH ${this.ui.currentPageId}`).trim();
        if (!name) return;

        const userSubs = this.getUserSubpatches();
        let existingEntry = null;
        if (pData.sourceTemplateId && userSubs[pData.sourceTemplateId]) {
            const src = userSubs[pData.sourceTemplateId];
            if (src.name.trim().toLowerCase() === name.toLowerCase()) {
                existingEntry = src;
            }
        }
        if (!existingEntry) {
            existingEntry = Object.values(userSubs).find(s => s && s.name && s.name.trim().toLowerCase() === name.toLowerCase());
        }

        const id = existingEntry ? existingEntry.id : `USER_SUB_${Date.now()}`;
        const isOverwrite = !!existingEntry;

        const template = {
            id,
            subType: pData.subType || id,
            format: 'gridsynth-submodule',
            version: '2.1',
            name,
            category: 'User Custom',
            author: 'User',
            isSystem: false,
            description: pData.manifest?.description || `${Object.keys(pData.modules || {}).length} modules`,
            manifest: pData.manifest || { description: '', ports: {} },
            pins: {},
            pageData: safeClone(pData)
        };
        delete template.pageData.sourceTemplateId;
        template.pageData.name = name;
        this.saveUserSubpatch(template, isOverwrite);
        pData.sourceTemplateId = id;
    }

    openSubpatchExportModal(template) {
        const modal = document.getElementById('json-io-modal');
        const title = document.getElementById('json-io-title');
        const icon = document.getElementById('json-io-icon');
        const textarea = document.getElementById('json-io-textarea');
        const footer = document.getElementById('json-io-footer');
        if (!modal || !textarea || !template) return;

        const exportData = {
            format: "gridsynth-submodule",
            version: "2.1",
            subType: template.subType || template.id,
            name: template.name || 'SUBPATCH',
            category: template.category || 'User Custom',
            author: template.author || 'User',
            manifest: template.manifest || {
                description: template.description || '',
                ports: {}
            },
            slots: template.pageData?.slots || {},
            modules: template.pageData?.modules || {},
            connections: template.pageData?.connections || []
        };
        const jsonStr = JSON.stringify(exportData, null, 2);

        if (title) title.textContent = `SUBPATCH EXPORT (${template.name})`;
        if (icon) icon.setAttribute('data-lucide', 'package');
        textarea.value = jsonStr;
        textarea.readOnly = true;

        if (footer) {
            const modCount = Object.keys(exportData.pageData?.modules || {}).length;
            const connCount = (exportData.pageData?.connections || []).length;
            footer.innerHTML = `
                <div class="text-[8px] text-slate-400 font-mono flex items-center gap-2">
                    <span>MODULES: ${modCount}</span>
                    <span>CONNS: ${connCount}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <button id="json-copy-btn" class="h-6 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] rounded-lg transition flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer">
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
                    this.ui.showToast(`サブパッチ「${template.name}」のJSONをコピーしました`);
                    setTimeout(() => {
                        const bt = document.getElementById('json-copy-btn-text');
                        if (bt) bt.textContent = 'COPY TO CLIPBOARD';
                    }, 2000);
                }).catch(() => {
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    this.ui.showToast('選択部分をコピーしました');
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

    openSubpatchImportModal(onImported) {
        const modal = document.getElementById('json-io-modal');
        const title = document.getElementById('json-io-title');
        const icon = document.getElementById('json-io-icon');
        const textarea = document.getElementById('json-io-textarea');
        const footer = document.getElementById('json-io-footer');
        if (!modal || !textarea) return;

        if (title) title.textContent = 'SUBPATCH JSON IMPORT';
        if (icon) icon.setAttribute('data-lucide', 'package-plus');
        textarea.value = '';
        textarea.placeholder = 'ここにサブパッチの JSON テキストを貼り付けてください...';
        textarea.readOnly = false;

        if (footer) {
            footer.innerHTML = `
                <button id="json-paste-btn" class="h-6 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer">
                    <i data-lucide="clipboard" class="w-3 h-3 pointer-events-none"></i>PASTE
                </button>
                <div class="flex items-center gap-1.5">
                    <button id="sub-import-apply-btn" class="h-6 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] rounded-lg transition flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer">
                        <i data-lucide="archive" class="w-3 h-3 pointer-events-none"></i>
                        <span>IMPORT TO STOCK</span>
                    </button>
                </div>
            `;

            document.getElementById('json-paste-btn')?.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        textarea.value = text;
                        this.ui.showToast('クリップボードから貼り付けました');
                    }
                } catch (e) {
                    this.ui.showToast('貼り付けは手動 (Ctrl+V) で行ってください');
                }
            });

            document.getElementById('sub-import-apply-btn')?.addEventListener('click', () => {
                const text = textarea.value.trim();
                if (!text) return this.ui.showToast('JSONテキストが空です');
                try {
                    const parsed = JSON.parse(text);
                    let pageData = null;
                    if (parsed.pageData && (parsed.pageData.modules || parsed.pageData.slots)) {
                        pageData = parsed.pageData;
                    } else if (parsed.pages && parsed.pages["0"]) {
                        pageData = parsed.pages["0"];
                    } else if (parsed.modules || parsed.slots) {
                        pageData = {
                            slots: parsed.slots || {},
                            modules: parsed.modules || {},
                            connections: parsed.connections || []
                        };
                    }

                    if (!pageData || !pageData.modules) {
                        return this.ui.showToast('有効なサブパッチデータが見つかりません');
                    }

                    const name = (parsed.name || pageData.name || `IMPORTED_${Date.now().toString().slice(-4)}`).trim();
                    const template = {
                        id: `USER_SUB_${Date.now()}`,
                        subType: parsed.subType || undefined,
                        format: 'gridsynth-submodule',
                        version: '2.1',
                        name,
                        category: parsed.category || 'User Custom',
                        author: parsed.author || 'User',
                        isSystem: false,
                        description: parsed.description || parsed.manifest?.description || `${Object.keys(pageData.modules || {}).length} modules`,
                        manifest: parsed.manifest || { description: parsed.description || '', ports: {} },
                        pins: parsed.pins || {},
                        pageData: safeClone(pageData)
                    };
                    delete template.pageData.sourceTemplateId;
                    template.pageData.name = name;

                    this.saveUserSubpatch(template, false);
                    modal.classList.add('hidden');
                    if (typeof onImported === 'function') onImported(template);
                } catch (err) {
                    this.ui.showToast('JSONの構文エラーです: ' + err.message);
                }
            });
        }

        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
            textarea.focus();
            textarea.select();
        }, 50);
    }

    exportCurrentPreset() {
        this.ui.persistCurrentPage();
        return exportPatch(this.ui.pagesData, this.ui.synth.masterBPM, this.ui.COLS);
    }

    loadPatchData(p, name = null) {
        if (!p) return;
        if (name) {
            this.currentPresetKey = name;
            this.presets[name] = p;
        }

        const parsed = parsePatch(p, this.ui.COLS, this.ui.userSubpatches);
        if (parsed.bpm) {
            this.ui.synth.setBPM(parsed.bpm);
        }
        this.ui.updatePresetDisplay(this.currentPresetKey, parsed.bpm);

        this.ui.pagesData = parsed.pages;
        this.ui.currentPageId = "0";
        this.ui.modules = this.ui.pagesData["0"]?.modules || {};
        this.ui.connections = this.ui.pagesData["0"]?.connections || [];
        this.ui.syncGridMap();
        this.ui.synth.rebuildAll(this.ui.pagesData, (pId, id) => this.ui.getPatchState(id, pId));
        this.ui.updateAllCells();
        this.ui.updatePageNavUI();
        requestAnimationFrame(() => this.ui.renderCables());

        // マルコフ連鎖 未結線ウェイトの警告チェック
        const markovWarnings = checkMarkovUnconnectedWeights(this.ui.pagesData);
        if (markovWarnings.length > 0) {
            const details = markovWarnings.map(w =>
                `${w.moduleId}:${w.port} (weight: ${w.weight})${w.pageName}`
            );
            setTimeout(() => {
                this.ui.openCustomAlert(
                    'MARKOV 結線警告',
                    'ウエイトが設定されていますが結線されていない出力端子があります。この枝に遷移すると連鎖が停止（演奏中断）します：',
                    details
                );
            }, 100);
        }
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
        if (this.DEMO_KEYS.includes(this.currentPresetKey)) return this.ui.showToast('DEMOパッチは上書きできません');
        this.presets[this.currentPresetKey] = this.exportCurrentPreset();
        this.savePresetsDB();
        this.ui.showToast(`"${this.currentPresetKey}" を上書き保存しました`);
    }

    createNewPatch() {
        const name = `PATCH_${Date.now().toString().slice(-4)}`;
        this.presets[name] = createDefaultPatchData(120);
        this.presetOrder.unshift(name);
        this.currentPresetKey = name;
        this.savePresetsDB();
        this.loadActivePreset();
        this.renderPresetList();
        this.ui.showToast(`新規作成: ${name}`);
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
        if (icon) icon.setAttribute('data-lucide', 'upload');
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
                    this.ui.showToast('パッチJSONをクリップボードにコピーしました');
                    setTimeout(() => {
                        const bt = document.getElementById('json-copy-btn-text');
                        if (bt) bt.textContent = 'COPY TO CLIPBOARD';
                    }, 2000);
                }).catch(() => {
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    this.ui.showToast('選択部分をコピーしました');
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
        if (icon) icon.setAttribute('data-lucide', 'download');
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
                        this.ui.showToast('クリップボードから貼り付けました');
                    }
                } catch (e) {
                    this.ui.showToast('貼り付けは手動 (Ctrl+V) で行ってください');
                }
            });

            const parseAndValidate = () => {
                const text = textarea.value.trim();
                if (!text) {
                    this.ui.showToast('JSONテキストが空です');
                    return null;
                }
                try {
                    const parsed = JSON.parse(text);
                    if (!parsed.pages && !parsed["0"] && !parsed.slots && !parsed.modules) {
                        this.ui.showToast('パッチ形式が無効です');
                        return null;
                    }
                    return parsed;
                } catch (err) {
                    this.ui.showToast('JSONの構文エラーです: ' + err.message);
                    return null;
                }
            };

            document.getElementById('json-apply-load-btn')?.addEventListener('click', () => {
                const data = parseAndValidate();
                if (data) {
                    this.ui.saveHistory();
                    this.loadPatchData(data);
                    modal.classList.add('hidden');
                    document.getElementById('preset-manager-modal')?.classList.add('hidden');
                    this.ui.showToast('パッチを読み込みました');
                }
            });

            document.getElementById('json-apply-saveas-btn')?.addEventListener('click', async () => {
                const data = parseAndValidate();
                if (data) {
                    const name = await this.ui.openCustomPrompt('SAVE AS NEW PATCH', `IMPORT_${Date.now().toString().slice(-4)}`);
                    if (name) {
                        this.ui.saveHistory();
                        this.presets[name] = data;
                        this.presetOrder.unshift(name);
                        this.currentPresetKey = name;
                        this.savePresetsDB();
                        this.loadActivePreset();
                        this.renderPresetList();
                        modal.classList.add('hidden');
                        document.getElementById('preset-manager-modal')?.classList.add('hidden');
                        this.ui.showToast(`"${name}" として保存・展開しました`);
                    }
                }
            });
        }

        modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => {
            textarea.focus();
            textarea.select();
        }, 50);
    }

    openAiSpecModal() {
        const modal = document.getElementById('json-io-modal');
        const title = document.getElementById('json-io-title');
        const icon = document.getElementById('json-io-icon');
        const textarea = document.getElementById('json-io-textarea');
        const footer = document.getElementById('json-io-footer');
        if (!modal || !textarea) return;

        const specText = AI_PATCH_SPEC_CONTENT;

        if (title) title.textContent = 'AI PATCH SPEC (Markdown)';
        if (icon) icon.setAttribute('data-lucide', 'bot');
        textarea.value = specText;
        textarea.readOnly = true;

        if (footer) {
            footer.innerHTML = `
                <div class="flex items-center gap-1.5">
                    <button id="ai-spec-dl-btn" class="h-6 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer" title=".mdファイルとしてダウンロード">
                        <i data-lucide="download" class="w-3 h-3 pointer-events-none text-cyan-400"></i>
                        <span>DOWNLOAD .MD</span>
                    </button>
                </div>
                <div class="flex items-center gap-1.5">
                    <button id="ai-spec-copy-btn" class="h-6 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[9px] rounded-lg transition flex items-center gap-1.5 shadow-md shadow-cyan-600/30 cursor-pointer">
                        <i data-lucide="copy" class="w-3 h-3 pointer-events-none"></i>
                        <span id="ai-spec-copy-text" class="pointer-events-none">COPY TO CLIPBOARD</span>
                    </button>
                    <button id="ai-spec-close-btn" class="h-6 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[9px] rounded-lg transition border border-slate-700 cursor-pointer">
                        CLOSE
                    </button>
                </div>
            `;

            document.getElementById('ai-spec-copy-btn')?.addEventListener('click', () => {
                navigator.clipboard.writeText(specText).then(() => {
                    const btnText = document.getElementById('ai-spec-copy-text');
                    if (btnText) btnText.textContent = 'COPIED! ✅';
                    this.ui.showToast('AI仕様書プロンプトをクリップボードにコピーしました');
                    setTimeout(() => {
                        const bt = document.getElementById('ai-spec-copy-text');
                        if (bt) bt.textContent = 'COPY TO CLIPBOARD';
                    }, 2000);
                }).catch(() => {
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    this.ui.showToast('選択部分をコピーしました');
                });
            });

            document.getElementById('ai-spec-dl-btn')?.addEventListener('click', () => {
                try {
                    const blob = new Blob([specText], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'GRIDSYNTH_AI_PATCH_SPEC.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.ui.showToast('GRIDSYNTH_AI_PATCH_SPEC.md をダウンロードしました');
                } catch (err) {
                    this.ui.showToast('ダウンロードに失敗しました: ' + err.message);
                }
            });

            document.getElementById('ai-spec-close-btn')?.addEventListener('click', () => {
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

    renderPresetList() {
        const c = document.getElementById('preset-list-container');
        if (!c) return;
        c.innerHTML = '';
        const userKeys = this.presetOrder.filter(k => !this.DEMO_KEYS.includes(k));
        userKeys.forEach(k => {
            const item = document.createElement('div');
            item.className = `flex items-center justify-between py-1 px-2 mb-1 rounded border ${k === this.currentPresetKey ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'} cursor-pointer text-xs`;
            item.innerHTML = `<span class="truncate">${k}</span><div class="flex items-center gap-1 shrink-0"><button class="rename-p text-violet-400 hover:text-white px-1">✎</button><button class="copy-p text-amber-400 hover:text-white px-1">📋</button><button class="del-p text-rose-400 hover:text-white px-1">✕</button></div>`;
            item.addEventListener('click', async (e) => {
                if (e.target.classList.contains('del-p')) {
                    delete this.presets[k];
                    this.presetOrder = this.presetOrder.filter(x => x !== k);
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
                    const ren = await this.ui.openCustomPrompt('RENAME', k);
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
                document.getElementById('preset-manager-modal')?.classList.add('hidden');
            });
            c.appendChild(item);
        });

        const dHeader = document.createElement('div');
        dHeader.className = 'flex items-center justify-between px-2 py-1 mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800/40 rounded cursor-pointer';
        dHeader.innerHTML = `<span>DEMO PATCHES</span><span>${this.demoAccordionOpen ? '▲' : '▼'}</span>`;
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
                    document.getElementById('preset-manager-modal')?.classList.add('hidden');
                };
                c.appendChild(item);
            });
        }
    }
}

