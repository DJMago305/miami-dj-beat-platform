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
    { key: 'apple_music_url', label: 'Apple Music', icon: 'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.004.958 1.04 1.88.475 3.208A8.196 8.196 0 00.062 5.15c-.04.602-.05 1.21-.053 1.814L0 12.064v4.38c.006.5.014 1.002.043 1.5.05.87.2 1.726.51 2.55.66 1.74 1.95 2.89 3.76 3.38.58.16 1.18.25 1.79.29.5.04 1.01.05 1.52.05h11.27c.5 0 1.01-.01 1.51-.05.59-.04 1.19-.13 1.76-.29 1.88-.51 3.15-1.71 3.77-3.54.22-.65.34-1.33.38-2.01.05-.76.06-1.53.06-2.3 0-2.7-.01-5.4-.02-8.1-.01-.65-.02-1.3-.05-1.95M12.79 8.1l-5.86 3.38c-.08.05-.16.09-.25.16-.32.27-.26.61.08.81l5.86 3.39c.14.08.28.12.43.12.15 0 .28-.04.43-.12l5.87-3.39c.33-.19.4-.53.09-.81a1.59 1.59 0 00-.24-.16l-5.87-3.38c-.15-.08-.29-.12-.44-.12-.15 0-.29.04-.44.12z', fill: true },
    { key: 'twitter_url', label: 'X (Twitter)', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z', fill: true },
    { key: 'facebook_url', label: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', fill: true },
    { key: 'website_url', label: 'Web', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', fill: true },
];

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

    const avatarEl = document.querySelector('.avatar');
    if (avatarEl && profile.photo_url) {
        avatarEl.src = profile.photo_url;
    }

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

    // Dashboard Almanac Initialization
    if (document.getElementById('dash-cal-grid')) {
        if (profile.availability_schedule && typeof profile.availability_schedule === 'object') {
            dashScheduleData = profile.availability_schedule.schedule || {};
            const rd = profile.availability_schedule.recurring_days || [];
            rd.forEach(d => dashRecurringDays.add(Number(d)));
        }
        renderDashCal();
    }

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
// ── DASHBOARD ALMANAC (READ-ONLY) ───────────────────────────
function renderDashCal() {
    const grid = document.getElementById('dash-cal-grid');
    const header = document.getElementById('dash-cal-header');
    if (!grid || !header) return;

    const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    header.textContent = `${MONTHS_ES[dashCalMonth]} ${dashCalYear}`;

    grid.innerHTML = '';
    const firstDay = new Date(dashCalYear, dashCalMonth, 1).getDay();
    const daysInMonth = new Date(dashCalYear, dashCalMonth + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${dashCalYear}-${String(dashCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayDate = new Date(dashCalYear, dashCalMonth, d);
        const dow = dayDate.getDay();
        const isPast = dayDate < today;

        const dayData = dashScheduleData[dateStr];
        const isRecurring = dashRecurringDays.has(dow);
        const hasEvents = dayData?.events?.length > 0;

        let bg = 'rgba(255,255,255,0.03)';
        let border = 'rgba(255,255,255,0.05)';
        let color = 'rgba(255,255,255,0.5)';

        if (hasEvents) {
            const ev = dayData.events[0];
            if (ev.status === 'CANCELLED') {
                bg = 'rgba(255,85,85,0.15)'; border = 'rgba(255,85,85,0.4)'; color = '#ff5555';
            } else {
                bg = 'rgba(0,255,136,0.15)'; border = 'rgba(0,255,136,0.4)'; color = '#00ff88';
            }
        } else if (isRecurring) {
            bg = 'rgba(80,120,255,0.15)'; border = 'rgba(80,120,255,0.4)'; color = '#80a0ff';
        }

        const cell = document.createElement('div');
        cell.className = 'dash-cal-cell';
        cell.style.cssText = `
            text-align:center; padding:32px 0; border-radius:18px; font-size:32px; font-weight:700;
            background:${bg}; border:1px solid ${border}; color:${color};
            opacity:${isPast ? 0.3 : 1}; position:relative; transition: all 0.2s; cursor: pointer;
        `;
        cell.textContent = d;

        // Click to show details
        cell.onclick = () => {
            // Remove previous active highlights
            document.querySelectorAll('.dash-cal-cell').forEach(c => {
                c.style.boxShadow = '';
                c.style.transform = '';
            });

            const ev = dayData?.events?.[0];
            const isCancelled = ev?.status === 'CANCELLED';
            const hasEvents = dayData?.events?.length > 0;

            // High intensity highlight for selection
            let activeColor = '#fff';
            if (isCancelled) activeColor = '#ff5555';
            else if (hasEvents) activeColor = '#00ff88';
            else if (isRecurring) activeColor = '#5078ff';

            cell.style.boxShadow = `0 0 20px ${activeColor}, inset 0 0 0 3px ${activeColor}`;
            cell.style.zIndex = '5';

            showDashEventDetails(dateStr, isRecurring, dayData, d);
        };

        // If it's today, highlight it
        if (dayDate.getTime() === today.getTime()) {
            cell.style.border = '2px solid var(--gold)';
        }

        grid.appendChild(cell);
    }
}

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
        // EVENTO ASIGNADO
        const ev = dayData.events[0];
        const isCancelled = ev.status === 'CANCELLED';

        themeColor = isCancelled ? '#ff5555' : '#00ff88'; // RED if cancelled, GREEN if confirmed
        title = isCancelled ? 'Evento Cancelado' : 'Evento Confirmado';
        const venueName = ev.venue || 'Boda Ana y Ruben';

        html = `
            <div style="color: ${themeColor}; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">${title}</div>
            <h2 style="color: #fff; font-size: 28px; font-weight: 900; margin-bottom: 20px; line-height: 1.1;">${venueName}</h2>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 10px; color: var(--muted); font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Fecha y Horario</div>
                <div style="font-size: 16px; color: #fff; font-weight: 700;">${dateReadable} | ${ev.from || '7:00 PM'} - ${ev.to || '12:00 AM'}</div>
            </div>

            <!-- DOCUMENTOS ADJUNTOS -->
            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
                <div style="font-size: 10px; color: var(--muted); font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">Archivos y Documentos del Evento</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="#" class="btn secondary small" style="padding: 10px 16px; font-size: 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.1);">
                        <span>📄</span> Flow Plan (PDF)
                    </a>
                    <a href="#" class="btn secondary small" style="padding: 10px 16px; font-size: 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.1);">
                        <span>🖼️</span> Plano del Salón (PNG)
                    </a>
                </div>
            </div>
        `;
    } else if (isRecurring) {
        // RESIDENCIA (AZUL)
        themeColor = '#5078ff';
        title = 'Residencia Activa';
        html = `
            <div style="color: ${themeColor}; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">${title}</div>
            <h2 style="color: #fff; font-size: 28px; font-weight: 900; margin-bottom: 20px; line-height: 1.1;">Resident DJ</h2>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 10px; color: var(--muted); font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Ubicación y Turno</div>
                <div style="font-size: 16px; color: #fff; font-weight: 700;">Mojitos Calle 8 | 7:00 PM - 12:00 AM</div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
                <div style="font-size: 10px; color: var(--muted); font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">Documentación de Residencia</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="#" class="btn secondary small" style="padding: 10px 16px; font-size: 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.1);">
                        <span>📄</span> Contrato Base (PDF)
                    </a>
                </div>
            </div>
        `;
    } else {
        // DÍA LIBRE
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
}

function dashPrevMonth() {
    if (dashCalMonth === 0) { dashCalMonth = 11; dashCalYear--; }
    else dashCalMonth--;
    renderDashCal();
}

function dashNextMonth() {
    if (dashCalMonth === 11) { dashCalMonth = 0; dashCalYear++; }
    else dashCalMonth++;
    renderDashCal();
}
