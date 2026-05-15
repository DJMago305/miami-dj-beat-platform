/**
 * MDJ Event Builder — catalog adapter (Phase 1A).
 * Hardcoded test DTOs only; no rentals.js coupling in 1A.
 */
(function (global) {
    'use strict';

    if (!global.MDJ_EVENT_BUILDER_V1) {
        return;
    }

    var SLOT_RULES = [
        { prefix: 'dj_', slot: 'dj_primary', category_key: 'dj', category_label: 'DJ / Performance' },
        { prefix: 'hl_', slot: 'horaloca_pack', category_key: 'horaloca', category_label: 'Hora Loca Experience' },
        { prefix: 'mc_', slot: 'mc_pack', category_key: 'mc', category_label: 'Professional MC' }
    ];

    var TEST_PRESETS = {
        dj: {
            catalog_sku: 'dj_family',
            category_key: 'dj',
            category_label: 'DJ / Performance',
            slot: 'dj_primary',
            name: 'Family Events',
            image_url: './assets/DJ_Performance/family-events.jpg',
            unit_price_usd: 350
        },
        dj_private: {
            catalog_sku: 'dj_private',
            category_key: 'dj',
            category_label: 'DJ / Performance',
            slot: 'dj_primary',
            name: 'Private Parties',
            image_url: './assets/DJ_Performance/private_parties.jpg',
            unit_price_usd: 500
        },
        horaloca: {
            catalog_sku: 'hl_premium_pack',
            category_key: 'horaloca',
            category_label: 'Hora Loca Experience',
            slot: 'horaloca_pack',
            name: 'Premium Hora Loca Pack',
            image_url: './assets/hora-loca/premium-pack.jpg',
            unit_price_usd: 1200
        },
        gear: {
            catalog_sku: 'f_chairs',
            category_key: 'furniture',
            category_label: 'Furniture & Decor',
            slot: 'gear_f_chairs',
            name: 'Premium Seating',
            image_url: './assets/furniture-decor/chairs.jpg',
            unit_price_usd: 6
        },
        mc: {
            catalog_sku: 'mc_club_host',
            category_key: 'mc',
            category_label: 'Professional MC',
            slot: 'mc_pack',
            name: 'Club Host MC',
            image_url: './assets/mc-club-host/mc-club-host.jpg',
            unit_price_usd: 450
        }
    };

    function resolveSlot(catalogSku, categoryKey) {
        var sku = String(catalogSku || '');
        var i;
        for (i = 0; i < SLOT_RULES.length; i++) {
            if (sku.indexOf(SLOT_RULES[i].prefix) === 0) {
                return SLOT_RULES[i].slot;
            }
        }
        if (categoryKey) {
            return 'gear_' + String(categoryKey).replace(/[^a-z0-9_]/gi, '_');
        }
        return 'gear_' + sku.replace(/[^a-z0-9_]/gi, '_');
    }

    function buildLineFromCatalog(item) {
        if (!item || !item.catalog_sku) {
            return null;
        }
        var qty = item.quantity > 0 ? item.quantity : 1;
        var unit = parseFloat(item.unit_price_usd);
        if (isNaN(unit)) {
            unit = 0;
        }
        return {
            line_id: item.line_id || global.crypto && global.crypto.randomUUID
                ? global.crypto.randomUUID()
                : 'line_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
            catalog_sku: item.catalog_sku,
            category_key: item.category_key || 'general',
            category_label: item.category_label || 'General Rentals',
            slot: item.slot || resolveSlot(item.catalog_sku, item.category_key),
            name: item.name || item.catalog_sku,
            image_url: item.image_url || null,
            unit_price_usd: unit,
            quantity: qty,
            line_total_usd: Math.round(unit * qty * 100) / 100,
            replaceable: item.replaceable !== false && String(item.slot || resolveSlot(item.catalog_sku, item.category_key)).indexOf('gear_') !== 0
        };
    }

    function buildTestLine(preset, opts) {
        var key = preset || 'dj';
        if (opts && opts.preset) {
            key = opts.preset === 'private' ? 'dj_private' : key;
        }
        var base = TEST_PRESETS[key] || TEST_PRESETS.dj;
        var merged = {
            catalog_sku: base.catalog_sku,
            category_key: base.category_key,
            category_label: base.category_label,
            slot: base.slot,
            name: base.name,
            image_url: base.image_url,
            unit_price_usd: base.unit_price_usd,
            quantity: opts && opts.quantity > 0 ? opts.quantity : 1
        };
        return buildLineFromCatalog(merged);
    }

    function inferRentalsToggleMeta(id) {
        var sku = String(id || '');
        var i;
        for (i = 0; i < SLOT_RULES.length; i++) {
            if (sku.indexOf(SLOT_RULES[i].prefix) === 0) {
                return {
                    category_key: SLOT_RULES[i].category_key,
                    category_label: SLOT_RULES[i].category_label,
                    slot: SLOT_RULES[i].slot
                };
            }
        }
        if (sku.indexOf('visuals_') === 0 || sku.indexOf('photo_') === 0 || sku.indexOf('video_') === 0) {
            return {
                category_key: 'visuals',
                category_label: 'Visuals & Photo',
                slot: resolveSlot(sku, 'visuals')
            };
        }
        if (sku.indexOf('sax_') === 0 || sku.indexOf('percussion_') === 0 || sku.indexOf('live_') === 0) {
            return {
                category_key: 'live_music',
                category_label: 'Live Music',
                slot: resolveSlot(sku, 'live_music')
            };
        }
        return {
            category_key: 'addon',
            category_label: 'Package Add-on',
            slot: resolveSlot(sku, 'addon')
        };
    }

    function buildLineFromRentalsItem(item) {
        if (!item || !item.id) {
            return null;
        }
        var meta = inferRentalsToggleMeta(item.id);
        return buildLineFromCatalog({
            catalog_sku: String(item.id),
            category_key: item.category_key || meta.category_key,
            category_label: item.category_label || meta.category_label,
            slot: item.slot || meta.slot,
            name: item.name || item.id,
            image_url: item.image_url || null,
            unit_price_usd: item.price,
            quantity: item.quantity > 0 ? item.quantity : 1,
            replaceable: false
        });
    }

    global.MDJEventBuilderAdapter = {
        resolveSlot: resolveSlot,
        buildLineFromCatalog: buildLineFromCatalog,
        buildLineFromRentalsItem: buildLineFromRentalsItem,
        buildTestLine: buildTestLine,
        TEST_PRESETS: TEST_PRESETS
    };
}(typeof window !== 'undefined' ? window : globalThis));
