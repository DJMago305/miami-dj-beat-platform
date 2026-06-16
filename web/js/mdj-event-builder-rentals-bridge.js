/**
 * MDJ Event Builder — rentals bridge (Phase 1B-1).
 * Wires toggle-pack / togglePackageItem only. Gated by MDJ_EVENT_BUILDER_V1.
 */
(function (global) {
    'use strict';

    if (!global.MDJ_EVENT_BUILDER_V1) {
        return;
    }

    function mdjV(path) {
        if (!path || typeof path !== 'string') {
            return '';
        }
        if (path.indexOf('?') >= 0) {
            return path;
        }
        return path;
    }

    function lookupTalentRow(id) {
        var td = global.talentData;
        if (!td || !id) {
            return null;
        }
        var lists = [td.musicians, td.visuals];
        var i;
        var j;
        var row;
        for (i = 0; i < lists.length; i++) {
            if (!Array.isArray(lists[i])) {
                continue;
            }
            for (j = 0; j < lists[i].length; j++) {
                row = lists[i][j];
                if (row && row.id === id) {
                    return row;
                }
            }
        }
        return null;
    }

    function lookupHlExtra(id) {
        var packs = global.hlPackages;
        if (!Array.isArray(packs) || !id) {
            return null;
        }
        var i;
        var j;
        var ex;
        for (i = 0; i < packs.length; i++) {
            if (!packs[i] || !Array.isArray(packs[i].extras)) {
                continue;
            }
            for (j = 0; j < packs[i].extras.length; j++) {
                ex = packs[i].extras[j];
                if (ex && ex.id === id) {
                    return ex;
                }
            }
        }
        return null;
    }

    function imgFrom(obj) {
        if (!obj) return null;
        var raw = obj.img || obj.image || obj.image_url || obj.poster || '';
        return raw ? mdjV(raw) : null;
    }

    function mdjRentalsLookupTogglePackItem(id) {
        var sku = String(id || '');

        // ── DJ packages (djTabs) ──────────────────────────
        if (global.djTabs) {
            var djKeys = Object.keys(global.djTabs);
            for (var d = 0; d < djKeys.length; d++) {
                var djPack = global.djTabs[djKeys[d]];
                if (djPack && djPack.id === sku) {
                    return { image_url: imgFrom(djPack), category_key: 'dj', category_label: 'DJ / Performance' };
                }
            }
        }
        if (sku.indexOf('dj_') === 0) {
            return { image_url: null, category_key: 'dj', category_label: 'DJ / Performance' };
        }

        // ── Hora Loca main packages (hlPackages) ─────────
        if (Array.isArray(global.hlPackages)) {
            for (var h = 0; h < global.hlPackages.length; h++) {
                if (global.hlPackages[h] && global.hlPackages[h].id === sku) {
                    return { image_url: imgFrom(global.hlPackages[h]), category_key: 'horaloca', category_label: 'Hora Loca Experience' };
                }
            }
        }
        if (sku.indexOf('hl_') === 0) {
            return { image_url: null, category_key: 'horaloca', category_label: 'Hora Loca Experience' };
        }

        // ── Hora Loca extras ─────────────────────────────
        var extra = lookupHlExtra(id);
        if (extra) {
            return { image_url: imgFrom(extra), category_key: 'horaloca', category_label: 'Hora Loca Experience' };
        }

        // ── Músicos / visuals (talentData) ───────────────
        var talent = lookupTalentRow(id);
        if (talent) {
            var tCat = sku.indexOf('visuals_') === 0 ? 'visuals' : 'live';
            return { image_url: imgFrom(talent), category_key: tCat, category_label: tCat === 'visuals' ? 'Visuals & Photo' : 'Live Music' };
        }

        // ── MC (mcTabs) ──────────────────────────────────
        if (global.mcTabs) {
            var mcKeys = Object.keys(global.mcTabs);
            for (var m = 0; m < mcKeys.length; m++) {
                var mcPack = global.mcTabs[mcKeys[m]];
                if (mcPack && mcPack.id === sku) {
                    return { image_url: imgFrom(mcPack), category_key: 'mc', category_label: 'MC y Presentadores' };
                }
            }
        }
        if (sku.indexOf('mc_') === 0) {
            return { image_url: null, category_key: 'mc', category_label: 'MC y Presentadores' };
        }

        // ── Staff ────────────────────────────────────────
        if (Array.isArray(global.staffRoles)) {
            for (var s = 0; s < global.staffRoles.length; s++) {
                if (global.staffRoles[s] && global.staffRoles[s].id === sku) {
                    return { image_url: imgFrom(global.staffRoles[s]), category_key: 'staff', category_label: 'Staff de Servicio' };
                }
            }
        }
        if (sku.indexOf('staff_') === 0) {
            return { image_url: null, category_key: 'staff', category_label: 'Staff de Servicio' };
        }

        // ── Payasos ──────────────────────────────────────
        if (Array.isArray(global.payasosRoles)) {
            for (var py = 0; py < global.payasosRoles.length; py++) {
                if (global.payasosRoles[py] && global.payasosRoles[py].id === sku) {
                    return { image_url: imgFrom(global.payasosRoles[py]), category_key: 'payaso', category_label: 'Entretenimiento Infantil' };
                }
            }
        }
        if (sku.indexOf('payaso_') === 0) {
            return { image_url: null, category_key: 'payaso', category_label: 'Entretenimiento Infantil' };
        }

        // ── FX ───────────────────────────────────────────
        if (global.fxItems) {
            var fxKeys = Object.keys(global.fxItems);
            for (var f = 0; f < fxKeys.length; f++) {
                var fxItem = global.fxItems[fxKeys[f]];
                if (fxItem && fxItem.id === sku) {
                    return { image_url: imgFrom(fxItem), category_key: 'fx', category_label: 'Efectos Especiales' };
                }
            }
        }
        if (sku.indexOf('fx_') === 0) {
            return { image_url: null, category_key: 'fx', category_label: 'Efectos Especiales' };
        }

        // ── Lighting ─────────────────────────────────────
        if (global.lightingItems) {
            var liKeys = Object.keys(global.lightingItems);
            for (var li = 0; li < liKeys.length; li++) {
                var liItem = global.lightingItems[liKeys[li]];
                if (liItem && liItem.id === sku) {
                    return { image_url: imgFrom(liItem), category_key: 'lighting', category_label: 'Iluminación y Pantallas LED' };
                }
            }
        }
        if (sku.indexOf('lighting_') === 0) {
            return { image_url: null, category_key: 'lighting', category_label: 'Iluminación y Pantallas LED' };
        }

        // ── Live music prefixes ──────────────────────────
        if (sku.indexOf('live_') === 0 || sku.indexOf('sax_') === 0 || sku.indexOf('percussion_') === 0 || sku.indexOf('booth360') === 0) {
            return { image_url: null, category_key: 'live', category_label: 'Músicos en Vivo' };
        }
        if (sku.indexOf('visuals_') === 0 || sku.indexOf('photo_') === 0 || sku.indexOf('video_') === 0 || sku.indexOf('drone_') === 0) {
            return { image_url: null, category_key: 'visuals', category_label: 'Captura & Visuales' };
        }

        // ── Catálogo dinámico (rentalCatalogs) ───────────
        if (global.rentalCatalogs) {
            var rcKeys = Object.keys(global.rentalCatalogs);
            for (var r = 0; r < rcKeys.length; r++) {
                var rc = global.rentalCatalogs[rcKeys[r]];
                if (rc && Array.isArray(rc.items)) {
                    for (var ri = 0; ri < rc.items.length; ri++) {
                        if (rc.items[ri] && rc.items[ri].id === sku) {
                            return { image_url: imgFrom(rc.items[ri]), category_key: rcKeys[r], category_label: rc.title || rcKeys[r] };
                        }
                    }
                }
            }
        }

        // ── Fallback ─────────────────────────────────────
        return { image_url: null, category_key: 'addon', category_label: 'Package Add-on' };
    }

    /** Expuesto para migraciones: re-infiere category_key dado un catalog_sku */
    global.mdjRentalsInferCategoryKey = function (catalogSku) {
        return mdjRentalsLookupTogglePackItem(catalogSku).category_key;
    };

    global.mdjRentalsSyncTogglePack = function (opts) {
        if (!global.MDJ_EVENT_BUILDER_V1) {
            return;
        }
        var EB = global.MDJEventBuilder;
        var Ad = global.MDJEventBuilderAdapter;
        if (!EB || !Ad || !opts || !opts.id) {
            return;
        }
        if (!opts.added) {
            EB.removeByCatalogSku(opts.id);
            return;
        }
        var meta = mdjRentalsLookupTogglePackItem(opts.id);
        var dto = Ad.buildLineFromRentalsItem({
            id: opts.id,
            name: opts.name,
            price: opts.price,
            image_url: meta.image_url,
            category_key: meta.category_key,
            category_label: meta.category_label
        });
        if (dto) {
            EB.addLine(dto);
        }
    };

    var MDJ_DJ_FAMILY_IMAGE = './assets/DJ_Performance/family-events.jpg';

    global.mdjRentalsSyncDjFamily = function (opts) {
        if (!global.MDJ_EVENT_BUILDER_V1) {
            return;
        }
        var EB = global.MDJEventBuilder;
        var Ad = global.MDJEventBuilderAdapter;
        var pack = opts && opts.pack;
        if (!EB || !Ad || !pack || pack.id !== 'dj_family') {
            return;
        }
        if (!opts.added) {
            EB.removeByCatalogSku('dj_family');
            return;
        }
        var nameKey = pack.nameKey || 'data_dj_family_name';
        var fallback = pack.fallbackName || 'Family Events';
        var label = typeof global.t === 'function' ? global.t(nameKey, fallback) : fallback;
        var img = pack.image || pack.img || MDJ_DJ_FAMILY_IMAGE;
        var dto = Ad.buildLineFromRentalsItem({
            id: 'dj_family',
            name: label,
            price: pack.price,
            image_url: img ? mdjV(img) : null,
            category_key: 'dj',
            category_label: 'DJ / Performance',
            slot: 'dj_primary',
            replaceable: true
        });
        if (dto) {
            EB.addLine(dto);
        }
    };
}(typeof window !== 'undefined' ? window : globalThis));
