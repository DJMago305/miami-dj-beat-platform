// ─── MIAMI DJ BEAT Auth — Login & DJ Registration ──────────────────────────────────
// Uses window.getSupabaseClient() (lazy singleton, avoids CDN race condition).

/**
 * DJ que refiere (promoción / QR / botón WEB en perfil): ?ref= en URL, o localStorage
 * tras index.html?ref= o gotoAffiliateWeb() desde dj-profile.
 */
/** Supabase GoTrue: duplicate signup */
function mdjIsUserAlreadyRegisteredError(err) {
    const msg = String(err?.message || err?.error_description || '').toLowerCase();
    return msg.includes('user already registered') || msg.includes('already been registered');
}

/** Wrong password / bad credentials on signInWithPassword */
function mdjIsInvalidCredentialsError(err) {
    const code = String(err?.code || err?.name || '').toLowerCase();
    const msg = String(err?.message || err?.error_description || '').toLowerCase();
    if (code === 'invalid_credentials' || code === 'invalid_grant') return true;
    return msg.includes('invalid login credentials') || msg.includes('invalid_credentials');
}

/**
 * Same contract as login.html buildPostAuthReturnUrl: ?redirect=party-planner&lead=… → ./party-planner.html?from_auth=1&…
 * Restricts redirect slug to safe filename stem (no path / open redirect).
 */
function mdjBuildPostAuthReturnUrlFromQuery(search) {
    try {
        const qp = new URLSearchParams(search || '');
        const raw = (qp.get('redirect') || '').trim();
        if (!raw) return null;
        if (!/^[a-z][a-z0-9_-]{0,80}$/i.test(raw)) return null;
        const lead = qp.get('lead');
        const eventType = qp.get('type');
        const ref = qp.get('ref');
        const dj = qp.get('dj');
        const profileId = qp.get('id');
        const tabRedirect = qp.get('tab');
        const panelRedirect = qp.get('panel');

        let finalUrl = `./${raw}.html?from_auth=1&`;
        if (lead) finalUrl += `lead=${encodeURIComponent(lead)}&`;
        if (eventType) finalUrl += `type=${encodeURIComponent(eventType)}&`;
        if (ref) finalUrl += `ref=${encodeURIComponent(ref)}&`;
        if (dj) finalUrl += `dj=${encodeURIComponent(dj)}&`;
        if (profileId) finalUrl += `id=${encodeURIComponent(profileId)}&`;
        if (tabRedirect) finalUrl += `tab=${encodeURIComponent(tabRedirect)}&`;
        if (panelRedirect) finalUrl += `panel=${encodeURIComponent(panelRedirect)}&`;

        return finalUrl.replace(/[&?]$/, '');
    } catch (e) {
        return null;
    }
}

function mdjAuthT(key, esFallback, enFallback) {
    try {
        if (window.i18n && typeof window.i18n.t === 'function') {
            const s = window.i18n.t(key);
            if (s) return s;
        }
    } catch (e) { /* ignore */ }
    const lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang || 'es').toLowerCase();
    return lang.startsWith('en') ? enFallback : esFallback;
}

function mdjGetReferralDjId() {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get('ref');
        if (fromUrl && String(fromUrl).trim()) return String(fromUrl).trim();
    } catch (e) { /* ignore */ }
    try {
        const a = localStorage.getItem('mdb_referral_dj_id');
        const b = localStorage.getItem('mdj_active_affiliate_dj');
        return (a || b || '').trim();
    } catch (e) {
        return '';
    }
}

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

    function showError(msg, opts) {
        if (!errorMsg) return;
        if (opts && opts.html) {
            errorMsg.innerHTML = msg;
        } else {
            errorMsg.innerHTML = '';
            errorMsg.textContent = msg;
        }
        errorMsg.style.display = 'block';
        if (opts && opts.tone === 'info') {
            errorMsg.style.color = 'var(--gold)';
        } else {
            errorMsg.style.color = '#ff4d4d';
        }
    }
    function clearError() {
        if (!errorMsg) return;
        errorMsg.style.display = 'none';
        errorMsg.innerHTML = '';
        errorMsg.textContent = '';
        errorMsg.style.color = '#ff4d4d';
    }

    /** Misma lógica que el submit de login: interior del sistema o redirect=party-planner, etc. */
    async function performPostAuthRedirect(db, user) {
        const params = new URLSearchParams(window.location.search);
        const rawRole = user?.app_metadata?.role || user?.user_metadata?.user_type || 'client';
        const role = (rawRole === 'talent' || rawRole === 'dj') ? 'artist' : rawRole;

        let targetUrl = './dj-profile.html';
        if (role === 'admin' || role === 'manager') {
            targetUrl = './admin-dashboard.html';
        } else if (role === 'client') {
            targetUrl = './client-portal.html';
            try {
                const { data: djRow } = await db.from('dj_profiles').select('role').eq('user_id', user.id).maybeSingle();
                if (djRow && djRow.role !== 'client') {
                    targetUrl = './dj-profile.html?id=' + encodeURIComponent(user.id);
                }
            } catch (roleFallbackErr) {
                console.warn('[AUTH] Role fallback check failed:', roleFallbackErr);
            }
        } else {
            targetUrl = './dj-profile.html?id=' + encodeURIComponent(user.id);
        }

        const postAuthFromRedirect = mdjBuildPostAuthReturnUrlFromQuery(window.location.search);
        if (postAuthFromRedirect) {
            window.location.assign(postAuthFromRedirect);
            return;
        }

        const nextRaw = (params.get('next') || '').trim();
        if (nextRaw) {
            const nextUrl = (nextRaw.startsWith('./') || nextRaw.startsWith('/')) ? nextRaw : `./${nextRaw.replace(/^\//, '')}`;
            window.location.assign(nextUrl);
            return;
        }

        window.location.assign(targetUrl);
    }

    /** Resolves an input (email or username) to a real email for Supabase Auth. */
    async function resolveIdentity(input, db) {
        const cleanInput = input.trim();
        if (!cleanInput) {
            throw new Error('Introduce tu email o nombre de usuario.');
        }

        const { data: rpcEmail, error: rpcErr } = await db.rpc('mdj_resolve_email_for_login', {
            p_identity: cleanInput
        });

        if (rpcErr) {
            console.error('[AUTH RESOLVER] mdj_resolve_email_for_login:', rpcErr);
            throw new Error(rpcErr.message || 'No se pudo resolver el inicio de sesión.');
        }
        if (rpcEmail) return rpcEmail;

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

                // Resolve Identity
                const email = await resolveIdentity(identityInput, db);

                if (btn) btn.textContent = 'Entrando...';
                const { data: authData, error } = await db.auth.signInWithPassword({ email, password });
                if (error) throw error;

                const user = authData.user;

                // ── SHIELD VERIFICATION NEUTRALIZED PER USER DIRECTIVE ──────────────────
                /*
                const securityCheck = await window.MDJPRO_SECURITY.checkDevice(user, db);

                if (securityCheck.status === 'new_device') {
                    // Detener entrada y pedir alerta
                    const channel = securityCheck.preference === 'sms' ? 'SMS' : 'Email';
                    alert(`🚨 ¡NUEVO DISPOSITIVO DETECTADO!\n\nHemos enviado una alerta a tu ${channel} (${securityCheck.email || securityCheck.phone}).\nDebes aprobar este acceso antes de continuar.`);

                    // En un sistema real aquí invocaríamos la Edge Function para disparar el mensaje.
                    await window.MDJPRO_SECURITY.registerDevice(user.id, user.user_metadata?.user_type || 'client', db);
                }
                */

                try {
                    sessionStorage.setItem('mdj_vip_welcome_pending', '1');
                } catch (e) { /* ignore */ }
                await performPostAuthRedirect(db, user);

            } catch (err) {
                if (mdjIsInvalidCredentialsError(err)) {
                    const html = (window.i18n && typeof window.i18n.t === 'function')
                        ? window.i18n.t('auth-password-invalid')
                        : mdjAuthT(
                            'auth-password-invalid',
                            'Contraseña incorrecta. <a class="auth-inline-link" href="./forgot-password.html">¿No la recuerdas? Restablecer aquí</a>',
                            'Incorrect password. <a class="auth-inline-link" href="./forgot-password.html">Forgot it? Reset here</a>'
                        );
                    showError(html, { tone: 'error', html: true });
                } else {
                    showError(err.message || 'Error al iniciar sesión.');
                }
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
                const confirmPassword = document.getElementById('signup-password-confirm')?.value || '';
                const phone = document.getElementById('signup-phone')?.value.trim() || '';
                const city = document.getElementById('signup-city')?.value.trim() || '';
                const instagram = document.getElementById('signup-instagram')?.value.trim().replace(/^@/, '') || '';
                const planParam = new URLSearchParams(window.location.search).get('plan') || 'LITE';

                if (!fullName || !email || !password) throw new Error('Por favor completa todos los campos requeridos (Nombre Real, Email, Contraseña).');
                if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
                if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden. Verifícalas y vuelve a intentarlo.');

                // 1. Create Auth user
                const userType = document.getElementById('signup-usertype')?.value || 'client';
                const refCode = mdjGetReferralDjId();

                const { data, error: authErr } = await db.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            artistic_name: name,
                            full_name: fullName,
                            plan: planParam,
                            user_type: userType,
                            source_ref: refCode,
                            phone: phone || '',
                            location: city || '',
                            username: email.split('@')[0]
                        }
                    }
                });
                if (authErr) throw authErr;

                const user = data?.user;
                if (!user) throw new Error('No se pudo crear el usuario. Intenta de nuevo.');

                // 2. Sesión JWT antes de INSERT en tablas con RLS (anon → 403 en dj_profiles / client_profiles)
                let userForRedirect = user;
                if (!data.session) {
                    const { data: siData, error: siErr } = await db.auth.signInWithPassword({ email, password });
                    if (!siErr && siData?.user) {
                        userForRedirect = siData.user;
                    } else {
                        const emLow = String(siErr?.message || '').toLowerCase();
                        if (emLow.includes('email not confirmed') || emLow.includes('not confirmed')) {
                            showError(
                                mdjAuthT(
                                    'auth-signup-confirm-email',
                                    'Cuenta creada. Revisa tu correo para confirmar; luego entra con tu email y contraseña.',
                                    'Account created. Check your email to confirm, then sign in with your password.'
                                ),
                                { tone: 'info' }
                            );
                            const tabLoginGo = document.getElementById('tab-login');
                            if (tabLoginGo) tabLoginGo.click();
                            const loginEmailGo = document.getElementById('login-email');
                            if (loginEmailGo) loginEmailGo.value = email;
                            if (btn) { btn.disabled = false; btn.textContent = 'Registrarme'; }
                            return;
                        }
                        throw siErr || new Error('No se pudo abrir sesión automáticamente.');
                    }
                }

                // 3. Crear perfil (solo con sesión activa → políticas RLS)
                // user_id debe coincidir con auth.uid() del JWT (tras signUp o signInWithPassword).
                const profileUid = userForRedirect.id;
                if (userType === 'talent') {
                    const memberId = `DJ-${profileUid.substring(0, 6).toUpperCase()}`;
                    const referralCode = `REF${memberId.replace('DJ-', '').substring(0, 5)}`;

                    const profilePayload = {
                        user_id: profileUid,
                        email: email,
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

                    const { error: djProfileErr } = await db.from('dj_profiles').insert([profilePayload]);
                    if (djProfileErr) throw new Error(`No se pudo crear tu perfil de artista: ${djProfileErr.message || 'error desconocido'}`);
                } else {
                    const clientPayload = {
                        user_id: profileUid,
                        username: email.split('@')[0],
                        full_name: fullName,
                        email: email,
                        phone: phone || null,
                        city: city || null,
                        source_ref: refCode || null,
                        discount_eligible: true
                    };
                    const { error: clientProfileErr } = await db.from('client_profiles').insert([clientPayload]);
                    if (clientProfileErr) throw new Error(`No se pudo crear tu cuenta de cliente: ${clientProfileErr.message || 'error desconocido'}`);
                }

                showError(
                    mdjAuthT(
                        'auth-welcome-new',
                        '¡Gracias por unirte a Miami DJ Beat! Ya estamos procesando tu solicitud.',
                        'Thanks for joining Miami DJ Beat! We\'re processing your request.'
                    ),
                    { tone: 'info' }
                );
                if (btn) { btn.disabled = false; btn.textContent = 'Registrarme'; }

                try {
                    sessionStorage.setItem('mdj_vip_welcome_pending', '1');
                } catch (e) { /* ignore */ }
                setTimeout(function () {
                    void performPostAuthRedirect(db, userForRedirect);
                }, 1000);

            } catch (err) {
                if (mdjIsUserAlreadyRegisteredError(err)) {
                    const em = document.getElementById('signup-email')?.value.trim() || '';
                    const loginEmailEl = document.getElementById('login-email');
                    if (loginEmailEl) loginEmailEl.value = em;
                    showError(
                        mdjAuthT(
                            'auth-already-member',
                            '¡Bienvenido de nuevo! Introduce tu contraseña para asegurar tu fecha.',
                            'Welcome back! Enter your password to secure your event date.'
                        ),
                        { tone: 'info' }
                    );
                    const tabLoginEl = document.getElementById('tab-login');
                    if (tabLoginEl) tabLoginEl.click();
                    if (btn) { btn.disabled = false; btn.textContent = 'Registrarme'; }
                    const pwEl = document.getElementById('login-password');
                    if (pwEl) setTimeout(function () { pwEl.focus(); }, 0);
                    return;
                }
                showError(err.message || 'Error al crear la cuenta.');
                if (btn) { btn.disabled = false; btn.textContent = 'Registrarme'; }
            }
        });
    }
});

// ── Inyección Global del Botón Logout ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const bootstrapGlobalHeader = async () => {
        const db = window.getSupabaseClient ? window.getSupabaseClient() : null;
        if (!db) {
            setTimeout(bootstrapGlobalHeader, 500);
            return;
        }

        const handleSessionState = async (session, liveUser = null) => {
            const loginBtn = document.getElementById('header-login-btn');
            const loginBtnMob = document.getElementById('header-login-btn-mobile');
            const authZone = document.getElementById('header-auth-zone');
            const headerDelegated = window.__MDJ_HEADER_SESSION_OWNER && document.getElementById('mainHeader');

            if (session) {
                if (!headerDelegated) {
                // UI Core Toggles (Morph Login to Logout — copy via window.updateAuthButtons + document.lang)
                if (loginBtn) {
                    loginBtn.setAttribute('data-i18n', 'btn-logout');
                    loginBtn.classList.remove('gold');
                    loginBtn.classList.add('danger');
                    loginBtn.href = '#';
                    loginBtn.onclick = window.doLogout || async function (e) { if (e) e.preventDefault(); await db.auth.signOut(); window.location.reload(); };
                    loginBtn.style.visibility = 'visible';
                    loginBtn.style.opacity = '1';
                    loginBtn.style.pointerEvents = 'auto';
                }
                if (loginBtnMob) {
                    loginBtnMob.setAttribute('data-i18n', 'btn-logout');
                    loginBtnMob.classList.remove('gold');
                    loginBtnMob.classList.add('danger');
                    loginBtnMob.href = '#';
                    loginBtnMob.onclick = window.doLogout || async function (e) { if (e) e.preventDefault(); await db.auth.signOut(); window.location.reload(); };
                    loginBtnMob.style.visibility = 'visible';
                    loginBtnMob.style.opacity = '1';
                    loginBtnMob.style.pointerEvents = 'auto';
                }
                if (authZone) {
                    authZone.style.visibility = 'visible';
                    authZone.style.opacity = '1';
                    authZone.style.pointerEvents = 'auto';
                }

                // Robust Avatar Sync (Live Fetch from user object)
                const targetUser = liveUser || session.user;
                const sessionAvatar = targetUser?.user_metadata?.avatar_url;
                if (sessionAvatar) {
                    document.querySelectorAll('.avatar, #accountBtn .avatar').forEach(av => av.src = sessionAvatar);
                } else {
                    db.from('dj_profiles').select('photo_url').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
                        if (data?.photo_url) {
                            document.querySelectorAll('.avatar, #accountBtn .avatar').forEach(av => av.src = data.photo_url);
                        }
                    }).catch(e => console.warn('[AUTH] Error loading avatar:', e.message));
                }
                }

                // ── Inyección Manager (Productividad Interna) ──
                const role = session.user?.app_metadata?.role || session.user?.user_metadata?.user_type || 'client';
                if (role === 'manager' || role === 'MANAGER') {
                    const topNav = document.getElementById('mainNav');
                    if (topNav && !document.getElementById('manager-link')) {
                        const mngr = document.createElement('a');
                        mngr.id = 'manager-link';
                        mngr.href = './admin-dashboard.html';
                        mngr.textContent = 'Manager';
                        mngr.style.cssText = 'color:var(--admin-accent,#00ff88);font-weight:900;border:1px solid var(--admin-accent,#00ff88);padding:4px 10px;border-radius:12px;margin-left:10px;';
                        topNav.appendChild(mngr);
                    }
                }

            } else {
                if (!headerDelegated) {
                // Revert to strict unconnected state (Layout-Safe) — copy via updateAuthButtons
                if (loginBtn) {
                    loginBtn.setAttribute('data-i18n', 'btn-login');
                    loginBtn.classList.remove('danger');
                    loginBtn.classList.add('gold');
                    loginBtn.href = './login.html';
                    loginBtn.onclick = null;
                    loginBtn.style.visibility = 'visible';
                    loginBtn.style.opacity = '1';
                    loginBtn.style.pointerEvents = 'auto';
                }
                if (loginBtnMob) {
                    loginBtnMob.setAttribute('data-i18n', 'btn-login');
                    loginBtnMob.classList.remove('danger');
                    loginBtnMob.href = './login.html';
                    loginBtnMob.onclick = null;
                    loginBtnMob.style.visibility = 'visible';
                    loginBtnMob.style.opacity = '1';
                    loginBtnMob.style.pointerEvents = 'auto';
                }
                if (authZone) {
                    authZone.style.visibility = 'hidden';
                    authZone.style.opacity = '0';
                    authZone.style.pointerEvents = 'none';
                }
                }
                document.getElementById('manager-link')?.remove();
            }
            if (typeof window.updateAuthButtons === 'function') {
                window.updateAuthButtons();
            }
        };

        // Guarantee immediate state read on boot
        const { data: { session } } = await db.auth.getSession();
        let liveUser = null;
        if (session) {
            try {
                const { data: { user } } = await db.auth.getUser();
                liveUser = user;
            } catch (authError) {
                console.warn('[AUTH] Cannot fetch liveUser, falling back to cached session', authError);
            }
        }
        await handleSessionState(session, liveUser);

        // Keep watching for dynamic disconnections 
        db.auth.onAuthStateChange(async (event, sessionObj) => {
            let evtLiveUser = null;
            if (sessionObj) {
                try {
                    const { data: { user } } = await db.auth.getUser();
                    evtLiveUser = user;
                } catch (authError) {
                    console.warn('[AUTH] Cannot fetch evtLiveUser, falling back to cached session', authError);
                }
            }
            handleSessionState(sessionObj, evtLiveUser);
        });
    };
    bootstrapGlobalHeader();
});
