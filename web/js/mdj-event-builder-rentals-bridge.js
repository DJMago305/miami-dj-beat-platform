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

    function mdjRentalsLookupTogglePackItem(id) {
        var talent = lookupTalentRow(id);
        if (talent) {
            var imgT = talent.img || talent.image || '';
            var catKey = talent.id && String(talent.id).indexOf('visuals_') === 0 ? 'visuals' : 'live_music';
            var catLabel = catKey === 'visuals' ? 'Visuals & Photo' : 'Live Music';
            return {
                image_url: imgT ? mdjV(imgT) : null,
                category_key: catKey,
                category_label: catLabel
            };
        }
        var extra = lookupHlExtra(id);
        if (extra) {
            var imgE = extra.img || extra.image || '';
            return {
                image_url: imgE ? mdjV(imgE) : null,
                category_key: 'horaloca',
                category_label: 'Hora Loca Add-on'
            };
        }
        return {
            image_url: null,
            category_key: 'addon',
            category_label: 'Package Add-on'
        };
    }

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
