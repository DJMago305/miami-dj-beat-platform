// ─── MDJPRO Form Handler — Supabase Primary, Formspree Fallback ───────────────
document.addEventListener('DOMContentLoaded', function () {

    /**
     * Intercept a contact form and save the lead to Supabase.
     * @param {string} formId - HTML id of the <form>
     * @param {string} statusId - HTML id of the status paragraph
     * @param {string} submitBtnId - HTML id of the submit button
     * @param {string} source - label to identify which form this came from
     */
    const setupForm = (formId, statusId, submitBtnId, source = 'hero_form') => {
        const form = document.getElementById(formId);
        const status = document.getElementById(statusId);
        const submitBtn = document.getElementById(submitBtnId);

        if (!form) return;

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            // UI feedback
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn._origText = submitBtn.textContent;
                submitBtn.textContent = 'Enviando...';
            }
            if (status) {
                status.style.display = 'block';
                status.textContent = 'Guardando tu solicitud...';
                status.style.color = 'var(--accent)';
            }

            const raw = new FormData(event.target);
            const formData = Object.fromEntries(raw);

            // ── 1. Save to Supabase (primary) ────────────────────────
            let leadId = null;
            let dbError = null;
            const db = window.getSupabaseClient();

            try {
                if (!db) throw new Error('Supabase client not ready');
                // Consolidate date from dropdowns if present
                let combinedDate = formData.event_date || null;
                if (!combinedDate && formData.event_year && formData.event_month && formData.event_day) {
                    combinedDate = `${formData.event_year}-${formData.event_month}-${formData.event_day}`;
                }

                const payload = {
                    event_type: formData.event_type || null,
                    event_date: combinedDate,
                    location: formData.location || null,
                    email: formData.email || null,
                    phone: formData.phone || null,
                    budget: formData.budget || null,
                    referred_by: formData.referred_by || null,
                    requested_talent: formData.requested_talent || null,
                    status: 'NEW',
                    source,
                };

                // Attach preferred DJ if coming from directory / dj-profile
                const djId = sessionStorage.getItem('preferred_dj_id');
                const djName = sessionStorage.getItem('preferred_dj_name');
                if (djId) payload.preferred_dj_id = djId;
                if (djName) payload.preferred_dj_name = djName;

                const { data: saved, error } = await db
                    .from('leads')
                    .insert([payload])
                    .select('id')
                    .single();

                if (!error && saved) {
                    leadId = saved.id;
                    console.log('✅ Lead saved to Supabase:', leadId);
                } else {
                    dbError = error;
                    console.warn('Supabase insert failed:', error);
                }
            } catch (err) {
                dbError = err;
                console.warn('Supabase insert exception:', err);
            }

            // ── 2. Formspree fallback (if Supabase failed) ────────────
            if (dbError && form.action && form.action.includes('formspree')) {
                try {
                    await fetch(form.action, {
                        method: 'POST',
                        body: raw,
                        headers: { 'Accept': 'application/json' }
                    });
                    console.log('Formspree fallback used.');
                } catch (e) {
                    console.warn('Formspree also failed:', e);
                }
            }

            // ── 3. Notify manager via Edge Function (DEPRECATED: handled by DB trigger) ─
            /*
            if (leadId) {
                try {
                    const projectUrl = window.MDB_SUPABASE_URL || '';
                    if (projectUrl) {
                        fetch(`${projectUrl}/functions/v1/notify-new-lead`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': window.MDB_SUPABASE_ANON_KEY || '',
                                'Authorization': `Bearer ${window.MDB_SUPABASE_ANON_KEY || ''}`,
                            },
                            body: JSON.stringify({
                                lead_id: leadId,
                                event_type: formData.event_type || '—',
                                event_date: formData.event_date || '—',
                                location: formData.location || '—',
                                email: formData.email || '—',
                                phone: formData.phone || '—',
                                budget: formData.budget || '—',
                            }),
                        }).catch(err => console.warn('Lead notification skipped:', err));
                    }
                } catch (notifyErr) {
                    console.warn('Lead notification error:', notifyErr);
                }
            }
            */

            // ── 4. UX: show success / error ───────────────────────────
            if (!dbError || leadId) {
                // Success
                const eventType = formData.event_type || 'Other';
                const refParam = formData.referred_by ? `&ref=${encodeURIComponent(formData.referred_by)}` : '';
                const djParam = formData.requested_talent ? `&dj=${encodeURIComponent(formData.requested_talent)}` : '';

                if (status) {
                    status.innerHTML = `
                        <div class="success-message">
                            <span style="font-size:24px;">✅</span>
                            <p>¡Solicitud recibida!</p>
                            <small>Para elegir tus talentos y personalizar tu evento, primero crea tu cuenta segura.</small>
                            <a href="login.html?mode=signup&user_type=client&redirect=party-planner&type=${encodeURIComponent(eventType)}${leadId ? `&lead=${leadId}` : ''}${refParam}${djParam}"
                               class="btn primary" style="margin-top:15px;display:inline-block;">
                                🔐 Crear Cuenta y Personalizar
                            </a>
                        </div>
                    `;
                    status.style.color = 'var(--accent2)';
                }

                form.reset();
                if (submitBtn) {
                    submitBtn.textContent = submitBtn._origText || 'Send';
                    submitBtn.disabled = false;
                }
                setTimeout(() => {
                    form.style.opacity = '0.5';
                    form.style.pointerEvents = 'none';
                }, 500);

            } else {
                // Error
                const msg = dbError?.message || 'Error al enviar. Intenta de nuevo.';
                if (status) {
                    status.textContent = msg;
                    status.style.color = '#ff6b6b';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Reintentar';
                }
            }
        });
    };

    // ── Hero Registration Flow ────────────────────────────────────────────────
    const regForm = document.getElementById('hero-registration-form');
    const regStatus = document.getElementById('hero-reg-status');
    const regBtn = document.getElementById('hero-reg-btn');

    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(regForm);
            const email = formData.get('email')?.trim();
            const password = formData.get('password');
            const fullName = formData.get('full_name')?.trim();

            if (regBtn) {
                regBtn.disabled = true;
                regBtn.textContent = 'Creando cuenta...';
            }
            if (regStatus) {
                regStatus.style.display = 'block';
                regStatus.textContent = 'Procesando registro...';
                regStatus.style.color = 'var(--gold)';
            }

            try {
                const db = window.getSupabaseClient();
                if (!db) throw new Error('Servicio de base de datos no listo.');

                // 1. Auth SignUp
                const { data, error: authErr } = await db.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            user_type: 'client'
                        }
                    }
                });

                if (authErr) throw authErr;
                if (!data.user) throw new Error('No se pudo crear el usuario.');

                // 2. Create Client Profile (Optional check if table exists)
                const { error: profileErr } = await db.from('client_profiles').insert([{
                    user_id: data.user.id,
                    full_name: fullName,
                    email: email
                }]);

                if (profileErr) console.warn('Aviso: Perfil no creado automáticamente.', profileErr);

                // 3. Success UI
                if (regStatus) {
                    regStatus.innerHTML = `
                        <div style="background: rgba(197, 160, 89, 0.15); padding: 20px; border-radius: 12px; border: 1px solid var(--gold); text-align: center;">
                            <span style="font-size: 32px;">✅</span>
                            <p style="color: var(--gold); font-weight: 700; margin-top: 10px; font-size: 18px;">¡Bienvenido!</p>
                            <p style="color: #fff; font-size: 13px; margin: 10px 0;">Tu cuenta profesional ha sido solicitada. Revisa tu correo para confirmar y acceder.</p>
                            <a href="login.html" class="btn primary small" style="display: inline-block; margin-top: 10px;">Ir al Login</a>
                        </div>
                    `;
                    regStatus.style.color = '#fff';
                }
                regForm.reset();
                if (regBtn) regBtn.style.display = 'none';

            } catch (err) {
                if (regStatus) {
                    regStatus.textContent = `Error: ${err.message}`;
                    regStatus.style.color = '#ff6b6b';
                }
                if (regBtn) {
                    regBtn.disabled = false;
                    regBtn.textContent = 'Reintentar »';
                }
            }
        });
    }

    // ── Register other forms ──────────────────────────────────────────────────
    setupForm('bottom-contact-form', 'bottom-form-status', 'bottom-submit-btn', 'bottom_form');
    setupForm('footer-contact-form', 'footer-form-status', 'footer-submit-btn', 'footer_form');

    // ── Real-time talent check in footer form ─────────────────────────────────
    const talentInput = document.getElementById('requested-talent');
    const talentStatus = document.getElementById('talent-status');

    if (talentInput) {
        talentInput.addEventListener('input', debounce(async (e) => {
            const name = e.target.value.trim();
            if (name.length < 3) { talentStatus.style.display = 'none'; return; }

            talentStatus.style.display = 'block';
            talentStatus.textContent = 'Buscando artista...';
            talentStatus.style.color = 'var(--muted)';

            const dbClient = window.getSupabaseClient();
            if (!dbClient) { talentStatus.textContent = 'No disponible.'; return; }
            const { data, error } = await dbClient
                .from('dj_profiles')
                .select('dj_name, availability, status')
                .ilike('dj_name', `%${name}%`)
                .limit(1)
                .single();

            if (error || !data) {
                talentStatus.textContent = 'Artista no encontrado en nuestra red.';
                talentStatus.style.color = '#ff6b6b';
            } else {
                talentStatus.textContent = `✅ ${data.dj_name} trabaja con nosotros.`;
                talentStatus.style.color = 'var(--admin-accent)';

                const d = document.querySelector('[name="event_day"]')?.value;
                const m = document.querySelector('[name="event_month"]')?.value;
                const y = document.querySelector('[name="event_year"]')?.value;
                const eventDate = (d && m && y) ? `${y}-${m}-${d}` : null;

                if (eventDate && data.availability?.includes(eventDate)) {
                    talentStatus.textContent = `⚠️ ${data.dj_name} está OCUPADO para esa fecha.`;
                    talentStatus.style.color = '#ff6b6b';
                }
            }
        }, 500));

        // Use change listeners on all date parts
        const dateParts = ['event_day', 'event_month', 'event_year'];
        dateParts.forEach(name => {
            document.querySelector(`[name="${name}"]`)?.addEventListener('change', () => {
                talentInput.dispatchEvent(new Event('input'));
            });
        });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Global: Check Talent Availability (footer section)
async function checkTalentAvailability() {
    const name = document.getElementById('check-talent-name')?.value.trim();
    const result = document.getElementById('availability-result');
    const m = document.getElementById('avail-month')?.value;
    const d = document.getElementById('avail-day')?.value;
    const y = document.getElementById('avail-year')?.value;

    if (!name) return alert('Ingresa el nombre del DJ/Artista.');

    const selectedDate = (m && d && y && m !== 'Month' && d !== 'Day' && y !== 'Year')
        ? `${y}-${m}-${d}` : null;

    result.textContent = 'Verificando agenda...';
    result.style.color = '#fff';

    const db2 = window.getSupabaseClient();
    if (!db2) { result.textContent = 'Servicio no disponible.'; return; }
    const { data, error } = await db2
        .from('dj_profiles')
        .select('dj_name, availability')
        .ilike('dj_name', `%${name}%`)
        .limit(1)
        .single();

    if (error || !data) {
        result.textContent = '❌ No encontramos a ese artista.';
        result.style.color = '#ff6b6b';
        return;
    }

    const busyDates = data.availability || [];
    const isBusy = selectedDate && busyDates.includes(selectedDate);

    if (isBusy) {
        result.innerHTML = `❌ <strong>${data.dj_name}</strong> está OCUPADO el ${selectedDate}.`;
        result.style.color = '#ff6b6b';
    } else if (selectedDate) {
        result.innerHTML = `✅ <strong>${data.dj_name}</strong> está DISPONIBLE el ${selectedDate}.`;
        result.style.color = 'var(--admin-accent)';
    } else {
        result.innerHTML = busyDates.length > 0
            ? `✅ <strong>${data.dj_name}</strong> está con nosotros.<br><small style="opacity:.7">Tiene fechas ocupadas. Selecciona una arriba para verificar.</small>`
            : `✅ <strong>${data.dj_name}</strong> está con nosotros y tiene agenda libre.`;
        result.style.color = 'var(--admin-accent)';
    }
}
