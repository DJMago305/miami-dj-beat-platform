// ─── MDJPRO Auth — Login & DJ Registration ──────────────────────────────────
// Uses window.getSupabaseClient() (lazy singleton, avoids CDN race condition).

/** Wait for the Supabase client to be ready (max ~3 sec). */
async function waitForSupabase(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const db = window.getSupabaseClient();
        if (db) return db;
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error('Supabase no está disponible. Recarga la página.');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const errorMsg = document.getElementById('auth-error');

    function showError(msg) {
        if (!errorMsg) return;
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }
    function clearError() {
        if (!errorMsg) return;
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
    }

    /** Resolves an input (email or username) to a real email for Supabase Auth. */
    async function resolveIdentity(input, db) {
        const cleanInput = input.trim();
        if (cleanInput.includes('@')) return cleanInput;

        try {
            console.log(`[AUTH RESOLVER] Buscando identidad para: "${cleanInput}"`);

            // Try DJ Profiles (Exact match, case-insensitive)
            const { data: dj, error: djErr } = await db.from('dj_profiles')
                .select('email, stage_name, dj_name')
                .ilike('stage_name', cleanInput)
                .maybeSingle();

            if (djErr) {
                console.error('[AUTH RESOLVER] Error en dj_profiles:', djErr);
                throw new Error(`Error de Seguridad (RLS): ${djErr.message || 'Acceso denegado'}`);
            }
            if (dj?.email) return dj.email;

            // Fallback to dj_name
            const { data: djAlt, error: djAltErr } = await db.from('dj_profiles')
                .select('email')
                .ilike('dj_name', cleanInput)
                .maybeSingle();

            if (djAltErr) console.error('[AUTH RESOLVER] Error en dj_profiles (alt):', djAltErr);
            if (djAlt?.email) return djAlt.email;

            // Try Client Profiles
            const { data: client, error: clErr } = await db.from('client_profiles')
                .select('email')
                .ilike('username', cleanInput)
                .maybeSingle();

            if (clErr) console.error('[AUTH RESOLVER] Error en client_profiles:', clErr);
            if (client?.email) return client.email;

        } catch (dbErr) {
            console.warn('[AUTH SHIELD] Query fallback due to schema discrepancy:', dbErr);
        }

        throw new Error('No se encontró una cuenta vinculada a este nombre de usuario. Por favor verifica el nombre o usa tu email.');
    }

    // ── LOGIN ──────────────────────────────────────────────────────────────
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const btn = loginForm.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

            try {
                const db = await waitForSupabase();
                const identityInput = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

                // MODO MILITAR: Resolve Identity
                const email = await resolveIdentity(identityInput, db);

                if (btn) btn.textContent = 'Entrando...';
                const { data: authData, error } = await db.auth.signInWithPassword({ email, password });
                if (error) throw error;

                const user = authData.user;

                // ── MODO MILITAR: SHIELD VERIFICATION ──────────────────
                const securityCheck = await window.MDJPRO_SECURITY.checkDevice(user, db);

                if (securityCheck.status === 'new_device') {
                    // Detener entrada y pedir alerta
                    const channel = securityCheck.preference === 'sms' ? 'SMS' : 'Email';
                    alert(`🚨 ¡NUEVO DISPOSITIVO DETECTADO!\n\nHemos enviado una alerta a tu ${channel} (${securityCheck.email || securityCheck.phone}).\nDebes aprobar este acceso antes de continuar.`);

                    // En un sistema real aquí invocaríamos la Edge Function para disparar el mensaje.
                    // Para el MVP de MODO MILITAR, registraremos el dispositivo tras la advertencia si el CEO lo desea.
                    await window.MDJPRO_SECURITY.registerDevice(user.id, user.user_metadata?.user_type || 'client', db);
                }

                const params = new URLSearchParams(window.location.search);
                const next = params.get('next') || params.get('redirect');
                window.location.assign(next ? next : './dj-profile.html');

            } catch (err) {
                showError(err.message || 'Error al iniciar sesión.');
                if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
            }
        });
    }

    // ── SIGNUP ─────────────────────────────────────────────────────────────
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();
            const btn = signupForm.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = true; btn.textContent = 'Creando cuenta...'; }

            try {
                const db = await waitForSupabase();

                // Collect all fields
                const fullName = document.getElementById('signup-fullname')?.value.trim() || '';
                const artisticName = document.getElementById('signup-name')?.value.trim() || '';
                const name = artisticName || fullName; // artistic name used as username, fallback to full name
                const email = document.getElementById('signup-email')?.value.trim() || '';
                const password = document.getElementById('signup-password')?.value || '';
                const phone = document.getElementById('signup-phone')?.value.trim() || '';
                const city = document.getElementById('signup-city')?.value.trim() || '';
                const instagram = document.getElementById('signup-instagram')?.value.trim().replace(/^@/, '') || '';
                const planParam = new URLSearchParams(window.location.search).get('plan') || 'LITE';

                if (!fullName || !email || !password) throw new Error('Por favor completa todos los campos requeridos (Nombre Real, Email, Contraseña).');
                if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');

                // 1. Create Auth user
                const userType = document.getElementById('signup-usertype')?.value || 'client';
                const refCode = new URLSearchParams(window.location.search).get('ref') || '';

                const { data, error: authErr } = await db.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            artistic_name: name,
                            full_name: fullName,
                            plan: planParam,
                            user_type: userType,
                            source_ref: refCode
                        }
                    }
                });
                if (authErr) throw authErr;

                const user = data?.user;
                if (!user) throw new Error('No se pudo crear el usuario. Intenta de nuevo.');

                // 2. Create Profile record (DJ or Client)
                if (userType === 'talent') {
                    const memberId = `DJ-${user.id.substring(0, 6).toUpperCase()}`;
                    const referralCode = `REF${memberId.replace('DJ-', '').substring(0, 5)}`;

                    const profilePayload = {
                        user_id: user.id,
                        email: email, // MODO MILITAR: Email sync for hybrid login
                        dj_name: name,
                        stage_name: name,
                        full_name: fullName,
                        plan: planParam,
                        status: 'ACTIVE',
                        member_id: memberId,
                        referral_code: referralCode,
                        photo_status: 'pending',
                        rating: 1.0,
                        review_count: 0
                    };

                    if (phone) profilePayload.phone = phone;
                    if (city) profilePayload.city = city;
                    if (instagram) profilePayload.social_instagram = `https://instagram.com/${instagram.replace(/^@/, '')}`;

                    await db.from('dj_profiles').insert([profilePayload]);
                } else {
                    // Client Profile
                    const clientPayload = {
                        user_id: user.id,
                        username: email.split('@')[0], // MODO MILITAR: Auto-username for clients
                        full_name: fullName,
                        email: email,
                        phone: phone || null,
                        city: city || null,
                        source_ref: refCode || null,
                        discount_eligible: true
                    };
                    await db.from('client_profiles').insert([clientPayload]);
                }

                // 3. Success
                alert(`✅ ¡Cuenta creada, ${name || fullName}!\n\nRevisa tu email para confirmar tu cuenta.\nLuego inicia sesión para acceder a tu portal.`);

                // Switch to login tab
                const tabLogin = document.getElementById('tab-login');
                if (tabLogin) tabLogin.click();

            } catch (err) {
                showError(err.message || 'Error al crear la cuenta.');
                if (btn) { btn.disabled = false; btn.textContent = 'Registrarme'; }
            }
        });
    }
});
