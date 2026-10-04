/* Cliente Comercial -> su PROPIO portal (commercial-portal.html#perfil / #notificaciones).
   client-portal.html es el destino al que llegan los tres caminos de ruteo (auth.js al iniciar sesion, su respaldo y el enlace
   MI PERFIL del header) y client-account.html el del avatar y CONFIG (lleva a #notificaciones; MI PERFIL lleva a #perfil); esta guardia
   vive en esas dos paginas y no obliga a tocar el header ni auth.js.
   Solo actua en la entrada simple (sin parametros): los enlaces directos (?lead=, ?mode=, ?cuenta=cliente...) se respetan,
   para que un comercial que tambien renta servicios no pierda el acceso a sus ordenes.
   Va en el <head>: la cuenta comercial ya conocida (marca guardada por commercial-portal.html para ESE usuario) se desvia al instante,
   antes de que se pinte la pantalla del cliente; la primera vez se confirma con la base y deja la marca. */
(function () {
    if (location.search) return;
    var FLAG = 'mdj_cc_uid';
    if (!/client-account/.test(location.pathname)) return;      // MI PERFIL / inicio de sesión (client-portal.html) llegan a la vista del cliente, también para la cuenta comercial
    var target = './commercial-portal.html#notificaciones';

    // Id del usuario con sesion iniciada, leido de donde Supabase guarda la sesion (sin esperar a que cargue nada).
    function sessionUid() {
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (/^sb-.*-auth-token$/.test(k)) {
                    var j = JSON.parse(localStorage.getItem(k));
                    var u = j && (j.user || (j.currentSession && j.currentSession.user));
                    if (u && u.id) return u.id;
                }
            }
        } catch (e) { /* sin almacenamiento: se usa la comprobacion con la base */ }
        return null;
    }

    var uid = sessionUid();
    try { if (uid && localStorage.getItem(FLAG) === uid) { location.replace(target); return; } } catch (e) { /* ok */ }

    var tries = 0;
    async function run() {
        var db = window.getSupabaseClient && window.getSupabaseClient();
        if (!db) { if (tries++ < 40) setTimeout(run, 150); return; }
        try {
            var s = (await db.auth.getSession()).data.session;
            if (!s) return;
            var r = await db.from('client_profiles').select('is_commercial').eq('user_id', s.user.id).maybeSingle();
            if (r && r.data && r.data.is_commercial === true) {
                try { localStorage.setItem(FLAG, s.user.id); } catch (e) { /* ok */ }
                location.replace(target);
            }
        } catch (e) { /* si falla la consulta, el cliente sigue en su portal */ }
    }
    run();
})();
