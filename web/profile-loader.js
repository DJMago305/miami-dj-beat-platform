// Dynamic Data Loader
let busyDates = [];
let dashCalYear = new Date().getFullYear();
let dashCalMonth = new Date().getMonth();
let dashScheduleData = {};
let dashRecurringDays = new Set();

// Social platforms config: field name in dj_profiles → { icon SVG path, label, url template }
const SOCIAL_PLATFORMS = [
    { key: 'youtube_url', label: 'YouTube', icon: 'M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 1.86-.14 3.23-.44 4.17-.27.84-.7 1.27-1.54 1.54-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 18c-4.19 0-6.8-.14-7.83-.44-.84-.27-1.27-.7-1.54-1.54-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-1.86.14-3.23.44-4.17.27-.84.7-1.27 1.54-1.54.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 6c4.19 0 6.8.14 7.83.44.84.27 1.27.7 1.54 1.54z', fill: true },
    { key: 'beatport_url', label: 'Beatport', icon: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a1 1 0 110 2 1 1 0 010-2zm3 3H9v1h1v4H9v1h3v-1h-1v-4h1v1h2V9z', fill: true },
    { key: 'spotify_url', label: 'Spotify', icon: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.208c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.856zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.786-2.13-9.965-1.165a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.234 1.328a.78.78 0 01.256 1.071zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 11-.543-1.795c3.563-1.08 9.49-.87 13.234 1.482a.937.937 0 01-1.074 1.47z', fill: true },
    { key: 'soundcloud_url', label: 'SoundCloud', icon: 'M1.175 12.225c-.042 0-.078.03-.083.072l-.428 3.851.428 3.78c.005.04.041.072.083.072.04 0 .077-.032.083-.073l.485-3.779-.485-3.85c-.006-.042-.043-.073-.083-.073zm2.43-.714c-.047 0-.087.034-.093.08l-.367 4.565.367 4.282c.006.046.046.08.094.08s.088-.034.094-.08l.413-4.282-.413-4.564c-.006-.047-.047-.081-.094-.081zm11.645 2.373c-.057-.36-.173-.693-.34-.993-.12-.22-.273-.422-.45-.597-.12-.12-.245-.226-.39-.317-.284-.176-.61-.281-.96-.302-.022 0-.046-.002-.07-.002-.058 0-.117.004-.175.012a3.85 3.85 0 00-1.07-.93c-.477-.294-1.018-.46-1.59-.46-.483 0-.95.118-1.375.33-.01.003-.02.006-.029.008-.079.036-.156.078-.23.123-.073.044-.143.09-.21.14-.066.05-.13.1-.19.155C9 13.005 8.708 13.73 8.708 14.52v.008c0 .019.001.038.002.057v4.258c0 .083.064.15.145.155h10.375c.08-.005.144-.072.144-.155v-4.348c0-1.1-.697-2.04-1.67-2.407a2.83 2.83 0 00-.454-.194zm-1.935-4.163a3.97 3.97 0 00-3.97 3.97c0 .12.01.24.027.355a3.968 3.968 0 003.943-3.97c0-.12-.01-.237-.027-.352a4.004 4.004 0 00.027-.003z', fill: true },
    { key: 'instagram_url', label: 'Instagram', icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z', fill: true },
    { key: 'tiktok_url', label: 'TikTok', icon: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.77a8.18 8.18 0 004.79 1.53V6.87a4.85 4.85 0 01-1.02-.18z', fill: true },
    { key: 'shazam_url', label: 'Shazam', icon: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.5 14.5h-3v-1.5h.75V11H10v-1.5h2.25v5.5h1.25v1.5zM12 9a1 1 0 110-2 1 1 0 010 2z', fill: true },
    { key: 'apple_music_url', label: 'Apple Music', icon: 'M12,2C6.477,2,2,6.477,2,12s4.477,10,10,10s10-4.477,10-10S17.523,2,12,2z M15,14c-1.105,0-2,0.895-2,2s0.895,2,2,2s2-0.895,2-2 S16.105,14,15,14z M17,7v5.5C17,13.328,16.328,14,15.5,14S14,13.328,14,12.5S14.672,11,15.5,11c0.166,0,0.32,0.027,0.5,0.076V7h1V7z', fill: true },
    { key: 'twitter_url', label: 'X (Twitter)', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z', fill: true },
    { key: 'facebook_url', label: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', fill: true },
    { key: 'website_url', label: 'Web', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', fill: true },
];

/**
 * MDJPRO - Dynamic Manuals Loader (SQL Integration)
 */
async function loadDynamicManuals(supabase) {
    const listContainer = document.getElementById('manual-downloads-list');
    if (!listContainer) return;

    const { data: manuals, error } = await supabase
        .from('mdjpro_manuals')
        .select('*')
        .eq('is_active', true)
        .order('lang', { ascending: true });

    if (error) {
        console.error('[SQL SHIELD] Error loading manuals:', error);
        return;
    }

    if (manuals && manuals.length > 0) {
        listContainer.innerHTML = manuals.map(m => `
            <div class="manual-card" style="margin-bottom: 20px;">
                <a href="${m.file_path}" download style="text-decoration:none; display: flex; align-items: center; gap: 20px; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; transition: all 0.2s;">
                    <div style="font-size: 24px;">📄</div>
                    <div>
                        <div style="font-size: 14px; font-weight: 800; color: #fff;">${m.title} [${m.lang.toUpperCase()}]</div>
                        <div style="font-size: 11px; opacity: 0.5;">Versión: ${m.version} | MDJPRO Oficial</div>
                    </div>
                    <div style="margin-left: auto; font-size: 12px; color: var(--gold); font-weight: 900;">DESCARGAR ↓</div>
                </a>
            </div>
        `).join('');
        console.log('[SQL SHIELD] Dynamic Manuals injected successfully.');
    }
}

function buildHeroBanner(profile) {
    const banner = document.getElementById('dj-hero-banner');
    if (!banner) return;

    // Name
    const nameEl = document.getElementById('hero-dj-name');
    if (nameEl) nameEl.textContent = profile.dj_name || profile.stage_name || 'DJ';

    // Category / Specialties
    const catEl = document.getElementById('hero-category');
    if (catEl) {
        const cat = profile.category || profile.specialties || profile.role || '';
        if (cat) catEl.textContent = cat;
    }

    // Background (cover) — use background_url first, fall back to photo_url
    const heroBg = document.getElementById('hero-bg');
    const bgSrc = profile.background_url || profile.cover_url || profile.photo_url;
    if (heroBg && bgSrc) {
        heroBg.style.backgroundImage = `url('${bgSrc}')`;
    }

    // Avatar (profile photo)
    const heroAvatar = document.getElementById('hero-avatar');
    if (heroAvatar && profile.photo_url) {
        heroAvatar.src = profile.photo_url;
    }

    // Social icons
    const socialsEl = document.getElementById('hero-socials');
    if (socialsEl) {
        socialsEl.innerHTML = '';
        SOCIAL_PLATFORMS.forEach(({ key, label, icon, fill }) => {
            const url = profile[key];
            if (!url) return;
            // Ensure absolute URL
            const href = url.startsWith('http') ? url : `https://${url}`;
            const btn = document.createElement('a');
            btn.href = href;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.title = label;
            btn.style.cssText = `
                display:inline-flex;align-items:center;justify-content:center;
                width:36px;height:36px;border-radius:8px;
                background:rgba(255,255,255,0.1);transition:background 0.2s;
                border:1px solid rgba(255,255,255,0.15);text-decoration:none;
            `;
            btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.22)');
            btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.1)');
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="${fill ? 'white' : 'none'}" stroke="${fill ? 'none' : 'white'}" stroke-width="2"><path d="${icon}"/></svg>`;
            socialsEl.appendChild(btn);
        });
    }

    // Show banner only if there's at least a name or bg
    if (bgSrc || profile.dj_name) {
        banner.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to be available
    let supabase;
    if (window.getSupabaseClient) {
        supabase = window.getSupabaseClient();
    } else {
        // fallback — wait for global
        await new Promise(r => setTimeout(r, 300));
        supabase = window.supabase;
    }
    if (!supabase) { console.error('Supabase not available'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const user = session.user;

    // Fetch Profile from dj_profiles
    const { data: profile, error } = await supabase
        .from('dj_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return;
    }

    // ── Build the profile hero banner (Spotify-style) ──
    buildHeroBanner(profile);

    // ── Load Dynamic Manuals [SQL SHIELD] ──
    loadDynamicManuals(supabase);

    // Update UI elements if they exist

    const elements = {
        'profile-name': profile.dj_name,
        'dash-username': profile.stage_name || profile.dj_name || profile.full_name || 'DJ',
        'profile-meta': `${profile.city || 'Miami'} • ${profile.region || 'Florida'}`,
        'display-plan': profile.plan,
        'display-status': profile.status,
        'display-member-id': profile.member_id || `DJ-${user.id.substring(0, 4).toUpperCase()}`,
        'display-bio': profile.bio || 'DJ profesional de la red Miami DJ Beat.',
        'display-full-name': profile.full_name || 'Pendiente',
        'display-phone': profile.phone || 'Pendiente',
        'display-address': profile.address || 'Pendiente',
        'display-birthday': profile.birthday || 'Pendiente',
        'display-country': profile.country || 'Pendiente',
        // PRO: card holder name
        'card-name-display': profile.full_name ? `Titular: ${profile.full_name}` : 'Titular: —'
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Handle profile photo
    const photoEl = document.querySelector('.profile-photo');
    if (photoEl && profile.photo_url) {
        photoEl.src = profile.photo_url;
    }

    const avatars = document.querySelectorAll('.avatar');
    avatars.forEach(av => {
        if (profile.photo_url) av.src = profile.photo_url;
    });

    // Link Management (Handle Logout)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = './index.html';
        });
    }

    // Pro / Contract Logic & PRO Flow Visibility (The Guard)
    const contractSection = document.getElementById('contract-section');
    const flowTabBtn = document.querySelector('.dash-tab-btn[data-tab="flow"]');

    // Triple Check Verification (Professional Model)
    const planType = profile.plan_type || profile.plan || 'free';
    const planStatus = profile.plan_status || 'active';
    const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;

    const isProType = ['pro_monthly', 'pro_annual', 'PRO'].includes(planType);
    const isActiveStatus = planStatus === 'active';
    const isNotExpired = expiresAt ? (new Date() < expiresAt) : true;

    // Access is granted ONLY if all conditions are met
    const isFullPro = isProType && isActiveStatus && isNotExpired;

    if (flowTabBtn) {
        // Professional rule: If not active or not PRO or expired, it doesn't even exist visually.
        flowTabBtn.style.display = isFullPro ? 'inline-block' : 'none';
    }

    if (contractSection) {
        if (isFullPro && profile.status === 'ACTIVE') {
            contractSection.style.display = 'block';
        } else if (profile.status === 'PENDING_REVIEW') {
            contractSection.innerHTML = `<h3 style="color: var(--gold);">⏳ Solicitud en Revisión</h3><p class="fineprint">Estamos verificando tu equipo y experiencia. Acceso a contratos disponible tras aprobación.</p>`;
            contractSection.style.display = 'block';
        }
    }

    // Referral & Rewards Logic
    const referralInput = document.getElementById('referral-link');
    const qrContainer = document.getElementById('qrcode');

    if (referralInput && qrContainer) {
        const referralCode = profile.member_id || `MDJ-${user.id.substring(0, 5).toUpperCase()}`;
        const referralURL = `${window.location.origin}${window.location.pathname.replace('dj-dashboard.html', 'index.html')}?ref=${encodeURIComponent(referralCode)}`;

        referralInput.value = referralURL;

        // Clear placeholder and generate QR
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: referralURL,
            width: 120,
            height: 120,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    // Availability Logic
    if (document.getElementById('busy-dates-container')) {
        busyDates = profile.availability || [];
        renderBusyDates();
    }

    // Event Weather Calendar Initialization (Agenda Tab) 🍏☀️
    if (document.getElementById('calendar-master')) {
        let events = [];
        if (profile.availability_schedule && typeof profile.availability_schedule === 'object') {
            const schedule = profile.availability_schedule.schedule || {};
            const recurringDays = profile.availability_schedule.recurring_days || [];

            // 1. Mapear Eventos de Fecha Específica
            const specificEvents = Object.entries(schedule).map(([date, data]) => ({
                title: data.events?.[0]?.venue || 'Evento Confirmado',
                start: date,
                extendedProps: {
                    venue: data.events?.[0]?.venue,
                    city: data.events?.[0]?.city || 'Miami, FL',
                    status: data.events?.[0]?.status
                },
                backgroundColor: data.events?.[0]?.status === 'CANCELLED' ? '#ff5555' : '#00ff88',
                borderColor: data.events?.[0]?.status === 'CANCELLED' ? '#ff5555' : '#00ff88'
            }));

            // 2. Mapear Residencias Recurrentes (Días de la semana)
            const recurringEvents = recurringDays.map(day => ({
                title: 'Resident DJ (Residencia)',
                daysOfWeek: [day], // 0-6 (Sun-Sat)
                extendedProps: {
                    venue: 'Key Largo / Miami Venue',
                    city: 'Key Largo, FL', // Referencia por defecto del usuario
                    status: 'RESIDENT'
                },
                backgroundColor: '#5078ff',
                borderColor: '#5078ff'
            }));

            events = [...specificEvents, ...recurringEvents];
        }
        window.initEventWeatherCalendar(events);
        // Inicializar clima por defecto
        window.updateWeatherAnimation('Sunny');
    }

    const dashPhotoInput = document.getElementById('dash-photo-input');
    const dashPhotoImg = document.getElementById('dash-photo-img');

    if (dashPhotoInput && dashPhotoImg) {
        dashPhotoInput.addEventListener('change', async function (e) {
            handleDashPhoto(e.target.files[0]);
        });

        // CLIPBOARD PASTE SUPPORT (Dashboard)
        window.addEventListener('paste', (e) => {
            // Ignore if typing in inputs
            if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    handleDashPhoto(item.getAsFile());
                }
            }
        });

        async function handleDashPhoto(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function (event) {
                const base64 = event.target.result;
                const originalOpacity = dashPhotoImg.style.opacity || '1';
                dashPhotoImg.style.opacity = '0.3'; // Visual feedback (working)

                // Update Supabase
                const { error } = await supabase
                    .from('dj_profiles')
                    .update({ photo_url: base64 })
                    .eq('user_id', session.user.id);

                dashPhotoImg.style.opacity = originalOpacity;

                if (error) {
                    console.error("Error updating photo:", error);
                    alert("Error al actualizar la foto: " + error.message);
                } else {
                    dashPhotoImg.src = base64;
                    // Update header avatar if it exists
                    const headerAvatar = document.querySelector('.avatar');
                    if (headerAvatar) headerAvatar.src = base64;
                    alert("¡Foto de perfil actualizada con éxito!");
                }
            };
            reader.readAsDataURL(file);
        }
    }
});

function renderBusyDates() {
    const container = document.getElementById('busy-dates-container');
    if (!container) return;

    if (busyDates.length === 0) {
        container.innerHTML = '<div class="fineprint" style="opacity: 0.5;">No hay fechas ocupadas registradas. Estás disponible todos los días.</div>';
        return;
    }

    container.innerHTML = busyDates.map((date, index) => `
        <div class="badge" style="background: rgba(255,255,255,0.1); display: flex; align-items: center; gap: 8px; padding: 10px 15px;">
            <span>🗓️ ${date}</span>
            <button onclick="removeBusyDate(${index})" style="background: none; border: none; color: #ff3333; cursor: pointer; font-weight: bold; font-size: 16px;">×</button>
        </div>
    `).join('');
}

async function addBusyDate() {
    const date = prompt("Ingresa la fecha que estarás ocupado (YYYY-MM-DD):");
    if (!date) return;

    // Basic YYYY-MM-DD validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Formato inválido. Usa AAAA-MM-DD");
        return;
    }

    if (busyDates.includes(date)) {
        alert("Esa fecha ya está marcada como ocupada.");
        return;
    }

    busyDates.push(date);
    busyDates.sort(); // Keep them sorted
    renderBusyDates();
    await syncAvailability();
}

async function removeBusyDate(index) {
    if (confirm(`¿Marcar el ${busyDates[index]} como disponible de nuevo?`)) {
        busyDates.splice(index, 1);
        renderBusyDates();
        await syncAvailability();
    }
}

async function syncAvailability() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
        .from('dj_profiles')
        .update({ availability: busyDates })
        .eq('user_id', session.user.id);

    if (error) {
        console.error("Error syncing availability:", error);
        alert("Error al guardar cambios en el servidor.");
    }
}

function copyReferral() {
    const copyText = document.getElementById("referral-link");
    if (!copyText) return;
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("¡Link de referido copiado!");
}

// ── DASHBOARD TAB LOGIC ────────────────────────────────────
window.switchDashTab = function (tabId) {
    document.querySelectorAll('.dash-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.dj-tab-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById('tab-' + tabId);
    const btn = document.querySelector(`.dj-tab-btn[onclick*="${tabId}"]`);

    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');

    if (tabId === 'flow') loadFlowData('30d');
};

// ── DASHBOARD ALMANAC (READ-ONLY) ───────────────────────────
/**
 * 🍏 EVENT WEATHER CALENDAR ENGINE
 * Integración de FullCalendar + Real-time Weather + iOS Animations
 */
window.initEventWeatherCalendar = async function (assignedEvents = []) {
    const calendarEl = document.getElementById('calendar-master');
    if (!calendarEl) return;

    // DAY_STATE Definition 
    const DAY_STATE = {
        EVENT: 'event',
        RESIDENT: 'resident',
        VACATION: 'vacation',
        HOLIDAY: 'holiday',
        AVAILABLE: 'available'
    };
    
    // Priority Dictionary
    const STATE_PRIORITY = {
        [DAY_STATE.EVENT]: 5,
        [DAY_STATE.RESIDENT]: 4,
        [DAY_STATE.VACATION]: 3,
        [DAY_STATE.HOLIDAY]: 2,
        [DAY_STATE.AVAILABLE]: 1
    };

    const holidays = {
        '2026-01-01': 'Año Nuevo',
        '2026-01-19': 'Martin Luther King Jr.',
        '2026-02-16': 'Presidents Day',
        '2026-05-25': 'Memorial Day',
        '2026-06-19': 'Juneteenth',
        '2026-07-04': 'Independence Day',
        '2026-09-07': 'Labor Day',
        '2026-10-12': 'Columbus Day',
        '2026-11-11': 'Veterans Day',
        '2026-11-26': 'Thanksgiving',
        '2026-12-25': 'Navidad'
    };

    let availabilityEvents = [];
    let schedule = {};
    let recurringDays = [];
    let vacationStart = '';
    let vacationEnd = '';

    try {
        const sb = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            const { data: profile, error: profError } = await sb
                .from('dj_profiles')
                .select('availability, availability_schedule')
                .eq('user_id', session.user.id)
                .maybeSingle();
                
            if (profError) console.warn("Supabase profile fetch warning:", profError);

            if (profile?.availability && Array.isArray(profile.availability)) {
                availabilityEvents = profile.availability.map(date => ({
                    title: 'Residencia/Bloqueado',
                    start: date,
                    allDay: true,
                    extendedProps: { type: DAY_STATE.RESIDENT }
                }));
            }
            if (profile?.availability_schedule) {
                schedule = profile.availability_schedule.schedule || {};
                recurringDays = profile.availability_schedule.recurring_days || [];
                vacationStart = profile.availability_schedule.vacation_start || '';
                vacationEnd = profile.availability_schedule.vacation_end || '';
            }
        }
    } catch (e) {
        console.error("Critical failure in calendar sync:", e);
    }

    // Helper: Build Days Range
    const getDatesInRange = (startStr, endStr) => {
        if (!startStr || !endStr) return [];
        const dates = [];
        let curr = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        if (curr > end) return [];
        while (curr <= end) {
            dates.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    };
    const vacationDates = getDatesInRange(vacationStart, vacationEnd);

    // ── CALENDAR DATA MAPPING & PRIORITY ENGINE ──
    const dayStateMap = {};
    const registerDayState = (dateStr, state) => {
        const current = dayStateMap[dateStr] || DAY_STATE.AVAILABLE;
        if (STATE_PRIORITY[state] > STATE_PRIORITY[current]) {
            dayStateMap[dateStr] = state;
        }
    };

    // 1. Vacations
    const vacEvents = vacationDates.map(date => {
        registerDayState(date, DAY_STATE.VACATION);
        return {
            title: 'Vacaciones',
            start: date,
            allDay: true,
            extendedProps: { type: DAY_STATE.VACATION }
        };
    });

    // 2. Specific Events
    const specificEvents = [];
    Object.entries(schedule).forEach(([dateStr, data]) => {
        (data.events || []).forEach(ev => {
            const isBlocked = data.status === 'blocked';
            const type = isBlocked ? DAY_STATE.VACATION : DAY_STATE.EVENT;
            registerDayState(dateStr, type);
            specificEvents.push({
                title: isBlocked ? 'Día Bloqueado' : (ev.venue || 'Evento Confirmado'),
                start: dateStr,
                extendedProps: {
                    venue: ev.venue || '',
                    city: ev.city || 'Miami, FL',
                    start_time: ev.from || '',
                    end_time: ev.to || '',
                    buffer_time: ev.buffer_mins || 0,
                    status: ev.status || 'CONFIRMED',
                    type: type
                }
            });
        });
    });

    // 3. Recurring Residencies (Stored differently, don't map absolute dates directly yet)
    const recurringEvents = recurringDays.map(day => ({
        title: 'Resident DJ (Residencia)',
        daysOfWeek: [day], // 0-6
        extendedProps: {
            venue: 'Key Largo / Miami Venue',
            city: 'Key Largo, FL',
            type: DAY_STATE.RESIDENT
        }
    }));

    // 4. Assigned Events (Fallback from args)
    const extraEvents = (assignedEvents || []).map(e => {
        if (e.start) registerDayState(e.start, DAY_STATE.EVENT);
        return { ...e, extendedProps: { ...e.extendedProps, type: DAY_STATE.EVENT } };
    });

    const allEvents = [...specificEvents, ...recurringEvents, ...vacEvents, ...extraEvents, ...availabilityEvents];

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        locale: 'es',
        firstDay: 0, 
        themeSystem: 'standard',
        height: 'auto',
        events: allEvents,

        dayCellClassNames: function(arg) {
            const d = arg.date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const dow = d.getDay();
            
            const classes = [];
            
            // Re-evaluate current priority based on recurring & holidays dynamically
            let finalState = dayStateMap[dateStr] || DAY_STATE.AVAILABLE;
            
            if (holidays[dateStr] && STATE_PRIORITY[DAY_STATE.HOLIDAY] > STATE_PRIORITY[finalState]) {
                finalState = DAY_STATE.HOLIDAY;
            }
            if (recurringDays.includes(dow) && STATE_PRIORITY[DAY_STATE.RESIDENT] > STATE_PRIORITY[finalState]) {
                finalState = DAY_STATE.RESIDENT;
            }

            classes.push(`state-${finalState}`);

            // Overlay: TODAY
            if (arg.isToday) {
                classes.push('state-today');
            }
            return classes;
        },

        dayCellDidMount: function (arg) {
            const d = arg.date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;

            if (holidays[dateKey]) {
                const hLabel = document.createElement('div');
                hLabel.className = 'holiday-label';
                hLabel.textContent = holidays[dateKey];
                arg.el.appendChild(hLabel);
            }
        },

        eventContent: function (arg) {
            let dot = document.createElement('div');
            dot.className = 'apple-status-dot';
            const type = arg.event.extendedProps?.type;
            
            if (type === DAY_STATE.EVENT) {
                dot.style.backgroundColor = '#00ff88'; dot.style.color = '#00ff88';
            } else if (type === DAY_STATE.RESIDENT) {
                dot.style.backgroundColor = '#5078ff'; dot.style.color = '#5078ff';
            } else if (type === DAY_STATE.VACATION) {
                dot.style.backgroundColor = '#ffc107'; dot.style.color = '#ffc107';
            } else {
                dot.style.display = 'none';
            }

            return { domNodes: [dot] };
        },

        eventClick: function (info) {
            document.querySelectorAll('.fc-daygrid-day').forEach(d => d.classList.remove('fc-day-selected'));
            const cell = info.el.closest('.fc-daygrid-day');
            if (cell) cell.classList.add('fc-day-selected');
            if (window.handleEventWeather) {
                window.handleEventWeather(info.event);
            }
        },

        dateClick: function (info) {
            document.querySelectorAll('.fc-daygrid-day').forEach(d => d.classList.remove('fc-day-selected'));
            info.dayEl.classList.add('fc-day-selected');
            if (window.handleEventWeather) {
                window.handleEventWeather(info.dateStr);
            }
        }
    });

    calendar.render();
    window.fcInstance = calendar;
};

/**
 * Motor de Clima y Animaciones 🍏☀️
 */
window.updateWeatherAnimation = function (condition) {
    const container = document.getElementById('weather-hero-container'); // Nueva ubicación unificada
    const overlay = document.getElementById('weather-master-overlay');
    const badge = document.getElementById('current-weather-badge');
    if (!container || !overlay) return;

    // 1. Ciclo Día/Noche (Engine 2026)
    const hour = new Date().getHours();
    const isNight = hour >= 18 || hour < 6;

    container.classList.remove('is-night', 'is-stormy');
    if (isNight) container.classList.add('is-night');

    // Reset layers
    const layers = ['weather-sunny', 'weather-rain', 'weather-clouds', 'weather-storm', 'weather-fog'];
    layers.forEach(l => {
        const el = document.getElementById(l);
        if (el) el.style.display = 'none';
        if (el) el.style.opacity = '0';
    });

    overlay.classList.add('active');
    if (badge) badge.style.display = 'block';

    const cond = (condition || 'sunny').toLowerCase();
    let label = 'Despejado';

    // 2. Mapeo Atmosférico
    if (cond.includes('rain') || cond.includes('drizzle')) {
        document.getElementById('weather-rain').style.display = 'block';
        document.getElementById('weather-rain').style.opacity = '1';
        label = '🌧️ Lluvia';
        window.createRainDrops();
    } else if (cond.includes('cloud')) {
        const cloudLayer = document.getElementById('weather-clouds');
        cloudLayer.style.display = 'block';
        cloudLayer.style.opacity = '1';
        label = '☁️ Nublado';
        window.initCloudLayers(isNight);
    } else if (cond.includes('clear') || cond.includes('sun')) {
        const sunLayer = document.getElementById('weather-sunny');
        sunLayer.style.display = 'block';
        sunLayer.style.opacity = '1';
        label = isNight ? '🌙 Noche Despejada' : '☀️ Soleado';
        if (isNight) container.classList.add('is-night');
    } else if (cond.includes('storm') || cond.includes('thunder')) {
        container.classList.add('is-stormy');
        document.getElementById('weather-storm').style.display = 'block';
        document.getElementById('weather-storm').style.opacity = '1';
        label = '⚡ Tormenta';
        window.startLightningEffect();
    }

    if (badge) badge.textContent = label;
};

window.initCloudLayers = function (isNight) {
    const cloudBox = document.getElementById('weather-clouds');
    if (!cloudBox) return;
    cloudBox.innerHTML = `
        <div class="cloud-layer cloud-1" style="background: ${isNight ? 'rgba(100,100,150,0.3)' : 'rgba(255,255,255,0.4)'}"></div>
        <div class="cloud-layer cloud-2" style="background: ${isNight ? 'rgba(80,80,120,0.2)' : 'rgba(255,255,255,0.2)'}"></div>
        <div class="cloud-layer cloud-3" style="background: ${isNight ? 'rgba(100,100,150,0.3)' : 'rgba(255,255,255,0.4)'}"></div>
    `;
};

window.createRainDrops = function () {
    const canvas = document.getElementById('weather-rain');
    if (!canvas) return;
    canvas.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = Math.random() * 100 + '%';
        drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
        drop.style.animationDelay = Math.random() * 2 + 's';
        canvas.appendChild(drop);
    }
};

window.startLightningEffect = function () {
    if (window.lightningInterval) clearInterval(window.lightningInterval);
    const storm = document.getElementById('weather-storm');
    if (!storm) return;
    window.lightningInterval = setInterval(() => {
        if (Math.random() > 0.7) {
            storm.classList.add('flash');
            setTimeout(() => storm.classList.remove('flash'), 200);
        }
    }, 3000);
};

/**
 * Muestra los detalles de un evento o residencia en la barra lateral
 */
window.showDashEventDetails = function (dateStr, isRecurring, dayData, dayNum) {
    const emptyDiv = document.getElementById('dash-event-detail-empty');
    const dataDiv = document.getElementById('dash-event-detail-data');
    const card = document.getElementById('dash-event-detail-card');

    if (!emptyDiv || !dataDiv || !card) return;

    emptyDiv.style.display = 'none';
    dataDiv.style.display = 'block';

    const dateObj = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateReadable = dateObj.toLocaleDateString('es-ES', options);

    let html = '';
    let themeColor = 'var(--gold)';
    let title = 'Detalles del Evento';

    if (dayData && dayData.events && dayData.events.length > 0) {
        const ev = dayData.events[0];
        const isCancelled = ev.status === 'CANCELLED';

        themeColor = isCancelled ? '#ff5555' : '#00ff88';
        title = isCancelled ? 'Evento Cancelado' : 'Evento Confirmado';
        const venueName = ev.venue || 'Evento Miami DJ Beat';

        html = `
            <div style="color: ${themeColor}; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">${title}</div>
            <h2 style="color: #fff; font-size: 28px; font-weight: 900; margin-bottom: 20px; line-height: 1.1;">${venueName}</h2>
            <div style="margin-bottom: 24px;">
                <div style="font-size: 10px; color: var(--muted); font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Fecha y Horario</div>
                <div style="font-size: 16px; color: #fff; font-weight: 700;">${dateReadable} | ${ev.from || '---'} - ${ev.to || '---'}</div>
            </div>
        `;
    } else if (isRecurring) {
        themeColor = '#5078ff';
        title = 'Residencia Activa';
        html = `
            <div style="color: ${themeColor}; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">${title}</div>
            <h2 style="color: #fff; font-size: 28px; font-weight: 900; margin-bottom: 20px; line-height: 1.1;">Resident DJ</h2>
            <div style="margin-bottom: 24px;">
                <div style="font-size: 10px; color: var(--muted); font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Turno Habitual</div>
                <div style="font-size: 16px; color: #fff; font-weight: 700;">${dateReadable}</div>
            </div>
        `;
    } else {
        themeColor = 'rgba(255,255,255,0.1)';
        html = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 32px; margin-bottom: 10px;">✨</div>
                <h3 style="color: #fff; font-size: 18px; font-weight: 800; margin-bottom: 5px;">Día sin eventos</h3>
                <p style="color: var(--muted); font-size: 13px;">No hay compromisos para el ${dateReadable}.</p>
            </div>
        `;
    }

    dataDiv.innerHTML = html;
    card.style.borderColor = themeColor;
    card.style.background = isRecurring ? 'rgba(80,120,255,0.05)' : (dayData?.events?.length > 0 ? 'rgba(197,160,89,0.05)' : '#111114');
};

window.getWeatherSVG = function (condition, size = 24) {
    const cond = condition.toLowerCase();
    let path = '';
    let color = '#fff';

    if (cond.includes('clear') || cond.includes('sun')) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="5" fill="url(#sun-grad)"/>
            <defs><radialGradient id="sun-grad"><stop offset="0%" stop-color="#FFD700"/><stop offset="100%" stop-color="#FF8C00"/></radialGradient></defs>
        </svg>`;
    } else if (cond.includes('cloud')) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5S20 10 17.5 10c-.2 0-.5 0-.7.1C15.8 7.6 13.1 6 10 6 5.6 6 2 9.6 2 14s3.6 8 8 8h7.5" fill="#E2E8F0" fill-opacity="0.8"/>
            <circle cx="15" cy="9" r="4" fill="#FFD700"/>
        </svg>`;
    } else if (cond.includes('rain')) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5 14c2.5 0 4.5-2 4.5-4.5S20 5 17.5 5c-.2 0-.5 0-.7.1C15.8 2.6 13.1 1 10 1 5.6 1 2 4.6 2 9s3.6 8 8 8h7.5" fill="#94A3B8"/>
            <path d="M8 19v3M12 19v3M16 19v3" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
    }
    return '☀️'; // Fallback
};

window.showEventWeatherDetails = async function (eventOrDate) {
    const dataDiv = document.getElementById('dash-event-detail-data');
    if (!dataDiv) return;

    dataDiv.style.display = 'block';

    const isEvent = !!eventOrDate.title;
    const city = isEvent ? (eventOrDate.extendedProps?.city || 'Miami, FL') : 'Miami, FL';
    const dateStr = isEvent ? eventOrDate.startStr : eventOrDate;
    const eventTitle = isEvent ? eventOrDate.title : 'Día sin eventos';

    // 1. Diagnóstico Atmosférico Dinámico
    const mockConditions = ['Sunny', 'Cloudy', 'Rainy', 'Stormy'];
    const condition = mockConditions[Math.floor(Math.random() * mockConditions.length)];
    window.updateWeatherAnimation(condition);

    const hours = [
        { h: '18:00', t: '82°', c: 'sunny' }, { h: '19:00', t: '80°', c: 'cloudy' },
        { h: '20:00', t: '79°', c: 'cloudy' }, { h: '21:00', t: '78°', c: 'rainy' },
        { h: '22:00', t: '77°', c: 'rainy' }, { h: '23:00', t: '75°', c: 'stormy' }
    ];

    // 2. Colores y Labels Logísticos
    let themeColor = isEvent ? (condition === 'Stormy' ? '#ff5555' : '#00ff88') : 'rgba(255,255,255,0.2)';
    let statusLabel = isEvent ? 'Evento Confirmado' : 'Agenda Disponible';

    // 3. ACTUALIZAR HERO ATMOSFÉRICO (IZQUIERDA) 🍏
    const heroCity = document.getElementById('hero-city');
    const heroTemp = document.getElementById('hero-temp');
    const heroCond = document.getElementById('hero-condition');
    const heroHL = document.getElementById('hero-high-low');

    if (heroCity) heroCity.textContent = city.split(',')[0];
    if (heroTemp) heroTemp.textContent = '82°';
    if (heroCond) heroCond.textContent = condition === 'Sunny' ? 'Despejado' : (condition === 'Cloudy' ? 'Mayormente Nublado' : (condition === 'Rainy' ? 'Lluvia Ligera' : 'Tormenta Eléctrica'));
    if (heroHL) heroHL.textContent = 'Máxima: 82° | Mínima: 72°';

    // 4. ACTUALIZAR CARRUSEL HORARIO PERMANENTE 📈
    const hourlyScroller = document.getElementById('hourly-scroller-main');
    if (hourlyScroller) {
        hourlyScroller.innerHTML = hours.map(h => `
            <div style="text-align: center; min-width: 55px; animation: fadeIn 0.5s ease-out;">
                <div style="font-size: 11px; font-weight: 700; opacity: 0.5; margin-bottom: 12px;">${h.h}</div>
                <div style="margin-bottom: 12px; transform: scale(1.1);">${window.getWeatherSVG(h.c, 28)}</div>
                <div style="font-size: 17px; font-weight: 600; letter-spacing: -0.5px;">${h.t}</div>
            </div>
        `).join('');
    }

    // 5. ACTUALIZAR PRONÓSTICO 10 DÍAS 📅
    const dailyScroller = document.getElementById('daily-forecast-list');
    if (dailyScroller) {
        const days = [
            { d: 'Hoy', i: '☀️', min: 72, max: 82 },
            { d: 'Vie', i: '⛅', min: 73, max: 82 },
            { d: 'Sáb', i: '☀️', min: 72, max: 82 },
            { d: 'Dom', i: '☀️', min: 72, max: 81 },
            { d: 'Lun', i: '⛈️', min: 74, max: 83 },
            { d: 'Mar', i: '☁️', min: 71, max: 79 },
            { d: 'Mié', i: '⛅', min: 73, max: 81 },
            { d: 'Jue', i: '☀️', min: 72, max: 84 },
            { d: 'Vie', i: '☀️', min: 73, max: 85 },
            { d: 'Sáb', i: '☀️', min: 72, max: 82 }
        ];

        dailyScroller.innerHTML = days.map(day => `
            <div style="display: grid; grid-template-columns: 50px 30px 40px 1fr 40px; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: #fff;">
                <div style="opacity: 0.9;">${day.d}</div>
                <div style="font-size: 18px; text-align: center;">${day.i}</div>
                <div style="opacity: 0.6; font-size: 13px;">${day.min}°</div>
                <div style="position: relative; height: 4px; background: rgba(255,255,255,0.1); border-radius: 4px;">
                    <div style="position: absolute; left: 20%; right: 10%; height: 100%; background: linear-gradient(90deg, #c5a059, #fff); border-radius: 4px;"></div>
                </div>
                <div style="text-align: right; font-weight: 800;">${day.max}°</div>
            </div>
        `).join('');
    }

    // 6. INYECTAR DETALLES LOGÍSTICOS (FORMATO PREMIUM CEO - MDJPRO 2026)
    const eventDayName = new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long' });
    const capitalizedDay = eventDayName.charAt(0).toUpperCase() + eventDayName.slice(1);

    dataDiv.innerHTML = `
        <div style="animation: fadeIn 0.4s ease-out; color: #fff; font-family: 'Inter', sans-serif;">
            <!-- Status Pill Superior -->
            <div style="color: ${themeColor}; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor;"></span>
                ${statusLabel}
            </div>

            <!-- GRID DE INFORMACIÓN CRÍTICA (FORMATO CEO) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: rgba(0,0,0,0.2); backdrop-filter: blur(20px); padding: 25px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05);">
                
                <!-- Fila 1: Evento y Lugar -->
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Evento</div>
                    <div style="font-size: 18px; font-weight: 800; color: #fff;">${eventTitle}</div>
                </div>
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Lugar</div>
                    <div style="font-size: 18px; font-weight: 700; color: #fff;">${city}</div>
                </div>

                <!-- Fila 2: Fecha y Clima Previsto -->
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Fecha</div>
                    <div style="font-size: 18px; font-weight: 700; color: #fff;">${isEvent ? capitalizedDay : 'Disponible'}</div>
                </div>
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Clima previsto</div>
                    <div style="font-size: 16px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 22px;">${condition === 'Sunny' ? '☀️' : (condition === 'Cloudy' ? '🌤' : '🌧')}</span>
                        <span>${heroCond ? heroCond.textContent : '—'} 78°F</span>
                    </div>
                </div>

                <!-- Fila 3: Atardecer y Alerta Logística -->
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Atardecer</div>
                    <div style="font-size: 18px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                        <span>🌇</span> 6:32 PM
                    </div>
                </div>
                <div style="grid-column: span 2; margin-top: 10px; padding: 15px; background: rgba(197,160,89,0.1); border-radius: 16px; border: 1px solid rgba(197,160,89,0.2);">
                    <div style="font-size: 10px; color: var(--gold); font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                         ⚠️ Alerta logística
                    </div>
                    <div style="font-size: 13px; font-weight: 500; line-height: 1.5; color: rgba(255,255,255,0.9);">
                        ${isEvent ? 'Posible viento moderado. Traer protección para equipos (faldas de mesa pesadas y cobertores).' : 'Sin alertas operativas. Equipo en mantenimiento.'}
                    </div>
                </div>
            </div>
        </div>
    `;
};

// ── FLUJO ANALYTICS (MDJPRO PREMIUM) ───────────────────────
window.loadFlowData = async function (range) {
    const ledger = document.getElementById('ledger-body');
    if (!ledger) return;

    // KPI mapping
    const kpis = {
        'kpi-gross': '$12,450.00',
        'kpi-events-done': '24',
        'kpi-events-pending': '8',
        'kpi-comm-rate': '12%',
        'kpi-available': '$4,280.00',
        'kpi-avg-ticket': '$518.00'
    };

    for (const [id, val] of Object.entries(kpis)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    ledger.innerHTML = `
    < tr >
            <td>05/Mar/2026</td>
            <td style="font-weight:700; color:#fff;">Residencia Mojitos (Turno Sab)</td>
            <td style="color:rgba(255,255,255,0.4);">$450.00</td>
            <td style="color:rgba(255,255,255,0.4);">$54.00</td>
            <td style="color:#00ff88; font-weight:800;">$396.00</td>
            <td><span class="status-pill income">INGRESADO</span></td>
            <td style="font-size:11px; opacity:0.5;">Auto-Payout</td>
        </tr >
    `;
};
