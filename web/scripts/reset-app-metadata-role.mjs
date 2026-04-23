#!/usr/bin/env node
/**
 * Resetea app_metadata.role a "client" para todos los usuarios de Auth excepto allowlist (email).
 *
 * Requiere variables de entorno:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   MDJ_METADATA_ROLE_ALLOWLIST — emails separados por coma (default: miamidjbeat@gmail.com)
 *
 * Uso (desde web/):
 *   npm install
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-app-metadata-role.mjs
 *
 * Advertencia: invalida sesiones / reclama nuevos JWT para reflejar metadatos en clientes.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rawAllow = process.env.MDJ_METADATA_ROLE_ALLOWLIST || 'miamidjbeat@gmail.com';
const allow = new Set(
    rawAllow
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
);

if (!url || !key) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const admin = createClient(url, key, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

let page = 1;
let updated = 0;
let skipped = 0;
let errors = 0;

while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
        console.error('listUsers:', error.message);
        process.exit(1);
    }
    const users = data?.users || [];
    if (users.length === 0) break;

    for (const u of users) {
        const email = String(u.email || '')
            .trim()
            .toLowerCase();
        if (email && allow.has(email)) {
            skipped += 1;
            continue;
        }

        const prev = u.app_metadata && typeof u.app_metadata === 'object' ? { ...u.app_metadata } : {};
        const nextRole = 'client';
        if (String(prev.role || '').toLowerCase() === nextRole) {
            skipped += 1;
            continue;
        }

        const app_metadata = { ...prev, role: nextRole };
        const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { app_metadata });
        if (upErr) {
            console.error('updateUserById', u.id, upErr.message);
            errors += 1;
        } else {
            updated += 1;
        }
    }

    if (users.length < 1000) break;
    page += 1;
}

console.log(JSON.stringify({ updated, skipped, errors, allowlist: [...allow] }, null, 2));
