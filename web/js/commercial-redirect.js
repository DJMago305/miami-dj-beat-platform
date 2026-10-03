/* Cliente Comercial -> su PROPIO portal y perfil (commercial-portal.html#perfil).
   client-portal.html es el destino al que llegan los tres caminos de ruteo (auth.js al iniciar sesion, su respaldo
   y el enlace MI PERFIL del header) y client-account.html el del avatar y CONFIG; esta guardia vive en esas dos paginas
   y no obliga a tocar el header ni auth.js.
   Solo actua en la entrada simple (sin parametros): los enlaces directos (?lead=, ?mode=, ?cuenta=cliente...) se respetan,
   para que un comercial que tambien renta servicios no pierda el acceso a sus ordenes. */
(function () {
    if (location.search) return;
    var tries = 0;
    async function run() {
        var db = window.getSupabaseClient && window.getSupabaseClient();
        if (!db) { if (tries++ < 40) setTimeout(run, 150); return; }
        try {
            var s = (await db.auth.getSession()).data.session;
            if (!s) return;
            var r = await db.from('client_profiles').select('is_commercial').eq('user_id', s.user.id).maybeSingle();
            if (r && r.data && r.data.is_commercial === true) location.replace('./commercial-portal.html#perfil');
        } catch (e) { /* si falla la consulta, el cliente sigue en su portal */ }
    }
    run();
})();
