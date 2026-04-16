const t = (k, def) => (window.translations?.[window.i18n?.currentLang]?.[k]) || def;

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
            gridEl.innerHTML = Object.entries(dataset).map(([key, item]) => {
                const isSelected = window.selectedPackage.some(p => p.id === item.id);
                const isActive = key === currentTabKey;
                const btnClass = isSelected ? "hl-action-btn added" : "hl-action-btn";
                const icon = isSelected ? "✓" : "+";
                const activeStateClass = isActive ? " active" : "";

                let emoji = '🎙️';
                if (item.id.includes('sax')) emoji = '🎷';
                if (item.id.includes('percussion') || item.id.includes('timbal')) emoji = '🥁';
                if (item.id.includes('photo')) emoji = '📸';
                if (item.id.includes('video') && !item.id.includes('drone')) emoji = '🎥';
                if (item.id.includes('drone')) emoji = '🚁';

                const clickBinding = `onclick="window.renderLiveHero('${key}', true)"`;

                return `
                    <div class="talent-cat-card hero-glass-card hl-type-card${activeStateClass}" ${clickBinding} style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; min-height: 320px; gap: 10px;">
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
            if (videoEl.getAttribute("src") !== activeVideo) {
                videoEl.src = activeVideo;
                videoEl.load();
                videoEl.play().catch(() => { });
            }
        }

        if (window.i18n) window.i18n.updateUI();

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

window.renderDjHero = (tabKey = 'weddings', animate = true) => {
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
                if (item.id.includes('holiday')) emoji = '🎇';

                const clickBinding = `onclick="window.renderDjHero('${key}', true)"`;
                const btnText = isSelected ? t('btn_remove_extra', 'Remove') : t(item.ctaKey, 'Activar');

                const isVIP = item.id === 'dj_weddings';
                const priceDisplay = isVIP
                    ? `<span style="font-size: 10px; opacity: 0.7; display: block; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.5px; margin-bottom: 2px; text-transform: uppercase;">Starting at</span>$${item.price}.00`
                    : `$${item.price}.00`;

                const footerNote = isVIP
                    ? `<div style="font-size: 8px; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; margin-bottom: 12px; width: 100%; text-align: center; line-height: 1.2;">Custom production available</div>`
                    : `<div style="margin-bottom: 12px;"></div>`;

                return `
                    <div class="talent-cat-card hero-glass-card hl-type-card${activeStateClass}" ${clickBinding} style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; min-height: 320px; transition: transform 0.3s ease;">
                        <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; align-items: center;">
                            <div class="hero-card-emoji" style="font-size: 28px; margin-bottom: 12px;">${emoji}</div>
                            <h3 class="hero-card-title hl-type-name" data-i18n="${item.nameKey}" style="font-size: 15px; line-height: 1.2; margin-bottom: 8px; color: var(--gold); font-family: 'Playfair Display', serif;">${t(item.nameKey, item.fallbackName)}</h3>
                            <p class="hero-card-text" data-i18n="${item.descKey}" style="font-size: 11px; opacity: 0.8; margin-bottom: auto; color: white; line-height: 1.35; width: 100%;">${t(item.descKey, item.fallbackDesc)}</p>
                            <div class="hero-card-price hl-type-price" style="font-size: 18px; font-weight: 700; color: var(--gold); margin-top: 15px;">${priceDisplay}</div>
                            ${footerNote}
                        </div>
                        <button class="${btnClass}" data-action="hl-activate-direct" data-id="${item.id}" style="font-size: 10px; padding: 10px 5px; margin-top: auto; border-radius: 50px; letter-spacing: 0.5px;" onclick="event.stopPropagation();">
                            <span class="hl-btn-icon">${icon}</span>
                            <span class="hl-btn-text" data-i18n="${isSelected ? 'btn_remove_extra' : item.ctaKey}">${btnText}</span>
                        </button>
                    </div>
                `;
            }).join('');
        }

        if (videoEl && activeItem.video) {
            if (videoEl.getAttribute("src") !== activeItem.video) {
                console.log("[DJ Module] Updating video source to:", activeItem.video);
                videoEl.setAttribute("src", activeItem.video);
                videoEl.src = activeItem.video;

                // Clear any existing source children just to be safe
                videoEl.innerHTML = `<source src="${activeItem.video}" type="video/mp4">`;

                videoEl.load();
                videoEl.play().catch((e) => {
                    console.warn("[DJ Module] Video autoplay prevented by browser policy:", e);
                });
            }
        }

        if (window.i18n) window.i18n.updateUI();

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
    const dataset = window.fxItems;
    const gridEl = document.getElementById("fx-roster-grid");
    const videoEl = document.getElementById("fx-hero-video");

    const performRender = () => {
        let activeVideo = dataset[currentTabKey] ? dataset[currentTabKey].video : "";

        if (gridEl && dataset) {
            let track = gridEl.querySelector('.fx-marquee-track');

            // Si el track no existe, inyectamos el DOM completo duplicado para el loop infinito
            if (!track) {
                const buildCards = () => Object.entries(dataset).map(([key, item]) => {
                    const clickBinding = `onclick="window.renderFxHero('${key}', true)"`;

                    return `
                        <div class="talent-cat-card hero-glass-card hl-type-card" data-fx-key="${key}" ${clickBinding} style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; min-height: 320px; gap: 10px;">
                            <div class="hl-card-icon" style="font-size: 32px; margin-bottom: 5px;">${item.emoji || '✨'}</div>
                            <h3 class="hl-card-title" data-i18n="${item.nameKey}" style="font-family: 'Playfair Display', serif; color: var(--gold); font-size: 15px; font-weight: 600; margin: 0; line-height: 1.2;">
                                ${t(item.nameKey, item.fallbackName)}
                            </h3>
                            <p class="hl-card-desc" data-i18n="${item.descKey}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; flex-grow: 1; line-height: 1.4;">
                                ${t(item.descKey, item.fallbackDesc)}
                            </p>
                            <div class="hl-card-price" style="font-family: Inter, sans-serif; color: var(--gold); font-size: 18px; font-weight: 700; margin-top: auto; margin-bottom: 10px;">
                                ${item.priceString ? item.priceString : (item.price ? '$' + item.price + '.00' : 'Cotizar')}
                            </div>
                            <button class="btn-premium-cta full hl-action-btn" data-action="open-fx" style="width: 100%; border: 1px solid var(--gold); background: transparent; color: var(--gold); padding: 8px 0; border-radius: 50px; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="event.stopPropagation();">
                                <span class="hl-btn-icon"></span>
                                <span class="hl-btn-text"></span>
                            </button>
                        </div>
                    `;
                }).join('');

                const singleSetHtml = buildCards();

                // Sobrescribir comportamiento del grid original para alojar el track
                gridEl.style.overflowX = 'hidden';
                gridEl.style.justifyContent = 'flex-start';

                gridEl.innerHTML = `
                    <style>
                        @keyframes fxMarqueeLoop {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(calc(-50% - 7.5px)); }
                        }
                        .fx-marquee-track {
                            display: flex;
                            gap: 15px;
                            animation: fxMarqueeLoop 35s linear infinite;
                            width: max-content;
                            will-change: transform;
                        }
                        .fx-marquee-track:hover {
                            animation-play-state: paused;
                        }
                    </style>
                    <div class="fx-marquee-track">
                        ${singleSetHtml}${singleSetHtml}
                    </div>
                `;
                track = gridEl.querySelector('.fx-marquee-track');
            }

            // --- ACTUALIZACIÓN DIFERENCIAL ---
            // Solo alteramos clases para no resetear la posición del Marquee Loop
            const allCards = track.querySelectorAll('.talent-cat-card');

            allCards.forEach(card => {
                const key = card.getAttribute('data-fx-key');
                if (!key) return;

                const item = dataset[key];
                const isActive = (key === currentTabKey);
                const isSelected = window.selectedPackage && window.selectedPackage.some(p => p.id === item.id);

                // Clase Active (Halo Glow)
                if (isActive) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }

                // Actualización del Botón Principal
                const btn = card.querySelector('.hl-action-btn');
                const btnIcon = card.querySelector('.hl-btn-icon');
                const btnText = card.querySelector('.hl-btn-text');

                if (btn && btnIcon && btnText) {
                    if (isSelected) {
                        btn.className = "hl-action-btn added";
                        btn.style.background = 'rgba(197,160,89,0.2)';
                        btnIcon.textContent = "✓";
                        btnText.textContent = t('btn_remove_extra', 'Remove');
                    } else {
                        btn.className = "btn-premium-cta full hl-action-btn";
                        btn.style.background = 'transparent';
                        btnIcon.textContent = "";
                        btnText.textContent = t(item.ctaKey, 'Consultar');
                    }
                }
            });
        }

        if (videoEl && activeVideo) {
            if (videoEl.getAttribute("src") !== activeVideo) {
                videoEl.src = activeVideo;
                videoEl.load();
                videoEl.play().catch(() => { });
            }
        }
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
    const dataset = window.lightingItems;
    const gridEl = document.getElementById("lighting-roster-grid");
    const videoEl = document.getElementById("lighting-hero-video");

    const performRender = () => {
        let activeVideo = dataset[currentTabKey] && dataset[currentTabKey].video ? dataset[currentTabKey].video : "./assets/Special_Effects/Iluminación.mp4";

        if (gridEl && dataset) {
            gridEl.innerHTML = Object.entries(dataset).map(([key, item]) => {
                const isSelected = window.selectedPackage && window.selectedPackage.some(p => p.id === item.id);
                const isActive = key === currentTabKey;
                const btnClass = isSelected ? "hl-action-btn added" : "btn-premium-cta full hl-action-btn";
                const icon = isSelected ? "✓" : "";
                const btnText = isSelected ? t('btn_remove_extra', 'Remove') : t(item.ctaKey, 'Consultar');
                const activeStateClass = isActive ? " active" : "";
                const borderFlicker = isActive ? "box-shadow: 0 0 25px rgba(212,175,55,0.4); border: 1px solid rgba(212,175,55,1);" : "box-shadow: 0 0 15px rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);";

                const clickBinding = `onclick="window.renderLightingHero('${key}', true)"`;

                return `
                    <div class="talent-cat-card hero-glass-card hl-type-card${activeStateClass}" ${clickBinding} style="flex: 1 1 0; min-width: 200px; max-width: 260px; padding: 20px 15px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; box-sizing: border-box; min-height: 320px; gap: 10px;">
                        <div class="hl-card-icon" style="font-size: 32px; margin-bottom: 5px;">${item.emoji || '💡'}</div>
                        <h3 class="hl-card-title" data-i18n="${item.nameKey}" style="font-family: 'Playfair Display', serif; color: var(--gold); font-size: 15px; font-weight: 600; margin: 0; line-height: 1.2;">
                            ${t(item.nameKey, item.fallbackName)}
                        </h3>
                        <p class="hl-card-desc" data-i18n="${item.descKey}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: rgba(255,255,255,0.7); font-size: 11px; margin: 0; flex-grow: 1; line-height: 1.4;">
                            ${t(item.descKey, item.fallbackDesc)}
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
            if (videoEl.getAttribute("src") !== activeVideo) {
                videoEl.src = activeVideo;
                videoEl.load();
                videoEl.play().catch(() => { });
            }
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
        const response = await fetch('./data/rentals.json');
        if (!response.ok) throw new Error('Failed to load rentals data');
        const data = await response.json();

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
        console.error('Error loading rentals data:', error);
    }
}

window.renderHoraLocaCatalogue = () => {
    const grid = document.getElementById('horaloca-grid');
    if (!grid) return;

    grid.innerHTML = window.hlPackages.map(pack => {
        const pName = t('data_' + pack.id + '_name', pack.name);
        const pDesc = t('data_' + pack.id + '_desc', pack.desc);

        let emoji = '🎭';
        if (pack.id === 'hl_robot') emoji = '🤖';
        if (pack.id === 'hl_brasil') emoji = '💃';
        if (pack.id === 'hl_cubana') emoji = '🥁';
        if (pack.id === 'hl_character') emoji = '🤡';
        if (pack.id === 'hl_hadas') emoji = '🧚‍♀️';

        const selected = Array.isArray(window.selectedPackage) ? window.selectedPackage : [];
        const isSelected = selected.some(p => p.id === pack.id);
        const btnClass = isSelected ? 'btn full hl-action-btn hl-btn-added' : 'btn-premium-cta full hl-action-btn';
        const btnText = isSelected ? t('btn_added_exp', 'Añadido') : t('btn_active_exp', 'Activar esta Experiencia');

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
        if (videoEl.getAttribute('src') !== pack.video) {
            videoEl.src = pack.video;
            videoEl.load();
            videoEl.play().catch(e => console.warn('Video auto-play prevented:', e));
        }
    }

    if (window.i18n) {
        window.i18n.updateUI();
    }

    document.querySelectorAll('.hl-type-card').forEach(card => card.classList.remove('active'));
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
                <img src="${item.img}" class="rental-img-zoom" alt="${item.id}">
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

    // Dynamically Inject Catalog Meta
    const titleEl = document.getElementById('rental-dynamic-title');
    const descEl = document.getElementById('rental-dynamic-desc');
    if (titleEl) titleEl.innerText = catalog.title;
    if (descEl) descEl.innerText = catalog.subtitle;

    // DYNAMIC BACKGROUND VIDEO ENGINE
    const bgVideo = document.getElementById('rental-dynamic-video');
    if (bgVideo) {
        // STRICT DATA CONTROL: Use explicitly defined bgVideo. If missing (like in Lighting), fallback to first product's video.
        const targetSrc = catalog.bgVideo || (catalog.items && catalog.items[0] && catalog.items[0].video ? catalog.items[0].video : '');

        // Use global timeout to prevent race conditions during tab switching
        if (window.bgVideoTimeout) clearTimeout(window.bgVideoTimeout);

        if (!targetSrc) {
            bgVideo.style.opacity = '0';
            window.bgVideoTimeout = setTimeout(() => bgVideo.removeAttribute('src'), 500);
        } else {
            // Safely check if current video matches expected by looking for the filename
            const filename = targetSrc.split('/').pop().replace(/%20/g, ' ');

            if (!bgVideo.src.includes(encodeURI(filename)) && !bgVideo.src.includes(filename)) {
                bgVideo.style.opacity = '0';
                window.bgVideoTimeout = setTimeout(() => {
                    bgVideo.onerror = () => {
                        // Preserve pure dark cinematic background if category-specific hero is missing
                        bgVideo.style.opacity = '0';
                        bgVideo.removeAttribute('src'); // Clean DOM state
                    };
                    bgVideo.src = targetSrc;
                    bgVideo.load();
                    bgVideo.play().then(() => bgVideo.style.opacity = '1').catch(e => console.warn(e));
                }, 500);
            } else {
                bgVideo.style.opacity = '1';
                // If it was paused by accident, ensure it's playing
                bgVideo.play().catch(() => { });
            }
        }
    }

    // Tab active state update
    document.querySelectorAll('.rental-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-cat') === categoryId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Drop static grid classes to allow horizontal Marquee track
    grid.className = "";
    grid.style.display = 'flex';
    grid.style.flexWrap = 'nowrap';
    grid.style.overflowX = 'hidden';
    grid.style.justifyContent = 'flex-start';
    grid.style.alignItems = 'stretch';
    grid.style.gap = '0';
    grid.style.padding = '0 80px 20px 80px'; // Match FX modal padding
    grid.style.position = 'relative';
    grid.style.zIndex = '10';

    let html = `
        <style>
            /* STICKY HEADER & TABS CSS */
            .rentals-header {
                position: sticky;
                top: 0;
                z-index: 1000;
                backdrop-filter: blur(12px);
                background: rgba(0,0,0,0.85);
                border-bottom: 1px solid rgba(255,255,255,0.08);
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

            /* --- DYNAMIC MARQUEE TRACK --- */
            @keyframes dynamicMarqueeLoop {
                0% { transform: translateX(0); }
                100% { transform: translateX(calc(-50% - 7.5px)); } /* 7.5px is half of 15px gap */
            }
            .dynamic-marquee-track {
                display: flex;
                gap: 15px;
                animation: dynamicMarqueeLoop 35s linear infinite;
                width: max-content;
                will-change: transform;
            }
            .dynamic-marquee-track:hover {
                animation-play-state: paused;
            }

            .product-card {
                border-radius: 16px;
                overflow: hidden;
                background: transparent;
                border: 1px solid var(--gold);
                box-shadow: 0 0 10px rgba(212, 175, 55, 0.15);
                transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.4s ease;
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
                opacity: 0.55;
                transition: transform 0.4s ease;
            }

            /* PANEL FLOTANTE */
            .product-overlay {
                position: absolute;
                bottom: 12px;
                left: 12px;
                right: 12px;

                background: rgba(20, 20, 20, 0.65);
                backdrop-filter: blur(12px);

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

            /* HOVER 3D SUAVE */
            .product-card:hover {
                transform: translateY(-6px) scale(1.01);
                box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                border-color: rgba(212, 175, 55, 0.7);
            }

            .product-card:hover .product-image img,
            .product-card:hover .product-image video {
                opacity: 0.85;
            }

            .product-card:hover .product-overlay {
                background: rgba(20, 20, 20, 0.85);
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
        <div class="dynamic-marquee-track">
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

        const mediaSrc = item.video || item.image || item.img;
        const isVideo = mediaSrc && (mediaSrc.toLowerCase().endsWith('.mp4') || mediaSrc.toLowerCase().endsWith('.webm'));
        const posterSrc = item.image || item.img || '';
        const mediaHtml = isVideo
            ? `<video src="${mediaSrc}" poster="${posterSrc}" autoplay muted loop playsinline style="width: 100%; height: auto; aspect-ratio: 4/5; object-fit: cover; display: block;"></video>`
            : `<img src="${mediaSrc}" alt="${item.name}">`;

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

    // INFINITE MARQUEE MATH CORRECTION: 
    // Prevent 4K screen underflow when category has very few items (e.g. Tents)
    const minItemsNeeded = 10;
    let baseSequenceHtml = cardsHtml;

    if (catalog.items.length < minItemsNeeded) {
        const repeatCount = Math.ceil(minItemsNeeded / catalog.items.length);
        baseSequenceHtml = '';
        for (let i = 0; i < repeatCount; i++) {
            baseSequenceHtml += cardsHtml;
        }
    }

    // Now baseSequenceHtml is guaranteed to be wider than the screens, 
    // Double inject it for a seamless 50% translation loop
    html += baseSequenceHtml + baseSequenceHtml;
    html += '</div>'; // Close track

    grid.innerHTML = html;

    // STRICT DATA CONTROL: Default to dedicated bgVideo. If missing, auto-fallback to the first item's video. 
    // This prevents black screen 404s when opening new tabs like Furniture or Stages.
    const catBgVideo = catalog.bgVideo || (catalog.items[0] && catalog.items[0].video ? catalog.items[0].video : '');

    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const itemId = card.getAttribute('data-rental-id');

            // STRICT DATA CONTROL: Find the exact item definition and its strict video path
            const itemDef = catalog.items.find(i => i.id === itemId);
            if (!itemDef || !itemDef.video) return; // If no strict video path defined natively, ignore hover intent.

            const targetVideoPath = itemDef.video;
            const filenameMatch = targetVideoPath.split('/').pop().replace(/%20/g, ' ');

            // Ensure we aren't already playing this specific video
            if (bgVideo && !bgVideo.src.includes(encodeURI(filenameMatch)) && !bgVideo.src.includes(filenameMatch)) {
                if (window.bgVideoTimeout) clearTimeout(window.bgVideoTimeout);
                bgVideo.style.opacity = '0';

                window.bgVideoTimeout = setTimeout(() => {
                    bgVideo.onerror = () => {
                        // If product video fails to load, silently abort and leave background black
                        bgVideo.style.opacity = '0';
                        bgVideo.removeAttribute('src');
                    };

                    bgVideo.src = targetVideoPath; // Use absolute explicit path defined by CEO
                    bgVideo.load();
                    bgVideo.play().then(() => {
                        bgVideo.style.opacity = '1';
                    }).catch(err => console.warn('Product video auto-play prevented', err));
                }, 300); // 300ms debounce crossfade
            }
        });
    });

    // Revert to Category Video when mouse leaves the marquee track entirely
    const track = document.querySelector('.dynamic-marquee-track');
    if (track) {
        track.addEventListener('mouseleave', () => {
            if (bgVideo) {
                if (window.bgVideoTimeout) clearTimeout(window.bgVideoTimeout);
                if (!catBgVideo) {
                    bgVideo.style.opacity = '0';
                    window.bgVideoTimeout = setTimeout(() => bgVideo.removeAttribute('src'), 400);
                    return;
                }

                const cleanCatBg = catBgVideo.split('/').pop().replace(/%20/g, ' ');
                if (!bgVideo.src.includes(encodeURI(cleanCatBg)) && !bgVideo.src.includes(cleanCatBg)) {
                    bgVideo.style.opacity = '0';
                    window.bgVideoTimeout = setTimeout(() => {
                        bgVideo.onerror = () => { bgVideo.style.opacity = '0'; bgVideo.removeAttribute('src'); };
                        bgVideo.src = catBgVideo;
                        bgVideo.load();
                        bgVideo.play().then(() => bgVideo.style.opacity = '1').catch(e => console.warn(e));
                    }, 400);
                }
            }
        });
    }
};

window.selectedPackage = [];

window.togglePackageItem = (id, name, price) => {
    const el = document.getElementById('toggle-' + id);
    const isChecked = el ? el.checked : true;

    if (isChecked) {
        if (!window.selectedPackage.find(item => item.id === id)) {
            window.selectedPackage.push({ id, name, price });
        }
    } else {
        window.selectedPackage = window.selectedPackage.filter(item => item.id !== id);
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

        const inModal = document.getElementById(inId);
        if (inModal) {
            inModal.classList.remove('modal-hidden');
            inModal.classList.add('modal-visible', 'modal-fade-in');
            document.body.classList.add('body-modal-lock');

            setTimeout(() => {
                inModal.classList.remove('modal-fade-in');
            }, 600);
        }

        if (window.i18n) window.i18n.updateUI();
    }, 400);
};

document.addEventListener('click', (e) => {
    const packCard = e.target.closest('[data-action="select-hl-package"]');
    if (packCard) {
        window.updateHoraLocaHero(packCard.getAttribute('data-id'));
        return;
    }
    // 0. GO HOME (Escape Raíz)
    if (e.target.closest('[data-action="go-home"]')) {
        window.location.href = 'index.html';
        return;
    }

    // CHECKOUT REDIRECT (Cart to Leads Pipeline)
    if (e.target.closest('.package-checkout-btn')) {
        if (window.selectedPackage && window.selectedPackage.length > 0) {
            e.preventDefault();
            // Serialize and persist state for landing page capture
            sessionStorage.setItem('mdjpro_checkout_cart', JSON.stringify(window.selectedPackage));
            // Route aggressively to conversion form
            window.location.href = 'index.html#contact';
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
            window.selectedPackage.push({ id, name, price });
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

        if (pack) {
            window.selectedPackage = Array.isArray(window.selectedPackage) ? window.selectedPackage : [];
            const isSelected = window.selectedPackage.some(p => p.id === id);

            if (isSelected) {
                window.selectedPackage = window.selectedPackage.filter(p => p.id !== id);
            } else {
                const nameKey = pack.nameKey || ('data_' + pack.id + '_name');
                const fallback = pack.fallbackName || pack.name || 'Premium Package';
                window.selectedPackage.push({ id: pack.id, name: t(nameKey, fallback), price: pack.price || 0 });
            }

            window.updatePackageSummary();

            if (window.renderHoraLocaCatalogue) window.renderHoraLocaCatalogue();
            if (window.renderLiveHero && window.activeCategory !== 'mc') window.renderLiveHero(null, false);

            if (window.i18n) window.i18n.updateUI();
        }
        return;
    }

    if (e.target.closest('[data-action="close-all"]')) {
        const modals = ['talent-selector-modal', 'horaloca-modal', 'roster-modal', 'rental-dynamic-modal'];
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
                type: 'rental'
            });
            btn.className = 'cta cta-remove';
            btn.innerText = isTalent ? 'CANCELAR' : 'REMOVE';
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
        window.premiumTransition('talent-selector-modal', 'roster-modal', () => {
            if (window.renderLiveHero) window.renderLiveHero('sax', false);
        });
        return;
    }

    // OPEN MC
    if (e.target.closest('[data-action="open-mc"]')) {
        window.premiumTransition('talent-selector-modal', 'mc-modal');
        return;
    }

    // OPEN VISUALS
    if (e.target.closest('[data-action="open-visuals"]')) {
        window.activeCategory = 'visuals';
        window.premiumTransition('talent-selector-modal', 'roster-modal', () => {
            if (window.renderLiveHero) window.renderLiveHero('photo', false);
        });
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

    // BACK TO SELECTOR FX
    if (e.target.closest('[data-action="back-to-selector-fx"]')) {
        const m = document.getElementById('fx-modal');
        if (m) {
            m.classList.add('modal-hidden');
            m.classList.remove('modal-visible');
            document.body.classList.remove('body-modal-lock');
        }
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
        const m = document.getElementById('lighting-modal');
        if (m) {
            m.classList.add('modal-hidden');
            m.classList.remove('modal-visible');
            document.body.classList.remove('body-modal-lock');
        }
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
});

document.addEventListener('DOMContentLoaded', () => {
    // 2. Direct Back Button Binding (No global interception)
    document.querySelectorAll('[data-action="go-back"], .back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    });

    loadRentalsData();
});
