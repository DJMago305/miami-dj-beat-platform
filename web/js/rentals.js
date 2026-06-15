/**
 * 🔒 LOCKED RENDER ENGINE
 * 
 * Controla la construcción visual del catálogo rentals.
 * 
 * Cambios no autorizados pueden afectar:
 * - Orden de render
 * - Transparencias / estilos premium
 * - Integridad de las tarjetas
 * 
 * NO TOCAR SIN PLAN DE CAMBIO.
 */
if (typeof window.t !== 'function') {
  window.t = (key, fallback) => fallback;
}

/**
 * Contrato producto — Hub «Entretenimiento y Talento» (`#talent-selector-modal`).
 * Congelado a propósito: regresiones frecuentes = preview vídeo en hover del carrusel + anillos de lista en tarjetas.
 * No cambiar flags sin ticket + Captain/Architect; si `true`, el código legacy correspondiente no está en el bundle.
 * Ver `.cursorrules` → «Talent selector hub (CONTRACT)».
 */
if (!window.MDJ_RENTALS_TALENT_HUB_CONTRACT) {
    window.MDJ_RENTALS_TALENT_HUB_CONTRACT = Object.freeze({
        /** `true` = volver a cablear preview en `#talent-shell-focus` al hover en `.talent-selector-carousel` (no activo). */
        enableCarouselHeroVideoPreview: false,
        /** `true` = volver a inyectar anillos/checkbox shortlist en tarjetas del carrusel (inyección completa no incluida). */
        enableHubShortlistPickRings: false
    });
}

const t = (k, def) => (window.translations?.[window.i18n?.currentLang]?.[k]) || def;

/** Antepone window.MDB_ASSETS_URL (bucket Storage `assets`) a rutas ./assets/... (vídeo o imagen). */
const mdjV = (u) => (typeof window.resolveMdAssetPublicUrl === "function" ? window.resolveMdAssetPublicUrl(u) : (typeof window.resolveMdAssetVideoUrl === "function" ? window.resolveMdAssetVideoUrl(u) : u));

/** Hero/cinematic background videos: muted + loop + inline (autoplay policy). Call before load()/play() when swapping src. */
window.mdjHeroVideoPrime = function (el) {
    if (!el) return;
    try {
        el.muted = true;
        el.defaultMuted = true;
        el.loop = true;
        el.playsInline = true;
        el.setAttribute("playsinline", "");
        el.setAttribute("muted", "");
        el.setAttribute("loop", "");
    } catch (e) { /* ignore */ }
};

window.djTabs = {
    weddings: {
        id: "dj_weddings",
        nameKey: "data_dj_weddings_name",
        subtitleKey: "dj_music_subtitle",
        descKey: "data_dj_weddings_desc",
        priceLabelKey: "dj_weddings_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/DJ_Performance/weddings_quinces.mp4",
        fallbackName: "Weddings & Corporate",
        fallbackSubtitle: "Select Your DJ Experience",
        fallbackDesc: "Premium DJ experience for high-end events",
        fallbackPrice: "From $1,500.00",
        price: 1500
    },
    private: {
        id: "dj_private",
        nameKey: "data_dj_private_name",
        subtitleKey: "dj_music_subtitle",
        descKey: "data_dj_private_desc",
        priceLabelKey: "dj_private_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/DJ_Performance/private_parties.mp4",
        fallbackName: "Private Parties",
        fallbackSubtitle: "Select Your DJ Experience",
        fallbackDesc: "Exclusive curation for VIP gatherings, house parties, and intimate yacht experiences. (Base: 4 Hours | Extra: $100/hr)",
        fallbackPrice: "From $500.00",
        price: 500
    },
    clubs: {
        id: "dj_clubs",
        nameKey: "data_dj_clubs_name",
        subtitleKey: "dj_music_subtitle",
        descKey: "data_dj_clubs_desc",
        priceLabelKey: "dj_clubs_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/DJ_Performance/clubs_nightlife.mp4",
        fallbackName: "Clubs & Nightlife",
        fallbackSubtitle: "Select Your DJ Experience",
        fallbackDesc: "High-energy open format, electronic, and global rhythms crafted for an explosive dancefloor. (Base: 4 Hours | Extra: $100/hr)",
        fallbackPrice: "From $500.00",
        price: 500
    },
    family: {
        id: "dj_family",
        nameKey: "data_dj_family_name",
        subtitleKey: "dj_music_subtitle",
        descKey: "data_dj_family_desc",
        priceLabelKey: "dj_family_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/DJ_Performance/kids_family.mp4",
        fallbackName: "Family Events",
        fallbackSubtitle: "Select Your DJ Experience",
        fallbackDesc: "Fun, engaging, and clean entertainment guaranteed to keep every generation dancing. (Base: 4 Hours | Extra: $100/hr)",
        fallbackPrice: "From $350.00",
        price: 350
    },
    seasonalParties: {
        id: "dj_seasonal_parties",
        nameKey: "talent_seasonal_title",
        subtitleKey: "dj_music_subtitle",
        descKey: "talent_seasonal_desc",
        priceLabelKey: "dj_holiday_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/DJ_Performance/Halloween.mp4",
        fallbackName: "Seasonal Parties",
        fallbackSubtitle: "Select Your DJ Experience",
        fallbackDesc: "Halloween, St. Patrick's Day, 4th of July. Custom pricing by setup ($600 – $1,500).",
        fallbackPrice: "$600 – $1,500",
        price: 900
    },
    holiday: {
        id: "dj_holiday",
        nameKey: "data_dj_holiday_name",
        subtitleKey: "dj_music_subtitle",
        descKey: "data_dj_holiday_desc",
        priceLabelKey: "dj_holiday_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/DJ_Performance/holiday_special_events.mp4",
        fallbackName: "Holiday & Special Events",
        fallbackSubtitle: "Select Your DJ Experience",
        fallbackDesc: "Curated soundtracks engineered to elevate corporate galas and seasonal festive gatherings. (Base: 5 Hours | Extra: $100/hr)",
        fallbackPrice: "From $1,500.00",
        price: 1500
    }
};

window.activeLiveTab = "sax"; window.liveMusicTabs = {
    sax: {
        id: "live_sax",
        nameKey: "data_mus_sax_name",
        subtitleKey: "live_music_subtitle",
        descKey: "data_mus_sax_desc",
        priceLabelKey: "live_sax_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/live-music/live-sax.mp4",
        fallbackName: "Live Saxophone",
        fallbackSubtitle: "Select the live music talent you wish to add to your package.",
        fallbackDesc: "A sophisticated live sax performance designed for premium cocktail hours, dinners, and elevated nightlife experiences.",
        fallbackPrice: "From $450.00",
        price: 450
    },
    percussion: {
        id: "live_percussion",
        nameKey: "data_mus_timbal_name",
        subtitleKey: "live_music_subtitle",
        descKey: "data_mus_timbal_desc",
        priceLabelKey: "live_percussion_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/live-music/live-percussion.mp4",
        fallbackName: "Live Percussion",
        fallbackSubtitle: "Select the live music talent you wish to add to your package.",
        fallbackDesc: "High-energy percussion designed to ignite the dance floor and elevate the rhythm of your event.",
        fallbackPrice: "From $350.00",
        price: 350
    },
    singer: {
        id: "live_singer",
        nameKey: "data_mus_singer_name",
        subtitleKey: "live_music_subtitle",
        descKey: "data_mus_singer_desc",
        priceLabelKey: "live_singer_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/live-music/live-singer.mp4?v=20260414-under90mb",
        fallbackName: "Live Singer",
        fallbackSubtitle: "Select the live music talent you wish to add to your package.",
        fallbackDesc: "A premium vocalist for elegant ceremonies, curated moments, and unforgettable live show experiences.",
        fallbackPrice: "From $600.00",
        price: 600
    }
};

window.activeLiveTab = "sax";

window.visualTabs = {
    photo: {
        id: "visuals_photo",
        nameKey: "data_vis_photo_name",
        subtitleKey: "visuals_subtitle",
        descKey: "data_vis_photo_desc",
        priceLabelKey: "vis_photo_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/capture-visuals/photo.mp4",
        fallbackName: "Photography",
        fallbackSubtitle: "Select the coverage talent you wish to add.",
        fallbackDesc: "Premium photography coverage capturing the ultimate moments of your event.",
        fallbackPrice: "From $300.00",
        price: 300,
        tabLabel: "Photo"
    },
    video: {
        id: "visuals_video",
        nameKey: "data_vis_video_name",
        subtitleKey: "visuals_subtitle",
        descKey: "data_vis_video_desc",
        priceLabelKey: "vis_video_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/capture-visuals/video.mp4",
        fallbackName: "Videography",
        fallbackSubtitle: "Select the coverage talent you wish to add.",
        fallbackDesc: "Cinematic 4K videography to document the life of the party.",
        fallbackPrice: "From $400.00",
        price: 400,
        tabLabel: "Video"
    },
    drone: {
        id: "visuals_drone",
        nameKey: "data_vis_drone_name",
        subtitleKey: "visuals_subtitle",
        descKey: "data_vis_drone_desc",
        priceLabelKey: "vis_drone_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/capture-visuals/drone.mp4",
        fallbackName: "Drone Operator",
        fallbackSubtitle: "Select the coverage talent you wish to add.",
        fallbackDesc: "Stunning aerial views and dynamic 4K shots sweeping over your venue.",
        fallbackPrice: "From $250.00",
        price: 250,
        tabLabel: "Drone"
    },
    booth360: {
        id: "visuals_booth360",
        nameKey: "data_vis_booth360_name",
        subtitleKey: "visuals_subtitle",
        descKey: "data_vis_booth360_desc",
        priceLabelKey: "vis_booth360_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/capture-visuals/Photo_Video_Booth_360.mp4",
        fallbackName: "Photo Booth 360",
        fallbackSubtitle: "Select the coverage talent you wish to add.",
        fallbackDesc: "Experiencia inmersiva de video en 360 grados.",
        fallbackPrice: "From $400.00",
        price: 400,
        tabLabel: "360"
    },
    magicMirror: {
        id: "visuals_magic_mirror",
        nameKey: "data_vis_magic_mirror_name",
        subtitleKey: "visuals_subtitle",
        descKey: "data_vis_magic_mirror_desc",
        priceLabelKey: "vis_magic_mirror_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/capture-visuals/Espejo_M\u00e1gico.mp4",
        fallbackName: "Magic Mirror",
        fallbackSubtitle: "Select the coverage talent you wish to add.",
        fallbackDesc: "Interactive full-length mirror photo experience for your guests.",
        fallbackPrice: "From $350.00",
        price: 350,
        tabLabel: "Mirror"
    }
};

window.mcTabs = {
    maestro: {
        id: "mc_maestro",
        nameKey: "data_mc_maestro_name",
        subtitleKey: "mc_subtitle",
        descKey: "data_mc_maestro_desc",
        priceLabelKey: "mc_maestro_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/mc-club-host/MC.mp4",
        fallbackName: "Maestro De Ceremonia",
        fallbackSubtitle: "Selecciona el estilo de conducción ideal para tu evento.",
        fallbackDesc: "Dirección formal, protocolo y animación bilingüe elegante.",
        fallbackPrice: "From $450.00",
        price: 450,
        tabLabel: "Maestro"
    },
    host: {
        id: "mc_host",
        nameKey: "data_mc_host_name",
        subtitleKey: "mc_subtitle",
        descKey: "data_mc_host_desc",
        priceLabelKey: "mc_host_price",
        ctaKey: "btn_add_to_pack",
        video: "./assets/mc-club-host/mc-club-host.mp4",
        fallbackName: "Club Host",
        fallbackSubtitle: "Selecciona el estilo de conducción ideal para tu evento.",
        fallbackDesc: "Energía en vivo, hype y conexión total con el público de la pista.",
        fallbackPrice: "From $350.00",
        price: 350,
        tabLabel: "Club Host"
    }
};

window.activeCategory = "live";

window.activeVisualTabLocked = "photo";
window.activeLiveTabLocked = "sax";
window.activeDjTabLocked = "weddings";
window.activeFxTabLocked = "sparks";
window.activeLightingTabLocked = "movingHeads";
window.activeStaffTabLocked = "bartender";
window.activePayasosTabLocked = "gif";

/** Payasos modal: hero + 4 reels (mismo ADN que Staff). */
window.payasosRoles = {
    gif: {
        nameKey: "payasos_gif_title",
        fallbackName: "GIF / energy",
        descKey: "payasos_gif_desc",
        fallbackDesc: "High-energy clips and comedic timing for kids and families.",
        video: "./assets/mdj-payasos/pallasos-gif.mp4"
    },
    show: {
        nameKey: "payasos_show_title",
        fallbackName: "Clown show",
        descKey: "payasos_show_desc",
        fallbackDesc: "Full stage show with classic clown performance and audience interaction.",
        video: "./assets/mdj-payasos/show-de-pallasos.mp4"
    },
    circo: {
        nameKey: "payasos_circo_title",
        fallbackName: "Circus",
        descKey: "payasos_circo_desc",
        fallbackDesc: "Circus-style acts, gags, and variety entertainment.",
        video: "./assets/mdj-payasos/circo.mp4"
    },
    santa: {
        nameKey: "payasos_santa_title",
        fallbackName: "Santa & seasonal",
        descKey: "payasos_santa_desc",
        fallbackDesc: "Holiday appearances and themed seasonal entertainment.",
        video: "./assets/mdj-payasos/Santaclous_Para_christmas.mp4"
    }
};

/** Staff modal (Bartender / Meseros / Chef): mismo ADN que roster — hero + vídeo por tarjeta. */
window.staffRoles = {
    bartender: {
        nameKey: "staff_bartender_title",
        fallbackName: "Bartender",
        descKey: "staff_bartender_desc",
        fallbackDesc: "Bar service and premium cocktail experience.",
        video: "./assets/mdj-staff-videos/Bartender.mp4"
    },
    meseros: {
        nameKey: "staff_meseros_title",
        fallbackName: "Meseros",
        descKey: "staff_meseros_desc",
        fallbackDesc: "Professional table service for your guests.",
        video: "./assets/mdj-staff-videos/Meseros.mp4"
    },
    chef: {
        nameKey: "staff_chef_title",
        fallbackName: "Chef",
        descKey: "staff_chef_desc",
        fallbackDesc: "Live kitchen and catering presentation.",
        video: "./assets/mdj-staff-videos/Cheff.mp4"
    }
};

window.renderStaffHero = function (tabKey = "bartender", animate = true) {
    window.activeStaffTabLocked = tabKey || window.activeStaffTabLocked || "bartender";
    const key = window.activeStaffTabLocked;
    const item = (window.staffRoles && window.staffRoles[key]) || window.staffRoles.bartender;

    const eyebrowEl = document.getElementById("staff-hero-eyebrow");
    const titleEl = document.getElementById("staff-hero-title");
    const subtitleEl = document.getElementById("staff-hero-subtitle");
    const videoEl = document.getElementById("staff-hero-video");

    if (eyebrowEl) {
        eyebrowEl.setAttribute("data-i18n", "staff_modal_eyebrow");
        eyebrowEl.textContent = t("staff_modal_eyebrow", "EVENT STAFF & SERVICE");
    }
    if (titleEl) {
        titleEl.setAttribute("data-i18n", item.nameKey);
        titleEl.textContent = t(item.nameKey, item.fallbackName);
    }
    if (subtitleEl) {
        subtitleEl.setAttribute("data-i18n", item.descKey);
        subtitleEl.textContent = t(item.descKey, item.fallbackDesc);
    }

    if (videoEl && item.video) {
        const v = item.video;
        const rv = mdjV(v);
        const changed = videoEl.getAttribute("src") !== rv;
        if (changed) videoEl.src = rv;
        if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }

    const staffGrid = document.getElementById("staff-roster-grid");
    document.querySelectorAll("#staff-roster-grid .hl-type-card[data-staff-key]").forEach(function (el) {
        el.classList.remove("active");
    });
    var pickStaff = null;
    if (staffGrid) {
        pickStaff = staffGrid.querySelector('.hl-type-card[data-staff-key="' + key + '"]:not(.mdj-staff-carousel-clone)');
        if (!pickStaff) pickStaff = staffGrid.querySelector('.hl-type-card[data-staff-key="' + key + '"]');
    }
    if (pickStaff) pickStaff.classList.add("active");

    if (window.i18n) window.i18n.updateUI();
};

window._bindStaffGridHeroHover = function () {
    const gridEl = document.getElementById("staff-roster-grid");
    const shell = document.querySelector("#staff-modal .modal-content.live-hero-shell");
    if (!gridEl || !shell) return;
    if (gridEl._mdjStaffMagicBound) return;
    gridEl._mdjStaffMagicBound = true;

    let lastKey = null;

    gridEl.addEventListener("pointerover", function (e) {
        const card = e.target.closest && e.target.closest(".hl-type-card[data-staff-key]");
        if (!card || !gridEl.contains(card)) return;
        const k = card.getAttribute("data-staff-key");
        if (!k || k === lastKey) return;
        lastKey = k;
        window.activeStaffTabLocked = k;
        if (window.renderStaffHero) window.renderStaffHero(k, false);
        shell.classList.add("mdj-staff-hero-preview-on");
    });

    gridEl.addEventListener("pointerout", function (e) {
        const rt = e.relatedTarget;
        if (rt && gridEl.contains(rt)) return;
        lastKey = null;
        shell.classList.remove("mdj-staff-hero-preview-on");
        const restore = window.activeStaffTabLocked || "bartender";
        if (window.renderStaffHero) window.renderStaffHero(restore, false);
    });
};

window.renderPayasosHero = function (tabKey = "gif", animate = true) {
    window.activePayasosTabLocked = tabKey || window.activePayasosTabLocked || "gif";
    const key = window.activePayasosTabLocked;
    const item = (window.payasosRoles && window.payasosRoles[key]) || window.payasosRoles.gif;

    const eyebrowEl = document.getElementById("payasos-hero-eyebrow");
    const titleEl = document.getElementById("payasos-hero-title");
    const subtitleEl = document.getElementById("payasos-hero-subtitle");
    const videoEl = document.getElementById("payasos-hero-video");

    if (eyebrowEl) {
        eyebrowEl.setAttribute("data-i18n", "payasos_modal_eyebrow");
        eyebrowEl.textContent = t("payasos_modal_eyebrow", "KIDS & FAMILY ENTERTAINMENT");
    }
    if (titleEl) {
        titleEl.setAttribute("data-i18n", item.nameKey);
        titleEl.textContent = t(item.nameKey, item.fallbackName);
    }
    if (subtitleEl) {
        subtitleEl.setAttribute("data-i18n", item.descKey);
        subtitleEl.textContent = t(item.descKey, item.fallbackDesc);
    }

    if (videoEl && item.video) {
        const v = item.video;
        const rv = mdjV(v);
        const changed = videoEl.getAttribute("src") !== rv;
        if (changed) videoEl.src = rv;
        if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }

    const payGrid = document.getElementById("payasos-roster-grid");
    document.querySelectorAll("#payasos-roster-grid .hl-type-card[data-payasos-key]").forEach(function (el) {
        el.classList.remove("active");
    });
    var pickPay = null;
    if (payGrid) {
        pickPay = payGrid.querySelector('.hl-type-card[data-payasos-key="' + key + '"]:not(.mdj-payasos-carousel-clone)');
        if (!pickPay) pickPay = payGrid.querySelector('.hl-type-card[data-payasos-key="' + key + '"]');
    }
    if (pickPay) pickPay.classList.add("active");

    if (window.i18n) window.i18n.updateUI();
};

window._bindPayasosGridHeroHover = function () {
    const gridEl = document.getElementById("payasos-roster-grid");
    const shell = document.querySelector("#payasos-modal .modal-content.live-hero-shell");
    if (!gridEl || !shell) return;
    if (gridEl._mdjPayasosMagicBound) return;
    gridEl._mdjPayasosMagicBound = true;

    let lastKey = null;

    gridEl.addEventListener("pointerover", function (e) {
        const card = e.target.closest && e.target.closest(".hl-type-card[data-payasos-key]");
        if (!card || !gridEl.contains(card)) return;
        const k = card.getAttribute("data-payasos-key");
        if (!k || k === lastKey) return;
        lastKey = k;
        window.activePayasosTabLocked = k;
        if (window.renderPayasosHero) window.renderPayasosHero(k, false);
        shell.classList.add("mdj-payasos-hero-preview-on");
    });

    gridEl.addEventListener("pointerout", function (e) {
        const rt = e.relatedTarget;
        if (rt && gridEl.contains(rt)) return;
        lastKey = null;
        shell.classList.remove("mdj-payasos-hero-preview-on");
        const restore = window.activePayasosTabLocked || "gif";
        if (window.renderPayasosHero) window.renderPayasosHero(restore, false);
    });
};

/** Roster modal (musicians / Captura y Visuales): hero por hover; el botón del pack sigue con su propio handler. */
window._rosterCardClick = function (key) {
    if (window.activeCategory === "visuals") window.activeVisualTabLocked = key;
    if (window.activeCategory === "live") window.activeLiveTabLocked = key;
    window.renderLiveHero(key, true);
};

/** Hover en roster: solo hero + vídeo + .active (sin reinyectar el grid; evita flicker y cortes de hover). */
window._rosterHeroPreviewOnly = function (key, hoveredCard) {
    if (window.activeCategory !== "visuals" && window.activeCategory !== "live") return;
    const dataset = window.activeCategory === "visuals" ? window.visualTabs : window.liveMusicTabs;
    const item = dataset[key];
    if (!item) return;

    const titleEl = document.getElementById("live-hero-title");
    const subtitleEl = document.getElementById("live-hero-subtitle");
    const eyebrowEl = document.getElementById("live-hero-eyebrow");
    const videoEl = document.getElementById("live-hero-video");

    if (eyebrowEl) {
        if (window.activeCategory === "live") {
            eyebrowEl.setAttribute("data-i18n", "live_music_eyebrow");
            eyebrowEl.textContent = t("live_music_eyebrow", "PREMIUM LIVE ENTERTAINMENT FOR LUXURY EVENTS");
        } else {
            eyebrowEl.setAttribute("data-i18n", "visuals_eyebrow");
            eyebrowEl.textContent = t("visuals_eyebrow", "PREMIUM EVENT COVERAGE");
        }
    }

    if (titleEl) {
        titleEl.setAttribute("data-i18n", item.nameKey);
        titleEl.textContent = t(item.nameKey, item.fallbackName);
    }
    if (subtitleEl) {
        subtitleEl.setAttribute("data-i18n", item.descKey);
        subtitleEl.textContent = t(item.descKey, item.fallbackDesc);
    }

    if (videoEl && item.video) {
        const v = item.video;
        const rv = mdjV(v);
        const changed = videoEl.getAttribute("src") !== rv;
        if (changed) videoEl.src = rv;
        if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }

    const grid = document.getElementById("roster-grid");
    document.querySelectorAll("#roster-grid .hl-type-card").forEach(function (el) {
        el.classList.remove("active");
    });
    var pick = null;
    if (hoveredCard && grid && grid.contains(hoveredCard) && hoveredCard.getAttribute("data-roster-key") === key) {
        pick = hoveredCard;
    } else if (grid) {
        pick = grid.querySelector('.hl-type-card[data-roster-key="' + key + '"]:not(.mdj-roster-hero-carousel-clone)');
        if (!pick) pick = grid.querySelector('.hl-type-card[data-roster-key="' + key + '"]');
    }
    if (pick) pick.classList.add("active");

    if (window.i18n) window.i18n.updateUI();
};

window._bindRosterGridHeroHover = function () {
    const grid = document.getElementById("roster-grid");
    const shell = document.querySelector("#roster-modal .modal-content.live-hero-shell");
    if (!grid || !shell) return;
    if (grid._mdjRosterHoverBound) return;
    grid._mdjRosterHoverBound = true;

    let lastHoverKey = null;

    grid.addEventListener("pointerover", function (e) {
        const card = e.target.closest && e.target.closest(".hl-type-card");
        if (!card || !grid.contains(card)) return;
        const key = card.getAttribute("data-roster-key");
        if (!key || key === lastHoverKey) return;
        lastHoverKey = key;
        if (window.activeCategory === "visuals") window.activeVisualTabLocked = key;
        if (window.activeCategory === "live") window.activeLiveTabLocked = key;
        if (window._rosterHeroPreviewOnly) window._rosterHeroPreviewOnly(key, card);
        shell.classList.add("mdj-roster-hero-preview-on");
    });

    grid.addEventListener("pointerout", function (e) {
        const rt = e.relatedTarget;
        if (rt && grid.contains(rt)) return;
        lastHoverKey = null;
        shell.classList.remove("mdj-roster-hero-preview-on");
        const restore =
            window.activeCategory === "visuals"
                ? window.activeVisualTabLocked || "photo"
                : window.activeLiveTabLocked || "sax";
        if (window.renderLiveHero) window.renderLiveHero(restore, false);
    });
};

/** DJ Performance — mismo ADN que Captura y Visuales: hover → hero + vídeo + .active */
window._djHeroPreviewOnly = function (key, hoveredCard) {
    const item = window.djTabs && window.djTabs[key];
    if (!item) return;
    const titleEl = document.getElementById("dj-hero-title");
    const subtitleEl = document.getElementById("dj-hero-subtitle");
    const eyebrowEl = document.getElementById("dj-hero-eyebrow");
    const videoEl = document.getElementById("dj-hero-video");
    if (eyebrowEl) {
        eyebrowEl.setAttribute("data-i18n", "dj_perf_eyebrow");
        eyebrowEl.textContent = t("dj_perf_eyebrow", "PREMIUM DJ CURATION");
    }
    if (titleEl) {
        titleEl.setAttribute("data-i18n", item.nameKey);
        titleEl.textContent = t(item.nameKey, item.fallbackName);
    }
    if (subtitleEl) {
        subtitleEl.setAttribute("data-i18n", item.subtitleKey);
        subtitleEl.textContent = t(item.subtitleKey, item.fallbackSubtitle);
    }
    if (videoEl && item.video) {
        const v = item.video;
        const rv = mdjV(v);
        const changed = videoEl.getAttribute("src") !== rv;
        if (changed) {
            videoEl.setAttribute("src", rv);
            videoEl.src = rv;
            videoEl.innerHTML = `<source src="${String(rv).replace(/"/g, "&quot;")}" type="video/mp4">`;
        }
        if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }
    const grid = document.getElementById("dj-roster-grid");
    document.querySelectorAll("#dj-roster-grid .hl-type-card").forEach(function (el) {
        el.classList.remove("active");
    });
    var pickDj = null;
    if (hoveredCard && grid && grid.contains(hoveredCard) && hoveredCard.getAttribute("data-dj-tab-key") === key) {
        pickDj = hoveredCard;
    } else if (grid) {
        pickDj = grid.querySelector('.hl-type-card[data-dj-tab-key="' + key + '"]:not(.mdj-dj-roster-carousel-clone)');
        if (!pickDj) pickDj = grid.querySelector('.hl-type-card[data-dj-tab-key="' + key + '"]');
    }
    if (pickDj) pickDj.classList.add("active");
    if (window.i18n) window.i18n.updateUI();
};

window._lightingHeroPreviewOnly = function (key, hoveredCard) {
    const item = window.lightingItems && window.lightingItems[key];
    if (!item) return;
    const videoEl = document.getElementById("lighting-hero-video");
    const titleEl = document.getElementById("lighting-hero-title");
    const subtitleEl = document.getElementById("lighting-hero-subtitle");
    const eyebrowEl = document.getElementById("lighting-hero-eyebrow");
    const activeVideo =
        item.video || "./assets/Special_Effects/Iluminacio\u0301n.mp4";
    const activeResolved = mdjV(activeVideo);
    if (eyebrowEl) {
        eyebrowEl.setAttribute("data-i18n", "lighting_eyebrow");
        eyebrowEl.textContent = t("lighting_eyebrow", "PREMIUM CLUB & ARCHITECTURAL");
    }
    if (titleEl) {
        titleEl.setAttribute("data-i18n", item.nameKey);
        titleEl.textContent = t(item.nameKey, item.fallbackName);
    }
    if (subtitleEl) {
        if (item.descKey) {
            subtitleEl.setAttribute("data-i18n", item.descKey);
            subtitleEl.textContent = t(item.descKey, item.fallbackDesc);
        } else {
            subtitleEl.textContent = item.fallbackDesc || "";
        }
    }
    if (videoEl && activeVideo) {
        const rv = activeResolved;
        const changed = videoEl.getAttribute("src") !== rv;
        if (changed) videoEl.src = rv;
        if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }
    const grid = document.getElementById("lighting-roster-grid");
    document.querySelectorAll("#lighting-roster-grid .hl-type-card").forEach(function (el) {
        el.classList.remove("active");
    });
    var pick = null;
    if (hoveredCard && grid && grid.contains(hoveredCard) && hoveredCard.getAttribute("data-lighting-key") === key) {
        pick = hoveredCard;
    } else if (grid) {
        grid.querySelectorAll(".hl-type-card:not(.mdj-lighting-carousel-clone)").forEach(function (el) {
            if (el.getAttribute("data-lighting-key") === key) pick = el;
        });
    }
    if (pick) pick.classList.add("active");
    if (window.i18n) window.i18n.updateUI();
};

window._fxHeroPreviewOnly = function (key, hoveredCard) {
    const item = window.fxItems && window.fxItems[key];
    if (!item) return;
    const videoEl = document.getElementById("fx-hero-video");
    const titleEl = document.getElementById("fx-hero-title");
    const subtitleEl = document.getElementById("fx-hero-subtitle");
    const eyebrowEl = document.getElementById("fx-hero-eyebrow");
    if (eyebrowEl) {
        eyebrowEl.setAttribute("data-i18n", "fx_eyebrow");
        eyebrowEl.textContent = t("fx_eyebrow", "PREMIUM VISUAL FX");
    }
    if (titleEl) {
        titleEl.setAttribute("data-i18n", item.nameKey);
        titleEl.textContent = t(item.nameKey, item.fallbackName);
    }
    if (subtitleEl) {
        subtitleEl.textContent = item.fallbackDesc || "";
    }
    if (videoEl && item.video) {
        const v = item.video;
        const rv = mdjV(v);
        const changed = videoEl.getAttribute("src") !== rv;
        if (changed) videoEl.src = rv;
        if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }
    const fxGrid = document.getElementById("fx-roster-grid");
    document.querySelectorAll("#fx-roster-grid [data-fx-key]").forEach(function (el) {
        el.classList.remove("active");
    });
    var fxPick = null;
    if (hoveredCard && fxGrid && fxGrid.contains(hoveredCard) && hoveredCard.getAttribute("data-fx-key") === key) {
        fxPick = hoveredCard;
    } else if (fxGrid) {
        fxGrid.querySelectorAll(".talent-cat-card[data-fx-key]:not(.mdj-fx-carousel-clone)").forEach(function (el) {
            if (el.getAttribute("data-fx-key") === key) fxPick = el;
        });
    }
    if (fxPick) fxPick.classList.add("active");
    if (window.i18n) window.i18n.updateUI();
};

window._bindLightingGridHeroHover = function () {
    const gridEl = document.getElementById("lighting-roster-grid");
    const shell = document.querySelector("#lighting-modal .modal-content.cinematic-hero-shell");
    if (!gridEl || !shell) return;
    if (gridEl._mdjLightingMagicBound) return;
    gridEl._mdjLightingMagicBound = true;

    let lastKey = null;

    gridEl.addEventListener("pointerover", function (e) {
        const card = e.target.closest && e.target.closest(".hl-type-card[data-lighting-key]");
        if (!card || !gridEl.contains(card)) return;
        const key = card.getAttribute("data-lighting-key");
        if (!key || key === lastKey) return;
        lastKey = key;
        window.activeLightingTabLocked = key;
        if (window._lightingHeroPreviewOnly) window._lightingHeroPreviewOnly(key, card);
        shell.classList.add("mdj-lighting-hero-preview-on");
    });

    gridEl.addEventListener("pointerout", function (e) {
        const rt = e.relatedTarget;
        if (rt && gridEl.contains(rt)) return;
        lastKey = null;
        shell.classList.remove("mdj-lighting-hero-preview-on");
        const restore = window.activeLightingTabLocked || "movingHeads";
        if (window.renderLightingHero) window.renderLightingHero(restore, false);
    });
};

window._bindFxGridHeroHover = function () {
    const gridEl = document.getElementById("fx-roster-grid");
    const shell = document.querySelector("#fx-modal .modal-content.cinematic-hero-shell");
    if (!gridEl || !shell) return;
    if (gridEl._mdjFxMagicBound) return;
    gridEl._mdjFxMagicBound = true;

    let lastKey = null;

    gridEl.addEventListener("pointerover", function (e) {
        const card = e.target.closest && e.target.closest(".talent-cat-card[data-fx-key]");
        if (!card || !gridEl.contains(card)) return;
        const key = card.getAttribute("data-fx-key");
        if (!key || key === lastKey) return;
        lastKey = key;
        window.activeFxTabLocked = key;
        if (window._fxHeroPreviewOnly) window._fxHeroPreviewOnly(key, card);
        shell.classList.add("mdj-fx-hero-preview-on");
    });

    gridEl.addEventListener("pointerout", function (e) {
        const rt = e.relatedTarget;
        if (rt && gridEl.contains(rt)) return;
        lastKey = null;
        shell.classList.remove("mdj-fx-hero-preview-on");
        const restore = window.activeFxTabLocked || "sparks";
        if (window.renderFxHero) window.renderFxHero(restore, false);
    });
};

/** MC & Presentadores: mismo ADN que Captura y Visuales (pointerenter → vídeo en hero; salida de la fila → estado base). */
window.initMcModalMagicHover = function () {
    const shell = document.querySelector("#mc-modal .modal-content.cinematic-hero-shell");
    const vHost = document.getElementById("mc-video-host");
    const vMaestro = document.getElementById("mc-video-maestro");
    const cardMaestro = document.getElementById("mc-card-maestro");
    const cardHost = document.getElementById("mc-card-host");
    if (!shell || !vHost || !vMaestro || !cardMaestro || !cardHost) return;
    if (shell._mdjMcMagicBound) return;
    shell._mdjMcMagicBound = true;

    const rowWrap = cardMaestro.parentElement;
    if (!rowWrap || rowWrap !== cardHost.parentElement) return;

    const clearActiveCards = function () {
        rowWrap.querySelectorAll(".talent-cat-card").forEach(function (c) {
            c.classList.remove("active");
        });
    };

    const showMaestro = function (hoveredCard) {
        vMaestro.style.opacity = "1";
        vHost.style.opacity = "0";
        shell.classList.add("mdj-mc-hero-preview-on");
        clearActiveCards();
        (hoveredCard || cardMaestro).classList.add("active");
    };
    const showHost = function (hoveredCard) {
        vHost.style.opacity = "1";
        vMaestro.style.opacity = "0";
        shell.classList.add("mdj-mc-hero-preview-on");
        clearActiveCards();
        (hoveredCard || cardHost).classList.add("active");
    };
    const reset = function () {
        shell.classList.remove("mdj-mc-hero-preview-on");
        clearActiveCards();
        vHost.style.opacity = "1";
        vMaestro.style.opacity = "0";
    };

    rowWrap.addEventListener(
        "pointerover",
        function (e) {
            const card = e.target.closest && e.target.closest(".talent-cat-card");
            if (!card || !rowWrap.contains(card)) return;
            const btn = card.querySelector('.hl-action-btn[data-service]');
            const svc = btn && btn.getAttribute("data-service");
            if (svc === "mc-maestro") showMaestro(card);
            else if (svc === "mc-host") showHost(card);
        },
        true
    );

    rowWrap.addEventListener("pointerleave", function (e) {
        const rt = e.relatedTarget;
        if (rt && rowWrap.contains(rt)) return;
        reset();
    });
};

window.renderLiveHero = (tabKey = null, animate = true) => {
    let dataset;
    let titleKey, titleFallback, eyebrowKey, eyebrowFallback, subtitleKey, subtitleFallback, activeVideo;
    let currentTabKey = tabKey;

    if (window.activeCategory === 'live') {
        dataset = window.liveMusicTabs;
        if (!currentTabKey) currentTabKey = 'sax';
        const activeItem = dataset[currentTabKey] || Object.values(dataset)[0];

        titleKey = activeItem.nameKey;
        titleFallback = activeItem.fallbackName;
        eyebrowKey = "live_music_eyebrow";
        eyebrowFallback = "PREMIUM LIVE ENTERTAINMENT FOR LUXURY EVENTS";
        subtitleKey = activeItem.descKey;
        subtitleFallback = activeItem.fallbackDesc;
        activeVideo = activeItem.video;
    } else if (window.activeCategory === 'visuals') {
        dataset = window.visualTabs;
        if (!currentTabKey) currentTabKey = 'photo';
        const activeItem = dataset[currentTabKey] || Object.values(dataset)[0];

        titleKey = activeItem.nameKey;
        titleFallback = activeItem.fallbackName;
        eyebrowKey = "visuals_eyebrow";
        eyebrowFallback = "PREMIUM EVENT COVERAGE";
        subtitleKey = activeItem.descKey;
        subtitleFallback = activeItem.fallbackDesc;
        activeVideo = activeItem.video;
    } else {
        return;
    }

    const titleEl = document.getElementById("live-hero-title");
    const subtitleEl = document.getElementById("live-hero-subtitle");
    const eyebrowEl = document.getElementById("live-hero-eyebrow");
    const videoEl = document.getElementById("live-hero-video");
    const gridEl = document.getElementById("roster-grid");

    const performRender = () => {

        if (eyebrowEl) {
            eyebrowEl.setAttribute('data-i18n', eyebrowKey);
            eyebrowEl.textContent = t(eyebrowKey, eyebrowFallback);
        }

        if (titleEl) {
            titleEl.setAttribute('data-i18n', titleKey);
            titleEl.textContent = t(titleKey, titleFallback);
        }

        if (subtitleEl) {
            subtitleEl.setAttribute('data-i18n', subtitleKey);
            subtitleEl.textContent = t(subtitleKey, subtitleFallback);
        }

        // Render Vida Propia Glass Cards inside roster-grid
        if (gridEl && dataset) {
            if (typeof window.mdjRentalsTeardownHorizontalInfiniteStrip === 'function') {
                window.mdjRentalsTeardownHorizontalInfiniteStrip(gridEl, 'mdj-roster-hero-carousel-clone', 'mdj-rentals-horizontal-infinite');
            }
            gridEl.innerHTML = Object.entries(dataset).map(([key, item]) => {
                const isSelected = window.selectedPackage.some(p => p.id === item.id);
                const isActive = key === currentTabKey;
                const btnClass = isSelected ? "hl-action-btn added" : "hl-action-btn";
                const icon = isSelected ? "✓" : "+";
                const activeStateClass = isActive ? " active" : "";

                let emoji = '🎙️';
                if (item.id === 'visuals_booth360' || key === 'booth360') emoji = '🎥🔄';
                else if (item.id === 'visuals_magic_mirror' || key === 'magicMirror') emoji = '🪞';
                else if (item.id.includes('sax')) emoji = '🎷';
                else if (item.id.includes('percussion') || item.id.includes('timbal')) emoji = '🥁';
                else if (item.id.includes('photo')) emoji = '📸';
                else if (item.id.includes('video') && !item.id.includes('drone')) emoji = '🎥';
                else if (item.id.includes('drone')) emoji = '🚁';

                return `
                    <div class="talent-cat-card hero-glass-card hl-type-card mdj-magic-hover-card${activeStateClass}" data-roster-key="${key}" style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; min-height: 320px; gap: 10px;">
                        <div class="hl-card-icon" style="font-size: 32px; margin-bottom: 5px;">${emoji}</div>
                        <h3 class="hl-card-title" data-i18n="${item.nameKey}" style="font-family: 'Playfair Display', serif; color: var(--gold); font-size: 15px; font-weight: 600; margin: 0; line-height: 1.2;">
                            ${t(item.nameKey, item.fallbackName)}
                        </h3>
                        <p class="hl-card-desc" data-i18n="${item.descKey}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; flex-grow: 1; line-height: 1.4;">
                            ${t(item.descKey, item.fallbackDesc)}
                        </p>
                        <div class="hl-card-price" style="font-family: Inter, sans-serif; color: var(--gold); font-size: 18px; font-weight: 700; margin-top: auto; margin-bottom: 10px;">
                            $${item.price}.00
                        </div>
                        <button class="${btnClass}" data-action="hl-activate-direct" data-id="${item.id}" style="width: 100%; border: 1px solid var(--gold); background: ${isSelected ? 'rgba(197,160,89,0.2)' : 'transparent'}; color: var(--gold); padding: 8px 0; border-radius: 50px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="event.stopPropagation();">
                            <span class="hl-btn-icon">${icon}</span>
                            <span class="hl-btn-text" data-i18n="${isSelected ? 'btn_remove_extra' : item.ctaKey}">${t(isSelected ? 'btn_remove_extra' : item.ctaKey, isSelected ? 'Remove' : item.fallbackCta || 'Activar')}</span>
                        </button>
                    </div>
                `;
            }).join('');
        }

        if (videoEl && activeVideo) {
            const v = activeVideo;
            const rv = mdjV(v);
            const changed = videoEl.getAttribute("src") !== rv;
            if (changed) videoEl.src = rv;
            if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
            if (changed) videoEl.load();
            videoEl.play().catch(() => { });
        }

        if (window.i18n) window.i18n.updateUI();

        if (typeof window._bindRosterGridHeroHover === "function") window._bindRosterGridHeroHover();

        if (gridEl && typeof window.mdjRentalsTryMountTalentStripInfinite === 'function') {
            window.mdjRentalsTryMountTalentStripInfinite(gridEl, 'mdj-roster-hero-carousel-clone');
        }
        if (gridEl && typeof window.mdjRentalsInitStripDragClickGuard === 'function') {
            window.mdjRentalsInitStripDragClickGuard(gridEl);
        }

        if (animate) {
            requestAnimationFrame(() => {
                if (videoEl) videoEl.classList.remove("live-fade-out");
                // Text overlay fade in
                const overlay = document.querySelector('.hl-hero-global-overlay');
                if (overlay) overlay.classList.remove("live-fade-out");
            });
        }
    };

    if (animate) {
        if (videoEl) videoEl.classList.add("live-fade-out");
        const overlay = document.querySelector('.hl-hero-global-overlay');
        if (overlay) overlay.classList.add("live-fade-out");
        setTimeout(performRender, 300);
    } else {
        performRender();
    }
};

/** DJ roster: mismo patrón que Captura y Visuales (pointerover → preview; salida del grid → restaurar tab bloqueada). */
window._bindDjRosterHeroHover = function (activeTabKey) {
    const gridEl = document.getElementById("dj-roster-grid");
    const shell = document.querySelector("#dj-modal .modal-content.live-hero-shell");
    if (!gridEl || !shell || !window.djTabs) return;
    if (gridEl._mdjDjMagicBound) return;
    gridEl._mdjDjMagicBound = true;

    let lastKey = null;

    gridEl.addEventListener("pointerover", function (e) {
        const card = e.target.closest && e.target.closest(".hl-type-card[data-dj-tab-key]");
        if (!card || !gridEl.contains(card)) return;
        const key = card.getAttribute("data-dj-tab-key");
        if (!key || key === lastKey) return;
        lastKey = key;
        window.activeDjTabLocked = key;
        if (window._djHeroPreviewOnly) window._djHeroPreviewOnly(key, card);
        shell.classList.add("mdj-dj-hero-preview-on");
    });

    gridEl.addEventListener("pointerout", function (e) {
        const rt = e.relatedTarget;
        if (rt && gridEl.contains(rt)) return;
        lastKey = null;
        shell.classList.remove("mdj-dj-hero-preview-on");
        const restore = window.activeDjTabLocked || activeTabKey || "weddings";
        if (window.renderDjHero) window.renderDjHero(restore, false);
    });
};

window.renderDjHero = (tabKey = 'weddings', animate = true) => {
    window.activeDjTabLocked = tabKey || window.activeDjTabLocked || "weddings";
    const dataset = window.djTabs;
    const activeItem = dataset[tabKey] || Object.values(dataset)[0];

    const titleKey = activeItem.nameKey;
    const titleFallback = activeItem.fallbackName;
    const eyebrowKey = "dj_perf_eyebrow";
    const eyebrowFallback = "DJ / PERFORMANCE";
    const subtitleKey = activeItem.subtitleKey;
    const subtitleFallback = activeItem.fallbackSubtitle;

    const titleEl = document.getElementById("dj-hero-title");
    const subtitleEl = document.getElementById("dj-hero-subtitle");
    const eyebrowEl = document.getElementById("dj-hero-eyebrow");
    const gridEl = document.getElementById("dj-roster-grid");
    const videoEl = document.getElementById("dj-hero-video"); // assumes video element inside 

    const performRender = () => {
        if (eyebrowEl) {
            eyebrowEl.setAttribute('data-i18n', eyebrowKey);
            eyebrowEl.textContent = t(eyebrowKey, eyebrowFallback);
        }

        if (titleEl) {
            titleEl.setAttribute('data-i18n', titleKey);
            titleEl.textContent = t(titleKey, titleFallback);
        }

        if (subtitleEl) {
            subtitleEl.setAttribute('data-i18n', subtitleKey);
            subtitleEl.textContent = t(subtitleKey, subtitleFallback);
        }

        if (gridEl && dataset) {
            if (typeof window.mdjRentalsTeardownHorizontalInfiniteStrip === 'function') {
                window.mdjRentalsTeardownHorizontalInfiniteStrip(gridEl, 'mdj-dj-roster-carousel-clone', 'mdj-rentals-horizontal-infinite');
            }
            gridEl.innerHTML = Object.entries(dataset).map(([key, item]) => {
                const isSelected = window.selectedPackage && window.selectedPackage.some(p => p.id === item.id);
                const isActive = key === tabKey;
                const btnClass = isSelected ? "hl-action-btn added" : "btn-premium-cta full hl-action-btn";
                const icon = isSelected ? "✓" : "";
                const activeStateClass = isActive ? " active" : "";

                let emoji = '🎧';
                if (item.id.includes('weddings')) emoji = '💍';
                if (item.id.includes('private')) emoji = '🥂';
                if (item.id.includes('clubs')) emoji = '🪩';
                if (item.id.includes('family')) emoji = '🎈';
                if (item.id === 'dj_seasonal_parties') emoji = '🎃☘️';
                if (item.id.includes('holiday')) emoji = '🎇';

                const btnText = isSelected ? t('btn_remove_extra', 'Remove') : t(item.ctaKey, 'Activar');

                const isVIP = item.id === 'dj_weddings';
                const priceDisplay = item.id === 'dj_seasonal_parties'
                    ? `<span style="font-size: 16px; font-weight: 700; color: var(--gold);">$600 – $1,500</span>`
                    : isVIP
                    ? `<span style="font-size: 10px; opacity: 0.7; display: block; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.5px; margin-bottom: 2px; text-transform: uppercase;">Starting at</span>$${item.price}.00`
                    : `$${item.price}.00`;

                const footerNote = isVIP
                    ? `<div style="font-size: 8px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; margin-bottom: 12px; width: 100%; text-align: center; line-height: 1.2;">Custom production available</div>`
                    : `<div style="margin-bottom: 12px;"></div>`;

                return `
                    <div class="talent-cat-card hero-glass-card hl-type-card mdj-magic-hover-card${activeStateClass}" data-dj-tab-key="${key}" style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; min-height: 320px; transition: transform 0.3s ease;">
                        <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; align-items: center;">
                            <div class="hero-card-emoji" style="font-size: 28px; margin-bottom: 12px;">${emoji}</div>
                            <h3 class="hero-card-title hl-type-name" data-i18n="${item.nameKey}" style="font-size: 15px; line-height: 1.2; margin-bottom: 8px; color: var(--gold); font-family: 'Playfair Display', serif;">${t(item.nameKey, item.fallbackName)}</h3>
                            <p class="hero-card-text" data-i18n="${item.descKey}" style="font-size: 11px; opacity: 0.8; margin-bottom: auto; color: white; line-height: 1.35; width: 100%;">${t(item.descKey, item.fallbackDesc)}</p>
                            <div class="hero-card-price hl-type-price" style="font-size: 18px; font-weight: 700; color: var(--gold); margin-top: 15px;">${priceDisplay}</div>
                            ${footerNote}
                        </div>
                        <button class="${btnClass}" data-action="hl-activate-direct" data-id="${item.id}" style="font-size: 10px; padding: 10px 5px; margin-top: auto; border-radius: 50px; letter-spacing: 0.5px;">
                            <span class="hl-btn-icon">${icon}</span>
                            <span class="hl-btn-text" data-i18n="${isSelected ? 'btn_remove_extra' : item.ctaKey}">${btnText}</span>
                        </button>
                    </div>
                `;
            }).join('');
        }

        if (videoEl && activeItem.video) {
            const v = activeItem.video;
            const rv = mdjV(v);
            const changed = videoEl.getAttribute("src") !== rv;
            if (changed) {
                videoEl.setAttribute("src", rv);
                videoEl.src = rv;
                videoEl.innerHTML = `<source src="${String(rv).replace(/"/g, "&quot;")}" type="video/mp4">`;
            }
            if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
            if (changed) videoEl.load();
            videoEl.play().catch(() => { });
        }

        if (typeof window._bindDjRosterHeroHover === 'function') {
            window._bindDjRosterHeroHover(tabKey);
        }

        if (window.i18n) window.i18n.updateUI();

        if (gridEl && typeof window.mdjRentalsTryMountTalentStripInfinite === 'function') {
            window.mdjRentalsTryMountTalentStripInfinite(gridEl, 'mdj-dj-roster-carousel-clone');
        }
        if (gridEl && typeof window.mdjRentalsInitStripDragClickGuard === 'function') {
            window.mdjRentalsInitStripDragClickGuard(gridEl);
        }

        if (animate) {
            requestAnimationFrame(() => {
                if (videoEl) videoEl.classList.remove("live-fade-out");
                const overlay = document.querySelector('#dj-modal .hl-hero-global-overlay');
                if (overlay) overlay.classList.remove("live-fade-out");
            });
        }
    };

    if (animate) {
        if (videoEl) videoEl.classList.add("live-fade-out");
        const overlay = document.querySelector('#dj-modal .hl-hero-global-overlay');
        if (overlay) overlay.classList.add("live-fade-out");
        setTimeout(performRender, 300);
    } else {
        performRender();
    }
};

window.fxItems = {
    sparks: {
        id: "fx_sparks",
        nameKey: "data_fx_sparks_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/SPARKULAR.mp4",
        fallbackName: "Pirotecnia Fría (Cold Sparks)",
        fallbackDesc: "Safe, spectacular indoor/outdoor cold spark fountains for grand entrances and first dances.",
        price: 300,
        emoji: "✨"
    },
    fog: {
        id: "fx_fog",
        nameKey: "data_fx_fog_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Dancin_Cloud.mp4",
        fallbackName: "Humo Bajo (Dancing on Clouds)",
        fallbackDesc: "A magical, cinematic low-lying fog effect perfect for the first dance.",
        price: 300,
        emoji: "☁️"
    },
    co2: {
        id: "fx_co2",
        nameKey: "data_fx_co2_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/CO2.mp4",
        fallbackName: "CO2 Jets & Cannons",
        fallbackDesc: "High-energy blasts of cryogenic fog designed to cool the dance floor during Peak Hour.",
        price: 400,
        emoji: "💨"
    },
    bubble: {
        id: "fx_bubble",
        nameKey: "data_fx_bubble_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Bubble_Haze.mp4",
        fallbackName: "Máquina de Burbujas & Haze",
        fallbackDesc: "A magical, shimmering atmospheric effect cascading thousands of bubbles across the room.",
        price: 150,
        emoji: "🫧"
    },
    snow: {
        id: "fx_snow",
        nameKey: "data_fx_snow_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/SNOW_MACHINE.mp4",
        fallbackName: "Efecto Nieve Artificial",
        fallbackDesc: "Transform the atmosphere completely and create a stunning winter wonderland indoors or outdoors.",
        price: 250,
        emoji: "❄️"
    },
    smoke: {
        id: "fx_smoke",
        nameKey: "data_fx_smoke_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Smoke_Machine.mp4",
        fallbackName: "Máquina de Humo (Geyser/Haze)",
        fallbackDesc: "High-output atmospheric smoke perfect for amplifying lighting effects and lasers on the dance floor.",
        price: 150,
        emoji: "🔥"
    },
    confetti: {
        id: "fx_confetti",
        nameKey: "data_fx_confetti_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Stadium_Confetti_Blowers.mp4",
        fallbackName: "Cañones de Confeti (Stadium Blowers)",
        fallbackDesc: "A massive, stadium-style confetti blast designed for the ultimate climax of your event or Hora Loca.",
        price: 450,
        emoji: "🎉"
    },
    danceFloor: {
        id: "fx_dancefloor",
        nameKey: "data_fx_dancefloor_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Led_Dance_Floor.mp4",
        fallbackName: "Pista de Baile LED (Infinity Floor)",
        fallbackDesc: "A stunning interactive 3D LED dance floor that transforms your entire venue into a luxury nightclub.",
        price: null,
        priceString: "Según Medidas",
        emoji: "🕺"
    },
    movingHeads: {
        id: "fx_moving_heads",
        nameKey: "data_light_moving_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Moving_Head_Lights.mp4",
        fallbackName: "Party & Club Lighting",
        fallbackDesc: "Intelligent moving heads and laser arrays to transform any venue into a high-energy nightlife experience.",
        price: 350,
        emoji: "🪩"
    },
    ledWall: {
        id: "fx_led_wall",
        nameKey: "data_light_led_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/pantalla_LED.mp4",
        fallbackName: "Pantallas LED Gigantes",
        fallbackDesc: "State-of-the-art modular LED walls for dynamic visuals, monogram displays, and DJ booth facades.",
        price: null,
        priceString: "Según Medidas",
        emoji: "📺"
    },
    uplighting: {
        id: "fx_uplighting",
        nameKey: "data_light_up_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Iluminación.mp4",
        fallbackName: "Uplighting Arquitectónico",
        fallbackDesc: "Elegant, wireless perimeter lighting designed to bathe your walls in the precise color palette of your event.",
        price: 350,
        emoji: "💡"
    }
};

window.renderFxHero = (currentTabKey = 'sparks', animate = true) => {
    window.activeFxTabLocked = currentTabKey;
    const dataset = window.fxItems;
    const gridEl = document.getElementById("fx-roster-grid");
    const videoEl = document.getElementById("fx-hero-video");

    const performRender = () => {
        let activeVideo = dataset[currentTabKey] ? dataset[currentTabKey].video : "";

        if (gridEl && dataset) {
            if (typeof window.mdjTeardownFxCarousel === 'function') {
                window.mdjTeardownFxCarousel();
            }

            const buildCards = () => Object.entries(dataset).map(([key, item]) => {
                const isActive = key === currentTabKey;
                const isSelected = window.selectedPackage && window.selectedPackage.some(p => p.id === item.id);
                const activeStateClass = isActive ? ' active' : '';
                const btnClass = isSelected ? 'hl-action-btn added' : 'btn-premium-cta full hl-action-btn';
                const btnBg = isSelected ? 'rgba(197,160,89,0.2)' : 'transparent';
                const btnLabel = isSelected ? t('btn_remove_extra', 'Remove') : t(item.ctaKey, 'Consultar');
                const iconHtml = isSelected ? '<span class="hl-btn-icon">✓</span>' : '<span class="hl-btn-icon"></span>';
                return `
                        <div class="talent-cat-card hero-glass-card hl-type-card mdj-magic-hover-card${activeStateClass}" data-fx-key="${key}" style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; min-height: 320px; gap: 10px;">
                            <div class="hl-card-icon" style="font-size: 32px; margin-bottom: 5px;">${item.emoji || '✨'}</div>
                            <h3 class="hl-card-title" data-i18n="${item.nameKey}" style="font-family: 'Playfair Display', serif; color: var(--gold); font-size: 15px; font-weight: 600; margin: 0; line-height: 1.2;">
                                ${t(item.nameKey, item.fallbackName)}
                            </h3>
                            <p class="hl-card-desc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; flex-grow: 1; line-height: 1.4;">
                                ${item.fallbackDesc || ""}
                            </p>
                            <div class="hl-card-price" style="font-family: Inter, sans-serif; color: var(--gold); font-size: 18px; font-weight: 700; margin-top: auto; margin-bottom: 10px;">
                                ${item.priceString ? item.priceString : (item.price ? '$' + item.price + '.00' : 'Cotizar')}
                            </div>
                            <button class="${btnClass}" data-action="open-fx" style="width: 100%; border: 1px solid var(--gold); background: ${btnBg}; color: var(--gold); padding: 8px 0; border-radius: 50px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="event.stopPropagation();">
                                ${iconHtml}
                                <span class="hl-btn-text">${btnLabel}</span>
                            </button>
                        </div>
                    `;
            }).join('');

            gridEl.className = 'mdj-fx-catalog-carousel grid5 cinematic-hero-cards';
            gridEl.style.boxSizing = 'border-box';
            gridEl.style.position = 'relative';
            gridEl.style.zIndex = '10';
            gridEl.style.width = '100%';
            gridEl.style.maxWidth = '100%';
            gridEl.innerHTML = buildCards();

            if (window.i18n) window.i18n.updateUI();

            if (typeof window.initFxInfiniteCarousel === 'function') {
                window.initFxInfiniteCarousel();
            }
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    if (typeof window.mdjFxInfiniteApply === 'function') {
                        window.mdjFxInfiniteApply();
                    }
                });
            });
            if (typeof window.initFxDragClickGuard === 'function') {
                window.initFxDragClickGuard();
            }
        }

        if (videoEl && activeVideo) {
            const v = activeVideo;
            const rv = mdjV(v);
            const changed = videoEl.getAttribute("src") !== rv;
            if (changed) videoEl.src = rv;
            if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
            if (changed) videoEl.load();
            videoEl.play().catch(() => { });
        }

        if (typeof window._bindFxGridHeroHover === "function") window._bindFxGridHeroHover();
    };

    if (animate) {
        if (videoEl) videoEl.classList.add("live-fade-out");
        const overlay = document.querySelector('#fx-modal .hl-hero-global-overlay');
        if (overlay) overlay.classList.add("live-fade-out");
        setTimeout(() => {
            performRender();
            requestAnimationFrame(() => {
                if (videoEl) videoEl.classList.remove("live-fade-out");
                if (overlay) overlay.classList.remove("live-fade-out");
            });
        }, 300);
    } else {
        performRender();
    }
};

window.lightingItems = {
    movingHeads: {
        id: "light_moving_heads",
        nameKey: "data_light_moving_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/Moving_Head_Lights.mp4",
        fallbackName: "Party & Club Lighting",
        fallbackDesc: "Intelligent moving heads and laser arrays to transform any venue into a high-energy nightlife experience.",
        price: 350,
        emoji: "🪩"
    },
    ledWall: {
        id: "light_led_wall",
        nameKey: "data_light_led_name",
        ctaKey: "btn_add_to_pack",
        video: "./assets/Special_Effects/pantalla_LED.mp4",
        fallbackName: "Pantallas LED Gigantes",
        fallbackDesc: "State-of-the-art modular LED walls for dynamic visuals, monogram displays, and DJ booth facades.",
        price: null,
        priceString: "Según Medidas",
        emoji: "📺"
    },
    uplighting: {
        id: "light_uplighting",
        nameKey: "data_light_up_name",
        ctaKey: "btn_add_to_pack",
        video: null,
        fallbackName: "Uplighting Arquitectónico",
        fallbackDesc: "Elegant, wireless perimeter lighting designed to bathe your walls in the precise color palette of your event.",
        price: 350,
        emoji: "💡"
    }
};

window.renderLightingHero = (currentTabKey = 'movingHeads', animate = true) => {
    window.activeLightingTabLocked = currentTabKey;
    const dataset = window.lightingItems;
    const gridEl = document.getElementById("lighting-roster-grid");
    const videoEl = document.getElementById("lighting-hero-video");

    const performRender = () => {
        if (typeof window.mdjTeardownLightingCarousel === 'function') {
            window.mdjTeardownLightingCarousel();
        }

        let activeVideo = dataset[currentTabKey] && dataset[currentTabKey].video ? dataset[currentTabKey].video : "./assets/Special_Effects/Iluminación.mp4";

        if (gridEl && dataset) {
            gridEl.innerHTML = Object.entries(dataset).map(([key, item]) => {
                const isSelected = window.selectedPackage && window.selectedPackage.some(p => p.id === item.id);
                const isActive = key === currentTabKey;
                const btnClass = isSelected ? "hl-action-btn added" : "btn-premium-cta full hl-action-btn";
                const icon = isSelected ? "✓" : "";
                const btnText = isSelected ? t('btn_remove_extra', 'Remove') : t(item.ctaKey, 'Consultar');
                const activeStateClass = isActive ? " active" : "";

                return `
                    <div class="talent-cat-card hero-glass-card hl-type-card mdj-magic-hover-card${activeStateClass}" data-lighting-key="${key}" style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; min-height: 320px; gap: 10px;">
                        <div class="hl-card-icon" style="font-size: 32px; margin-bottom: 5px;">${item.emoji || '💡'}</div>
                        <h3 class="hl-card-title" data-i18n="${item.nameKey}" style="font-family: 'Playfair Display', serif; color: var(--gold); font-size: 15px; font-weight: 600; margin: 0; line-height: 1.2;">
                            ${t(item.nameKey, item.fallbackName)}
                        </h3>
                        <p class="hl-card-desc" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; flex-grow: 1; line-height: 1.4;">
                            ${item.fallbackDesc || ""}
                        </p>
                        <div class="hl-card-price" style="font-family: Inter, sans-serif; color: var(--gold); font-size: 18px; font-weight: 700; margin-top: auto; margin-bottom: 10px;">
                            ${item.priceString ? item.priceString : (item.price ? '$' + item.price + '.00' : 'Cotizar')}
                        </div>
                        <button class="${btnClass}" data-action="open-lighting" style="width: 100%; border: 1px solid var(--gold); background: ${isSelected ? 'rgba(197,160,89,0.2)' : 'transparent'}; color: var(--gold); padding: 8px 0; border-radius: 50px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="event.stopPropagation();">
                            ${icon ? '<span class="hl-btn-icon">${icon}</span>' : ''}
                            <span class="hl-btn-text">${btnText}</span>
                        </button>
                    </div>
                `;
            }).join('');
        }

        if (videoEl && activeVideo) {
            const v = activeVideo;
            const rv = mdjV(v);
            const changed = videoEl.getAttribute("src") !== rv;
            if (changed) videoEl.src = rv;
            if (typeof window.mdjHeroVideoPrime === "function") window.mdjHeroVideoPrime(videoEl);
            if (changed) videoEl.load();
            videoEl.play().catch(() => { });
        }

        if (typeof window._bindLightingGridHeroHover === "function") window._bindLightingGridHeroHover();

        if (typeof window.initLightingInfiniteCarousel === 'function') {
            window.initLightingInfiniteCarousel();
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (typeof window.mdjLightingInfiniteApply === 'function') {
                    window.mdjLightingInfiniteApply();
                }
            });
        });
        if (typeof window.initLightingDragClickGuard === 'function') {
            window.initLightingDragClickGuard();
        }
    };

    if (animate) {
        if (videoEl) videoEl.classList.add("live-fade-out");
        const overlay = document.querySelector('#lighting-modal .hl-hero-global-overlay');
        if (overlay) overlay.classList.add("live-fade-out");
        setTimeout(() => {
            performRender();
            requestAnimationFrame(() => {
                if (videoEl) videoEl.classList.remove("live-fade-out");
                if (overlay) overlay.classList.remove("live-fade-out");
            });
        }, 300);
    } else {
        performRender();
    }
};

async function loadRentalsData() {
    try {
        const data = window.MDJ_RENTALS_DATA;

        window.hlPackages = (data.horaLoca || [])
            .filter(item => item.active)
            .sort((a, b) => (a.order || a.sortOrder || 0) - (b.order || b.sortOrder || 0));

        window.talentData = data.talent;

        if (window.talentData.musicians) {
            window.talentData.musicians = window.talentData.musicians.filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
        }
        if (window.talentData.visuals) {
            window.talentData.visuals = window.talentData.visuals.filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
        }

        if (window.renderHoraLocaCatalogue) {
            window.renderHoraLocaCatalogue();
        }

    } catch (error) {
        void error;
    }
}

window.renderHoraLocaCatalogue = () => {
    const grid = document.getElementById('horaloca-grid');
    if (!grid) return;

    if (typeof window.mdjRentalsTeardownHorizontalInfiniteStrip === 'function') {
        window.mdjRentalsTeardownHorizontalInfiniteStrip(grid, 'mdj-horaloca-carousel-clone', 'mdj-rentals-horizontal-infinite');
    }

    grid.innerHTML = window.hlPackages.map(pack => {
        const pName = window.t('data_' + pack.id + '_name', pack.name) || t('data_' + pack.id + '_name', pack.name);
        const pDesc = window.t('data_' + pack.id + '_desc', pack.desc) || t('data_' + pack.id + '_desc', pack.desc);

        let emoji = '🎭';
        if (pack.id === 'hl_robot') emoji = '🤖';
        if (pack.id === 'hl_brasil') emoji = '💃';
        if (pack.id === 'hl_cubana') emoji = '🥁';
        if (pack.id === 'hl_character') emoji = '🤡';
        if (pack.id === 'hl_hadas') emoji = '🧚‍♀️';

        const selected = Array.isArray(window.selectedPackage) ? window.selectedPackage : [];
        const isSelected = selected.some(p => p.id === pack.id);
        const btnClass = isSelected ? 'btn full hl-action-btn hl-btn-added' : 'btn-premium-cta full hl-action-btn';
        const btnText = isSelected ? (window.t('btn_added_exp', 'Añadido') || t('btn_added_exp', 'Añadido')) : (window.t('btn_active_exp', 'Activar esta Experiencia') || t('btn_active_exp', 'Activar esta Experiencia'));

        return `
        <div class="talent-cat-card hero-glass-card hl-type-card" id="hl-card-${pack.id}" data-action="select-hl-package" data-id="${pack.id}" style="flex: 1 1 0; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; min-height: 320px; transition: transform 0.3s ease;">
            <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; align-items: center;">
                <div class="hero-card-emoji" style="font-size: 28px; margin-bottom: 12px;">${emoji}</div>
                <h3 class="hero-card-title hl-type-name" data-i18n="data_${pack.id}_name" style="font-size: 15px; line-height: 1.2; margin-bottom: 8px; color: var(--gold); font-family: 'Playfair Display', serif;">${pName}</h3>
                <p class="hero-card-text" data-i18n="data_${pack.id}_desc" style="font-size: 11px; opacity: 0.8; margin-bottom: auto; color: white; line-height: 1.35; width: 100%;">${pDesc}</p>
                <div class="hero-card-price hl-type-price" style="font-size: 18px; font-weight: 700; color: var(--gold); margin-top: 15px; margin-bottom: 20px;">$${pack.price}.00</div>
            </div>
            <button class="${btnClass}" data-action="hl-activate-direct" data-id="${pack.id}" style="font-size: 10px; padding: 10px 5px; margin-top: auto; border-radius: 50px; letter-spacing: 0.5px;">
                <span class="hl-btn-text" data-i18n="${isSelected ? 'btn_added_exp' : 'btn_active_exp'}">${btnText}</span>
            </button>
        </div>
        `;
    }).join('');

    if (window.i18n) window.i18n.updateUI();

    if (typeof window.mdjRentalsTryMountTalentStripInfinite === 'function') {
        window.mdjRentalsTryMountTalentStripInfinite(grid, 'mdj-horaloca-carousel-clone');
    }
    if (typeof window.mdjRentalsInitStripDragClickGuard === 'function') {
        window.mdjRentalsInitStripDragClickGuard(grid);
    }

    if (window.hlPackages.length > 0) {
        window.updateHoraLocaHero(window.hlPackages[0].id);
    }
};

window.updateHoraLocaHero = (id) => {
    const pack = window.hlPackages.find(i => i.id === id);
    if (!pack) return;

    const nameEl = document.getElementById('hl-active-name');
    const priceEl = document.getElementById('hl-active-price');
    const descEl = document.getElementById('hl-active-desc');

    const pName = t('data_' + pack.id + '_name', pack.name);
    const pDesc = t('data_' + pack.id + '_desc', pack.desc);

    if (nameEl) {
        nameEl.setAttribute('data-i18n', 'data_' + pack.id + '_name');
        nameEl.textContent = pName;
    }
    if (priceEl) priceEl.textContent = "$" + pack.price + ".00";
    if (descEl) {
        descEl.setAttribute('data-i18n', 'data_' + pack.id + '_desc');
        descEl.textContent = pDesc || "";
    }

    const videoEl = document.getElementById('hl-hero-video');
    if (videoEl && pack.video) {
        const v = pack.video;
        const rv = mdjV(v);
        const changed = videoEl.getAttribute('src') !== rv;
        if (changed) videoEl.src = rv;
        if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(videoEl);
        if (changed) videoEl.load();
        videoEl.play().catch(() => {});
    }

    if (window.i18n) {
        window.i18n.updateUI();
    }

    const hlGrid = document.getElementById('horaloca-grid');
    if (hlGrid) {
        hlGrid.querySelectorAll('.hl-type-card').forEach(function (card) {
            card.classList.remove('active');
        });
    }
    const activeCard = document.getElementById(`hl-card-${id}`);
    if (activeCard) activeCard.classList.add('active');

    const addBtn = document.getElementById('hl-add-btn');
    if (addBtn) {
        addBtn.setAttribute('data-id', pack.id);
        addBtn.setAttribute('data-name', pack.name);
        addBtn.setAttribute('data-price', pack.price);

        const selected = Array.isArray(window.selectedPackage) ? window.selectedPackage : [];
        const isSelected = selected.some(p => p.id === pack.id);

        if (isSelected) {
            addBtn.innerHTML = `<span class="hl-btn-text" data-i18n="btn_added_exp">${t('btn_added_exp', 'Añadido')}</span>`;
            addBtn.className = 'btn full hl-action-btn hl-btn-added';
        } else {
            addBtn.innerHTML = `<span class="hl-btn-text" data-i18n="btn_active_exp">${t('btn_active_exp', 'Activar esta Experiencia')}</span>`;
            addBtn.className = 'btn primary full hl-action-btn';
        }
    }

    // 6. Paso 2B: Inyección dinámica de Extras aislada
    const extrasGrid = document.getElementById('hl-extras-grid');
    if (extrasGrid) {
        if (pack.extras && pack.extras.length > 0) {
            extrasGrid.innerHTML = pack.extras
                .filter(ex => ex.active)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(ex => {
                    const selected = Array.isArray(window.selectedPackage) ? window.selectedPackage : [];
                    const isSelected = selected.some(p => p.id === ex.id);
                    const exName = t('data_' + ex.id + '_name', ex.name);
                    const btnLbl = isSelected ? t('btn_remove_extra', 'Quitar extra') : t('btn_add_extra', 'Agregar extra');
                    return `
                    <div class="tile glass-card rental-grid-card">
                        <div class="rental-card-content hl-extra-card-content">
                            <div>
                                <h4 class="rental-card-title" data-i18n="data_${ex.id}_name">${exName}</h4>
                            </div>
                            <div class="hl-extra-price-wrap">
                                <div class="rental-card-price">+$${ex.price}.00</div>
                                <div class="rental-action-bar">
                                    <span class="rental-switch-lbl" data-i18n="${isSelected ? 'btn_remove_extra' : 'btn_add_extra'}">${btnLbl}</span>
                                    <label class="switch rental-switch-wrap">
                                        <input type="checkbox" id="toggle-${ex.id}" data-action="toggle-pack" data-id="${ex.id}" data-name="${ex.name}" data-price="${ex.price}">
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');

            // Sincronizar estado visual de los toggles nativos post-inyección
            if (Array.isArray(window.selectedPackage)) {
                pack.extras.forEach(ex => {
                    const isSelected = window.selectedPackage.some(p => p.id === ex.id);
                    const toggle = document.getElementById(`toggle-${ex.id}`);
                    if (toggle) toggle.checked = isSelected;
                });
            }
        } else {
            extrasGrid.innerHTML = `<div class="hl-extra-empty" data-i18n="hl_no_extras">${t('hl_no_extras', 'Este paquete incluye todos los performers temáticos, no hay adicionales disponibles.')}</div>`;
        }
    }
    if (window.i18n) window.i18n.updateUI();
};

window.renderRoster = (type) => {
    const grid = document.getElementById('roster-grid');
    const rosterTitle = document.getElementById('roster-title');
    if (!grid) return;

    if (rosterTitle) rosterTitle.textContent = type === 'musicians' ? t('roster_title_musicians', 'Músicos de Élite') : t('roster_title_visuals', 'Captura y Visuales');

    const items = window.talentData[type] || [];
    grid.innerHTML = items.map(item => {
        const iName = t('data_' + item.id + '_name', item.name);
        const iDesc = t('data_' + item.id + '_desc', item.desc || 'Acompañamiento VIP para eventos mágicos');
        const badgeEx = t('badge_exclusive', 'MDJ BEAT EXCLUSIVE');
        const rFrom = t('roster_from', 'Desde');
        const btnAdd = t('btn_add_to_pack', 'Agregar al paquete');
        const isSelected = window.selectedPackage.some(p => p.id === item.id);
        const btnLbl = isSelected ? t('btn_remove_extra', 'Quitar extra') : btnAdd;

        return `
        <div class="tile glass-card rental-grid-card">
            <div class="rental-media-box">
                <img src="${item.img ? mdjV(item.img) : ""}" class="rental-img-zoom" alt="${item.id}">
                <div class="rental-badge-pro" data-i18n="badge_exclusive">${badgeEx}</div>
            </div>
            <div class="rental-card-content">
                <div>
                    <h4 class="rental-card-title" data-i18n="data_${item.id}_name">${iName}</h4>
                    <p class="rental-card-subtitle" data-i18n="data_${item.id}_desc">${iDesc}</p>
                </div>
                <div>
                    <div class="rental-card-price"><span data-i18n="roster_from">${rFrom}</span> $${item.price}.00</div>
                    <div class="rental-action-bar">
                        <span class="rental-switch-lbl" data-i18n="${isSelected ? 'btn_remove_extra' : 'btn_add_to_pack'}">${btnLbl}</span>
                        <label class="switch rental-switch-wrap">
                            <input type="checkbox" id="toggle-${item.id}" data-action="toggle-pack" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    if (window.i18n) window.i18n.updateUI();

    window.selectedPackage.forEach(item => {
        const checkbox = document.getElementById('toggle-' + item.id);
        if (checkbox) checkbox.checked = true;
    });
};


/* =========================================
   UNIVERSAL RENTAL CATALOG ENGINE (Phase 6)
========================================= */
window.rentalCatalogs = {
    furniture: {
        title: "Furniture & Decor",
        subtitle: "Premium furniture and decor to elevate your event experience.",
        items: [
            { id: "f_chairs", name: "Premium Seating", price: 6, image: "./assets/furniture-decor/chairs.jpg", video: "./assets/furniture-decor/chairs.mp4", category: "furniture", unit: "/u" },
            { id: "f_cocktail", name: "High-Top Cocktail Tables", price: 20, image: "./assets/furniture-decor/cocktail-tables.jpg", video: "./assets/furniture-decor/cocktail-tables.mp4", category: "furniture", unit: "/u" },
            { id: "f_dining", name: "Dining Tables", price: 25, image: "./assets/furniture-decor/dining-tables.jpg", video: "./assets/furniture-decor/dining-tables.mp4", category: "furniture", unit: "/u" },
            { id: "f_floral", name: "Bespoke Floral Decor", price: 150, image: "./assets/furniture-decor/floral-decor.jpg", video: "./assets/furniture-decor/floral-decor.mp4", category: "furniture", unit: "/u" },
            { id: "f_led", name: "LED Furniture", price: 75, image: "./assets/furniture-decor/led-furniture.jpg", video: "./assets/furniture-decor/led-furniture.mp4", category: "furniture", unit: "/u" },
            { id: "f_linens", name: "Premium Linens", price: 12, image: "./assets/furniture-decor/linens.jpg", video: "./assets/furniture-decor/linens.mp4", category: "furniture", unit: "/u" },
            { id: "f_tables", name: "Banquet Tables", price: 15, image: "./assets/furniture-decor/tables.jpg", video: "./assets/furniture-decor/tables.mp4", category: "furniture", unit: "/u" },
            { id: "f_backdrop", name: "Scenic Backdrops", price: 300, image: "./assets/furniture-decor/backdrops.jpg", video: "./assets/furniture-decor/backdrops.mp4", category: "furniture", unit: "/u" }
        ]
    },
    tents: {
        title: "Tent & Event Structures",
        subtitle: "Premium tents, inflatables, and event structures ready for any setup. Select your units and build your event instantly.",
        items: [
            { id: "tent_clear", name: "Premium Clear Tent", price: 800, img: "./assets/tents/carpas-main.jpg", video: "./assets/tents/carpas-main.mp4" },
            { id: "tent_white", name: "Classic White Tent", price: 600, img: "./assets/tents/carpas-white.jpg", video: "./assets/tents/carpas-white.mp4" },
            { id: "ac_unit", name: "Portable A/C Unit", price: 250, img: "./assets/tents/carpas-ac.jpg", video: "./assets/tents/carpas-ac.mp4" }
        ]
    },
    inflatables: {
        title: "Kids & Inflatables",
        subtitle: "Fun structures and attractions for kids events and parties.",
        items: [
            { id: "castle_lite", name: "Lite Castle", price: 150, img: "./assets/inflatables/lite-castle.jpg", video: "./assets/inflatables/lite-castle.mp4" },
            { id: "castle_basic", name: "Basic Castle", price: 200, img: "./assets/inflatables/basic-castle.jpg", video: "./assets/inflatables/basic-castle.mp4" },
            { id: "castle_big", name: "Big Castle", price: 350, img: "./assets/inflatables/big-castle.jpg", video: "./assets/inflatables/big-castle.mp4" }
        ]
    },
    stages: {
        title: "Stage & Event Structures",
        subtitle: "Professional staging solutions for concerts, DJs, and live productions.",
        items: [
            { id: "stage_small", name: "Small DJ Stage", price: 300, img: "./assets/Tent & Event Structures/stage-small.jpg", video: "./assets/Tent & Event Structures/stage-small.mp4?v=20260414-under90mb" },
            { id: "stage_medium", name: "Medium Event Stage", price: 600, img: "./assets/Tent & Event Structures/stage-medium.jpg", video: "./assets/Tent & Event Structures/stage-medium.mp4" },
            { id: "stage_large", name: "Large Concert Stage", price: 1200, img: "./assets/Tent & Event Structures/stage-large.jpg", video: "./assets/Tent & Event Structures/stage-large.mp4" },
            { id: "truss_arch", name: "Goal Post Truss System", price: 350, img: "./assets/Tent & Event Structures/goal-post-truss.jpg", video: "./assets/Tent & Event Structures/goal-post-truss.mp4" },
            { id: "truss_box_full", name: "Full Box Truss Structure", price: 1800, img: "./assets/Tent & Event Structures/full-box-truss.jpg", video: "./assets/Tent & Event Structures/full-box-truss.mp4" },
            { id: "truss_ultra", name: "Ultra Truss System", price: 3500, img: "./assets/Tent & Event Structures/ultra-truss-system.jpg", video: "./assets/Tent & Event Structures/ultra-truss-system.mp4?v=20260414-under90mb" }
        ]
    },
    audio: {
        title: "Audio y Sonido Profesional",
        subtitle: "Premium sound systems, microphones, mixers, and event audio solutions for concerts, private events, and live productions.",
        items: [
            { id: "pa_small", name: "Small PA System", price: 150, img: "./assets/audio/pa-small.jpg", video: "./assets/audio/pa-small.mp4", category: "audio", unit: "u" },
            { id: "pa_medium", name: "Medium PA System", price: 350, img: "./assets/audio/pa-medium.jpg", video: "./assets/audio/pa-medium.mp4", category: "audio", unit: "u" },
            { id: "pa_large", name: "Large Event Sound System", price: 750, img: "./assets/audio/pa-large.jpg", video: "./assets/audio/pa-large.mp4", category: "audio", unit: "u" },
            { id: "wireless_mic", name: "Wireless Microphone", price: 65, img: "./assets/audio/wireless-mic.jpg", video: "./assets/audio/wireless-mic.mp4", category: "audio", unit: "u" },
            { id: "dj_monitor", name: "DJ Monitor Speaker", price: 95, img: "./assets/audio/dj-monitor.jpg", video: "./assets/audio/dj-monitor.mp4", category: "audio", unit: "u" },
            { id: "audio_mixer", name: "Audio Mixer", price: 120, img: "./assets/audio/audio-mixer.jpg", video: "./assets/audio/audio-mixer.mp4", category: "audio", unit: "u" }
        ]
    },
    lighting: {
        title: "Iluminación y Pantallas LED",
        subtitle: "Professional lighting, LED screens, and visual systems to elevate your event experience.",
        items: [
            { id: "led_panel_small", name: "LED Panel Screen (Small)", price: 300, img: "./assets/lighting/led-small.jpg", video: "./assets/lighting/led-small.mp4", category: "lighting", unit: "u" },
            { id: "led_panel_large", name: "LED Panel Screen (Large)", price: 800, img: "./assets/lighting/led-large.jpg", video: "./assets/lighting/led-large.mp4", category: "lighting", unit: "u" },
            { id: "moving_heads", name: "Moving Head Lights (Pair)", price: 150, img: "./assets/lighting/moving-heads.jpg", video: "./assets/lighting/moving-heads.mp4", category: "lighting", unit: "u" },
            { id: "uplighting_pack", name: "Uplighting Pack (10 Units)", price: 200, img: "./assets/lighting/uplighting.jpg", video: "./assets/lighting/uplighting.mp4", category: "lighting", unit: "u" },
            { id: "laser_show", name: "Laser Show System", price: 250, img: "./assets/lighting/laser.jpg", video: "./assets/lighting/laser.mp4", category: "lighting", unit: "u" },
            { id: "fog_machine", name: "Fog Machine (Smoke)", price: 60, img: "./assets/lighting/fog.jpg", video: "./assets/lighting/fog.mp4", category: "lighting", unit: "u" },
            { id: "low_fog_machine", name: "Low-Lying Fog (Dry Ice)", price: 250, img: "./assets/lighting/low-fog.jpg", video: "./assets/lighting/low-fog.mp4", category: "lighting", unit: "u" },
            { id: "bubble_machine", name: "Pro Bubble Machine", price: 45, img: "./assets/lighting/bubble-machine.jpg", video: "./assets/lighting/bubble-machine.mp4", category: "lighting", unit: "u" },
            { id: "spark_machine", name: "Cold Spark Machines (Pair)", price: 250, img: "./assets/lighting/spark-machine.jpg", video: "./assets/lighting/spark-machine.mp4", category: "lighting", unit: "pair" },
            { id: "led_video_small", name: "LED Video Wall (Small)", price: 500, img: "./assets/lighting/led-video-small.jpg", video: "./assets/lighting/led-video-small.mp4", category: "lighting", unit: "u" },
            { id: "led_video_medium", name: "LED Video Wall (Medium)", price: 950, img: "./assets/lighting/led-video-medium.jpg", video: "./assets/lighting/led-video-medium.mp4", category: "lighting", unit: "u" },
            { id: "led_video_large", name: "LED Video Wall (Large)", price: 1800, img: "./assets/lighting/led-video-large.jpg", video: "./assets/lighting/led-video-large.mp4", category: "lighting", unit: "u" },
            { id: "indoor_led_screen", name: "Indoor LED Screen", price: 650, img: "./assets/lighting/indoor-led-screen.jpg", video: "./assets/lighting/indoor-led-screen.mp4", category: "lighting", unit: "u" },
            { id: "outdoor_led_screen", name: "Outdoor LED Screen", price: 1200, img: "./assets/lighting/outdoor-led-screen.jpg", video: "./assets/lighting/outdoor-led-screen.mp4", category: "lighting", unit: "u" },
            { id: "led_tv_stand", name: "LED TV Display Stand", price: 220, img: "./assets/lighting/led-tv-stand.jpg", video: "./assets/lighting/led-tv-stand.mp4", category: "lighting", unit: "u" }
        ]
    }
};

window.rentalDraftQty = {}; // Universal draft quantity memory string

window.renderRentalCatalog = (categoryId) => {
    const grid = document.getElementById('rental-dynamic-grid');
    const catalog = window.rentalCatalogs[categoryId];

    if (!grid || !catalog) return;

    if (typeof window.mdjTeardownRentalCatalogCarousel === 'function') {
        window.mdjTeardownRentalCatalogCarousel();
    }

    // Dynamically Inject Catalog Meta
    const titleEl = document.getElementById('rental-dynamic-title');
    const descEl = document.getElementById('rental-dynamic-desc');
    if (titleEl) titleEl.innerText = catalog.title;
    if (descEl) descEl.innerText = catalog.subtitle;

    // Fondo multi-vídeo (hero) — omitir si el modal es solo contenedor catálogo, salvo Audio y Sonido (vídeos visibles + hover por ítem).
    const rentalModal = document.getElementById('rental-dynamic-modal');
    const showRentalHeroVideo =
        categoryId === 'audio' ||
        categoryId === 'furniture' ||
        categoryId === 'tents' ||
        categoryId === 'stages' ||
        categoryId === 'inflatables';
    if (rentalModal) {
        rentalModal.classList.toggle('mdj-rental-hero-video-on', showRentalHeroVideo);
    }
    const skipBgVideo = rentalModal && rentalModal.getAttribute('data-mdj-catalog-no-bg') === '1' && !showRentalHeroVideo;
    const videoContainer = document.getElementById('rental-multi-video-container');
    if (videoContainer && !skipBgVideo) {
        const allVideos = videoContainer.querySelectorAll('.rental-bg-vid');
        let hasActive = false;

        allVideos.forEach(vid => {
            if (vid.getAttribute('data-category') === categoryId) {
                vid.classList.add('active-vid');
                if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(vid);
                vid.play().catch(() => {});
                hasActive = true;
            } else {
                vid.classList.remove('active-vid');
                vid.pause();
            }
        });

        if (!hasActive && allVideos.length > 0) {
            allVideos[0].classList.add('active-vid');
            if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(allVideos[0]);
            allVideos[0].play().catch(() => {});
        }
    } else if (videoContainer && skipBgVideo) {
        videoContainer.querySelectorAll('.rental-bg-vid').forEach((vid) => {
            vid.classList.remove('active-vid');
            try {
                vid.pause();
            } catch (e) { /* ignore */ }
        });
    }

    // Tab active state update
    document.querySelectorAll('.rental-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-cat') === categoryId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    /* Todas las categorías: scroll horizontal + carrusel infinito (mismo ADN que hub de talento). */
    grid.className = "";
    grid.style.display = 'block';
    grid.style.width = '100%';
    grid.style.boxSizing = 'border-box';
    grid.style.padding = '0';
    grid.style.overflow = 'visible';
    grid.style.position = 'relative';
    grid.style.zIndex = '10';

    let html = `
        <style>
            /* STICKY HEADER & TABS CSS */
            .rentals-header {
                position: sticky;
                top: 0;
                z-index: 1000;
            }
            .rentals-header-inner {
                max-width: 1400px;
                margin: 0 auto;
                padding: 14px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .rental-tabs {
                display: flex;
                gap: 12px;
                align-items: center;
                margin: 0;
            }
            .rental-tabs button {
                background: rgba(255,255,255,0.1) !important;
                border: 1px solid rgba(255,255,255,0.4) !important;
                color: rgba(255,255,255,0.9) !important;
                padding: 10px 22px;
                border-radius: 999px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: -apple-system, sans-serif;
                font-weight: 600;
                font-size: 15px;
            }
            .rental-tabs button.active {
                background: rgba(212, 175, 55, 0.2) !important;
                color: var(--gold) !important;
                border: 2px solid var(--gold) !important;
                box-shadow: 0 0 20px rgba(212, 175, 55, 0.5) !important;
                transform: scale(1.05);
            }
            .rental-tabs button:not(.active):hover {
                background: rgba(255,255,255,0.2) !important;
                border: 1px solid rgba(255,255,255,0.6) !important;
                color: white !important;
            }

            .product-card {
                border-radius: 16px;
                overflow: hidden;
                background: transparent;
                border: 2px solid rgba(212, 175, 55, 0.4) !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.4s ease;
                /* Match Special Effects Dimensions */
                width: 260px;
                min-width: 260px;
                flex-shrink: 0;
            }

            .product-image {
                position: relative;
                background: transparent;
            }

            .product-image img,
            .product-image video {
                width: 100%;
                height: auto;
                aspect-ratio: 4/5;
                object-fit: cover;
                display: block;
                opacity: 0.8; /* BALANCE PERFECTO: LUZ DEL VIDEO VISIBLE, PRODUCTO NÍTIDO */
                transition: transform 0.4s ease, opacity 0.4s ease;
            }

            /* PANEL FLOTANTE - PRECIOS */
            .product-overlay {
                position: absolute;
                bottom: 12px;
                left: 12px;
                right: 12px;

                background: rgba(18, 18, 18, 0.95); /* CASI SÓLIDO TOTAL */
                border: 2px solid #d4af37; /* BORDE ORO INTENSO */
                box-shadow: 0 -4px 15px rgba(0,0,0,0.8);

                border-radius: 14px;
                padding: 12px;

                display: flex;
                flex-direction: column;
                gap: 10px;

                transition: all 0.25s ease;
            }

            /* TOP */
            .overlay-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .price-wrap {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }

            .price {
                font-size: 20px;
                font-weight: 700;
                color: #d4af37;
            }

            .unit {
                font-size: 12px;
                opacity: 0.7;
                color: #fff;
            }

            .qty {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .qty-btn-action {
                background: transparent;
                border: none;
                color: #d4af37;
                font-size: 24px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
            }
            .qty-btn-action:hover {
                color: #fff;
            }

            .qty-val-display {
                color: #fff;
                font-weight: 600;
                width: 20px;
                text-align: center;
                font-size: 16px;
                font-family: -apple-system, sans-serif;
            }

            /* BOTÓN */
            .cta {
                width: 100%;
                padding: 10px;
                border-radius: 10px;
                border: none;

                background: linear-gradient(135deg, #d4af37, #aa8c2c);
                color: black;
                font-weight: 600;
                cursor: pointer;

                transition: all 0.2s ease;
            }

            .cta-remove {
                background: rgba(30,30,30,0.8);
                color: rgba(255,255,255,0.9);
                border: 1px solid rgba(255,255,255,0.2);
            }
            .cta-remove:hover {
                background: rgba(40,40,40,0.95);
                border-color: rgba(255,59,48,0.5);
                color: #ff3b3b;
            }

            /* HOVER 3D SUAVE PREMIUM */
            .product-card:hover {
                transform: translateY(-8px) scale(1.02);
                border-color: #ffd700 !important; /* ORO INTENSO AL HOVER */
            }

            .product-card:hover .product-image img,
            .product-card:hover .product-image video {
                transform: scale(1.05);
                opacity: 1; /* LA FOTO SE VUELVE 100% SÓLIDA AL ENFOCAR */
            }

            .product-card:hover .product-overlay {
                border-color: #ffd700;
            }

            .cta:not(.cta-remove):hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
            }

            .product-overlay .title {
                color: rgba(255,255,255,0.95);
                font-size: 15px;
                font-weight: 500;
                font-family: 'Playfair Display', serif;
                text-align: center;
                text-shadow: 0 2px 5px rgba(0,0,0,0.8);
            }
            .overlay-bottom {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
        </style>
        <div class="mdj-rental-catalog-carousel" data-mdj-ui-tick-scroll>
    `;

    let cardsHtml = '';

    catalog.items.forEach(item => {
        if (window.rentalDraftQty[item.id] === undefined) {
            window.rentalDraftQty[item.id] = 0;
        }
        const qty = window.rentalDraftQty[item.id];

        const isAdded = window.selectedPackage.some(p => p.id === item.id);
        const isTalent = item.category === 'talent';
        const btnClass = isAdded ? 'cta cta-remove' : 'cta';

        let btnText = isAdded ? 'REMOVE' : 'ADD';
        if (isTalent) {
            btnText = isAdded ? 'CANCELAR' : 'RESERVAR';
        }

        const qtyHtml = isTalent ? '' : `
                            <div class="qty">
                                <button class="qty-btn-action" data-action="r-qty-down" data-id="${item.id}">−</button>
                                <span id="qty-val-${item.id}" class="qty-val-display">${qty}</span>
                                <button class="qty-btn-action" data-action="r-qty-up" data-id="${item.id}">+</button>
                            </div>
        `;

        const imgRaw = item.image || item.img || '';
        const imgSrc = imgRaw ? mdjV(imgRaw) : '';
        const mediaHtml = `<img src="${imgSrc}" alt="${item.name}" style="width: 100%; height: auto; aspect-ratio: 4/5; object-fit: cover; display: block;">`;

        cardsHtml += `
            <div class="product-card" data-rental-id="${item.id}">
                <div class="product-image">
                    ${mediaHtml}

                    <div class="product-overlay">
                        <div class="overlay-top" ${isTalent ? 'style="justify-content: center;"' : ''}>
                            <div class="price-wrap">
                                <span class="price">$${item.price}</span>
                                <span class="unit">${item.unit || '/u'}</span>
                            </div>

                            ${qtyHtml}
                        </div>

                        <div class="overlay-bottom">
                            <div class="title">${item.name}</div>
                            <button class="${btnClass}" data-action="r-add-cart" data-id="${item.id}" data-price="${item.price}" data-name="${item.name}" data-category="${item.category || ''}">${btnText}</button>
                        </div>
                    </div>

                </div>
            </div>
        `;
    });

    html += cardsHtml;
    html += '</div>'; // Close track

    grid.innerHTML = html;

    if (typeof window.mdjUiTickAutoInit === 'function') {
        window.mdjUiTickAutoInit();
    }

    // STRICT DATA CONTROL: Default to dedicated bgVideo. If missing, auto-fallback to the first item's video. 
    // This prevents black screen 404s when opening new tabs like Furniture or Stages.
    const catBgVideo = catalog.bgVideo || (catalog.items[0] && catalog.items[0].video ? catalog.items[0].video : '');

    // --- RESTAURACIÓN DEL HOVER (PEDIDO EXPRESO DEL USUARIO) ---
    const rentalHoverPreview = (card) => {
        const itemId = card.getAttribute('data-rental-id');
        const itemDef = catalog.items.find(i => i.id === itemId);
        if (!itemDef || !itemDef.video) return;

        const heroVid = document.querySelector('#rental-multi-video-container .active-vid');
        if (!heroVid) return;
        const source = heroVid.querySelector('source');
        if (!source) return;
        const cleanItemVid = itemDef.video.split('/').pop().replace(/%20/g, ' ');
        const already =
            source.src &&
            (source.src.includes(encodeURI(cleanItemVid)) || source.src.includes(cleanItemVid));
        if (already) {
            if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(heroVid);
            heroVid.play().catch(() => {});
            return;
        }
        source.src = mdjV(itemDef.video);
        if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(heroVid);
        heroVid.load();
        heroVid.play().catch(() => {});
    };

    const track = document.querySelector('#rental-dynamic-modal .mdj-rental-catalog-carousel');
    if (track) {
        let lastRentalCard = null;
        /* Delegación: incluye clones del carrusel infinito y puntero fino (iMac / Safari). */
        track.addEventListener(
            'pointerover',
            (e) => {
                const card = e.target && e.target.closest && e.target.closest('.product-card');
                if (!card || !track.contains(card)) return;
                if (lastRentalCard === card) return;
                lastRentalCard = card;
                rentalHoverPreview(card);
            },
            true
        );

        const revertRentalHero = () => {
            lastRentalCard = null;
            const heroVid = document.querySelector('#rental-multi-video-container .active-vid');
            if (heroVid && catBgVideo) {
                const source = heroVid.querySelector('source');
                const cleanCatBg = catBgVideo.split('/').pop().replace(/%20/g, ' ');
                if (source && !source.src.includes(encodeURI(cleanCatBg)) && !source.src.includes(cleanCatBg)) {
                    source.src = mdjV(catBgVideo);
                    if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(heroVid);
                    heroVid.load();
                    heroVid.play().catch(() => {});
                }
            }
        };

        track.addEventListener('mouseleave', revertRentalHero);
        track.addEventListener(
            'pointerleave',
            (e) => {
                if (e.relatedTarget && track.contains(e.relatedTarget)) return;
                revertRentalHero();
            },
            true
        );

        if (typeof window.mdjUiTickBindScroll === 'function') {
            window.mdjUiTickBindScroll(track);
        }
    }

    if (typeof window.initRentalCatalogInfiniteCarousel === 'function') {
        window.initRentalCatalogInfiniteCarousel();
    }
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            if (typeof window.mdjRentalCatalogInfiniteApply === 'function') {
                window.mdjRentalCatalogInfiniteApply();
            }
        });
    });
    if (typeof window.initRentalCatalogDragClickGuard === 'function') {
        window.initRentalCatalogDragClickGuard();
    }
};

/**
 * Catálogo rental-dynamic-modal (todas las categorías): scroll + clones infinitos, mismo ADN que hub de talento.
 */
window.mdjTeardownRentalCatalogCarousel = function () {
    const track = document.querySelector('#rental-dynamic-modal .mdj-rental-catalog-carousel');
    if (!track) return;
    track.querySelectorAll('.mdj-rental-carousel-clone').forEach((n) => n.remove());
    track.classList.remove('mdj-rental-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '';
    delete track._mdjInfiniteSetWidth;
    if (track._mdjInfiniteScrollHandler) {
        track.removeEventListener('scroll', track._mdjInfiniteScrollHandler);
        delete track._mdjInfiniteScrollHandler;
    }
    if (track._mdjInfiniteResizeHandler) {
        window.removeEventListener('resize', track._mdjInfiniteResizeHandler);
        delete track._mdjInfiniteResizeHandler;
    }
};

window.mdjRentalCatalogInfiniteApply = function () {
    const track = document.querySelector('#rental-dynamic-modal .mdj-rental-catalog-carousel');
    if (!track || track.dataset.mdjInfiniteCarousel !== '1') {
        if (track) track.scrollLeft = 0;
        return;
    }
    const originals = Array.from(track.querySelectorAll(':scope > .product-card:not(.mdj-rental-carousel-clone)'));
    const n = originals.length;
    if (n < 2) {
        track.scrollLeft = 0;
        return;
    }
    const firstO = originals[0];
    const lastO = originals[n - 1];
    let sw = Math.round(lastO.offsetLeft + lastO.offsetWidth - firstO.offsetLeft);
    if (!sw || sw < 10) {
        const tri = Math.round(track.scrollWidth / 3);
        if (tri > 10) sw = tri;
    }
    if (!sw || sw < 10) return;
    track._mdjInfiniteSetWidth = sw;
    track.scrollLeft = sw;
};

window.initRentalCatalogInfiniteCarousel = function () {
    const track = document.querySelector('#rental-dynamic-modal .mdj-rental-catalog-carousel');
    if (!track || track.dataset.mdjInfiniteCarousel === '1') return;

    const originals = Array.from(track.querySelectorAll(':scope > .product-card:not(.mdj-rental-carousel-clone)'));
    const n = originals.length;
    if (n < 2) return;

    function cloneCard(el) {
        const c = el.cloneNode(true);
        c.classList.add('mdj-rental-carousel-clone');
        c.removeAttribute('id');
        c.setAttribute('tabindex', '-1');
        c.setAttribute('aria-hidden', 'true');
        return c;
    }

    const fragBefore = document.createDocumentFragment();
    originals.forEach((el) => fragBefore.appendChild(cloneCard(el)));
    track.insertBefore(fragBefore, track.firstChild);
    originals.forEach((el) => track.appendChild(cloneCard(el)));

    track.classList.add('mdj-rental-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '1';

    let jumping = false;
    track._mdjInfiniteScrollHandler = function () {
        if (jumping) return;
        const sw = track._mdjInfiniteSetWidth;
        if (!sw) return;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0) return;
        const buf = 8;
        if (track.scrollLeft <= buf) {
            jumping = true;
            track.scrollLeft += sw;
            requestAnimationFrame(function () { jumping = false; });
        } else if (track.scrollLeft >= max - buf) {
            jumping = true;
            track.scrollLeft -= sw;
            requestAnimationFrame(function () { jumping = false; });
        }
    };
    track.addEventListener('scroll', track._mdjInfiniteScrollHandler, { passive: true });

    let resizeT = null;
    track._mdjInfiniteResizeHandler = function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(function () {
            if (typeof window.mdjRentalCatalogInfiniteApply === 'function') {
                window.mdjRentalCatalogInfiniteApply();
            }
        }, 120);
    };
    window.addEventListener('resize', track._mdjInfiniteResizeHandler, { passive: true });
};

/** Evita click en tarjetas cuando el usuario estaba arrastrando el carrusel (igual que hub de talento). */
window.initRentalCatalogDragClickGuard = function () {
    const carousel = document.querySelector('#rental-dynamic-modal .mdj-rental-catalog-carousel');
    if (!carousel || carousel.dataset.mdjDragClickGuard === '1') return;
    carousel.dataset.mdjDragClickGuard = '1';

    let originX = 0;
    let originY = 0;
    let pointerDown = false;
    let moved = false;
    let scrollAtPointerDown = 0;
    const MOVE_PX = 5;

    carousel.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        pointerDown = true;
        moved = false;
        originX = e.clientX;
        originY = e.clientY;
        scrollAtPointerDown = carousel.scrollLeft;
    }, true);

    carousel.addEventListener('pointermove', (e) => {
        if (!pointerDown) return;
        if (Math.abs(e.clientX - originX) >= MOVE_PX || Math.abs(e.clientY - originY) >= MOVE_PX) {
            moved = true;
        }
    }, { passive: true });

    carousel.addEventListener('scroll', () => {
        if (pointerDown) moved = true;
    }, { passive: true });

    const endPointer = () => {
        pointerDown = false;
    };
    carousel.addEventListener('pointerup', endPointer);
    carousel.addEventListener('pointercancel', endPointer);

    carousel.addEventListener('click', (e) => {
        const scrolled = carousel.scrollLeft !== scrollAtPointerDown;
        if (!moved && !scrolled) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moved = false;
    }, true);
};

/**
 * Carrusel horizontal infinito genérico para tiras de tarjetas `.talent-cat-card` (Staff, Payasos, MC, Hora Loca, roster DJ/músicos, etc.).
 * Mismo ADN que Iluminación / FX / catálogo rental: clones + salto en bordes; `n >= 2` tarjetas originales.
 */
window.mdjRentalsTeardownHorizontalInfiniteStrip = function (track, cloneClass, infiniteClass) {
    if (!track) return;
    infiniteClass = infiniteClass || 'mdj-rentals-horizontal-infinite';
    track.querySelectorAll('.' + cloneClass).forEach(function (n) { n.remove(); });
    track.classList.remove(infiniteClass);
    track.dataset.mdjInfiniteCarousel = '';
    delete track._mdjInfiniteSetWidth;
    if (track._mdjInfiniteScrollHandler) {
        track.removeEventListener('scroll', track._mdjInfiniteScrollHandler);
        delete track._mdjInfiniteScrollHandler;
    }
    if (track._mdjInfiniteResizeHandler) {
        window.removeEventListener('resize', track._mdjInfiniteResizeHandler);
        delete track._mdjInfiniteResizeHandler;
    }
};

window.mdjRentalsApplyHorizontalInfiniteStrip = function (track, cloneClass) {
    if (!track || track.dataset.mdjInfiniteCarousel !== '1') {
        if (track) track.scrollLeft = 0;
        return;
    }
    const sel = ':scope > .talent-cat-card:not(.' + cloneClass + ')';
    const originals = Array.from(track.querySelectorAll(sel));
    const n = originals.length;
    if (n < 2) {
        track.scrollLeft = 0;
        return;
    }
    const firstO = originals[0];
    const lastO = originals[n - 1];
    let sw = Math.round(lastO.offsetLeft + lastO.offsetWidth - firstO.offsetLeft);
    if (!sw || sw < 10) {
        const tri = Math.round(track.scrollWidth / 3);
        if (tri > 10) sw = tri;
    }
    if (!sw || sw < 10) return;
    track._mdjInfiniteSetWidth = sw;
    track.scrollLeft = sw;
};

window.mdjRentalsInitHorizontalInfiniteStrip = function (track, cloneClass, infiniteClass) {
    infiniteClass = infiniteClass || 'mdj-rentals-horizontal-infinite';
    if (!track || track.dataset.mdjInfiniteCarousel === '1') return;

    const sel = ':scope > .talent-cat-card:not(.' + cloneClass + ')';
    const originals = Array.from(track.querySelectorAll(sel));
    const n = originals.length;
    if (n < 2) return;

    function cloneCard(el) {
        const c = el.cloneNode(true);
        c.classList.add(cloneClass);
        c.classList.remove('active');
        c.removeAttribute('id');
        c.setAttribute('tabindex', '-1');
        c.setAttribute('aria-hidden', 'true');
        return c;
    }

    const fragBefore = document.createDocumentFragment();
    originals.forEach(function (el) { fragBefore.appendChild(cloneCard(el)); });
    track.insertBefore(fragBefore, track.firstChild);
    originals.forEach(function (el) { track.appendChild(cloneCard(el)); });

    track.classList.add(infiniteClass);
    track.dataset.mdjInfiniteCarousel = '1';

    let jumping = false;
    track._mdjInfiniteScrollHandler = function () {
        if (jumping) return;
        const sw = track._mdjInfiniteSetWidth;
        if (!sw) return;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0) return;
        const buf = 8;
        if (track.scrollLeft <= buf) {
            jumping = true;
            track.scrollLeft += sw;
            requestAnimationFrame(function () { jumping = false; });
        } else if (track.scrollLeft >= max - buf) {
            jumping = true;
            track.scrollLeft -= sw;
            requestAnimationFrame(function () { jumping = false; });
        }
    };
    track.addEventListener('scroll', track._mdjInfiniteScrollHandler, { passive: true });

    let resizeT = null;
    const cc = cloneClass;
    track._mdjInfiniteResizeHandler = function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(function () {
            if (typeof window.mdjRentalsApplyHorizontalInfiniteStrip === 'function') {
                window.mdjRentalsApplyHorizontalInfiniteStrip(track, cc);
            }
        }, 120);
    };
    window.addEventListener('resize', track._mdjInfiniteResizeHandler, { passive: true });
};

/** Monta carrusel infinito + doble rAF para medir anchos (tras pintar). */
window.mdjRentalsTryMountTalentStripInfinite = function (trackOrId, cloneClass) {
    const track = typeof trackOrId === 'string' ? document.getElementById(trackOrId) : trackOrId;
    if (!track) return;
    const infiniteClass = 'mdj-rentals-horizontal-infinite';
    if (typeof window.mdjRentalsInitHorizontalInfiniteStrip === 'function') {
        window.mdjRentalsInitHorizontalInfiniteStrip(track, cloneClass, infiniteClass);
    }
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            if (typeof window.mdjRentalsApplyHorizontalInfiniteStrip === 'function') {
                window.mdjRentalsApplyHorizontalInfiniteStrip(track, cloneClass);
            }
        });
    });
};

/**
 * Tras abrir un modal, el layout ya tiene ancho real: vuelve a medir el salto del carrusel infinito
 * (en carga inicial el modal suele estar oculto y el primer apply puede fallar).
 */
window.mdjRentalsRestripInfiniteAfterModalShow = function (modalId) {
    const map = {
        'staff-modal': ['staff-roster-grid', 'mdj-staff-carousel-clone'],
        'payasos-modal': ['payasos-roster-grid', 'mdj-payasos-carousel-clone'],
        'mc-modal': ['mc-roster-scroll', 'mdj-mc-carousel-clone'],
        'horaloca-modal': ['horaloca-grid', 'mdj-horaloca-carousel-clone'],
        'roster-modal': ['roster-grid', 'mdj-roster-hero-carousel-clone'],
        'dj-modal': ['dj-roster-grid', 'mdj-dj-roster-carousel-clone']
    };
    const cfg = map[modalId];
    if (!cfg || typeof window.mdjRentalsApplyHorizontalInfiniteStrip !== 'function') return;
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            const el = document.getElementById(cfg[0]);
            if (el) window.mdjRentalsApplyHorizontalInfiniteStrip(el, cfg[1]);
        });
    });
};

/** Misma lógica que candado drag→click de lighting/fx/rental (un listener por pista). */
window.mdjRentalsInitStripDragClickGuard = function (track) {
    if (!track || track.dataset.mdjDragClickGuard === '1') return;
    track.dataset.mdjDragClickGuard = '1';

    let originX = 0;
    let originY = 0;
    let pointerDown = false;
    let moved = false;
    let scrollAtPointerDown = 0;
    const MOVE_PX = 5;

    track.addEventListener('pointerdown', function (e) {
        if (e.button != null && e.button !== 0) return;
        pointerDown = true;
        moved = false;
        originX = e.clientX;
        originY = e.clientY;
        scrollAtPointerDown = track.scrollLeft;
    }, true);

    track.addEventListener('pointermove', function (e) {
        if (!pointerDown) return;
        if (Math.abs(e.clientX - originX) >= MOVE_PX || Math.abs(e.clientY - originY) >= MOVE_PX) {
            moved = true;
        }
    }, { passive: true });

    track.addEventListener('scroll', function () {
        if (pointerDown) moved = true;
    }, { passive: true });

    const endPointer = function () {
        pointerDown = false;
    };
    track.addEventListener('pointerup', endPointer);
    track.addEventListener('pointercancel', endPointer);

    track.addEventListener('click', function (e) {
        const scrolled = track.scrollLeft !== scrollAtPointerDown;
        if (!moved && !scrolled) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moved = false;
    }, true);
};

/**
 * Iluminación & Pantallas LED (#lighting-modal): mismo carrusel infinito que hub de talento.
 */
window.mdjTeardownLightingCarousel = function () {
    const track = document.querySelector('#lighting-modal #lighting-roster-grid');
    if (!track) return;
    track.querySelectorAll('.mdj-lighting-carousel-clone').forEach((n) => n.remove());
    track.classList.remove('mdj-lighting-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '';
    delete track._mdjInfiniteSetWidth;
    if (track._mdjInfiniteScrollHandler) {
        track.removeEventListener('scroll', track._mdjInfiniteScrollHandler);
        delete track._mdjInfiniteScrollHandler;
    }
    if (track._mdjInfiniteResizeHandler) {
        window.removeEventListener('resize', track._mdjInfiniteResizeHandler);
        delete track._mdjInfiniteResizeHandler;
    }
};

window.mdjLightingInfiniteApply = function () {
    const track = document.querySelector('#lighting-modal #lighting-roster-grid');
    if (!track || track.dataset.mdjInfiniteCarousel !== '1') {
        if (track) track.scrollLeft = 0;
        return;
    }
    const originals = Array.from(track.querySelectorAll(':scope > .talent-cat-card:not(.mdj-lighting-carousel-clone)'));
    const n = originals.length;
    if (n < 2) {
        track.scrollLeft = 0;
        return;
    }
    const firstO = originals[0];
    const lastO = originals[n - 1];
    let sw = Math.round(lastO.offsetLeft + lastO.offsetWidth - firstO.offsetLeft);
    if (!sw || sw < 10) {
        const tri = Math.round(track.scrollWidth / 3);
        if (tri > 10) sw = tri;
    }
    if (!sw || sw < 10) return;
    track._mdjInfiniteSetWidth = sw;
    track.scrollLeft = sw;
};

window.initLightingInfiniteCarousel = function () {
    const track = document.querySelector('#lighting-modal #lighting-roster-grid');
    if (!track || track.dataset.mdjInfiniteCarousel === '1') return;

    const originals = Array.from(track.querySelectorAll(':scope > .talent-cat-card:not(.mdj-lighting-carousel-clone)'));
    const n = originals.length;
    if (n < 2) return;

    function cloneCard(el) {
        const c = el.cloneNode(true);
        c.classList.add('mdj-lighting-carousel-clone');
        c.classList.remove('active');
        c.removeAttribute('id');
        c.setAttribute('tabindex', '-1');
        c.setAttribute('aria-hidden', 'true');
        return c;
    }

    const fragBefore = document.createDocumentFragment();
    originals.forEach((el) => fragBefore.appendChild(cloneCard(el)));
    track.insertBefore(fragBefore, track.firstChild);
    originals.forEach((el) => track.appendChild(cloneCard(el)));

    track.classList.add('mdj-lighting-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '1';

    let jumping = false;
    track._mdjInfiniteScrollHandler = function () {
        if (jumping) return;
        const sw = track._mdjInfiniteSetWidth;
        if (!sw) return;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0) return;
        const buf = 8;
        if (track.scrollLeft <= buf) {
            jumping = true;
            track.scrollLeft += sw;
            requestAnimationFrame(function () { jumping = false; });
        } else if (track.scrollLeft >= max - buf) {
            jumping = true;
            track.scrollLeft -= sw;
            requestAnimationFrame(function () { jumping = false; });
        }
    };
    track.addEventListener('scroll', track._mdjInfiniteScrollHandler, { passive: true });

    let resizeT = null;
    track._mdjInfiniteResizeHandler = function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(function () {
            if (typeof window.mdjLightingInfiniteApply === 'function') {
                window.mdjLightingInfiniteApply();
            }
        }, 120);
    };
    window.addEventListener('resize', track._mdjInfiniteResizeHandler, { passive: true });
};

window.initLightingDragClickGuard = function () {
    const carousel = document.querySelector('#lighting-modal #lighting-roster-grid');
    if (!carousel || carousel.dataset.mdjDragClickGuard === '1') return;
    carousel.dataset.mdjDragClickGuard = '1';

    let originX = 0;
    let originY = 0;
    let pointerDown = false;
    let moved = false;
    let scrollAtPointerDown = 0;
    const MOVE_PX = 5;

    carousel.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        pointerDown = true;
        moved = false;
        originX = e.clientX;
        originY = e.clientY;
        scrollAtPointerDown = carousel.scrollLeft;
    }, true);

    carousel.addEventListener('pointermove', (e) => {
        if (!pointerDown) return;
        if (Math.abs(e.clientX - originX) >= MOVE_PX || Math.abs(e.clientY - originY) >= MOVE_PX) {
            moved = true;
        }
    }, { passive: true });

    carousel.addEventListener('scroll', () => {
        if (pointerDown) moved = true;
    }, { passive: true });

    const endPointer = () => {
        pointerDown = false;
    };
    carousel.addEventListener('pointerup', endPointer);
    carousel.addEventListener('pointercancel', endPointer);

    carousel.addEventListener('click', (e) => {
        const scrolled = carousel.scrollLeft !== scrollAtPointerDown;
        if (!moved && !scrolled) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moved = false;
    }, true);
};

/** Efectos Especiales (#fx-modal): carrusel horizontal + infinito (mismo ADN que Iluminación / hub talento). */
window.mdjTeardownFxCarousel = function () {
    const track = document.querySelector('#fx-modal #fx-roster-grid');
    if (!track) return;
    track.querySelectorAll('.mdj-fx-carousel-clone').forEach((n) => n.remove());
    track.classList.remove('mdj-fx-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '';
    delete track._mdjInfiniteSetWidth;
    if (track._mdjInfiniteScrollHandler) {
        track.removeEventListener('scroll', track._mdjInfiniteScrollHandler);
        delete track._mdjInfiniteScrollHandler;
    }
    if (track._mdjInfiniteResizeHandler) {
        window.removeEventListener('resize', track._mdjInfiniteResizeHandler);
        delete track._mdjInfiniteResizeHandler;
    }
};

window.mdjFxInfiniteApply = function () {
    const track = document.querySelector('#fx-modal #fx-roster-grid');
    if (!track || track.dataset.mdjInfiniteCarousel !== '1') {
        if (track) track.scrollLeft = 0;
        return;
    }
    const originals = Array.from(track.querySelectorAll(':scope > .talent-cat-card:not(.mdj-fx-carousel-clone)'));
    const n = originals.length;
    if (n < 2) {
        track.scrollLeft = 0;
        return;
    }
    const firstO = originals[0];
    const lastO = originals[n - 1];
    let sw = Math.round(lastO.offsetLeft + lastO.offsetWidth - firstO.offsetLeft);
    if (!sw || sw < 10) {
        const tri = Math.round(track.scrollWidth / 3);
        if (tri > 10) sw = tri;
    }
    if (!sw || sw < 10) return;
    track._mdjInfiniteSetWidth = sw;
    track.scrollLeft = sw;
};

window.initFxInfiniteCarousel = function () {
    const track = document.querySelector('#fx-modal #fx-roster-grid');
    if (!track || track.dataset.mdjInfiniteCarousel === '1') return;

    const originals = Array.from(track.querySelectorAll(':scope > .talent-cat-card:not(.mdj-fx-carousel-clone)'));
    const n = originals.length;
    if (n < 2) return;

    function cloneCard(el) {
        const c = el.cloneNode(true);
        c.classList.add('mdj-fx-carousel-clone');
        c.classList.remove('active');
        c.removeAttribute('id');
        c.setAttribute('tabindex', '-1');
        c.setAttribute('aria-hidden', 'true');
        return c;
    }

    const fragBefore = document.createDocumentFragment();
    originals.forEach((el) => fragBefore.appendChild(cloneCard(el)));
    track.insertBefore(fragBefore, track.firstChild);
    originals.forEach((el) => track.appendChild(cloneCard(el)));

    track.classList.add('mdj-fx-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '1';

    let jumping = false;
    track._mdjInfiniteScrollHandler = function () {
        if (jumping) return;
        const sw = track._mdjInfiniteSetWidth;
        if (!sw) return;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0) return;
        const buf = 8;
        if (track.scrollLeft <= buf) {
            jumping = true;
            track.scrollLeft += sw;
            requestAnimationFrame(function () { jumping = false; });
        } else if (track.scrollLeft >= max - buf) {
            jumping = true;
            track.scrollLeft -= sw;
            requestAnimationFrame(function () { jumping = false; });
        }
    };
    track.addEventListener('scroll', track._mdjInfiniteScrollHandler, { passive: true });

    let resizeT = null;
    track._mdjInfiniteResizeHandler = function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(function () {
            if (typeof window.mdjFxInfiniteApply === 'function') {
                window.mdjFxInfiniteApply();
            }
        }, 120);
    };
    window.addEventListener('resize', track._mdjInfiniteResizeHandler, { passive: true });
};

window.initFxDragClickGuard = function () {
    const carousel = document.querySelector('#fx-modal #fx-roster-grid');
    if (!carousel || carousel.dataset.mdjDragClickGuard === '1') return;
    carousel.dataset.mdjDragClickGuard = '1';

    let originX = 0;
    let originY = 0;
    let pointerDown = false;
    let moved = false;
    let scrollAtPointerDown = 0;
    const MOVE_PX = 5;

    carousel.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        pointerDown = true;
        moved = false;
        originX = e.clientX;
        originY = e.clientY;
        scrollAtPointerDown = carousel.scrollLeft;
    }, true);

    carousel.addEventListener('pointermove', (e) => {
        if (!pointerDown) return;
        if (Math.abs(e.clientX - originX) >= MOVE_PX || Math.abs(e.clientY - originY) >= MOVE_PX) {
            moved = true;
        }
    }, { passive: true });

    carousel.addEventListener('scroll', () => {
        if (pointerDown) moved = true;
    }, { passive: true });

    const endPointer = () => {
        pointerDown = false;
    };
    carousel.addEventListener('pointerup', endPointer);
    carousel.addEventListener('pointercancel', endPointer);

    carousel.addEventListener('click', (e) => {
        const scrolled = carousel.scrollLeft !== scrollAtPointerDown;
        if (!moved && !scrolled) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moved = false;
    }, true);
};

window.selectedPackage = [];
/** Categorías del hub (DJ, MC, etc.) marcadas para intención de presupuesto — independiente de líneas con precio en selectedPackage */
window.selectedTalent = [];

window.togglePackageItem = (id, name, price) => {
    const el = document.getElementById('toggle-' + id);
    const isChecked = el ? el.checked : true;

    if (isChecked) {
        if (!window.selectedPackage.find(item => item.id === id)) {
            // Determinar la categoría basándonos en el ID para el agrupamiento en el carrito
            let cat = 'general';
            if (id.startsWith('dj_')) cat = 'dj';
            else if (id.startsWith('hl_') || id.startsWith('hora_loca')) cat = 'horaloca';
            else if (id.startsWith('live_')) cat = 'live';
            else if (id.startsWith('visuals_') || id.startsWith('vis_')) cat = 'visuals';
            else if (id.startsWith('mc_')) cat = 'mc';
            else if (id.startsWith('staff_')) cat = 'staff';
            else if (id.startsWith('payaso_')) cat = 'payaso';
            else if (id.startsWith('fx_')) cat = 'fx';
            else if (id.startsWith('lighting_')) cat = 'lighting';
            
            window.selectedPackage.push({ 
                id, 
                name, 
                price,
                category: cat,
                type: 'rental'
            });
        }
    } else {
        window.selectedPackage = window.selectedPackage.filter(item => item.id !== id);
    }
    if (window.MDJ_EVENT_BUILDER_V1 && typeof window.mdjRentalsSyncTogglePack === 'function') {
        window.mdjRentalsSyncTogglePack({ id: id, name: name, price: price, added: !!isChecked });
    }
    window.updatePackageSummary();
};

window.updatePackageSummary = () => {
    const summaries = document.querySelectorAll('.package-summary-bar');
    if (!summaries || summaries.length === 0) return;

    let total = 0;
    let itemsHtml = "";

    window.selectedPackage.forEach(item => {
        const lineTotal = item.quantity ? (item.price * item.quantity) : item.price;
        total += lineTotal;

        if (item.quantity && item.quantity > 0) {
            itemsHtml += `<div style="margin-bottom: 4px;">✔ ${item.name} (x${item.quantity}) — $${lineTotal}.00</div>`;
        } else {
            itemsHtml += `<div style="margin-bottom: 4px;">✔ ${item.name} — $${lineTotal}.00</div>`;
        }
    });

    const count = window.selectedPackage.length;

    summaries.forEach(bar => {
        if (count > 0) {
            if (bar.style.display === 'none' || bar.style.display === '') {
                bar.classList.remove('package-entrance-anim');
                void bar.offsetWidth;
                bar.classList.add('package-entrance-anim');
            }
            bar.style.display = 'flex';

            const nameEl = bar.querySelector('.package-item-name');
            if (nameEl) {
                nameEl.innerHTML = `<div style="display: flex; flex-direction: column;">${itemsHtml}</div>`;
            }

            const totalEl = bar.querySelector('.package-total');
            if (totalEl) {
                totalEl.textContent = `Total: $${total}.00`;
            }
        } else {
            bar.style.display = 'none';
        }
    });
};

window.premiumTransition = (outId, inId, callback) => {
    const outModal = document.getElementById(outId);
    if (!outModal) return;

    outModal.classList.add('modal-fade-out');

    setTimeout(() => {
        outModal.classList.remove('modal-visible', 'modal-fade-out');
        outModal.classList.add('modal-hidden');

        if (callback) callback();

        const inModal = inId ? document.getElementById(inId) : null;
        if (inModal) {
            inModal.classList.remove('modal-hidden');
            inModal.classList.add('modal-visible', 'modal-fade-in');
            document.body.classList.add('body-modal-lock');

            if (inId && typeof window.mdjRentalsRestripInfiniteAfterModalShow === 'function') {
                window.mdjRentalsRestripInfiniteAfterModalShow(inId);
            }

            setTimeout(() => {
                inModal.classList.remove('modal-fade-in');
            }, 600);

            if (inId === 'talent-selector-modal') {
                if (typeof window.mdjEnsureTalentHubInfiniteOnOpen === 'function') {
                    window.mdjEnsureTalentHubInfiniteOnOpen();
                } else if (typeof window.mdjResetTalentSelectorCarousel === 'function') {
                    requestAnimationFrame(() => window.mdjResetTalentSelectorCarousel());
                }
            }
        } else {
            document.body.classList.remove('body-modal-lock');
        }

        if (window.i18n) window.i18n.updateUI();
        if (inId === 'talent-selector-modal' && typeof window.mdjSyncTalentSelectorCopy === 'function') {
            window.mdjSyncTalentSelectorCopy();
        }
    }, 400);
};

// ── BOOKING & CHECKOUT GLOBALS ──
window.closeCheckoutModal = function() {
    const m = document.getElementById('dj-checkout-modal');
    if(m) {
        m.classList.add('modal-hidden');
        document.getElementById('checkout-step-1').style.display = 'block';
        document.getElementById('checkout-step-2').style.display = 'none';
        const form = document.getElementById('checkout-discovery-form');
        if(form) form.reset();
    }
};

window.checkoutNextStep = function() {
    const form = document.getElementById('checkout-discovery-form');
    if(form && !form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Copy Validated Payload
    const dateInput = document.getElementById('chk-date');
    const cityInput = document.getElementById('chk-city');
    const nameInput = document.getElementById('chk-name');
    const emailInput = document.getElementById('chk-email');
    const phoneInput = document.getElementById('chk-phone');
    const hoursInput = document.getElementById('chk-hours');

    if(dateInput && cityInput) {
        document.getElementById('inv-date-display').innerText = dateInput.value || 'TBD';
        document.getElementById('inv-city-display').innerText = cityInput.value || 'TBD';
    }
    document.getElementById('inv-client-name').innerText = nameInput ? nameInput.value : 'Guest Client';
    document.getElementById('inv-client-email').innerText = emailInput ? emailInput.value : '';
    document.getElementById('inv-client-phone').innerText = phoneInput ? phoneInput.value : '';
    document.getElementById('inv-hours-display').innerText = hoursInput ? hoursInput.value : '4';
    
    // Calculate Cart & Grouping
    let subtotal = 0;
    
    let summaryHtml = '';
    let detailedHtml = '';

    if(window.selectedPackage && window.selectedPackage.length > 0) {
        // --- 1. Calcular Totales Agrupados ---
        let groups = {
            'DJ / Performance Talent': 0,
            'Hora Loca Experience': 0,
            'Músicos en Vivo': 0,
            'Captura y Visuales': 0,
            'MC y Presentadores': 0,
            'Staff (Eventos)': 0,
            'Payasos': 0,
            'Special Effects (FX)': 0,
            'Lighting & LED Screens': 0,
            'Staging & Trusses': 0,
            'Furniture & Tents': 0,
            'Audio & Sound Systems': 0,
            'General Rentals': 0
        };

        window.selectedPackage.forEach(item => {
            const lineTotal = item.total || (item.price * (item.quantity || 1));
            subtotal += lineTotal;

            // Map Category to Group
            let cat = item.category || 'general';
            if (cat === 'dj' || item.id.startsWith('dj_')) groups['DJ / Performance Talent'] += lineTotal;
            else if (cat === 'horaloca' || cat.includes('hl_') || item.id.startsWith('hl_') || item.id.startsWith('hora_loca')) groups['Hora Loca Experience'] += lineTotal;
            else if (cat === 'live' || cat === 'musicians' || item.id.startsWith('live_')) groups['Músicos en Vivo'] += lineTotal;
            else if (cat === 'visuals' || cat === 'photo-booth' || item.id.startsWith('visuals_') || item.id.startsWith('vis_')) groups['Captura y Visuales'] += lineTotal;
            else if (cat.includes('mc') || item.id.startsWith('mc_')) groups['MC y Presentadores'] += lineTotal;
            else if (cat === 'staff' || cat === 'bartender' || cat === 'mesero' || item.id.startsWith('staff_')) groups['Staff (Eventos)'] += lineTotal;
            else if (cat === 'payaso' || cat === 'clown' || item.id.startsWith('payaso_')) groups['Payasos'] += lineTotal;
            else if (cat === 'fx' || cat === 'special-effects' || item.id.startsWith('fx_')) groups['Special Effects (FX)'] += lineTotal;
            else if (cat === 'lighting' || item.id.startsWith('light_') || item.id.startsWith('led_')) groups['Lighting & LED Screens'] += lineTotal;
            else if (cat === 'stages' || cat === 'truss' || item.id.startsWith('stage_') || item.id.startsWith('truss_')) groups['Staging & Trusses'] += lineTotal;
            else if (cat === 'furniture' || cat === 'tents' || item.id.startsWith('f_') || item.id.startsWith('tent_') || item.id.startsWith('castle_')) groups['Furniture & Tents'] += lineTotal;
            else if (cat === 'audio' || item.id.startsWith('pa_') || item.id === 'wireless_mic' || item.id === 'audio_mixer') groups['Audio & Sound Systems'] += lineTotal;
            else groups['General Rentals'] += lineTotal;

            // --- 2. Build Detailed Page 2 (Line by Line) ---
            detailedHtml += `
            <tr>
                <td style="padding: 12px 15px; border: 1px solid #ebebeb; font-size: 11px; text-align: center;">${item.quantity || 1}</td>
                <td style="padding: 12px 15px; border: 1px solid #ebebeb; font-size: 12px; font-weight: 600; color: #111;">${item.name}</td>
                <td style="padding: 12px 15px; border: 1px solid #ebebeb; font-size: 13px; text-align: right; color: #555;">$${lineTotal.toFixed(2)}</td>
            </tr>`;
        });

        // --- 3. Build Summary Page 1 ---
        for (const [groupName, groupTotal] of Object.entries(groups)) {
            if (groupTotal > 0) {
                summaryHtml += `
                <tr>
                    <td style="padding: 15px; border: 1px solid #ebebeb; font-size: 13px; font-weight: 700; color: #111;">${groupName}</td>
                    <td style="padding: 15px; border: 1px solid #ebebeb; font-size: 14px; font-weight: 600; text-align: right; color: #000;">$${groupTotal.toFixed(2)}</td>
                </tr>`;
            }
        }
        
    } else {
        // Fallback for empty/isolated testing
        subtotal = 0;
        summaryHtml = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #888;">No items in cart</td></tr>`;
        detailedHtml = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #888;">No items matched</td></tr>`;
    }
    
    // Inject HTML
    const sumTb = document.getElementById('inv-summary-body');
    if (sumTb) sumTb.innerHTML = summaryHtml;
    
    const detTb = document.getElementById('inv-detailed-body');
    if (detTb) detTb.innerHTML = detailedHtml;

    document.getElementById('inv-subtotal').innerText = '$' + subtotal.toFixed(2);
    document.getElementById('inv-deposit').innerText = '$' + (subtotal * 0.3).toFixed(2);
    document.getElementById('inv-balance').innerText = '$' + subtotal.toFixed(2);
    
    // Advance Visual State
    document.getElementById('checkout-step-1').style.display = 'none';
    document.getElementById('checkout-step-2').style.display = 'block';
};

window.checkoutPrevStep = function() {
    document.getElementById('checkout-step-2').style.display = 'none';
    document.getElementById('checkout-step-1').style.display = 'block';
};

window.checkoutSubmit = async function() {
    const btn = document.getElementById('chk-reserve-btn');
    if(btn) {
        btn.innerText = "Processing...";
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }
    
    // Package Cart & Leads Payload
    const leadData = {
        name: document.getElementById('chk-name').value,
        email: document.getElementById('chk-email').value,
        phone: document.getElementById('chk-phone').value,
        date: document.getElementById('chk-date').value,
        city: document.getElementById('chk-city').value,
        hours: document.getElementById('chk-hours').value,
        type: document.getElementById('chk-type').value,
        cart: window.selectedPackage || []
    };
    
    sessionStorage.setItem('mdjpro_checkout_cart', JSON.stringify(leadData));

    var subtotal = 0;
    (leadData.cart || []).forEach(function (item) {
        subtotal += item.total || (item.price * (item.quantity || 1));
    });

    var sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    var session = null;
    if (sb) {
        try {
            var wr = await sb.auth.getSession();
            session = wr && wr.data && wr.data.session;
        } catch (eS) { /* ignore */ }
    }

    var notesObj = {
        rental_cart: leadData.cart,
        rental_hours: leadData.hours,
        rental_subtotal_usd: subtotal,
        source_detail: 'rentals_checkout'
    };
    if (session && session.user) {
        notesObj.client_user_id = session.user.id;
    }

    var payload = {
        event_type: (leadData.type && String(leadData.type).trim()) || 'Event rental',
        event_date: leadData.date || null,
        location: leadData.city || null,
        email: leadData.email || null,
        phone: leadData.phone || null,
        contact_person: leadData.name || null,
        budget: subtotal > 0 ? String(Math.round(subtotal * 100) / 100) : null,
        status: 'NEW',
        source: 'rentals_checkout',
        notes: JSON.stringify(notesObj)
    };
    if (session && session.user) {
        payload.client_user_id = session.user.id;
        var se = session.user.email && String(session.user.email).trim();
        if (se) {
            payload.email = se.toLowerCase();
        }
    }

    if (sb && payload.email) {
        try {
            var ins = await sb.from('leads').insert([payload]).select('id').single();
            if (!ins.error && ins.data && ins.data.id) {
                try {
                    sessionStorage.removeItem('mdj_rentals_cart_backup');
                } catch (eR) { /* ignore */ }
                window.location.href = './client-portal.html?lead=' + encodeURIComponent(ins.data.id);
                return;
            }
            if (ins.error) {
                var msg = (ins.error.message || 'Could not save reservation') + '';
                if (btn) {
                    btn.innerText = btn.getAttribute('data-label-default') || 'Confirm';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
                try {
                    window.alert(msg);
                } catch (eA) { /* ignore */ }
                return;
            }
        } catch (eIns) {
            void eIns;
            if (btn) {
                btn.innerText = btn.getAttribute('data-label-default') || 'Confirm';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
            return;
        }
    }

    setTimeout(function () {
        if (btn) {
            btn.innerText = btn.getAttribute('data-label-default') || 'Confirm';
            btn.disabled = false;
            btn.style.opacity = '1';
        }
        window.location.href = 'index.html#contact';
    }, 800);
};

document.addEventListener('click', async (e) => {
    /* Hub talent selector: checkbox/label must not bubble to [data-action] on the parent card. */
    if (e.target.closest && e.target.closest('#talent-selector-modal .mdj-talent-hub-pick')) {
        return;
    }
    const packCard = e.target.closest('[data-action="select-hl-package"]');
    if (packCard) {
        window.updateHoraLocaHero(packCard.getAttribute('data-id'));
        return;
    }
    // OPEN CONTACT (Lead Route Direct)
    if (e.target.closest('[data-action="open-contact"]')) {
        e.preventDefault();
        window.location.href = 'index.html#contact';
        return;
    }

    // 0. GO HOME (Escape Raíz)
    if (e.target.closest('[data-action="go-home"]')) {
        window.location.href = 'index.html';
        return;
    }

    // CHECKOUT MODAL OPEN — login at “moment of truth” (hunger flow)
    if (e.target.closest('.package-checkout-btn')) {
        e.preventDefault();
        var sbCheckout = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
        var sessCheckout = null;
        if (sbCheckout) {
            try {
                var wr = await sbCheckout.auth.getSession();
                sessCheckout = wr && wr.data && wr.data.session;
            } catch (eCh) { /* ignore */ }
        }
        if (!sessCheckout) {
            try {
                sessionStorage.setItem('mdj_rentals_cart_backup', JSON.stringify(window.selectedPackage || []));
            } catch (eBk) { /* ignore */ }
            try {
                var uLogin = new URL('./login.html', window.location.href);
                var baseNext = window.location.pathname + window.location.search;
                var sep = baseNext.indexOf('?') >= 0 ? '&' : '?';
                uLogin.searchParams.set('next', baseNext + sep + 'resume_checkout=1');
                uLogin.searchParams.set('reason', 'checkout');
                window.location.href = uLogin.toString();
            } catch (eUrl) {
                window.location.href = './login.html?reason=checkout';
            }
            return;
        }
        if (window.selectedPackage && window.selectedPackage.length > 0) {
            const chkModal = document.getElementById('dj-checkout-modal');
            if(chkModal) {
                chkModal.classList.remove('modal-hidden');
            }
        } else {
             alert(window.t ? window.t('msg_empty_cart', 'Please select at least one package.') : 'Please select at least one package.');
        }
        return;
    }

    // 1. HARD CLOSE (Purga Universal)
    const liveTab = e.target.closest("[data-live-tab]");
    if (liveTab) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const tabKey = liveTab.getAttribute("data-live-tab");
        window.renderLiveHero(tabKey, true);
        return;
    }

    const liveCta = e.target.closest('[data-action="hero-add-live"]');
    if (liveCta) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const id = liveCta.getAttribute("data-id");
        const name = liveCta.getAttribute("data-name");
        const price = parseFloat(liveCta.getAttribute("data-price") || "0");

        const isSelected = window.selectedPackage.some(p => p.id === id);
        if (isSelected) {
            window.selectedPackage = window.selectedPackage.filter(item => item.id !== id);
        } else {
            window.selectedPackage.push({ 
                id, 
                name, 
                price,
                category: 'live',
                type: 'rental'
            });
        }
        window.updatePackageSummary();
        // CTA update doesn't need animation
        window.renderLiveHero(window.activeLiveTab, false);
        return;
    }

    // GLOBAL DIRECT ACTIVATE (Vida Propia Cards)
    if (e.target.closest('[data-action="hl-activate-direct"]')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const btn = e.target.closest('button');
        const id = btn.getAttribute('data-id');

        let pack = null;
        if (window.hlPackages) pack = window.hlPackages.find(p => p.id === id);
        if (!pack && window.liveMusicTabs) pack = Object.values(window.liveMusicTabs).find(p => p.id === id);
        if (!pack && window.visualTabs) pack = Object.values(window.visualTabs).find(p => p.id === id);
        if (!pack && window.mcTabs) pack = Object.values(window.mcTabs).find(p => p.id === id);
        if (!pack && window.djTabs) pack = Object.values(window.djTabs).find(p => p.id === id);
        if (!pack && window.fxItems) pack = Object.values(window.fxItems).find(p => p.id === id);
        if (!pack && window.lightingItems) pack = Object.values(window.lightingItems).find(p => p.id === id);
        if (!pack && id === 'dj_family' && window.djTabs && window.djTabs.family) {
            pack = window.djTabs.family;
        }

        if (pack) {
            window.selectedPackage = Array.isArray(window.selectedPackage) ? window.selectedPackage : [];
            const isSelected = window.selectedPackage.some(p => p.id === id);

            if (isSelected) {
                window.selectedPackage = window.selectedPackage.filter(p => p.id !== id);
            } else {
                const nameKey = pack.nameKey || ('data_' + pack.id + '_name');
                const fallback = pack.fallbackName || pack.name || 'Premium Package';
                
                // Determinar la categoría basándonos en el ID para el agrupamiento en el carrito
                let cat = 'general';
                if (id.startsWith('dj_')) cat = 'dj';
                else if (id.startsWith('hl_') || id.startsWith('hora_loca')) cat = 'horaloca';
                else if (id.startsWith('live_')) cat = 'live';
                else if (id.startsWith('visuals_') || id.startsWith('vis_')) cat = 'visuals';
                else if (id.startsWith('mc_')) cat = 'mc';
                else if (id.startsWith('staff_')) cat = 'staff';
                else if (id.startsWith('payaso_')) cat = 'payaso';
                else if (id.startsWith('fx_')) cat = 'fx';
                else if (id.startsWith('lighting_')) cat = 'lighting';
                
                // MUTUAL EXCLUSIVITY FIX:
                // Remove existing items of the SAME category if it's a mutually exclusive category
                const exclusiveCategories = ['dj', 'live', 'mc', 'horaloca', 'visuals'];
                if (exclusiveCategories.includes(cat)) {
                    const oldItems = window.selectedPackage.filter(p => p.category === cat);
                    oldItems.forEach(oldItem => {
                        if (window.MDJ_EVENT_BUILDER_V1 && typeof window.mdjRentalsSyncDirectActivate === 'function') {
                            window.mdjRentalsSyncDirectActivate({ pack: { id: oldItem.id }, category: cat, added: false });
                        }
                    });
                    window.selectedPackage = window.selectedPackage.filter(p => p.category !== cat);
                }
                
                window.selectedPackage.push({ 
                    id: pack.id, 
                    name: t(nameKey, fallback), 
                    price: pack.price || 0,
                    category: cat,
                    type: 'rental'
                });
            }

            window.updatePackageSummary();

            if (window.MDJ_EVENT_BUILDER_V1 && typeof window.mdjRentalsSyncDirectActivate === 'function') {
                window.mdjRentalsSyncDirectActivate({ pack: pack, category: cat, added: !isSelected });
            }

            // Re-render UI to update buttons
            if (window.renderHoraLocaCatalogue) window.renderHoraLocaCatalogue();
            if (window.renderLiveHero && window.activeCategory !== 'mc') window.renderLiveHero(window.activeLiveTabLocked || 'sax', false);
            if (window.renderDjHero) window.renderDjHero(window.activeDjTabLocked || 'weddings', false);
            if (window.renderFxHero) window.renderFxHero(window.activeFxTabLocked || 'sparks', false);
            if (window.renderLightingHero) window.renderLightingHero(window.activeLightingTabLocked || 'movingHeads', false);

            if (window.i18n) window.i18n.updateUI();
        }
        return;
    }

    if (e.target.closest('[data-action="back-from-talent-selector"]')) {
        window.premiumTransition('talent-selector-modal', null);
        return;
    }

    if (e.target.closest('[data-action="back-from-rental-dynamic"]')) {
        window.premiumTransition('rental-dynamic-modal', null);
        return;
    }

    if (e.target.closest('[data-action="close-all"]')) {
        const modals = [
            'talent-selector-modal',
            'horaloca-modal',
            'roster-modal',
            'staff-modal',
            'payasos-modal',
            'dj-modal',
            'mc-modal',
            'fx-modal',
            'lighting-modal',
            'rental-dynamic-modal'
        ];
        modals.forEach(id => {
            const m = document.getElementById(id);
            if (m && m.classList.contains('modal-visible')) {
                m.classList.add('modal-fade-out');
                setTimeout(() => {
                    m.classList.remove('modal-visible', 'modal-fade-out');
                    m.classList.add('modal-hidden');
                    document.body.classList.remove('body-modal-lock');

                    const hlIframe = document.getElementById('hl-hero-iframe');
                    if (hlIframe) hlIframe.src = '';
                    const rsIframe = document.getElementById('roster-hero-iframe');
                    if (rsIframe) rsIframe.src = '';
                }, 400);
            }
        });
        return;
    }

    // DYNAMIC RENTAL ENGINE LOGIC (Phase 6)
    if (e.target.closest('[data-action="open-rental-category"]')) {
        e.preventDefault();
        const btn = e.target.closest('a') || e.target.closest('div');
        const catId = btn.getAttribute('data-category');
        if (!catId) return;

        const modal = document.getElementById('rental-dynamic-modal');
        if (modal) {
            modal.classList.remove('modal-hidden');
            modal.classList.add('modal-visible');
            document.body.classList.add('body-modal-lock');
            window.renderRentalCatalog(catId);
        }
        return;
    }

    // INTERNAL TAB SWITCHER
    if (e.target.classList.contains('rental-tab-btn')) {
        const catId = e.target.getAttribute('data-cat');
        window.renderRentalCatalog(catId);
        return;
    }

    if (e.target.closest('[data-action="r-qty-down"]')) {
        e.preventDefault();
        const id = e.target.closest('button').getAttribute('data-id');
        if (window.rentalDraftQty[id] > 0) {
            window.rentalDraftQty[id]--;
            const valEl = document.getElementById(`qty-val-${id}`);
            if (valEl) valEl.innerText = window.rentalDraftQty[id];
        }
        return;
    }

    if (e.target.closest('[data-action="r-qty-up"]')) {
        e.preventDefault();
        const id = e.target.closest('button').getAttribute('data-id');
        window.rentalDraftQty[id]++;
        const valEl = document.getElementById(`qty-val-${id}`);
        if (valEl) valEl.innerText = window.rentalDraftQty[id];
        return;
    }

    if (e.target.closest('[data-action="r-add-cart"]')) {
        e.preventDefault();
        const btn = e.target.closest('button');
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const unitPrice = parseFloat(btn.getAttribute('data-price'));
        let qty = window.rentalDraftQty[id] || 0;

        const isCurrentlyAdded = window.selectedPackage.some(p => p.id === id);
        const category = btn.getAttribute('data-category');
        const isTalent = category === 'talent';

        if (isCurrentlyAdded) {
            window.selectedPackage = window.selectedPackage.filter(p => p.id !== id);
            btn.className = 'cta';
            btn.innerText = isTalent ? 'RESERVAR' : 'ADD';
            window.rentalDraftQty[id] = 0;
            const valEl = document.getElementById(`qty-val-${id}`);
            if (valEl) valEl.innerText = 0;

            // --- REVERTIR AL VIDEO BASE EN REMOVE ---
            const heroVideo = document.querySelector('#rental-multi-video-container .active-vid');
            if (heroVideo) {
                const activeCatId = heroVideo.getAttribute('data-category');
                const cat = window.rentalCatalogs[activeCatId];
                if (cat) {
                    const baseSrc = cat.bgVideo || (cat.items[0] && cat.items[0].video ? cat.items[0].video : '');
                    const source = heroVideo.querySelector('source');
                    if (source && baseSrc) {
                        source.src = mdjV(baseSrc);
                        if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(heroVideo);
                        heroVideo.load();
                        heroVideo.play().catch(() => {});
                    }
                }
            }
        } else {
            if (qty === 0) {
                qty = 1;
                window.rentalDraftQty[id] = 1;
                const valEl = document.getElementById(`qty-val-${id}`);
                if (valEl) valEl.innerText = 1;
            }
            window.selectedPackage.push({
                id: id,
                name: name,
                price: unitPrice,
                quantity: qty,
                total: unitPrice * qty,
                category: category,
                type: 'rental'
            });
            btn.className = 'cta cta-remove';
            btn.innerText = isTalent ? 'CANCELAR' : 'REMOVE';

            // --- HERO VIDEO POR ITEM (FIX DIRECTO) ---
            let item = null;
            Object.values(window.rentalCatalogs).forEach(cat => {
                const found = cat.items.find(i => i.id === id);
                if (found) item = found;
            });

            const heroVideo = document.querySelector('#rental-multi-video-container .active-vid');

            if (heroVideo && item && item.video) {
                // Cambiamos SOLO el source del video activo (no tocamos el sistema)
                const source = heroVideo.querySelector('source');

                if (source) {
                    source.src = mdjV(item.video);
                    if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(heroVideo);
                    heroVideo.load();
                    heroVideo.play().catch(() => {});
                }
            }
        }

        window.updatePackageSummary();
        return;
    }

    // 2. SOFT BACK HORA LOCA
    if (e.target.closest('[data-action="back-to-selector"]')) {
        window.premiumTransition('horaloca-modal', 'talent-selector-modal', () => {
            const hlIframe = document.getElementById('hl-hero-iframe');
            if (hlIframe) hlIframe.src = '';
        });
        return;
    }

    // 3. SOFT BACK ROSTER
    if (e.target.closest('[data-action="back-to-selector-roster"]')) {
        window.premiumTransition('roster-modal', 'talent-selector-modal', () => {
            const rsVideo = document.getElementById('live-hero-video');
            if (rsVideo) {
                rsVideo.pause();
                rsVideo.src = '';
            }
        });
        return;
    }

    // 3.2 SOFT BACK STAFF
    if (e.target.closest('[data-action="back-to-selector-staff"]')) {
        window.premiumTransition('staff-modal', 'talent-selector-modal', () => {
            const sv = document.getElementById('staff-hero-video');
            if (sv) {
                try {
                    sv.pause();
                    sv.removeAttribute('src');
                    sv.load();
                } catch (e) { /* ignore */ }
            }
        });
        return;
    }

    // 3.3 SOFT BACK PAYASOS
    if (e.target.closest('[data-action="back-to-selector-payasos"]')) {
        window.premiumTransition('payasos-modal', 'talent-selector-modal', () => {
            const pv = document.getElementById('payasos-hero-video');
            if (pv) {
                try {
                    pv.pause();
                    pv.removeAttribute('src');
                    pv.load();
                } catch (e) { /* ignore */ }
            }
        });
        return;
    }

    // 3.5 SOFT BACK MC
    if (e.target.closest('[data-action="back-to-selector-mc"]')) {
        window.premiumTransition('mc-modal', 'talent-selector-modal');
        return;
    }

    // 3.8 SOFT BACK DJ
    if (e.target.closest('[data-action="back-to-selector-dj"]')) {
        window.premiumTransition('dj-modal', 'talent-selector-modal', () => {
            const djVideo = document.getElementById('dj-hero-video');
            if (djVideo) {
                djVideo.pause();
                djVideo.src = '';
            }
        });
        return;
    }

    // 4. OPEN CATEGORIES (PRO LEVEL)
    // OPEN HORA LOCA
    if (e.target.closest('[data-action="open-horaloca"]')) {
        window.premiumTransition('talent-selector-modal', 'horaloca-modal', () => {
            if (window.hlPackages?.length && window.updateHoraLocaHero) {
                window.updateHoraLocaHero(window.hlPackages[0].id);
            }
        });
        return;
    }

    // OPEN MUSICIANS
    if (e.target.closest('[data-action="open-musicians"]')) {
        window.activeCategory = 'live';
        window.activeLiveTabLocked = 'sax';
        window.premiumTransition('talent-selector-modal', 'roster-modal', () => {
            if (window.renderLiveHero) window.renderLiveHero('sax', false);
        });
        return;
    }

    // OPEN STAFF (modal propio: hero + Bartender / Meseros / Chef — mismo ADN que Músicos en Vivo)
    if (e.target.closest('[data-action="open-staff"]')) {
        window.activeStaffTabLocked = 'bartender';
        window.premiumTransition('talent-selector-modal', 'staff-modal', () => {
            if (window.renderStaffHero) window.renderStaffHero('bartender', false);
            if (window._bindStaffGridHeroHover) window._bindStaffGridHeroHover();
        });
        return;
    }

    // OPEN PAYASOS (modal propio: hero + 4 reels — mismo ADN que Staff)
    if (e.target.closest('[data-action="open-payasos"]')) {
        window.activePayasosTabLocked = 'gif';
        window.premiumTransition('talent-selector-modal', 'payasos-modal', () => {
            if (window.renderPayasosHero) window.renderPayasosHero('gif', false);
            if (window._bindPayasosGridHeroHover) window._bindPayasosGridHeroHover();
        });
        return;
    }

    // OPEN MC
    if (e.target.closest('[data-action="open-mc"]')) {
        window.premiumTransition('talent-selector-modal', 'mc-modal');
        return;
    }

    // OPEN DJ / Performance (hub card — mismo contrato que el resto de categorías)
    if (e.target.closest('[data-action="open-dj"]')) {
        window.premiumTransition('talent-selector-modal', 'dj-modal', () => {
            if (window.renderDjHero) window.renderDjHero('weddings', false);
        });
        return;
    }

    // OPEN VISUALS
    if (e.target.closest('[data-action="open-visuals"]')) {
        window.activeCategory = 'visuals';
        window.activeVisualTabLocked = 'photo';
        window.premiumTransition('talent-selector-modal', 'roster-modal', () => {
            if (window.renderLiveHero) window.renderLiveHero('photo', false);
        });
        return;
    }

    // Booth & Magic Mirror (Rentals home tile) → Captura y Visuales, tab Photo Booth 360
    if (e.target.closest('[data-action="open-booth-visuals"]')) {
        e.preventDefault();
        window.activeCategory = 'visuals';
        window.activeVisualTabLocked = 'booth360';
        const m = document.getElementById('roster-modal');
        if (m) {
            m.classList.remove('modal-hidden');
            m.classList.add('modal-visible');
            document.body.classList.add('body-modal-lock');
            if (window.renderLiveHero) window.renderLiveHero('booth360', false);
            if (typeof window.mdjRentalsRestripInfiniteAfterModalShow === 'function') {
                window.mdjRentalsRestripInfiniteAfterModalShow('roster-modal');
            }
        }
        return;
    }

    // OPEN FX MODAL
    if (e.target.closest('[data-action="open-fx-modal"]')) {
        const m = document.getElementById('fx-modal');
        if (m) {
            m.classList.remove('modal-hidden');
            m.classList.add('modal-visible');
            document.body.classList.add('body-modal-lock');
            if (window.renderFxHero) window.renderFxHero('sparks', false);
        }
        return;
    }

    // BACK TO SELECTOR FX (vuelve al hub Talent / Entretenimiento sin cortar el flujo modal)
    if (e.target.closest('[data-action="back-to-selector-fx"]')) {
        window.premiumTransition('fx-modal', 'talent-selector-modal');
        return;
    }

    // OPEN FX (Fallback to AI Booth)
    if (e.target.closest('[data-action="open-fx"]')) {
        if (window.MDJ_Assistant) {
            if (!window.MDJ_Assistant.isOpen) window.MDJ_Assistant.toggleWindow();
            setTimeout(() => {
                const inputArea = document.querySelector('.booth-input-area input');
                if (inputArea) {
                    inputArea.value = "Me interesa agregar Efectos Especiales (Chispas, Humo, etc) a mi evento. ¿Puedes darme info?";
                    window.MDJ_Assistant.handleSendMessage();
                }
            }, 300);
        }
        return;
    }

    // OPEN LIGHTING MODAL
    if (e.target.closest('[data-action="open-lighting-modal"]')) {
        const m = document.getElementById('lighting-modal');
        if (m) {
            m.classList.remove('modal-hidden');
            m.classList.add('modal-visible');
            document.body.classList.add('body-modal-lock');
            if (window.renderLightingHero) window.renderLightingHero('movingHeads', false);
        }
        return;
    }

    // BACK TO SELECTOR LIGHTING
    if (e.target.closest('[data-action="back-to-selector-lighting"]')) {
        window.premiumTransition('lighting-modal', 'talent-selector-modal');
        return;
    }

    // OPEN LIGHTING (Fallback to AI Booth)
    if (e.target.closest('[data-action="open-lighting"]')) {
        if (window.MDJ_Assistant) {
            if (!window.MDJ_Assistant.isOpen) window.MDJ_Assistant.toggleWindow();
            setTimeout(() => {
                const inputArea = document.querySelector('.booth-input-area input');
                if (inputArea) {
                    inputArea.value = "Me interesa agregar Iluminación o Pantallas LED a mi evento. ¿Puedes darme info?";
                    window.MDJ_Assistant.handleSendMessage();
                }
            }, 300);
        }
        return;
    }

    const viewHeroBtn = e.target.closest('[data-action="view-hero"]');
    if (viewHeroBtn) {
        const id = viewHeroBtn.getAttribute('data-id');
        const group = viewHeroBtn.getAttribute('data-group');
        if (group === 'horaLoca') window.updateHoraLocaHero(id);
        return;
    }

    const heroAddBtn = e.target.closest('[data-action="hero-add-to-pack"]');
    if (heroAddBtn) {
        // Micro-animación de feedback VIP al cliquear
        heroAddBtn.classList.add('pulse-success');
        setTimeout(() => heroAddBtn.classList.remove('pulse-success'), 400);

        const id = heroAddBtn.getAttribute('data-id');
        const toggle = document.getElementById('toggle-' + id);
        if (toggle) {
            toggle.click();
            window.updateHoraLocaHero(id);
        }
    }
});

document.addEventListener('change', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('mdj-talent-hub-cb')) {
        if (typeof window.mdjSyncSelectedTalentFromHub === 'function') {
            window.mdjSyncSelectedTalentFromHub(e.target);
        }
        return;
    }
    const toggle = e.target.closest('[data-action="toggle-pack"]');
    if (toggle) {
        const id = toggle.getAttribute('data-id');
        window.togglePackageItem(
            id,
            toggle.getAttribute('data-name'),
            parseFloat(toggle.getAttribute('data-price'))
        );
        // Sincronización inversa segura con el Hero
        const heroAddBtn = document.getElementById('hl-hero-add-btn');
        if (heroAddBtn && heroAddBtn.getAttribute('data-id') === id) {
            window.updateHoraLocaHero(id);
        }
    }
});

// 1. Clean Dynamic Translation Re-render Binding via Pub/Sub
document.addEventListener('languageChanged', () => {
    const rosterModal = document.getElementById('roster-modal');
    if (rosterModal && !rosterModal.classList.contains('modal-hidden')) {
        const activeTab = document.querySelector('.live-tab.active');
        if (activeTab && window.renderLiveHero) {
            window.renderLiveHero(activeTab.dataset.talent);
        }
    }
    const staffModal = document.getElementById('staff-modal');
    if (staffModal && !staffModal.classList.contains('modal-hidden') && window.renderStaffHero && window.activeStaffTabLocked) {
        window.renderStaffHero(window.activeStaffTabLocked, false);
    }
    const payasosModal = document.getElementById('payasos-modal');
    if (payasosModal && !payasosModal.classList.contains('modal-hidden') && window.renderPayasosHero && window.activePayasosTabLocked) {
        window.renderPayasosHero(window.activePayasosTabLocked, false);
    }
});

function mdjRentalsTryResumeCheckoutAfterAuth() {
    try {
        var sp = new URLSearchParams(window.location.search);
        if (sp.get('resume_checkout') !== '1') return;
        if (window.history && window.history.replaceState) {
            var u = new URL(window.location.href);
            u.searchParams.delete('resume_checkout');
            var qs = u.search || '';
            window.history.replaceState({}, '', u.pathname + qs + (window.location.hash || ''));
        }
        var backup = sessionStorage.getItem('mdj_rentals_cart_backup');
        if (backup) {
            try {
                var arr = JSON.parse(backup);
                if (Array.isArray(arr) && arr.length) {
                    window.selectedPackage = arr;
                    if (typeof window.updatePackageSummary === 'function') {
                        window.updatePackageSummary();
                    }
                }
            } catch (eJ) { /* ignore */ }
        }
        if (window.selectedPackage && window.selectedPackage.length > 0) {
            var chkModal = document.getElementById('dj-checkout-modal');
            if (chkModal) {
                chkModal.classList.remove('modal-hidden');
            }
        }
    } catch (e) { /* ignore */ }
}

/** Tarjetas canónicas del hub (sin :scope — compat WebKit/iOS). */
function mdjTalentCarouselOriginalCards(track) {
    if (!track || !track.children) return [];
    return Array.prototype.filter.call(track.children, function (el) {
        if (el.nodeType !== 1) return false;
        if (!el.classList.contains('talent-cat-card')) return false;
        return !el.classList.contains('mdj-talent-loop-clone');
    });
}

/** Hub = categorías ENTRAR solamente; nunca perfiles DJ sueltos en el carrusel. */
window.mdjRentalsStripPublicDjTalentCards = function () {
    var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track) return;
    var hadLoop = track.dataset.mdjSimpleLoop === '1';
    track.querySelectorAll('[data-mdj-public-dj], .mdj-rentals-public-dj').forEach(function (el) {
        el.remove();
    });
    if (hadLoop && typeof window.mdjRebuildTalentSelectorInfiniteCarousel === 'function') {
        window.mdjRebuildTalentSelectorInfiniteCarousel();
    }
    try {
        delete track.dataset.mdjArtistsHydrated;
    } catch (eDel) {
        void eDel;
    }
};

/**
 * Hub talento: duplicado simple del carril + salto en scroll (mitad = un set completo).
 */
window.mdjRebuildTalentSelectorInfiniteCarousel = function () {
    var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track) return;
    track.querySelectorAll('.mdj-talent-loop-clone').forEach(function (n) {
        n.remove();
    });
    try {
        delete track.dataset.mdjHubPickInjected;
    } catch (eH) { /* ignore */ }
    track.classList.remove('mdj-talent-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '';
    track.dataset.mdjSimpleLoop = '';
    if (track._mdjLoopScroll) {
        track.removeEventListener('scroll', track._mdjLoopScroll);
        delete track._mdjLoopScroll;
    }
    if (typeof window.mdjInjectTalentHubShortlistUi === 'function') {
        window.mdjInjectTalentHubShortlistUi();
    }
    if (typeof window.initTalentSelectorInfiniteCarousel === 'function') {
        window.initTalentSelectorInfiniteCarousel();
    }
    var tm = document.getElementById('talent-selector-modal');
    if (tm && tm.classList.contains('modal-visible') && typeof window.mdjTalentSelectorInfiniteApply === 'function') {
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                window.mdjTalentSelectorInfiniteApply();
            });
        });
    }
};

window.mdjTalentSelectorInfiniteApply = function () {
    var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track || track.dataset.mdjSimpleLoop !== '1') {
        if (track) track.scrollLeft = 0;
        return;
    }
    var sw = track.scrollWidth;
    if (sw > 120) track.scrollLeft = Math.round(sw / 4);
};

window.mdjTalentSelectorInfiniteApplyRetry = function (attempt) {
    attempt = attempt == null ? 0 : attempt;
    if (typeof window.mdjTalentSelectorInfiniteApply === 'function') window.mdjTalentSelectorInfiniteApply();
    var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track || track.dataset.mdjSimpleLoop !== '1') return;
    if (track.scrollWidth > 120 || attempt >= 24) return;
    setTimeout(function () {
        window.mdjTalentSelectorInfiniteApplyRetry(attempt + 1);
    }, 48);
};

/**
 * Hub Entretenimiento y Talento: mantiene tarjetas sin UI de shortlist (anillos).
 * `MDJ_RENTALS_TALENT_HUB_CONTRACT.enableHubShortlistPickRings` debe permanecer `false` salvo reimplementación firmada.
 */
window.mdjInjectTalentHubShortlistUi = function () {
    const track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track) return;
    track.querySelectorAll('.mdj-talent-hub-pick').forEach(function (n) {
        n.remove();
    });
    mdjTalentCarouselOriginalCards(track).forEach(function (card) {
        card.classList.remove('mdj-talent-hub-card', 'mdj-talent-hub-selected');
    });
    track.querySelectorAll('.mdj-talent-loop-clone').forEach(function (clone) {
        clone.classList.remove('mdj-talent-hub-selected');
    });
    track.dataset.mdjHubPickInjected = '1';
};

window.mdjSyncSelectedTalentFromHub = function (checkboxEl) {
    if (!checkboxEl) return;
    const hubId = checkboxEl.getAttribute('data-talent-hub-id');
    const action = checkboxEl.getAttribute('data-talent-action') || '';
    const card = checkboxEl.closest('.talent-cat-card');
    const titleEl = card ? card.querySelector('.hero-card-title') : null;
    const name = titleEl ? titleEl.textContent.trim() : action;
    window.selectedTalent = Array.isArray(window.selectedTalent) ? window.selectedTalent : [];
    window.selectedTalent = window.selectedTalent.filter((t) => t && t.hubId !== hubId);
    if (checkboxEl.checked) {
        window.selectedTalent.push({ hubId, action, name, kind: 'hub', price: 0 });
    }
    if (card) {
        const track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
        const on = !!checkboxEl.checked;
        if (track && action) {
            track.querySelectorAll('.talent-cat-card').forEach(function (c) {
                if ((c.getAttribute('data-action') || '') !== action) return;
                c.classList.toggle('mdj-talent-hub-selected', on);
                const ocb = c.querySelector('.mdj-talent-hub-cb');
                if (ocb && ocb !== checkboxEl) {
                    ocb.checked = on;
                }
            });
        } else {
            card.classList.toggle('mdj-talent-hub-selected', on);
        }
    }
};

/** Presupuesto: líneas con precio + categorías del hub marcadas */
window.getSelectedTalentForBudget = function () {
    return {
        lineItems: Array.isArray(window.selectedPackage) ? window.selectedPackage.slice() : [],
        hubShortlist: Array.isArray(window.selectedTalent) ? window.selectedTalent.slice() : []
    };
};

window.initTalentSelectorInfiniteCarousel = function () {
    var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track || track.dataset.mdjSimpleLoop === '1') return;
    var originals = mdjTalentCarouselOriginalCards(track);
    if (originals.length < 2) return;
    originals.forEach(function (el) {
        var k = el.cloneNode(true);
        k.classList.add('mdj-talent-loop-clone');
        k.removeAttribute('id');
        k.setAttribute('tabindex', '-1');
        k.setAttribute('aria-hidden', 'true');
        track.appendChild(k);
    });
    track.classList.add('mdj-talent-carousel-infinite');
    track.dataset.mdjInfiniteCarousel = '1';
    track.dataset.mdjSimpleLoop = '1';
    var jumping = false;
    track._mdjLoopScroll = function () {
        if (jumping) return;
        var sw = track.scrollWidth;
        var cw = track.clientWidth || 0;
        if (sw < 80) return;
        var half = sw / 2;
        var max = Math.max(0, sw - cw);
        var sl = track.scrollLeft;
        var th = 18;
        if (sl >= max - th) {
            jumping = true;
            track.scrollLeft = sl - half;
            requestAnimationFrame(function () {
                jumping = false;
            });
        } else if (sl <= th) {
            jumping = true;
            track.scrollLeft = sl + half;
            requestAnimationFrame(function () {
                jumping = false;
            });
        }
    };
    track.addEventListener('scroll', track._mdjLoopScroll, { passive: true });
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            if (typeof window.mdjTalentSelectorInfiniteApplyRetry === 'function') {
                window.mdjTalentSelectorInfiniteApplyRetry(0);
            }
        });
    });
};

window.mdjEnsureTalentHubInfiniteOnOpen = function () {
    var tm = document.getElementById('talent-selector-modal');
    if (!tm || !tm.classList.contains('modal-visible')) return;
    if (typeof window.mdjRentalsStripPublicDjTalentCards === 'function') {
        window.mdjRentalsStripPublicDjTalentCards();
    }
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            var track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
            if (!track) return;
            if (typeof window.mdjInjectTalentHubShortlistUi === 'function') {
                window.mdjInjectTalentHubShortlistUi();
            }
            if (track.dataset.mdjSimpleLoop !== '1' && typeof window.initTalentSelectorInfiniteCarousel === 'function') {
                window.initTalentSelectorInfiniteCarousel();
            }
            if (typeof window.mdjTalentSelectorInfiniteApply === 'function') {
                window.mdjTalentSelectorInfiniteApply();
            }
            if (typeof window.mdjTalentSelectorInfiniteApplyRetry === 'function') {
                window.mdjTalentSelectorInfiniteApplyRetry(0);
            }
            setTimeout(function () {
                if (typeof window.mdjTalentSelectorInfiniteApply === 'function') {
                    window.mdjTalentSelectorInfiniteApply();
                }
                if (typeof window.mdjTalentSelectorInfiniteApplyRetry === 'function') {
                    window.mdjTalentSelectorInfiniteApplyRetry(0);
                }
            }, 180);
        });
    });
};

/** Talent selector — hover en tarjetas con data-talent-hero-src: preview en #talent-shell-focus (object-fit cover). */
window.mdjResetTalentSelectorCarousel = function () {
    const track = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!track) return;
    const apply = function () {
        if (track.dataset.mdjSimpleLoop === '1' && typeof window.mdjTalentSelectorInfiniteApply === 'function') {
            window.mdjTalentSelectorInfiniteApply();
            if (typeof window.mdjTalentSelectorInfiniteApplyRetry === 'function') {
                window.mdjTalentSelectorInfiniteApplyRetry(0);
            }
        } else {
            track.scrollLeft = 0;
        }
    };
    requestAnimationFrame(function () {
        requestAnimationFrame(apply);
    });
};

/**
 * Escucha global en el modal: cualquier clic en tarjeta hub alterna checkbox + clase dorada (sin depender del track).
 */
window.mdjBindTalentModalHubGlobalClick = function () {
    const modal = document.getElementById('talent-selector-modal');
    if (!modal || modal.dataset.mdjHubGlobalClick === '1') return;
    modal.dataset.mdjHubGlobalClick = '1';
    modal.addEventListener(
        'click',
        function (e) {
            const card = e.target && e.target.closest && e.target.closest('.mdj-talent-hub-card');
            if (!card || !modal.contains(card) || card.classList.contains('mdj-talent-loop-clone')) return;
            if (!card.closest('.talent-selector-carousel')) return;
            if (e.target.closest && e.target.closest('.mdj-talent-card-enter')) return;

            const input = card.querySelector('.mdj-talent-hub-cb');
            if (!input) return;

            if (e.target === input) {
                card.classList.toggle('mdj-talent-hub-selected', input.checked);
                if (typeof window.mdjSyncSelectedTalentFromHub === 'function') {
                    window.mdjSyncSelectedTalentFromHub(input);
                }
                e.stopPropagation();
                return;
            }
            if (e.target.closest && e.target.closest('.mdj-talent-hub-pick')) {
                window.requestAnimationFrame(function () {
                    card.classList.toggle('mdj-talent-hub-selected', input.checked);
                    if (typeof window.mdjSyncSelectedTalentFromHub === 'function') {
                        window.mdjSyncSelectedTalentFromHub(input);
                    }
                });
                e.stopPropagation();
                return;
            }

            input.checked = !input.checked;
            card.classList.toggle('mdj-talent-hub-selected', input.checked);
            if (typeof window.mdjSyncSelectedTalentFromHub === 'function') {
                window.mdjSyncSelectedTalentFromHub(input);
            }
            e.preventDefault();
            e.stopPropagation();
        },
        true
    );
};

window.mdjBindTalentHubWholeCardToggle = function () {
    if (typeof window.mdjBindTalentModalHubGlobalClick === 'function') {
        window.mdjBindTalentModalHubGlobalClick();
    }
};

/** Vídeo hero del hub: solo `#talent-shell-ambient` en el carrusel de categorías — ver `MDJ_RENTALS_TALENT_HUB_CONTRACT.enableCarouselHeroVideoPreview` (debe quedar `false`). */
window.initTalentSelectorShellHover = function () {
    const amb = document.getElementById('talent-shell-ambient');
    const foc = document.getElementById('talent-shell-focus');
    const shell = document.querySelector('#talent-selector-modal .cinematic-hero-shell');
    if (!amb || !foc || !shell) return;

    const heroEls = function () {
        return document.querySelectorAll('#talent-selector-modal [data-talent-hero-src]');
    };

    const applyFocus = (url, el) => {
        if (!url) return;
        const rurl = typeof window.resolveMdAssetVideoUrl === 'function' ? window.resolveMdAssetVideoUrl(url) : url;
        foc.muted = true;
        if (foc.dataset.mdjPreviewUrl === rurl) {
            foc.classList.add('is-visible');
            amb.classList.add('talent-shell-ambient-dim');
            shell.classList.add('talent-shell-hero-preview-on');
            heroEls().forEach((n) => n.classList.remove('active'));
            if (el) el.classList.add('active');
            foc.play().catch(() => {});
            return;
        }
        foc.dataset.mdjPreviewUrl = rurl;
        foc.src = rurl;
        if (typeof window.mdjHeroVideoPrime === 'function') window.mdjHeroVideoPrime(foc);
        foc.classList.add('is-visible');
        amb.classList.add('talent-shell-ambient-dim');
        shell.classList.add('talent-shell-hero-preview-on');
        heroEls().forEach((n) => n.classList.remove('active'));
        if (el) el.classList.add('active');
        foc.load();
        foc.play().catch(() => {});
    };

    const clearFocus = () => {
        delete foc.dataset.mdjPreviewUrl;
        foc.classList.remove('is-visible');
        amb.classList.remove('talent-shell-ambient-dim');
        shell.classList.remove('talent-shell-hero-preview-on');
        heroEls().forEach((n) => n.classList.remove('active'));
        try {
            foc.pause();
            foc.removeAttribute('src');
            foc.load();
        } catch (e) { /* ignore */ }
    };

    foc.addEventListener('error', clearFocus);

    /*
     * Hub: sin delegación pointer/focus en `.talent-selector-carousel` → #talent-shell-focus (contrato congelado).
     * Modales internos: hover propio (render* / _bind*GridHeroHover), no reutilizar este shell para ese carrusel.
     */

    heroEls().forEach((node) => {
        if (node.closest && node.closest('.talent-selector-carousel')) return;
        const url = node.getAttribute('data-talent-hero-src');
        if (!url) return;
        node.addEventListener('pointerenter', () => applyFocus(url, node));
        node.addEventListener('pointerleave', (e) => {
            const rt = e.relatedTarget;
            if (rt && rt.closest && rt.closest('[data-talent-hero-src]')) return;
            clearFocus();
        });
        node.addEventListener('focusin', () => applyFocus(url, node));
        node.addEventListener('focusout', clearFocus);
    });
};

/**
 * Hub Entretenimiento: arrastrar/scroll horizontal dispara un `click` fantasma al soltar → abre otro modal.
 * Suprimimos el click si (1) hubo arrastre con puntero o (2) el scrollLeft del carrusel cambió desde el pointerdown.
 * pointerdown en capture para capturar aunque el target sea una tarjeta hija.
 */
window.initTalentCarouselDragClickGuard = function () {
    const carousel = document.querySelector('#talent-selector-modal .talent-selector-carousel');
    if (!carousel || carousel.dataset.mdjDragClickGuard === '1') return;
    carousel.dataset.mdjDragClickGuard = '1';

    let originX = 0;
    let originY = 0;
    let pointerDown = false;
    let moved = false;
    const MOVE_PX = 5;

    carousel.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        pointerDown = true;
        moved = false;
        originX = e.clientX;
        originY = e.clientY;
    }, true);

    carousel.addEventListener('pointermove', (e) => {
        if (!pointerDown) return;
        if (Math.abs(e.clientX - originX) >= MOVE_PX || Math.abs(e.clientY - originY) >= MOVE_PX) {
            moved = true;
        }
    }, { passive: true });

    const endPointer = () => {
        pointerDown = false;
    };
    carousel.addEventListener('pointerup', endPointer);
    carousel.addEventListener('pointercancel', endPointer);

    /* Solo suprimir click tras arrastre real; no matar clics en tarjetas de categoría (.talent-cat-card). */
    carousel.addEventListener('click', (e) => {
        if (!moved) return;
        const card = e.target && e.target.closest ? e.target.closest('.talent-cat-card[data-action]') : null;
        if (card) {
            moved = false;
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        moved = false;
    }, true);
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch dynamic prices from Supabase and override local data
    try {
        if (window.getSupabaseClient) {
            const supabase = window.getSupabaseClient();
            if (supabase) {
                const { data } = await supabase.from('platform_settings').select('value').eq('key', 'rentals_catalog_prices').maybeSingle();
                if (data && data.value) {
                    const dynamicPrices = JSON.parse(data.value);
                    
                    // Helper function to update an item's price
                    const updateItemPrice = (item) => {
                        if (item && item.id && dynamicPrices[item.id] !== undefined) {
                            item.price = dynamicPrices[item.id];
                            if (item.fallbackPrice) {
                                if (item.fallbackPrice.includes('From')) {
                                    item.fallbackPrice = 'From $' + item.price.toFixed(2);
                                } else if (!item.fallbackPrice.includes('–')) {
                                    item.fallbackPrice = '$' + item.price.toFixed(2);
                                }
                            }
                        }
                    };

                    // 1. Override MDJ_RENTALS_DATA (Hora Loca & Legacy Talent)
                    if (window.MDJ_RENTALS_DATA) {
                        for (const category in window.MDJ_RENTALS_DATA) {
                            if (Array.isArray(window.MDJ_RENTALS_DATA[category])) {
                                window.MDJ_RENTALS_DATA[category].forEach(updateItemPrice);
                            } else {
                                for (const subcat in window.MDJ_RENTALS_DATA[category]) {
                                    if (Array.isArray(window.MDJ_RENTALS_DATA[category][subcat])) {
                                        window.MDJ_RENTALS_DATA[category][subcat].forEach(updateItemPrice);
                                    }
                                }
                            }
                        }
                    }

                    // 2. Override Tabs (DJ, Live, Visuals, MC, FX, Staff, Payasos)
                    const tabGroups = [
                        window.djTabs, 
                        window.liveMusicTabs, 
                        window.visualTabs, 
                        window.mcTabs, 
                        window.fxTabs,
                        window.staffRoles,
                        window.payasosRoles
                    ];
                    tabGroups.forEach(group => {
                        if (group) {
                            Object.values(group).forEach(updateItemPrice);
                        }
                    });

                    // 3. Override Rental Catalogs (Stages, Audio, Lighting, etc.)
                    if (window.rentalCatalogs) {
                        Object.values(window.rentalCatalogs).forEach(catalog => {
                            if (catalog && Array.isArray(catalog.items)) {
                                catalog.items.forEach(updateItemPrice);
                            }
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error fetching dynamic prices:', e);
    }

    // 2. Direct Back Button Binding (No global interception)
    document.querySelectorAll('[data-action="go-back"], .back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    });

    await loadRentalsData();
    mdjRentalsTryResumeCheckoutAfterAuth();

    const runTalentHubChrome = () => {
        if (typeof window.mdjRentalsStripPublicDjTalentCards === 'function') {
            window.mdjRentalsStripPublicDjTalentCards();
        }
        if (typeof window.mdjInjectTalentHubShortlistUi === 'function') {
            window.mdjInjectTalentHubShortlistUi();
        }
        if (typeof window.initTalentSelectorInfiniteCarousel === 'function') {
            window.initTalentSelectorInfiniteCarousel();
        }
        if (typeof window.mdjBindTalentHubWholeCardToggle === 'function') {
            window.mdjBindTalentHubWholeCardToggle();
        }
        if (typeof window.initTalentSelectorShellHover === 'function') {
            window.initTalentSelectorShellHover();
        }
        if (typeof window.initTalentCarouselDragClickGuard === 'function') {
            window.initTalentCarouselDragClickGuard();
        }
        if (typeof window.mdjRentalsTryMountTalentStripInfinite === 'function') {
            window.mdjRentalsTryMountTalentStripInfinite('staff-roster-grid', 'mdj-staff-carousel-clone');
            window.mdjRentalsTryMountTalentStripInfinite('payasos-roster-grid', 'mdj-payasos-carousel-clone');
            window.mdjRentalsTryMountTalentStripInfinite('mc-roster-scroll', 'mdj-mc-carousel-clone');
        }
        if (typeof window.mdjRentalsInitStripDragClickGuard === 'function') {
            ['staff-roster-grid', 'payasos-roster-grid', 'mc-roster-scroll'].forEach(function (sid) {
                const el = document.getElementById(sid);
                if (el) window.mdjRentalsInitStripDragClickGuard(el);
            });
        }
    };

    if (window.MDJ_ARTISTS && typeof window.MDJ_ARTISTS.hydrateRentalsTalentHubCarousel === 'function') {
        window.MDJ_ARTISTS.hydrateRentalsTalentHubCarousel = function () {
            if (typeof window.mdjRentalsStripPublicDjTalentCards === 'function') {
                window.mdjRentalsStripPublicDjTalentCards();
            }
            var tr = document.querySelector('#talent-selector-modal .talent-selector-carousel');
            if (tr) tr.dataset.mdjArtistsHydrated = '1';
            return Promise.resolve();
        };
        window.MDJ_ARTISTS.hydrateRentalsTalentHubCarousel().then(runTalentHubChrome).catch(() => runTalentHubChrome());
    } else {
        runTalentHubChrome();
    }
    if (window.mdjTalentCarouselLoadBound !== '1') {
        window.mdjTalentCarouselLoadBound = '1';
        window.addEventListener(
            'load',
            function () {
                const tr = document.querySelector('#talent-selector-modal .talent-selector-carousel');
                if (typeof window.mdjInjectTalentHubShortlistUi === 'function') {
                    window.mdjInjectTalentHubShortlistUi();
                }
                if (tr && tr.dataset.mdjSimpleLoop !== '1' && typeof window.initTalentSelectorInfiniteCarousel === 'function') {
                    try {
                        window.initTalentSelectorInfiniteCarousel();
                    } catch (eL) {
                        void eL;
                    }
                }
                if (typeof window.mdjBindTalentHubWholeCardToggle === 'function') {
                    window.mdjBindTalentHubWholeCardToggle();
                }
                if (typeof window.mdjTalentSelectorInfiniteApplyRetry === 'function') {
                    window.mdjTalentSelectorInfiniteApplyRetry(0);
                }
                if (typeof window.mdjRentalsTryMountTalentStripInfinite === 'function') {
                    window.mdjRentalsTryMountTalentStripInfinite('staff-roster-grid', 'mdj-staff-carousel-clone');
                    window.mdjRentalsTryMountTalentStripInfinite('payasos-roster-grid', 'mdj-payasos-carousel-clone');
                    window.mdjRentalsTryMountTalentStripInfinite('mc-roster-scroll', 'mdj-mc-carousel-clone');
                }
            },
            { passive: true }
        );
    }
    document.addEventListener('languageChanged', function () {
        if (typeof window.mdjRebuildTalentSelectorInfiniteCarousel === 'function') {
            window.mdjRebuildTalentSelectorInfiniteCarousel();
        }
    });
    if (typeof window.initMcModalMagicHover === 'function') {
        window.initMcModalMagicHover();
    }
});
