// web/supabase-config.js
// IMPORTANT: anon key only (safe for browser). NEVER put service_role here.

window.MDB_SUPABASE_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
window.MDB_SUPABASE_ANON_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";

// Lazy singleton — avoids race condition with CDN async load.
// Any script can call window.getSupabaseClient() to get the initialized client.
let _supabaseClient = null;
window.getSupabaseClient = function () {
    if (_supabaseClient) return _supabaseClient;
    const factory = (window.supabase && typeof window.supabase.createClient === 'function')
        ? window.supabase.createClient
        : null;
    if (!factory) {
        console.error('[supabase-config] supabase.createClient not available yet.');
        return null;
    }
    _supabaseClient = factory(window.MDB_SUPABASE_URL, window.MDB_SUPABASE_ANON_KEY);
    console.log('[supabase-config] ✅ Client initialized on first use.');
    return _supabaseClient;
};
