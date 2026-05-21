/**
 * MDJPRO — Booth Assistant AI Logic
 * Sales / negotiation helper with a human tone. Uses scripted states + keyword routing (not a hosted LLM).
 * Policy: never disclose internal credentials, unreleased roadmap, private user data, or “company secrets”.
 * For anything outside public MDJ knowledge, deflect to support or give general business criteria only.
 */

// ==========================================
// UI GLOBAL HEADER CONTROLLER (Stabilization)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const mainHeader = document.getElementById('mainHeader');
    if (mainHeader) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                mainHeader.classList.add('scrolled');
            } else {
                mainHeader.classList.remove('scrolled');
            }
        }, { passive: true });

        // Initial state verify
        if (window.scrollY > 50) mainHeader.classList.add('scrolled');
    }
});

window.MDJ_Assistant = {
    isOpen: false,
    sessionState: "DISCOVERY", // "DISCOVERY", "B2C_QUALIFICATION", "B2C_PRICING", "B2C_OBJECTION", "B2C_CLOSING", "B2B_EVANGELIST"
    /** Set when user self-identifies (e.g. cantante, DJ) for follow-up copy */
    sessionTalentRole: null,
    userLanguage: null, // "es" or "en"
    /** Flujo “contratar por categoría + fecha” alineado con Jobs / public_dj_profiles (PRO primero, LITE después). */
    boothRosterCtx: {
        step: "idle",
        roleCode: null,
        eventDate: null,
        candidates: [],
        pendingInvite: null
    },
    /** Recordatorios anuales (cumple / aniversario): borrador en sessionStorage hasta CRM/canales. */
    boothLifeEventCtx: {
        step: "idle"
    },
    /** Historial de conversación enviado a booth-chat LLM (últimos 20 mensajes). */
    _chatHistory: [],
    /** Declines confidential / sensitive requests; returns reply string or null */
    confidentialityAndSafetyReply: function (rawInput, isSpanish) {
        var t = (rawInput || '').toLowerCase();
        var confidential = /contraseña|password|passwd|api[_\s-]?key|secret[o]?|confidencial|confidential|credencial|credential|token\s*(priv|secret)|stripe\s*secret|supabase\s*key|\.env|hack|exploit|sql\s*injection|ddos|breach|filtraci[oó]n|salario de\s+\w+|cu[aá]nto gana\s+\w+\s+en la empresa|employee\s+id|ssn|n[uú]mero de tarjeta|iban\s+interno|base de datos interna|dump\s+de|internal\s+only|roadmap\s+secreto|no publicado/i.test(t);
        var askSecrets = /secreto[s]?\s+de\s+(la\s+)?empresa|company\s+secrets|informaci[oó]n\s+privada\s+de\s+(usuarios|djs)|datos\s+internos|acuerdo[s]?\s+privad/i.test(t);
        if (confidential || askSecrets) {
            return isSpanish
                ? "Por seguridad y ética profesional no comparto credenciales, datos internos, acuerdos privados ni secretos comerciales. Sí puedo orientarte en ventas, propuesta de valor, objeciones y buenas prácticas públicas de Miami DJ Beat. ¿Qué tema de negocio quieres trabajar?"
                : "For security and professional ethics I don’t share credentials, internal data, private agreements, or trade secrets. I can still help with sales, value proposition, objections, and public best practices for Miami DJ Beat. What business topic should we tackle?";
        }
        return null;
    },

    /**
     * Short yes/no — avoids infinite loops when the last bot line was a yes/no question.
     * Used across states; keep patterns in sync when adding new flows.
     */
    isShortAffirmative: function (raw) {
        const t = (raw || '').trim().toLowerCase();
        if (!t) return false;
        if (/^s\.?$/.test(t)) return true;
        if (/^(sí|si|ok|okay|yes|yeah|yep|yup|claro|por supuesto|dale|va|vamos|listo|sure|exacto|correcto|bueno|perfecto|adelante|genial)\b/i.test(t)) return true;
        if (/^(sí|si|ok|yes)\s*[!\.]?$/i.test(t)) return true;
        return false;
    },

    isShortNegative: function (raw) {
        const t = (raw || '').trim().toLowerCase();
        if (!t) return false;
        if (/^(no|nop|nope|nah|not yet|a[uú]n no|todav[ií]a no|nada de eso|negativo)\b/i.test(t)) return true;
        if (/^no\s*[!\.]?$/i.test(t)) return true;
        return false;
    },

    /**
     * Catálogo / mapa del sitio. Fuentes: jobs.html, shop.html, rentals.html (+ rentalCatalogs en web/js/rentals.js),
     * modal de talento en rentals.html, services.html, course-data.js (módulos).
     */
    siteKnowledgeReply: function (userInput, isSpanish) {
        const q = (userInput || '').toLowerCase();
        const wantsBoth = /mapa del sitio|todo (lo |el )?(que )?(ofrecen|tienen|hay)|cat[áa]logo completo|listado completo|todas las categor|navegaci[oó]n (del sitio|web)/i.test(q);

        const wantsJobsList = wantsBoth || /categor[ií]as.*(trabajo|empleo|jobs)|roles.{0,40}(portal|eligen|seleccion|jobs)|portal (de )?jobs|jobs\.html|lista de roles|vacantes|qu[eé] roles|cu[aá]ntos roles|trabajo.*categor|empleo.*categor|d[oó]nde.{0,35}(jobs|categor[ií]as de trabajo|portal de trabajo)/i.test(q);
        const wantsRentList = wantsBoth || /categor[ií]as.*(alquiler|rental|equipo|evento (y servicio)?)|rentals\.html|eventos y servicios|productos (para )?rentar|alquiler( de|es)?|cat[áa]logo.*(rental|equipo)|rental.*categor|equipos para evento|rentar (equipo|carpa|sonido|luz)|d[oó]nde.{0,35}(rental|alquiler|eventos y servicios|cat[áa]logo de evento)/i.test(q);
        const wantsShopList = wantsBoth || /categor[ií]as.*(shop|tienda|merch)|shop\.html|tienda (mdj|oficial)?|productos (en la )?tienda|merchandising|camisetas|gorras|hoodie/i.test(q);
        const wantsEventTalentList = wantsBoth || /categor[ií]as.*(talento|paquete|dj.{0,3}performance|hora loca|m[uú]sicos|visual|mc)|selector de talento|agregar talento|modal de talento|fot[oó]grafo|vide[oó]grafo|vj\b/i.test(q);
        const wantsServicesList = wantsBoth || /services\.html|p[aá]gina de services|cotizaci[oó]n.*(services|servicios)|formulario de servicios/i.test(q);
        const wantsAcademiaList = wantsBoth || /academia\.html|courses\.html|categor[ií]as.*(curso|academia|certificaci)|m[oó]dulos (del )?(programa|curso)|listado (de )?m[oó]dulos|certificaci[oó]n (oficial )?(mdj|dj)|programa de certificaci/i.test(q);

        if (!wantsJobsList && !wantsRentList && !wantsShopList && !wantsEventTalentList && !wantsServicesList && !wantsAcademiaList) return null;

        var jobsEs =
            "Jobs (./jobs.html) — roles al postularte: DJ, MC, cantante, live band, percussionista, saxofonista, violinista, payaso, hora loca, bartender, mesero, manager artístico, productor musical, influencer/promotor, foto booth 360. **Booth** puede orientar una búsqueda por categoría + fecha (roster público; confirmación final en **./find-dj.html** / **./services.html**).";
        var jobsEn =
            "Jobs (./jobs.html) — application roles: DJ, MC, vocalist, live band, percussion, sax, violin, clown, hora loca, bartender, server, artist manager, music producer, influencer/promoter, 360 photo booth. **Booth** can run a category + date lookup on the public roster (finalize availability in **./find-dj.html** / **./services.html**).";

        var shopEs = "Shop (./shop.html) — categorías de producto en merchandising: tshirts, hats, hoodies (variantes en la página).";
        var shopEn = "Shop (./shop.html) — merch product categories: tshirts, hats, hoodies (see page for variants).";

        var rentEs = "Rentals — equipamiento (./rentals.html, web/js/rentals.js · rentalCatalogs):\n• Furniture & Decor\n• Tent & Event Structures\n• Kids & Inflatables\n• Stage & Event Structures\n• Audio y Sonido Profesional\n• Iluminación y Pantallas LED";
        var rentEn = "Rentals — gear (./rentals.html, web/js/rentals.js):\n• Furniture & Decor • Tents • Inflatables • Stages • Audio • Lighting & LED";

        var talentEs = "Selector de talento para paquetes (modal en ./rentals.html): DJ / Performance · Hora Loca Experience · Músicos en vivo · Captura y visuales (foto, video, VJ) · MC y presentadores.";
        var talentEn = "Talent picker for packages (modal on ./rentals.html): DJ/Performance · Hora Loca · Live musicians · Photo/Video/VJ · MC & hosts.";

        var servicesEs = "Services (./services.html) — formulario de cotización; tipo de evento en el select: Nightclub & Festival, Elite Corporate, Premium Wedding, Other / Custom.";
        var servicesEn = "Services (./services.html) — quote form; event type options: Nightclub & Festival, Elite Corporate, Premium Wedding, Other / Custom.";

        var academiaEs = "Academia / certificación (courses.html · course-data.js) — 12 módulos: Fundamentos del Sonido, Equipamiento Profesional, Software Profesional, Técnica de Mezcla, MC y Control de Pista, Producción e Iluminación, Organización de Librería, Contratos y Cotizaciones, Marketing Personal DJ, Precios y Finanzas DJ, Mentalidad del DJ Élite, Examen Final + Certificación.";
        var academiaEn = "Academy (courses.html · course-data.js) — 12 modules: sound fundamentals, gear, software, mixing, MC, lighting/production, library, contracts, marketing, pricing/finance, elite mindset, final exam + certification.";

        var partsEs = [];
        var partsEn = [];
        if (wantsJobsList) { partsEs.push(jobsEs); partsEn.push(jobsEn); }
        if (wantsShopList) { partsEs.push(shopEs); partsEn.push(shopEn); }
        if (wantsRentList) { partsEs.push(rentEs); partsEn.push(rentEn); }
        if (wantsEventTalentList) { partsEs.push(talentEs); partsEn.push(talentEn); }
        if (wantsServicesList) { partsEs.push(servicesEs); partsEn.push(servicesEn); }
        if (wantsAcademiaList) { partsEs.push(academiaEs); partsEn.push(academiaEn); }

        var out = isSpanish ? partsEs.join("\n\n") : partsEn.join("\n\n");
        var commerce =
            wantsJobsList || wantsShopList || wantsRentList || wantsEventTalentList || wantsServicesList;
        if (commerce) return this.boothTailWithOptionalCloser(out, isSpanish);
        return out;
    },

    /**
     * Guía de alta / suscripción (login.html). afterCatalog = true → cierre corto tras respuesta de catálogo.
     * Params alineados con login.html (signup=free → talent, plan=pro, redirect=jobs).
     */
    subscriptionGuideReply: function (userInput, isSpanish, afterCatalog) {
        const q = (userInput || '').toLowerCase();
        const wantsPro = /plan pro|mdjpro|djpro|pro\b|premium|elite|pago|paid|29/i.test(q);
        const wantsJobsRedirect = /jobs|empleo|portal de trabajo|postular/i.test(q);

        if (afterCatalog) {
            if (isSpanish) {
                var tail = "**Siguiente paso — cuenta:** abre **./login.html** → pestaña **Crear cuenta**.";
                if (wantsPro) tail += " Para **MDJPRO:** **./login.html?plan=pro**.";
                else if (wantsJobsRedirect) tail += " **Talento + Jobs:** **./login.html?signup=free&redirect=jobs**.";
                else tail += " **Artista/talento (gratis):** **./login.html?signup=free** · **PRO:** **./login.html?plan=pro**.";
                return tail;
            }
            var tailEn = "**Next — account:** open **./login.html** → **Sign up**.";
            if (wantsPro) tailEn += " **MDJPRO:** **./login.html?plan=pro**.";
            else if (wantsJobsRedirect) tailEn += " **Talent + Jobs:** **./login.html?signup=free&redirect=jobs**.";
            else tailEn += " **Artist (free):** **./login.html?signup=free** · **PRO:** **./login.html?plan=pro**.";
            return tailEn;
        }

        if (isSpanish) {
            var lines = [
                "Para **suscribirte** en Miami DJ Beat:",
                "1) Abre **./login.html** y elige **Crear cuenta** (email + contraseña).",
                "2) **Cliente** (comprar, reservar servicios): registro normal en el formulario.",
                "3) **Artista / talento** (perfil, gigs): entra con **./login.html?signup=free** — el alta orienta a talento (según reglas del sitio).",
                "4) **Plan PRO (MDJPRO):** **./login.html?plan=pro** — visibilidad y herramientas premium para artistas.",
                "5) Si vienes del **portal Jobs**, puedes usar **./login.html?signup=free&redirect=jobs** para volver al flujo de empleo tras registrarte.",
                "Después: completa **dj-profile**, revisa **dj-dashboard** y **Academia** según tu rol."
            ];
            return this.boothTailWithOptionalCloser(lines.join("\n"), true);
        }
        return this.boothTailWithOptionalCloser(
            [
                "To **subscribe** on Miami DJ Beat:",
                "1) Open **./login.html** → **Sign up** (email + password).",
                "2) **Client** (buy/book services): standard signup.",
                "3) **Artist / talent** (profile, gigs): **./login.html?signup=free**.",
                "4) **PRO (MDJPRO):** **./login.html?plan=pro**.",
                "5) **From Jobs portal:** **./login.html?signup=free&redirect=jobs**.",
                "Then: **dj-profile**, **dj-dashboard**, **Academia** as applicable."
            ].join("\n"),
            false
        );
    },

    /**
     * Orquesta / banda / grupo en vivo + trabajo + registro — respuesta única (Jobs LIVE_BAND + login).
     */
    ensembleSubscriptionWorkReply: function (userInput, isSpanish) {
        const q = (userInput || "").toLowerCase();
        const hasEnsemble =
            /orquesta|orchestra|banda(\s+en\s+vivo)?|grupo\s+musical|conjunto(\s+musical)?|live\s+band|ensemble|big\s*band|tengo\s+(una\s+)?(orquesta|banda|grupo)|our\s+band|my\s+band/i.test(
                q
            );
        const wantsWorkOrSignup =
            /trabajo|empleo|jobs|gigs|gig|work|contrat|postul|busco|encontrar|bookings|suscrib|suscripci|registr|cuenta|signup|sign\s*up|subscri|darme de alta|alta en la plataforma|get\s+(an\s+)?account|create\s+(an\s+)?account/i.test(
                q
            );
        if (!hasEnsemble || !wantsWorkOrSignup) return null;

        if (isSpanish) {
            return [
                "Para **orquesta / banda en vivo**, en el portal **Jobs** (./jobs.html) el rol que te corresponde es **LIVE BAND** (puedes marcar otros si aplica).",
                "**Registro y vuelta a empleo:** **./login.html?signup=free&redirect=jobs** — crea cuenta como talento y regresa al flujo de Jobs.",
                "**Solo alta talento (gratis):** **./login.html?signup=free** — luego abre **./jobs.html** y completa **dj-profile** con demos y repertorio.",
                "Si buscas **visibilidad y herramientas PRO:** **./login.html?plan=pro**."
            ].join("\n");
        }
        return [
            "For **orchestra / live band**, on **Jobs** (./jobs.html) choose the **LIVE BAND** role (add others if they apply).",
            "**Sign up and return to hiring:** **./login.html?signup=free&redirect=jobs**.",
            "**Talent signup (free):** **./login.html?signup=free** — then open **./jobs.html** and fill **dj-profile** with demos and repertoire.",
            "**PRO visibility & tools:** **./login.html?plan=pro**."
        ].join("\n");
    },

    /**
     * Foto / photo booth (incl. typo “bool”) + rentar/alquilar/contratar — cliente que busca el servicio.
     * Va antes de jobsRoleSubscriptionReply para no mezclar con alta de talento FOTO_BOOTH_360.
     */
    photoBoothRentClientReply: function (userInput, isSpanish) {
        const q = (userInput || "").toLowerCase();
        const mentionsPhotoBooth =
            /photo\s*booth|foto\s*booth|fotobooth|photo\s*bool|foto\s*bool|booth\s+360|cabina\s+360|cabina\s+foto|foto\s+cabina|360\s+photo|360\s+foto/i.test(q);
        const wantsRentOrBook =
            /rentar|alquilar|contratar|reserva|reservar|cotiz|quote|necesito\s+el\s+servicio|quiero\s+el\s+servicio|\bhire\b/i.test(q);
        if (!mentionsPhotoBooth || !wantsRentOrBook) return null;

        if (isSpanish) {
            return this.boothTailWithOptionalCloser(
                [
                    "Si **quieres contratar** una cabina / **foto booth** (incl. 360) para tu evento:",
                    "• **Rentals / paquetes:** **./rentals.html** — arma el paquete; en el **modal de talento** elige **captura y visuales** (foto, video, 360 si aplica).",
                    "• **Cotización global de evento:** **./services.html** (tipo de evento y detalles).",
                    "Si **tienes** equipo y quieres **ofrecerlo** en la red como proveedor: **./jobs.html** → rol **FOTO BOOTH 360** · alta **./login.html?signup=free&redirect=jobs**."
                ].join("\n"),
                true
            );
        }
        return this.boothTailWithOptionalCloser(
            [
                "To **book / rent** a **photo booth** (including 360) for your event:",
                "• **Rentals & packages:** **./rentals.html** — build your package; in the **talent modal** pick **photo / video / capture** (360 when applicable).",
                "• **Full event quote:** **./services.html**.",
                "If you **operate** a booth and want to **join as a vendor:** **./jobs.html** → **FOTO_BOOTH_360** · **./login.html?signup=free&redirect=jobs**."
            ].join("\n"),
            false
        );
    },

    /**
     * Cualquier rol de Jobs (artista / performance / staff) + trabajo o suscripción —
     * mismo patrón: rol en ./jobs.html + login talento. Incluye equipo de **hora loca**.
     * Mensajes cortos solo de **hora loca** (sin “suscribirme”) también entran; no si parece **contratar** como cliente.
     * Orden de reglas: más específicas primero (no solapar con ensemble LIVE_BAND).
     */
    jobsRoleSubscriptionReply: function (userInput, isSpanish) {
        const q = (userInput || "").toLowerCase();
        const looksClientHire =
            /contratar|para\s+(mi|el|la)\s+(boda|fiesta|quince|evento|celebraci)|book\s+hora|hire\s|cu[aá]nto\s+cuesta|precio\s+de|quiero\s+(una\s+)?hora\s+loca\s+para|necesito\s+hora\s+loca\s+para|hora\s+loca\s+para\s+mi|hora\s+loca\s+para\s+la\s+fiesta/i.test(
                q
            );
        const mentionsHoraLoca = /hora\s+loca|equipo\s+de\s+hora\s+loca|equipo\s+hora\s+loca/i.test(q);
        const horaLocaTalentPhrasing =
            /nos\s+dedicamos|nos\s+dedico|me\s+dedico\s+a|dedicamos\s+a|hacemos\s+hora\s+loca|hacer\s+hora\s+loca|(?:team|tim|t[ií]m|t[ií]n)\s+de\s+hora\s+loca|tengo\s+un\s+(?:team|tim|t[ií]m|t[ií]n)\s+de\s+hora\s+loca|hora\s+loca\s+en\s+miami/i.test(
                q
            );
        const wc = q.trim().split(/\s+/).length;
        const shortHoraLocaTalentTopic =
            mentionsHoraLoca && !looksClientHire && (wc <= 24 || horaLocaTalentPhrasing);
        const wantsTalentIntent =
            /suscrib|suscripci|registr|cuenta|signup|sign\s*up|subscri|darme de alta|membres|plan pro|mdjpro|djpro|crear cuenta|get\s+(an\s+)?account|create\s+(an\s+)?account|trabajo|empleo|jobs|gigs|gig|work|postul|busco|encontrar|bookings|contrataciones|contrataci[oó]n|aplicar|apply|perfil|profile|soy|somos|nos\s+dedicamos|me\s+dedico|nos\s+dedico/i.test(
                q
            ) || horaLocaTalentPhrasing;
        const wantsIntent = wantsTalentIntent || shortHoraLocaTalentTopic;
        if (!wantsIntent) return null;

        const tailEs = [
            "**Registro talento y vuelta a empleo:** **./login.html?signup=free&redirect=jobs**.",
            "**Solo alta (gratis):** **./login.html?signup=free** — luego **./jobs.html** y completa **dj-profile**.",
            "**PRO:** **./login.html?plan=pro**."
        ].join("\n");
        const tailEn = [
            "**Talent signup + return to Jobs:** **./login.html?signup=free&redirect=jobs**.",
            "**Free signup:** **./login.html?signup=free** — then **./jobs.html** and **dj-profile**.",
            "**PRO:** **./login.html?plan=pro**."
        ].join("\n");

        const rules = [
            {
                re: /hora\s+loca|equipo\s+de\s+hora\s+loca|equipo\s+hora\s+loca|show\s+de\s+hora\s+loca|tenemos\s+(un\s+)?equipo\s+de\s+hora\s+loca|somos\s+(el\s+|un\s+)?equipo\s+de\s+hora\s+loca|grupo\s+de\s+hora\s+loca|(?:team|tim|t[ií]m|t[ií]n)\s+de\s+hora\s+loca|tengo\s+un\s+(?:team|tim|t[ií]m|t[ií]n)\s+de\s+hora\s+loca|nos\s+dedicamos\b[\s\S]{0,96}?hora\s+loca|dedicamos\s+a[\s\S]{0,96}?hora\s+loca|hacemos\s+hora\s+loca|hacer\s+hora\s+loca|hora\s+loca\s+en\s+miami/i,
                firstEs:
                    "Si haces **hora loca**, tienes **equipo / team**, **os dedicáis** a ese show (p. ej. en **Miami**), en **Jobs** (./jobs.html) marca el rol **HORA LOCA** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "For **hora loca** — **team**, **crew**, or **you specialize in that show** (e.g. in **Miami**), on **Jobs** (./jobs.html) select **HORA LOCA** when you apply (add others if needed)."
            },
            {
                re: /(^|\s)(soy|somos)\s+(un\s+|una\s+|unos\s+|unas\s+)?(payaso|payasa|clown)\b|trabajo\s+como\s+payaso|payaso\s+de\s+fiesta/i,
                firstEs:
                    "Como **payaso / clown**, en **Jobs** (./jobs.html) marca el rol **PAYASO** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **clown / entertainer**, on **Jobs** (./jobs.html) select **PAYASO** when you apply (add others if needed)."
            },
            {
                re: /saxofonista|saxofon|(^|\s)saxo\b|saxophonist/i,
                firstEs:
                    "Como **saxofonista**, en **Jobs** (./jobs.html) marca el rol **SAXOFONISTA** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **sax player**, on **Jobs** (./jobs.html) select **SAXOFONISTA** when you apply (add others if needed)."
            },
            {
                re: /violinista|violin\b|violinist/i,
                firstEs:
                    "Como **violinista**, en **Jobs** (./jobs.html) marca el rol **VIOLINISTA** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **violinist**, on **Jobs** (./jobs.html) select **VIOLINISTA** when you apply (add others if needed)."
            },
            {
                re: /percusionista|percusi[oó]n|percussion|(^|\s)baterista\b|drummer/i,
                firstEs:
                    "Como **percusionista / baterista**, en **Jobs** (./jobs.html) marca el rol **PERCUSIONISTA** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As **percussion / drums**, on **Jobs** (./jobs.html) select **PERCUSIONISTA** when you apply (add others if needed)."
            },
            {
                re: /(^|\s)(soy|somos)\s+(un\s+|una\s+)?(cantante|singer|vocalista)\b|trabajo\s+como\s+cantante|canto\s+en\s+vivo|i\s*m\s+a\s+singer/i,
                firstEs:
                    "Como **cantante**, en **Jobs** (./jobs.html) marca el rol **CANTANTE** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **vocalist**, on **Jobs** (./jobs.html) select **CANTANTE** when you apply (add others if needed)."
            },
            {
                re: /(^|\s)(soy|somos)\s+(un\s+|una\s+)?(mc|m\.c\.|maestro\s+de\s+ceremonias|maestro\s+de\s+ceremonia)\b|master\s+of\s+ceremon|host\s+de\s+evento|presentador\s+de\s+evento|(^|\s)(soy|somos)\s+(un\s+|una\s+)?animador(a)?\b|i\s*m\s+an?\s+mc\b/i,
                firstEs:
                    "Como **MC / maestro de ceremonias / animador**, en **Jobs** (./jobs.html) marca el rol **MC** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As an **MC / host / MC-style host**, on **Jobs** (./jobs.html) select **MC** when you apply (add others if needed)."
            },
            {
                re: /(^|\s)(soy|somos)\s+(un\s+|una\s+|unos\s+|unas\s+)?(dj|d\s*\.?\s*j\s*\.?|disc\s*jockey)\b|trabajo\s+como\s+dj|trabajo\s+de\s+dj|soy\s+disc\s*jockey|i\s*m\s+a\s+dj\b|we\s*re\s+djs/i,
                firstEs:
                    "Como **DJ**, en **Jobs** (./jobs.html) marca el rol **DJ** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **DJ**, on **Jobs** (./jobs.html) select **DJ** when you apply (add others if needed)."
            },
            {
                re: /manager\s+art[ií]stico|artist\s+manager|manager\s+de\s+artistas/i,
                firstEs:
                    "Como **manager artístico**, en **Jobs** (./jobs.html) marca el rol **MANAGER ARTÍSTICO** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As an **artist manager**, on **Jobs** (./jobs.html) select **MANAGER_ARTISTICO** when you apply (add others if needed)."
            },
            {
                re: /productor\s+musical|music\s+producer|productora\s+musical|beatmaker|productor\s+de\s+beats/i,
                firstEs:
                    "Como **productor musical**, en **Jobs** (./jobs.html) marca el rol **PRODUCTOR MUSICAL** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **music producer**, on **Jobs** (./jobs.html) select **PRODUCTOR_MUSICAL** when you apply (add others if needed)."
            },
            {
                re: /influencer|promotor\s+de\s+eventos|event\s+promoter|promotora\s+de\s+eventos/i,
                firstEs:
                    "Como **influencer / promotor**, en **Jobs** (./jobs.html) marca el rol **INFLUENCER / PROMOTOR** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As an **influencer / promoter**, on **Jobs** (./jobs.html) select **INFLUENCER_PROMOTOR** when you apply (add others if needed)."
            },
            {
                re: /foto\s+booth\s+360|photo\s+booth\s+360|fotobooth\s+360|photo\s*bool|foto\s*bool|booth\s+360|360\s+foto|cabina\s+360|booll\s+360|video\s+360\s+booth/i,
                firstEs:
                    "Si ofreces **foto booth / cabina 360** (video o experiencia 360), en **Jobs** (./jobs.html) marca el rol **FOTO BOOTH 360** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "For **360 photo booth** (video or experience), on **Jobs** (./jobs.html) select **FOTO_BOOTH_360** when you apply (add others if needed)."
            },
            {
                re: /(^|\s)(soy|somos)\s+(un\s+|una\s+|unos\s+|unas\s+)?(bartender|barman|barmen)\b|trabajo\s+como\s+(bartender|barman)|me\s+dedico\s+a\s+(ser\s+)?bartender|i\s+am\s+a\s+bartender|i\s*m\s+a\s+bartender|work\s+as\s+a\s+bartender/i,
                firstEs:
                    "Como **bartender**, en **Jobs** (./jobs.html) marca el rol **BARTENDER** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As a **bartender**, on **Jobs** (./jobs.html) select **BARTENDER** when you apply (add others if needed)."
            },
            {
                re: /(^|\s)(soy|somos)\s+(un\s+|una\s+|unos\s+|unas\s+)?(mesero|mesera|server|waiter|waitress)\b|trabajo\s+como\s+mesero|work\s+as\s+a\s+server/i,
                firstEs:
                    "Como **mesero/a**, en **Jobs** (./jobs.html) marca el rol **MESERO** al postularte (puedes añadir otros si aplica).",
                firstEn:
                    "As **serving staff**, on **Jobs** (./jobs.html) select **MESERO** when you apply (add others if needed)."
            }
        ];

        for (var i = 0; i < rules.length; i++) {
            if (!rules[i].re.test(q)) continue;
            if (i === 0 && looksClientHire) continue;
            return isSpanish ? rules[i].firstEs + "\n\n" + tailEs : rules[i].firstEn + "\n\n" + tailEn;
        }
        return null;
    },

    /** Mapea lenguaje natural de contratación → código de rol Jobs (mayúsculas). */
    boothInferJobsRoleFromHireMessage: function (lower) {
        var rules = [
            [/orquesta|live\s*band|banda\s+en\s+vivo|grupo\s+musical|big\s*band|conjunto\s+musical/, "LIVE_BAND"],
            [/maestro\s+de\s+ceremonia|maestro\s+de\s+ceremonias|\bm\.?c\.?\b(?!\w)|\bmc\b|presentador(a)?\s+de\s+evento|host\s+de\s+evento|animador(a)?\s+de\s+boda/, "MC"],
            [/\bdj\b|disc\s*jockey|mezcla\s+para\s+boda/, "DJ"],
            [/\bcantante\b|singer|vocalista/, "CANTANTE"],
            [/saxofon|saxophonist/, "SAXOFONISTA"],
            [/violinista|violinist|\bviolin\b(?!\w)/, "VIOLINISTA"],
            [/percusionista|baterista|percussion|drummer/, "PERCUSIONISTA"],
            [/payaso|clown/, "PAYASO"],
            [/hora\s+loca/, "HORA_LOCA"],
            [/\bbartender\b|barman/, "BARTENDER"],
            [/mesero|mesera|waiter|waitress/, "MESERO"],
            [/manager\s+art|artist\s+manager/, "MANAGER_ARTISTICO"],
            [/productor\s+musical|music\s+producer|beatmaker/, "PRODUCTOR_MUSICAL"],
            [/influencer|promotor\s+de\s+eventos|event\s+promoter/, "INFLUENCER_PROMOTOR"],
            [/foto\s+booth|photo\s+booth|cabina\s+360|booth\s+360/, "FOTO_BOOTH_360"]
        ];
        for (var i = 0; i < rules.length; i++) {
            if (rules[i][0].test(lower)) return rules[i][1];
        }
        return null;
    },

    boothParseEventDate: function (raw) {
        var s = (raw || "").trim();
        if (!s) return null;
        var m = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
        if (m) {
            var y = parseInt(m[3], 10);
            if (y < 100) y += 2000;
            return m[1].padStart(2, "0") + "/" + m[2].padStart(2, "0") + "/" + y;
        }
        if (/\b20[2-3]\d\b/.test(s)) {
            var y2 = s.match(/\b(20[2-3]\d)\b/);
            if (y2) return y2[1];
        }
        return null;
    },

    /** 1–5, misma lógica que las estrellas visuales (señal de perfil/idioma, no reseña completa). */
    boothStarCount: function (row) {
        var n = row && row.lang_score != null ? Number(row.lang_score) : NaN;
        if (!Number.isFinite(n) || n < 1) {
            if (window.MDB_SUBSCRIPTION && typeof window.MDB_SUBSCRIPTION.isPremiumTier === "function" && window.MDB_SUBSCRIPTION.isPremiumTier(row)) {
                n = 5;
            } else {
                n = 3;
            }
        }
        return Math.max(1, Math.min(5, Math.round(n)));
    },

    boothFormatStars: function (row) {
        var n = this.boothStarCount(row);
        return "★".repeat(n) + "☆".repeat(5 - n);
    },

    /** Frase natural para la venta (“habla español solamente”, “español e inglés”, etc.). */
    boothLanguagePitch: function (row, isSpanish) {
        var L = (row && row.languages) || "";
        var t = String(L).toLowerCase();
        var es = /\bes\b|spa|spanish|español|espanol/i.test(t);
        var en = /\ben\b|ingl|english/i.test(t);
        if (es && en) return isSpanish ? "habla **español e inglés**" : "speaks **English and Spanish**";
        if (es) return isSpanish ? "solo habla **español**" : "speaks **Spanish only**";
        if (en) return isSpanish ? "habla **inglés** (principalmente)" : "speaks **English** (primarily)";
        return isSpanish ? "no detalla idiomas con claridad en el perfil público" : "doesn’t spell out languages clearly on the public profile";
    },

    /** Etiqueta corta para “¿tu MC?”, “your DJ?”, según código Jobs. */
    boothRoleClientLabel: function (roleCode, isSpanish) {
        var r = String(roleCode || "").toUpperCase().replace(/\s+/g, "_");
        if (r === "MC") return isSpanish ? "MC / maestro de ceremonias" : "MC (host)";
        if (r === "DJ") return "DJ";
        if (r === "CANTANTE") return isSpanish ? "cantante" : "vocalist";
        if (r === "LIVE_BAND") return isSpanish ? "banda en vivo" : "live band";
        if (r === "PERCUSIONISTA") return isSpanish ? "percusionista" : "percussion";
        if (r === "SAXOFONISTA") return isSpanish ? "saxofonista" : "sax player";
        if (r === "VIOLINISTA") return isSpanish ? "violinista" : "violinist";
        if (r === "PAYASO") return isSpanish ? "payaso / animación" : "clown / entertainer";
        if (r === "HORA_LOCA") return "hora loca";
        if (r === "BARTENDER") return "bartender";
        if (r === "MESERO") return isSpanish ? "mesero/a" : "server";
        if (r === "MANAGER_ARTISTICO") return isSpanish ? "manager artístico" : "artist manager";
        if (r === "PRODUCTOR_MUSICAL") return isSpanish ? "productor musical" : "music producer";
        if (r === "INFLUENCER_PROMOTOR") return isSpanish ? "influencer / promotor" : "influencer / promoter";
        if (r === "FOTO_BOOTH_360") return isSpanish ? "cabina / foto booth 360" : "360 photo booth";
        return r.replace(/_/g, " ").toLowerCase() || (isSpanish ? "servicio" : "role");
    },

    /**
     * Español: tono “solo habla español pero tiene un nivel de N estrellas — creo que sería adecuado para tu caso”.
     */
    boothSpanishNivelYCreoAdecuado: function (row) {
        var name = (row && (row.stage_name || row.dj_slug)) || "esta opción";
        var starsN = this.boothStarCount(row);
        var L = (row && row.languages) || "";
        var t = String(L).toLowerCase();
        var hasEs = /\bes\b|spa|spanish|español|espanol/i.test(t);
        var hasEn = /\ben\b|ingl|english/i.test(t);
        var lead;
        if (hasEs && hasEn) {
            lead = "**" + name + "** habla **español e inglés** y tiene un ";
        } else if (hasEs) {
            lead = "**" + name + "** solo habla **español**, pero tiene un ";
        } else if (hasEn) {
            lead = "**" + name + "** habla principalmente **inglés**, pero tiene un ";
        } else {
            lead = "**" + name + "** no detalla idiomas con claridad en el perfil; aun así tiene un ";
        }
        return (
            lead +
            "**nivel de " +
            starsN +
            " de 5 estrellas** en el perfil (señal de idioma / calidad del perfil; no es una reseña pública completa) — **creo que sería adecuado** para tu caso"
        );
    },

    /**
     * Cierre de venta educado y sin presión: programar evento, cuenta cliente, enlaces oficiales.
     */
    boothDiplomaticSalesCloser: function (isSpanish) {
        if (isSpanish) {
            return (
                "\n\nSi quieres, puedes **programar tu evento con nosotros**: tenemos **muchísimas opciones** que se adaptan a tu medida y presupuesto. " +
                "Si te interesa seguir, en la web oficial entra con tu **cuenta de cliente** o **crea una nueva**: **./services.html** (cotizar y organizar) · **./login.html** (iniciar sesión o registro). " +
                "Para la **tienda oficial**, **./shop.html** — invitación clara, sin presión, por si quieres explorar."
            );
        }
        return (
            "\n\nIf you’d like to **plan your event with us**, we have **lots of options** to match your style and budget. " +
            "On the official site you can use your **client account** or **create one**: **./services.html** (quote / plan your event) · **./login.html** (sign in or sign up). " +
            "For the **official shop**, **./shop.html** — a clear, low-pressure next step if you want to browse."
        );
    },

    /** Añade el cierre diplomático solo si el texto aún no lo trae (evita duplicados). */
    boothTailWithOptionalCloser: function (text, isSpanish) {
        var t = String(text || "");
        var marker = isSpanish ? "programar tu evento con nosotros" : "plan your event with us";
        if (t.toLowerCase().indexOf(marker) !== -1) return t;
        return t + this.boothDiplomaticSalesCloser(isSpanish);
    },

    /**
     * Párrafo tipo vendedor: nombre, idioma, nivel de estrellas, creo adecuado, ¿tu rol?
     */
    boothTopPickOfferParagraph: function (row, roleCode, eventDate, isSpanish, listLen) {
        var nList = Math.max(1, Math.min(99, parseInt(String(listLen || 1), 10) || 1));
        var name = (row && (row.stage_name || row.dj_slug)) || (isSpanish ? "esta opción" : "this pick");
        var starsN = this.boothStarCount(row);
        var langPitch = this.boothLanguagePitch(row, isSpanish);
        var roleLabel = this.boothRoleClientLabel(roleCode, isSpanish);
        var dateBit = eventDate ? (isSpanish ? " para el **" + eventDate + "**" : " for **" + eventDate + "**") : "";
        if (isSpanish) {
            return (
                this.boothSpanishNivelYCreoAdecuado(row) +
                ". ¿Te gustaría que fuera tu **" +
                roleLabel +
                "**" +
                dateBit +
                "? Dime **sí** y lo dejo en tu **lista para carrito** (`mdj_booth_cart_recommendations`); o el **número** de otro de la lista (1–" +
                nList +
                "). ¿Necesitas **algún otro servicio** (DJ, luces, foto…)?" +
                this.boothDiplomaticSalesCloser(true)
            );
        }
        return (
            "**" +
            name +
            "** " +
            langPitch +
            ", with a **" +
            starsN +
            " out of 5** profile level (language/profile signal, not a full public review score) — **I think they’d be a good fit** for your event. Would you like them as your **" +
            roleLabel +
            "**" +
            dateBit +
            "? Say **yes** to save to your **cart prep list** (`mdj_booth_cart_recommendations`), or a **number** to pick someone else from the list (1–" +
            nList +
            "). Need **another service** (DJ, lighting, photo…)?" +
            this.boothDiplomaticSalesCloser(false)
        );
    },

    boothTierLabel: function (row, isSpanish) {
        if (window.MDB_SUBSCRIPTION && typeof window.MDB_SUBSCRIPTION.isPremiumTier === "function" && window.MDB_SUBSCRIPTION.isPremiumTier(row)) {
            return isSpanish ? "PRO (prioridad)" : "PRO (priority)";
        }
        return isSpanish ? "LITE / reserva" : "LITE / backup";
    },

    boothLanguageHint: function (row, isSpanish) {
        var L = (row && row.languages) || "";
        var t = String(L).toLowerCase();
        var es = /\bes\b|spa|spanish|español|espanol/i.test(t);
        var en = /\ben\b|ingl|english/i.test(t);
        if (es && en) return isSpanish ? "ES + EN" : "ES + EN";
        if (es) return isSpanish ? "principalmente español" : "Spanish-forward";
        if (en) return isSpanish ? "principalmente inglés" : "English-forward";
        return isSpanish ? "idiomas en perfil" : "languages on profile";
    },

    boothSearchRankFallback: function (row) {
        if (window.MDB_SUBSCRIPTION && typeof window.MDB_SUBSCRIPTION.searchRankScore === "function") {
            return window.MDB_SUBSCRIPTION.searchRankScore(row);
        }
        var pl = String((row && row.plan) || "").toUpperCase();
        var st = String((row && row.plan_status) || "").toLowerCase();
        var active = st === "active" || !row.plan_expires_at || new Date(row.plan_expires_at) > new Date();
        var pro = row && (row.is_premium === true || pl === "PRO" || pl === "ELITE" || /pro/i.test(String(row.plan_type || "")));
        if (pro && active) return 1e9;
        return 0;
    },

    boothFetchRosterByRole: async function (roleCode) {
        var code = (roleCode || "").toUpperCase();
        if (!code) return [];
        var sb = typeof window.getSupabaseClient === "function" ? window.getSupabaseClient() : null;
        if (!sb) return [];
        try {
            var selFull =
                "dj_slug, stage_name, photo_url, city, roles, plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status, languages, lang_score";
            var selMin = "dj_slug, stage_name, photo_url, city, roles, plan, plan_type, plan_status, plan_expires_at, is_premium, subscription_status";
            var res = await sb.from("public_dj_profiles").select(selFull).eq("available", true).limit(140);
            if (res.error) res = await sb.from("public_dj_profiles").select(selMin).eq("available", true).limit(140);
            var data = (res && res.data) || [];
            var filtered = data.filter(function (r) {
                var parts = String(r.roles || "")
                    .split(",")
                    .map(function (x) {
                        return String(x).trim().toUpperCase();
                    })
                    .filter(Boolean);
                return parts.indexOf(code) !== -1;
            });
            filtered.sort(function (a, b) {
                return window.MDJ_Assistant.boothSearchRankFallback(b) - window.MDJ_Assistant.boothSearchRankFallback(a);
            });
            return filtered.slice(0, 8);
        } catch (err) {
            try {
                console.warn("[Booth] boothFetchRosterByRole:", err && err.message ? err.message : err);
            } catch (e2) {
                void e2;
            }
            return [];
        }
    },

    boothAppendCartRecommendation: function (row, roleCode, eventDate) {
        try {
            var raw = sessionStorage.getItem("mdj_booth_cart_recommendations");
            var arr = [];
            if (raw) arr = JSON.parse(raw);
            if (!Array.isArray(arr)) arr = [];
            arr.push({
                kind: "talent_pick",
                dj_slug: row.dj_slug,
                stage_name: row.stage_name,
                role_code: roleCode,
                event_date: eventDate,
                tier:
                    window.MDB_SUBSCRIPTION && typeof window.MDB_SUBSCRIPTION.isPremiumTier === "function" && window.MDB_SUBSCRIPTION.isPremiumTier(row)
                        ? "PRO"
                        : "LITE",
                ts: Date.now()
            });
            sessionStorage.setItem("mdj_booth_cart_recommendations", JSON.stringify(arr.slice(-12)));
        } catch (e) {
            void e;
        }
    },

    boothAppendLifeEventRecord: function (rec) {
        try {
            var raw = sessionStorage.getItem("mdj_booth_life_events");
            var arr = [];
            if (raw) arr = JSON.parse(raw);
            if (!Array.isArray(arr)) arr = [];
            arr.push(rec);
            sessionStorage.setItem("mdj_booth_life_events", JSON.stringify(arr.slice(-10)));
        } catch (e2) {
            void e2;
        }
    },

    boothLifeEventInferKind: function (lower) {
        if (/cumple|birthday/i.test(lower)) return "birthday";
        if (/aniversario|anniversary|bodas?\s+de\s+oro/i.test(lower)) return "anniversary";
        return "other";
    },

    boothLifeEventGuessHonoree: function (raw) {
        var m =
            /\b(?:para|de|homenajead[oa]|celebramos\s+a)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,22}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,22})?)\b/i.exec(raw) ||
            /\b(?:nombre|se\s+llama|llama)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,22}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,22})?)\b/i.exec(raw);
        return m ? m[1].trim() : null;
    },

    boothLifeEventGuessClientName: function (raw) {
        var m =
            /\b(?:me\s+llamo|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,22})\b/i.exec(raw) ||
            /\bsalud(?:a|ame)\s+como\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,22})\b/i.exec(raw);
        return m ? m[1].trim() : null;
    },

    boothLifeEventGuessChannel: function (lower) {
        if (/whatsapp|\bwa\b|wsp/i.test(lower)) return "whatsapp";
        if (/correo|e-mail|email|\bmail\b/i.test(lower)) return "email";
        if (/\bsms\b|texto|mensaje\s+de\s+texto/i.test(lower)) return "sms";
        return null;
    },

    boothLifeEventSavedReply: function (isSpanish, dateStr2, kind2, hon2, cli2) {
        var tipoEs =
            kind2 === "birthday" ? "cumpleaños" : kind2 === "anniversary" ? "aniversario" : "celebración";
        var tipoEn = kind2 === "birthday" ? "birthday" : kind2 === "anniversary" ? "anniversary" : "celebration";
        var honLabel = hon2 || (isSpanish ? "tu celebración" : "your celebration");
        var cliLabel = cli2 || (isSpanish ? "[tu nombre]" : "[your name]");
        if (isSpanish) {
            return (
                "Listo: quedó un **borrador** en tu navegador (`mdj_booth_life_events`) con la fecha **" +
                dateStr2 +
                "** (" +
                tipoEs +
                "). El **envío automático** (WhatsApp / correo / SMS) lo activa el equipo cuando enlace a tu **cuenta o lead** y con tu **consentimiento** (leyes de marketing y privacidad).\n\n" +
                "Ejemplo de mensaje el año siguiente (tú ajustas el tono):\n" +
                '• *"Hola **' +
                cliLabel +
                "** — soy **Miami DJ Beat**. El año pasado te ayudamos con **" +
                tipoEs +
                "** (" +
                honLabel +
                ')… vemos que se acerca de nuevo esa fecha. ¿Te gustaría **revivir ese momento icónico** con nosotros?"*\n' +
                (hon2
                    ? '• O en nombre del homenajeado: *"Hola, por parte de **' + hon2 + '**, Miami DJ Beat…"*\n\n'
                    : "\n") +
                this.boothDiplomaticSalesCloser(true)
            );
        }
        return (
            "Saved a **draft** on this device (`mdj_booth_life_events`) for **" +
            dateStr2 +
            "** (" +
            tipoEn +
            "). **Automated** WhatsApp / email / SMS goes through **ops + your account/lead** with proper **opt-in**.\n\n" +
            "Example outreach next year:\n" +
            '*"Hi **' +
            cliLabel +
            "** — **Miami DJ Beat** here. Last year we helped with your **" +
            tipoEn +
            "** for **" +
            honLabel +
            '**… that date is coming up again. Want to plan another **iconic** night with us?"*\n\n' +
            this.boothDiplomaticSalesCloser(false)
        );
    },

    /**
     * Cumple / aniversario / recordatorio anual: negocio amable + datos en `mdj_booth_life_events` (dispositivo).
     * Envío real SMS/email/WhatsApp = backend + consentimiento legal (TCPA/opt-in).
     */
    boothLifeEventRemarketingFlow: function (userInput) {
        var isSpanish = this.userLanguage === "es";
        var raw = (userInput || "").trim();
        var lower = raw.toLowerCase();
        var ctx = this.boothLifeEventCtx;
        var roster = this.boothRosterCtx;
        if (!ctx) return null;
        if (roster && (roster.step === "need_date" || roster.step === "after_offer")) return null;

        var lifeIntent =
            /\b(registrar|guardar|dejar\s+nota|apuntar)\b[\s\S]{0,48}\b(cumple|aniversario|fecha\s+conmemorativa|milestone)/i.test(lower) ||
            /\b(recordatorio\s+anu|recordar\s+cada\s+año|año\s+que\s+viene|año\s+siguiente|cada\s+año\s+(que\s+)?(me\s+)?(manden|envíen|recuerden|avisen)|mensaje\s+el\s+pr[oó]ximo\s+año)/i.test(lower) ||
            /\b(cumpleaños?|aniversario)\b[\s\S]{0,96}\b(mensaje|whatsapp|correo|mail|sms|manden|envíen|recordar|publicidad|avis)/i.test(lower) ||
            /\b(yearly|annual)\s+remind/i.test(lower) ||
            /\bnext\s+year[\s\S]{0,40}(email|text|whatsapp|remind)/i.test(lower);

        if (ctx.step === "awaiting_line") {
            if (/^\s*(cancelar|cancel|olvida|olvidalo|no\s+quiero|stop)\b/i.test(lower)) {
                ctx.step = "idle";
                return isSpanish
                    ? "Perfecto, no guardé ninguna fecha conmemorativa. ¿Seguimos con reservas o servicios?"
                    : "Okay — I didn’t save any milestone. Want to continue with bookings or services?";
            }
            var dateStr2 = this.boothParseEventDate(raw);
            if (!dateStr2) {
                return isSpanish
                    ? "Necesito la **fecha** en formato **día/mes** o **día/mes/año** (ej. 15/03 o 15/03/2027), y si puedes: **cumple** o **aniversario**, **nombre del homenajeado** (ej. para Sofía), cómo **te llamas tú** para el saludo, y si prefieres **WhatsApp**, **correo** o **SMS** cuando exista integración."
                    : "Please send the **date** as **day/month** or **day/month/year** (e.g. 15/03/2027), plus **birthday vs anniversary**, optional **honoree name**, how **you’d like to be addressed**, and preferred **WhatsApp / email / SMS** once we wire messaging.";
            }
            var kind2 = this.boothLifeEventInferKind(lower);
            var hon2 = this.boothLifeEventGuessHonoree(raw);
            var cli2 = this.boothLifeEventGuessClientName(raw);
            var ch2 = this.boothLifeEventGuessChannel(lower);
            this.boothAppendLifeEventRecord({
                kind: kind2,
                honoree_name: hon2,
                client_first_name: cli2,
                milestone_date: dateStr2,
                preferred_channel: ch2,
                notes_raw: raw.slice(0, 400),
                source: "booth_widget",
                ts: Date.now()
            });
            ctx.step = "idle";
            return this.boothLifeEventSavedReply(isSpanish, dateStr2, kind2, hon2, cli2);
        }

        if (ctx.step !== "idle") return null;
        if (!lifeIntent) return null;

        var dateStr = this.boothParseEventDate(raw);
        if (dateStr && /cumple|aniversario|birthday|anniversary/i.test(lower)) {
            var kind0 = this.boothLifeEventInferKind(lower);
            var hon0 = this.boothLifeEventGuessHonoree(raw);
            var cli0 = this.boothLifeEventGuessClientName(raw);
            var ch0 = this.boothLifeEventGuessChannel(lower);
            this.boothAppendLifeEventRecord({
                kind: kind0,
                honoree_name: hon0,
                client_first_name: cli0,
                milestone_date: dateStr,
                preferred_channel: ch0,
                notes_raw: raw.slice(0, 400),
                source: "booth_widget",
                ts: Date.now()
            });
            ctx.step = "idle";
            return this.boothLifeEventSavedReply(isSpanish, dateStr, kind0, hon0, cli0);
        }

        ctx.step = "awaiting_line";
        return isSpanish
            ? "Puedo **registrar una fecha conmemorativa** (cumple, aniversario, etc.) para que el equipo programe **recordatorios** cuando se acerque el año siguiente — por **WhatsApp**, **correo** o **SMS** (cuando esté conectado el canal y con tu **consentimiento explícito**).\n\n" +
                  "En **una sola línea** dime: **tipo** (cumple o aniversario), **fecha** (día/mes o día/mes/año), **nombre del homenajeado** si aplica (ej. *para Sofía*), cómo **te llamas** para saludarte (ej. *me llamo Juan*), y **canal** preferido (WhatsApp / correo / SMS).\n\n" +
                  "Ejemplo de tono de venta (no es envío automático todavía): *«Hola Juan — Miami DJ Beat: el año pasado armamos tu fiesta (X)… se acerca otra vez esa fecha; ¿revivimos ese momento icónico?»*\n\n" +
                  "Escribe esa línea aquí, o **cancelar** si cambiaste de idea." +
                  this.boothDiplomaticSalesCloser(true)
            : "I can **save a milestone date** (birthday, anniversary…) so ops can schedule **gentle reminders** next year via **WhatsApp**, **email**, or **SMS** once the channel is wired and you’ve given **explicit opt-in**.\n\n" +
                  "Send **one line**: **type** (birthday vs anniversary), **date** (day/month[/year]), optional **honoree** (e.g. *for Sofia*), how to **greet you** (e.g. *my name is Juan*), and preferred **channel**.\n\n" +
                  "Example tone (not auto-sent yet): *“Hi Juan — Miami DJ Beat: last year we hosted your party (X)… that date is coming up again; want to relive that iconic moment?”*\n\n" +
                  "Send your line, or say **cancel**." +
                  this.boothDiplomaticSalesCloser(false);
    },

    /**
     * Contratación por categoría (Jobs) + fecha: recomendaciones PRO primero, LITE después; estrellas; carrito vía sessionStorage.
     * Devuelve string si maneja el turno; null para seguir con el resto del Booth.
     */
    boothRosterAvailabilityFlow: async function (userInput) {
        var isSpanish = this.userLanguage === "es";
        var raw = (userInput || "").trim();
        var lower = raw.toLowerCase();
        var ctx = this.boothRosterCtx;
        if (!ctx) return null;

        if (ctx.step !== "idle" && /(\b(listo|ya termin[eé]|eso es todo|no necesito m[aá]s|gracias\s*adios)\b|i\x27m done|that\x27s all|no more thanks)/i.test(lower)) {
            ctx.step = "idle";
            ctx.roleCode = null;
            ctx.eventDate = null;
            ctx.candidates = [];
            ctx.pendingInvite = null;
            return isSpanish
                ? "Perfecto. Cuando quieras **cerrar la reservación**, el equipo puede seguir en **./services.html** o puedes explorar **./find-dj.html**. ¿Algo más?" +
                      this.boothDiplomaticSalesCloser(true)
                : "Great. When you’re ready to **finalize the booking**, our team can continue in **./services.html** or you can browse **./find-dj.html**. Anything else?" +
                      this.boothDiplomaticSalesCloser(false);
        }

        var hireVerb =
            /necesito|quiero|busco|contratar|hire|book|puedo\s+conseguir|hay\s+(alguien|algun|alguna)|recomienda|recommend|looking\s+for|get\s+me|need\s+an?\s|un\s+mc|a\s+mc|an\s+mc|para\s+(mi|una)\s+boda|for\s+a\s+wedding|para\s+el\s+evento/i.test(lower);
        var talentSignupNoise = /(^|\b)(soy|somos)\s+(un|una)?\s*(dj|mc|cantante)\b.*(trabajo|jobs|empleo|postul|perfil|apply)/i.test(lower);

        if (ctx.step === "need_date") {
            var d = this.boothParseEventDate(raw);
            if (!d) {
                return isSpanish
                    ? "Gracias. ¿Me das la **fecha del evento** (día/mes/año o mes día año)? Con eso busco en la categoría **" +
                          (ctx.roleCode || "") +
                          "** priorizando cuentas **PRO** y luego **LITE**."
                    : "Thanks. What’s the **event date** (day/month/year)? I’ll search **" +
                          (ctx.roleCode || "") +
                          "** with **PRO** accounts first, then **LITE**.";
            }
            ctx.eventDate = d;
            ctx.step = "has_list";
            ctx.candidates = await this.boothFetchRosterByRole(ctx.roleCode);
            if (!ctx.candidates.length) {
                ctx.step = "idle";
                return isSpanish
                    ? "No encontré talento público con esa categoría ahora mismo. Prueba **./find-dj.html** o deja datos en **./services.html** y el equipo asigna por disponibilidad real de agenda."
                    : "I didn’t find public roster matches for that category right now. Try **./find-dj.html** or **./services.html** so ops can match real calendar availability.";
            }
            var lines = [];
            lines.push(
                isSpanish
                    ? "Para **" + ctx.eventDate + "** en categoría **" + ctx.roleCode + "**, priorizo **MDJPRO / pagos** y luego **LITE**. Estrellas = referencia de idioma/perfil (no es reseña pública completa):"
                    : "For **" + ctx.eventDate + "** in **" + ctx.roleCode + "**, I list **paid PRO** first, then **LITE**. Stars = language / profile signal (not a full public review score):"
            );
            for (var i = 0; i < ctx.candidates.length; i++) {
                var c = ctx.candidates[i];
                var stars = this.boothFormatStars(c);
                var tier = this.boothTierLabel(c, isSpanish);
                var lang = this.boothLanguageHint(c, isSpanish);
                lines.push(
                    (i + 1) + ") **" + (c.stage_name || c.dj_slug || "Talent") + "** " + stars + " · " + tier + " · " + lang
                );
            }
            ctx.pendingInvite = ctx.candidates[0];
            ctx.step = "after_offer";
            lines.push(this.boothTopPickOfferParagraph(ctx.candidates[0], ctx.roleCode, ctx.eventDate, isSpanish, ctx.candidates.length));
            return lines.join("\n");
        }

        if (ctx.step === "after_offer") {
            if (this.isShortAffirmative(raw) && ctx.pendingInvite) {
                this.boothAppendCartRecommendation(ctx.pendingInvite, ctx.roleCode, ctx.eventDate);
                ctx.step = "idle";
                return isSpanish
                    ? "Listo: dejé la recomendación en tu lista (**mdj_booth_cart_recommendations**). Abre **./shop.html** o inicia sesión y revisa el icono del carrito. ¿Te interesa **algún otro servicio** para el mismo evento?" +
                          this.boothDiplomaticSalesCloser(true)
                    : "Done — saved to **`mdj_booth_cart_recommendations`**. Open **./shop.html** or sign in and check the cart icon. Interested in **another service** for the same event?" +
                          this.boothDiplomaticSalesCloser(false);
            }
            var pick = raw.match(/^\s*(\d)\s*$/);
            if (pick && ctx.candidates[pick[1] - 1]) {
                ctx.pendingInvite = ctx.candidates[pick[1] - 1];
                var pn = ctx.pendingInvite.stage_name || ctx.pendingInvite.dj_slug;
                return isSpanish
                    ? "Perfecto: " +
                          this.boothSpanishNivelYCreoAdecuado(ctx.pendingInvite) +
                          ". ¿Te gustaría que fuera tu **" +
                          this.boothRoleClientLabel(ctx.roleCode, true) +
                          "**? (**sí** / **no**)"
                    : "Got it — **" +
                          pn +
                          "** " +
                          this.boothLanguagePitch(ctx.pendingInvite, false) +
                          ", **" +
                          this.boothStarCount(ctx.pendingInvite) +
                          " out of 5 stars**. Would you like them as your **" +
                          this.boothRoleClientLabel(ctx.roleCode, false) +
                          "**? (**yes** / **no**)";
            }
            if (this.isShortNegative(raw)) {
                ctx.step = "idle";
                ctx.pendingInvite = null;
                return isSpanish
                    ? "Sin problema. Si cambias de idea, vuelve a pedir recomendaciones o abre **./find-dj.html**. ¿Algo más?"
                    : "No problem. If you change your mind, ask again or open **./find-dj.html**. Anything else?";
            }
            if (/^otro|^another|m[aá]s servicios|dj\b|sonido|luz|foto|video/i.test(lower)) {
                ctx.step = "idle";
                return isSpanish
                    ? "Seguimos: ¿qué otro rol o servicio necesitas (DJ, MC, sonido, foto, hora loca…)? Si es otro rol, dime cuál y la misma fecha **" +
                          (ctx.eventDate || "") +
                          "** o una nueva."
                    : "What else do you need (DJ, MC, sound, photo, hora loca…)? Tell me the role and the same date **" +
                          (ctx.eventDate || "") +
                          "** or a new one.";
            }
            return isSpanish
                ? "Dime **sí** para guardar en la lista, un **número** (1–" +
                      (ctx.candidates && ctx.candidates.length) +
                      ") o **ya terminé** si no necesitas más."
                : "Say **yes** to save to the list, a **number** (1–" +
                      (ctx.candidates && ctx.candidates.length) +
                      '), or **all set** if you’re done.';
        }

        if (ctx.step !== "idle") return null;

        if (talentSignupNoise) return null;
        var jobSeekerNoise =
            /\b(busco|buscamos)\s+(trabajo|empleo|gigs?|chamba|vacantes?)\b|looking\s+for\s+(work|a\s+job|gigs?)\b|need\s+a\s+job\b|quiero\s+trabajar\s+como\b|postul(o|ar|ando)\b|apply(ing)?\s+for\s+work\b/i.test(lower);
        if (jobSeekerNoise) return null;
        if (!hireVerb) return null;

        var role = this.boothInferJobsRoleFromHireMessage(lower);
        try {
            var jr = sessionStorage.getItem("mdj_jobs_roster_categories");
            if (!role && jr) {
                var parsed = JSON.parse(jr);
                if (parsed && parsed.codes && parsed.codes[0]) role = parsed.codes[0];
            }
        } catch (e1) {
            void e1;
        }
        if (!role) {
            return isSpanish
                ? "Puedo buscar por **categoría de Jobs** (MC, DJ, cantante, banda en vivo, etc.). ¿Qué rol necesitas y para qué **fecha**?"
                : "I can search by **Jobs roster category** (MC, DJ, vocalist, live band, etc.). Which role and **what date**?";
        }

        var dateGuess = this.boothParseEventDate(raw);
        if (!dateGuess) {
            ctx.step = "need_date";
            ctx.roleCode = role;
            ctx.eventDate = null;
            ctx.candidates = [];
            ctx.pendingInvite = null;
            return isSpanish
                ? "Genial — categoría **" +
                      role +
                      "**. Para buscar en el roster (PRO primero, LITE después; alineado con **./jobs.html**), dime la **fecha del evento** (día/mes/año)."
                : "Great — **" +
                      role +
                      "**. To search the roster (**PRO first**, then **LITE**, same rules as **./jobs.html**), send the **event date** (day/month/year).";
        }

        ctx.roleCode = role;
        ctx.eventDate = dateGuess;
        ctx.step = "has_list";
        ctx.candidates = await this.boothFetchRosterByRole(role);
        if (!ctx.candidates.length) {
            ctx.step = "idle";
            return isSpanish
                ? "No hay coincidencias públicas para **" + role + "** en esta fecha (solo talento marcado disponible en red). Sigue en **./find-dj.html** o **./services.html**."
                : "No public matches for **" + role + "** right now. Continue on **./find-dj.html** or **./services.html**.";
        }
        var out = [];
        out.push(
            isSpanish
                ? "Resultados para **" + role + "** · fecha **" + dateGuess + "** (PRO de pago primero, luego LITE):"
                : "Matches for **" + role + "** · date **" + dateGuess + "** (paid PRO first, then LITE):"
        );
        for (var j = 0; j < ctx.candidates.length; j++) {
            var cc = ctx.candidates[j];
            out.push(
                j + 1 + ") **" + (cc.stage_name || cc.dj_slug) + "** " + this.boothFormatStars(cc) + " · " + this.boothTierLabel(cc, isSpanish) + " · " + this.boothLanguageHint(cc, isSpanish)
            );
        }
        ctx.pendingInvite = ctx.candidates[0];
        ctx.step = "after_offer";
        out.push(this.boothTopPickOfferParagraph(ctx.candidates[0], role, dateGuess, isSpanish, ctx.candidates.length));
        return out.join("\n");
    },

    knowledgeBase: {
        platform: "Miami DJ Beat es la plataforma líder para DJs y entretenimiento en Florida.",
        plans: {
            "PRO": "El Plan PRO ofrece 9x más visualización, prioridad en búsquedas y perfil verificado por $29.99/mes.",
            "BASIC": "El Plan Básico permite crear un perfil y recibir solicitudes directas de clientes."
        },
        professionalHealth: {
            "artistic": "El Índice de Salud Artística mide tu reputación oficial combinando calificaciones de clientes y estabilidad profesional. Es tu sello de calidad ante la plataforma.",
            "financial": "La Salud Económica refleja tu flujo de caja real, estabilidad e ingresos proyectados en Miami DJ Beat.",
            "engagement": "El Engagement de Trabajo mide tu volumen de actividad, posicionamiento y capacidad de atracción de nuevos clientes.",
            "tips": "Las Propinas y Comisiones son ingresos adicionales que ganas por excelencia en el servicio y por referir nuevos clientes mediante tu QR oficial.",
            "ticket": "El Ticket Promedio indica tu valor actual en el mercado, ayudándote a ajustar tus tarifas para maximizar ganancias."
        }
    },

    init: function () {
        this.setupEvents();
    },

    setupEvents: function () {
        const trigger = document.querySelector('.booth-trigger');
        const sendBtn = document.querySelector('.booth-send-btn');
        const input = document.querySelector('.booth-input-area input');

        if (trigger) {
            trigger.addEventListener('click', () => this.toggleWindow());
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendMessage());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSendMessage();
            });
        }
    },

    toggleWindow: function () {
        const booth = document.getElementById('mdj-assistant-booth');
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            booth.classList.add('active');
            if (document.querySelectorAll('.message').length === 0) {
                var _boothName = window.__mdjBoothDisplayName && window.__mdjBoothDisplayName !== 'Member' ? window.__mdjBoothDisplayName : '';
                var _boothGreet = _boothName
                    ? 'Hola, ' + _boothName + '. Soy Booth, el agente de Miami DJ Beat — dime qué necesitas y lo cerramos ahora mismo.'
                    : 'Soy Booth, el agente de Miami DJ Beat. Reservas, artistas, equipos, cursos — dime qué necesitas y lo resolvemos ahora.';
                this.addMessage('assistant', _boothGreet);
            }
        } else {
            booth.classList.remove('active');
        }
    },

    handleSendMessage: function () {
        const input = document.querySelector('.booth-input-area input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage("user", text);
        input.value = '';

        // Simulación de Cerebro AI (Venta/Negociación/State Machine)
        setTimeout(() => {
            Promise.resolve(this.processAIResponse(text)).catch((err) => {
                try {
                    console.warn("processAIResponse", err);
                } catch (e0) {
                    void e0;
                }
                var self = window.MDJ_Assistant;
                var es = self && self.userLanguage === "es";
                if (self && typeof self.addMessage === "function") {
                    self.addMessage(
                        "assistant",
                        es
                            ? "Algo falló al procesar tu mensaje. Intenta de nuevo o abre **./services.html** para hablar con el equipo."
                            : "Something went wrong processing your message. Try again, or open **./services.html** to reach the team."
                    );
                }
            });
        }, 800);
    },

    _renderMarkdown: function (text) {
        // Escapa HTML base para seguridad
        var s = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        // Links markdown [texto](url) → <a>
        s = s.replace(/\[([^\]]+)\]\((\/[^\)]*|https?:\/\/[^\)]*)\)/g, function (_, label, url) {
            var isInternal = url.startsWith('/');
            var target = isInternal ? '_self' : '_blank';
            var rel = isInternal ? '' : ' rel="noopener noreferrer"';
            return '<a href="' + url + '" target="' + target + '"' + rel + ' style="color:#c9a84c;text-decoration:underline;">' + label + '</a>';
        });
        // **negrita**
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // *itálica*
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // saltos de línea
        s = s.replace(/\n/g, '<br>');
        return s;
    },

    addMessage: function (role, text) {
        const msgContainer = document.querySelector('.booth-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        if (role === 'assistant') {
            msgDiv.innerHTML = this._renderMarkdown(text);
        } else {
            msgDiv.textContent = text;
        }
        msgContainer.appendChild(msgDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    },

    /**
     * Llama a la Edge Function booth-chat (GPT-4o-mini).
     * Retorna el texto de la respuesta o null si falla (fallback a scripted).
     */
    _callBoothLLM: async function (userInput, isSpanish) {
        try {
            var base = (window.MDB_SUPABASE_URL || "").replace(/\/$/, "");
            var key = window.MDB_SUPABASE_ANON_KEY || "";
            if (!base || !key) return null;

            var endpoint = base + "/functions/v1/booth-chat";

            // Contexto de sesión: identidad del usuario + MDJBoothCapture
            var context = "";
            try {
                // Identidad del usuario logueado
                var _boothCtxParts = [];
                var _name = window.__mdjBoothDisplayName;
                if (_name && _name !== 'Member') {
                    _boothCtxParts.push('Nombre del usuario: ' + _name);
                }
                var _idn = window.__mdjLastPlatformIdentity;
                if (_idn) {
                    var _principal = _idn.principal || '';
                    if (_principal === 'performer') _boothCtxParts.push('Rol: Artista DJ de la plataforma');
                    else if (_principal === 'buyer') _boothCtxParts.push('Rol: Cliente/Fan');
                    else if (_principal === 'staff') _boothCtxParts.push('Rol: Staff de Miami DJ Beat');
                }
                if (_boothCtxParts.length > 0) context = _boothCtxParts.join(' | ');

                // Contexto adicional de MDJBoothCapture (URL params, intención)
                if (window.MDJBoothCapture && typeof window.MDJBoothCapture.getAgentSystemHint === "function") {
                    var _capture = window.MDJBoothCapture.getAgentSystemHint() || "";
                    if (_capture) context = context ? context + '\n' + _capture : _capture;
                }
            } catch (_e) { /* sin contexto */ }

            var res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + key,
                    "apikey": key,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: userInput,
                    history: this._chatHistory.slice(-20),
                    context: context,
                }),
            });

            if (!res.ok) return null;
            var data = await res.json();
            return (typeof data.reply === "string" && data.reply.trim()) ? data.reply.trim() : null;
        } catch (_err) {
            return null;
        }
    },

    processAIResponse: async function (userInput) {
        const input = userInput.toLowerCase();

        // 1. LANGUAGE LOCK (Only evaluate once per session)
        if (!this.userLanguage) {
            const spanishFlags = /[áéíóúñ]|hola|buenos|tardes|noches|como|puedes|vender|plan|precio|fiesta|quiero|necesito|cuanto|cuesta|música|evento|trabajar|clientes|gano|dinero|mejorar|perfil|español|espanol|spanish/.test(input);
            const englishFlags = /hello|hi|how|party|hire|book|expensive|budget|english|ingles|what|why|where|when|dj/.test(input);

            if (englishFlags && !spanishFlags) this.userLanguage = "en";
            else this.userLanguage = "es"; // Default to Spanish in Miami if mixed or unsure
        }
        const isSpanish = this.userLanguage === "es";

        var safety = this.confidentialityAndSafetyReply(userInput, isSpanish);
        if (safety) {
            this.addMessage("assistant", safety);
            return;
        }

        // ── LLM (GPT-4o-mini vía booth-chat) ─────────────────────────────────
        // Intentamos LLM primero; si falla o retorna null, caemos al scripted.
        var llmReply = await this._callBoothLLM(userInput, isSpanish);
        if (llmReply) {
            this._chatHistory.push({ role: "user", content: userInput });
            this._chatHistory.push({ role: "assistant", content: llmReply });
            // Limitar historial a 20 mensajes (10 intercambios)
            if (this._chatHistory.length > 20) this._chatHistory.splice(0, 2);
            this.addMessage("assistant", llmReply);
            return;
        }
        // ─────────────────────────────────────────────────────────────────────

        var ensembleWork = this.ensembleSubscriptionWorkReply(userInput, isSpanish);
        if (ensembleWork) {
            this.addMessage("assistant", ensembleWork);
            return;
        }

        var photoBoothRent = this.photoBoothRentClientReply(userInput, isSpanish);
        if (photoBoothRent) {
            this.addMessage("assistant", photoBoothRent);
            return;
        }

        try {
            var rosterFlow = await this.boothRosterAvailabilityFlow(userInput);
            if (rosterFlow) {
                this.addMessage("assistant", rosterFlow);
                return;
            }
        } catch (eRoster) {
            try {
                console.warn("boothRosterAvailabilityFlow", eRoster);
            } catch (e1) {
                void e1;
            }
            this.addMessage(
                "assistant",
                isSpanish
                    ? "No pude consultar el roster ahora. Prueba **./find-dj.html** o **./services.html**."
                    : "I couldn’t query the roster right now. Try **./find-dj.html** or **./services.html**."
            );
            return;
        }

        var lifeFlow = this.boothLifeEventRemarketingFlow(userInput);
        if (lifeFlow) {
            this.addMessage("assistant", lifeFlow);
            return;
        }

        var jobsRoleSub = this.jobsRoleSubscriptionReply(userInput, isSpanish);
        if (jobsRoleSub) {
            this.addMessage("assistant", jobsRoleSub);
            return;
        }

        var siteKb = this.siteKnowledgeReply(userInput, isSpanish);
        var wantsSubscription = /suscrib|suscripci[oó]n|registr|crear cuenta|sign\s*up|signup|membres[ií]a|plan pro|mdjpro|djpro|darme de alta|alta en la plataforma|quiero (una )?cuenta|necesito (cuenta|registr|darme de alta)|get (an )?account|create (an )?account/i.test(userInput);
        var subKb = wantsSubscription ? this.subscriptionGuideReply(userInput, isSpanish, !!siteKb) : null;

        if (siteKb && subKb) {
            this.addMessage("assistant", siteKb + "\n\n" + subKb);
            return;
        }
        if (siteKb) {
            this.addMessage("assistant", siteKb);
            return;
        }
        if (subKb) {
            this.addMessage("assistant", subKb);
            return;
        }

        // GLOBAL INTENT DETECTORS
        const isClientLaunch = /fiesta|dj|cuanto cuesta|cuesta|música|musica|evento|contratar|book|hire|party|wedding|boda|quince|15 años|15 anos|fecha|city|ciudad/.test(input);
        const isDJLaunch = /trabajar|clientes|gano|mejorar|trabajo|gig|work|apply|ganar|plan|pro\b|suscripcion|subscription|membresia|perfil|profile|soy\s+dj\b|soy\s+d\.j\.|i\s+am\s+a\s+dj/i.test(input);

        // "Soy cantante / músico…" — not the default hire-DJ vs work-as-DJ loop
        var talentRoleMatch = /^\s*soy\s+(?:un\s+|una\s+)?(cantante|singer|músico|musician|vocalista|baterista|guitarrista|mc|animador|animadora|host|fot[oó]grafo|fotografo|tecladista|saxofonista|trompetista|violinista|percusionista|harpista|artista|banda|corista|productor|productora|ingeniero\s+de\s+sonido|sonidista)\b/i.exec(userInput.trim());
        if (!talentRoleMatch) {
            talentRoleMatch = /\btrabajo\s+como\s+(cantante|singer|músico|musician|vocalista|baterista|guitarrista|mc|animador|animadora|artista)\b/i.exec(userInput.trim());
        }
        if (!talentRoleMatch && /me\s+dedico\s+al\s+canto|cantante\s+profesional|soy\s+una\s+cantante|canto\s+en\s+eventos|cant[oó]\s+en\s+vivo/i.test(userInput.trim())) {
            talentRoleMatch = ['', 'cantante'];
        }
        const isOtherTalentSelfId = !!(talentRoleMatch && talentRoleMatch[1] && !/^dj$/i.test(talentRoleMatch[1]));

        const isSpanishOnlyRequest = /^(puedes\s+)?hablar\s+en\s+español|hablas\s+español|en\s+español|español\s+por\s+favor|solo\s+español|spanish\s+only|in\s+spanish/i.test(input.trim());

        // ADVANCED CLOSER INTENTS
        const isPremiumEvent = /wedding|boda|quince|15 años|15 anos|corporate|corporativo/.test(input);
        const isObjection = /caro|expensive|high price|presupuesto|budget|mucho|rebaja|descuento/.test(input);
        const isLowball = (isPremiumEvent && (/350|400|500|barato|cheap|poco/.test(input))) || (isObjection && /350|400|500/.test(input));
        const isExplanation = /que incluye|incluye|what do i get|what does it include|detalles|details|por que tan|why is it/.test(input);

        // UI NAVIGATION AWARENESS
        const isUINavigation = /donde|where|no veo|encuentro|find|where is|ubicacion|boton|button|pestaña|tab|no aparece/.test(input);

        let response = "";

        // GLOBAL INTERCEPT 1: UI NAVIGATION HELP (Spatial Awareness)
        if (isUINavigation && (this.sessionState === "B2C_PRICING" || this.sessionState === "B2C_CLOSING" || this.sessionState === "B2C_OBJECTION" || this.sessionState === "DISCOVERY")) {
            this.sessionState = "B2C_CLOSING"; // Lock them in closing since they are looking for the button
            response = isSpanish
                ? "Claro, te guío paso a paso para que no te pierdas:\n\n1. Entra al módulo de 'Entertainment & Talent' en la página principal.\n2. Abre la pestaña 'DJ / Performance'.\n3. Selecciona la categoría exacta de tu evento.\n4. Ahí mismo, dentro de la tarjeta, verás el botón 'Reserve Your Date'.\n\n¿Qué pantalla estás viendo ahora mismo? Te ayudo desde ahí."
                : "Sure, let me guide you step by step so you don't get lost:\n\n1. Enter the 'Entertainment & Talent' module on the main page.\n2. Open the 'DJ / Performance' tab.\n3. Select your exact event category.\n4. Right there inside the card, you'll see the 'Reserve Your Date' button.\n\nWhat screen are you looking at right now? I'll guide you from there.";
            this.addMessage("assistant", this.boothTailWithOptionalCloser(response, isSpanish));
            return;
        }

        // GLOBAL INTERCEPT 2: PRICE DEFENSE SYSTEM (LOWBALLING PREMIUM EVENTS)
        if (isLowball || (isObjection && isPremiumEvent)) {
            this.sessionState = "B2C_QUALIFICATION"; // Lock them in the funnel
            response = isSpanish
                ? "Perfecto, gracias por decirme eso.\n\nTe explico rápido para que tengas claridad:\nUn evento importante (como bodas o 15 años) no funciona como una fiesta básica de $350. Ahí ya estamos hablando de una experiencia completa — música, animación, estructura del evento, momentos especiales…\n\nNuestros paquetes premium comienzan entre $1500 y $2000 dependiendo de lo que quieras incluir. Pero tranquilo, eso no significa que no se pueda ajustar.\n\nDéjame ayudarte a armar algo que tenga buen impacto sin romperte el presupuesto. ¿Para qué fecha es el evento y en qué ciudad?"
                : "Perfect, thanks for telling me that.\n\nLet me explain quickly for clarity:\nA major event (like a wedding or sweet 16) doesn't work like a basic $350 party. We are talking about a complete experience — music, MCing, event structure, special moments…\n\nOur premium packages start between $1500 and $2000 depending on what you want to include. But don't worry, that doesn't mean we can't adjust it.\n\nLet me help you build something with a great impact without breaking your budget. What date is the event and in what city?";
            this.addMessage("assistant", this.boothTailWithOptionalCloser(response, isSpanish));
            return;
        }

        // STATE MACHINE ENGINE
        switch (this.sessionState) {

            // STATE 1: DISCOVERY (Initial routing - WILL NOT RETURN HERE)
            case "DISCOVERY":
                if (isObjection) {
                    this.sessionState = "B2C_OBJECTION";
                    response = isSpanish
                        ? "Entiendo completamente. En Miami DJ Beat no competimos por precio, sino por el nivel absoluto de la experiencia.\n\nTrabajar con nuestro roster garantiza sonido élite y cero dolores de cabeza. ¿Te gustaría ver una primera cotización oficial sin compromiso?"
                        : "I completely understand. At Miami DJ Beat, we don't compete on price—we compete on the absolute level of the experience.\n\nBooking our roster guarantees elite sound and zero headaches. Would you like to see a first official quote with no commitment?";
                } else if (isOtherTalentSelfId && talentRoleMatch) {
                    this.sessionState = "B2B_EVANGELIST";
                    const roleRaw = talentRoleMatch[1];
                    const roleNorm = roleRaw.toLowerCase();
                    this.sessionTalentRole = roleNorm;
                    const rolePretty = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1).toLowerCase();
                    const isSinger = /^(cantante|singer|vocalista)$/.test(roleNorm);
                    response = isSinger
                        ? (isSpanish
                            ? `Entendido: eres ${rolePretty}. En bodas y eventos privados suele combinarse voz en vivo con el DJ de la noche; también hay cabida para sets acústicos o momentos especiales.\n\n¿Buscas **trabajar** como cantante en la red (perfil, demos, booking) o **contratar** un DJ u otro servicio para un evento tuyo?`
                            : `Got it — you’re a ${rolePretty}. Private events often pair live vocals with the night’s DJ; acoustic sets or special moments work too.\n\nAre you looking to **work** as a singer on the network (profile, demos, booking) or **hire** a DJ or another service for your own event?`)
                        : (isSpanish
                            ? `Entendido: eres ${rolePretty}. Miami DJ Beat está centrada en DJs y producción de eventos, pero también conecta talento y entretenimiento.\n\n¿Entonces buscas trabajar en eventos con nosotros (perfil, visibilidad, booking) o contratar un DJ u otro servicio para tu propio evento?`
                            : `Got it — you’re a ${rolePretty}. Miami DJ Beat focuses on DJs and event production, but also connects talent and entertainment.\n\nSo are you looking to work events with us (profile, visibility, booking) or hire a DJ or another service for your own event?`);
                } else if (isSpanishOnlyRequest) {
                    this.userLanguage = "es";
                    response = "Sí, seguimos en español. Miami DJ Beat es principalmente DJs y producción de eventos; también conecta talento. ¿Buscas contratar un DJ para un evento o quieres trabajar como artista en la plataforma?";
                } else if (isClientLaunch && !isDJLaunch) {
                    this.sessionState = "B2C_QUALIFICATION";
                    response = isSpanish
                        ? "Hagámoslo realidad. Para darte la información exacta, ¿qué tipo de evento estás organizando, en qué ciudad y para qué fecha?"
                        : "Let's make it happen. To give you the exact information, what type of event are you organizing, in what city, and for what date?";
                } else if (isDJLaunch) {
                    this.sessionState = "B2B_EVANGELIST";
                    this.sessionTalentRole = "dj";
                    response = isSpanish
                        ? "Excelente. Aquí en Miami DJ Beat, no solo tocas música, manejas tu propio negocio. ¿Estás buscando optimizar tu Perfil, revisar tus Ingresos en el Dashboard, o ver lo de la Agenda?"
                        : "Excellent. Here at Miami DJ Beat, you don't just play music, you run your own business. Are you looking to optimize your Profile, check your Income Dashboard, or look at your Schedule?";
                } else if (this.isShortAffirmative(userInput)) {
                    response = isSpanish
                        ? "Genial. En una línea: ¿necesitas contratar un DJ para un evento, o quieres crecer como DJ en la plataforma?"
                        : "Great. In one line: do you need to hire a DJ for an event, or grow as a DJ on the platform?";
                } else if (this.isShortNegative(userInput)) {
                    response = isSpanish
                        ? "Sin problema. Dime qué necesitas (evento, precio, perfil, plan PRO…) y te digo el siguiente paso."
                        : "No problem. Tell me what you need—event, pricing, profile, PRO plan—and I’ll point you to the next step.";
                } else {
                    response = isSpanish
                        ? "Sí claro. El foco principal es DJs y producción de eventos, pero también conectamos talento y entretenimiento.\n\n¿Buscas contratar un servicio para tu evento, o quieres trabajar como artista (DJ u otro rol) en la plataforma?"
                        : "Sure. Our core is DJs and event production, but we also connect talent and entertainment.\n\nAre you looking to hire a service for your event, or work as an artist (DJ or another role) on the platform?";
                }
                break;

            // STATE 2: QUALIFICATION
            case "B2C_QUALIFICATION":
                if (isObjection) {
                    this.sessionState = "B2C_OBJECTION";
                    response = isSpanish
                        ? "Entiendo completamente. En Miami DJ Beat no competimos por precio, sino por el nivel absoluto de la experiencia. Si buscas una producción impecable, podemos diseñar un setup a la medida. ¿Te envío una propuesta oficial?"
                        : "I completely understand. At Miami DJ Beat, we don't compete on price—we compete on the absolute level of the experience. If you're looking for flawless production, we can design a custom setup. Should I send an official proposal?";
                    break;
                }
                if (this.isShortAffirmative(userInput)) {
                    response = isSpanish
                        ? "Perfecto. Para cotizar bien: ¿tipo de evento, ciudad y fecha?"
                        : "Great. For a solid quote: event type, city, and date?";
                    break;
                }
                if (this.isShortNegative(userInput)) {
                    response = isSpanish
                        ? "Entiendo. ¿Qué te frena: presupuesto, fecha o tipo de evento? Te ayudo a encajarlo."
                        : "Got it. What’s the blocker—budget, date, or event type? I’ll help you fit it.";
                    break;
                }
                // Transitioning from Qualification to Pricing
                this.sessionState = "B2C_PRICING";
                response = isSpanish
                    ? "Perfecto. Dependiendo de la magnitud de la producción, nuestros paquetes en esta categoría comienzan desde $350 hasta setups premium de $1500+, siempre manteniendo el estándar exclusivo de Miami DJ Beat.\n\n¿Quieres que armemos una cotización enfocada en valor o prefieres que armemos la ruta premium de una vez?"
                    : "Perfect. Depending on the scale of production, our packages in this category start from $350 up to premium setups of $1500+, always maintaining the exclusive Miami DJ Beat standard.\n\nDo you want us to build a value-focused quote, or would you prefer we build the premium route right away?";
                break;

            // STATE 3: PRICING
            case "B2C_PRICING":
                if (isObjection) {
                    this.sessionState = "B2C_OBJECTION";
                    response = isSpanish
                        ? "Lo entiendo. Como te comentaba, no competimos por precio, sino por la garantía de la experiencia.\n\nTrabajar con nuestro roster asegura sonido premium y que todo salga perfecto. ¿Quieres que generemos la factura previa para que la evalúes tranquilamente?"
                        : "I understand. As I mentioned, we don't compete on price, but on the guarantee of the experience.\n\nBooking our roster ensures premium sound and that everything goes perfectly. Do you want us to generate the preliminary invoice for you to evaluate quietly?";
                } else if (isExplanation) {
                    this.sessionState = "B2C_CLOSING";
                    response = isSpanish
                        ? "Claro. Al reservar con nosotros estás asegurando talento de élite de Miami, sonido de primera línea y curaduría musical diseñada para eventos de lujo.\n\nNosotros nos encargamos de que la energía de la noche sea perfecta. ¿Listo para que aseguremos tu fecha en el sistema?"
                        : "Sure. Booking with us secures elite Miami talent, top-tier sound, and musical curation designed for luxury events.\n\nWe make sure the energy of the night is absolutely perfect. Ready for us to secure your date in the system?";
                } else {
                    this.sessionState = "B2C_CLOSING";
                    response = isSpanish
                        ? "¡Esa es la actitud! Para avanzar al siguiente nivel, simplemente selecciona la categoría de tu evento en esta página, haz clic en 'Reserve Your Date' y generaremos tu invoice oficial para asegurar la fecha.\n\n¿Tienes alguna duda antes de avanzar?"
                        : "That's the attitude! To move forward to the next level, simply select your event category on this page, click 'Reserve Your Date', and we will generate your official invoice to secure the date.\n\nDo you have any questions before moving forward?";
                }
                break;

            // STATE 4: OBJECTION HANDLING
            case "B2C_OBJECTION":
                // Push to Closing Phase
                this.sessionState = "B2C_CLOSING";
                response = isSpanish
                    ? "Excelente. Ve a la categoría de tu evento en esta pantalla y haz clic en 'Reserve Your Date'. Ahí podrás ingresar tus datos y el sistema arrojará la cotización exacta del depósito requerido, sin compromiso de inicio.\n\n¿Te ubico con el botón?"
                    : "Excellent. Go to your event category on this screen and click 'Reserve Your Date'. There you can enter your details and the system will show the exact quote for the required deposit, with no initial commitment.\n\nDo you need help finding the button?";
                break;

            // STATE 5: CLOSING (End of funnel loop)
            case "B2C_CLOSING":
                if (this.isShortAffirmative(userInput)) {
                    response = isSpanish
                        ? "Perfecto. Siguiente paso: elige categoría de evento → 'Reserve Your Date' → completa datos y depósito para bloquear la fecha. Si algo no aparece, dime qué pantalla ves."
                        : "Perfect. Next: pick your event category → “Reserve Your Date” → fill details and deposit to lock the date. If something doesn’t show, tell me what you see on screen.";
                } else if (this.isShortNegative(userInput)) {
                    response = isSpanish
                        ? "Sin problema. ¿Es el precio, la fecha o que no encuentras el botón? Dime cuál y te guío en un paso."
                        : "No problem. Is it price, date, or the button you can’t find? Say which and I’ll guide you in one step.";
                } else if (/gracias|thanks|thank you|muchas gracias|thx\b|ty\b|perfecto gracias/i.test(userInput)) {
                    response = isSpanish
                        ? "De nada. Cuando quieras cerrar la fecha, usa 'Reserve Your Date' en la categoría de tu evento. Si surge algo más, escribe aquí."
                        : "You’re welcome. When you’re ready to lock the date, use “Reserve Your Date” under your event category. If anything else comes up, message me here.";
                } else {
                    response = isSpanish
                        ? "¡Genial! Solo haz clic en 'Reserve Your Date' en el panel de DJs para completar esta parte y acceder a tu Invoice Oficial. ¡Yo estaré aquí si me necesitas!"
                        : "Great! Just click on 'Reserve Your Date' in the DJ panel to complete this part and access your Official Invoice. I'll be here if you need me!";
                }
                break;

            // SECONDARY STATE: B2B EVANGELIST
            case "B2B_EVANGELIST":
                const b2bProfile = /perfil|profile|estrellas|stars|rating|reviews|reseña|visibilidad/.test(input);
                const b2bFinance = /dinero|money|pago|finanzas|finance|dashboard|ingresos|cobrar|propinas|tips/.test(input);
                const b2bCalendar = /calendario|calendar|clima|weather|lluvia|organizar|planificar/.test(input);
                const b2bPlan = /plan|pro\b|suscripcion|subscription|membresia|precio/.test(input);
                const b2bStrategy = /estrategia|strategy|margen|margin|objetivo|kpi|objeci[oó]n|objection|negocio|business|pricing|precio justo|fee|honorario|criterio|decisi[oó]n|problema de negocio/.test(input);
                const singerFollowUp = /^(cantante|singer|vocalista)$/.test((this.sessionTalentRole || "").toLowerCase());
                const singerLex = /canto|voz|vocal|live|acústico|acoustic|boda|show|gig|repertorio|demo|bilingüe|bilingue|duo|dúo|dúo con|con dj/i.test(input);

                if (singerFollowUp && singerLex && !b2bPlan) {
                    response = isSpanish
                        ? "Para cantantes en MDJB: deja en el perfil estilo (pop, latin, bilingüe…), demos cortos, ciudad y si haces dúo o momentos con DJ. Los clientes buscan claridad de paquete y disponibilidad. ¿Quieres priorizar perfil o cotizaciones?"
                        : "For singers on MDJB: put style (pop, Latin, bilingual…), short demos, city, and whether you pair with a DJ. Clients want clear packages and availability. Profile or quoting first?";
                } else if (singerFollowUp && this.isShortAffirmative(userInput)) {
                    response = isSpanish
                        ? "Genial. Como cantante: sube demos, repertorio y ciudad al perfil; el Plan PRO ayuda en visibilidad. Muchos shows combinan voz en vivo + DJ el mismo evento. ¿Seguimos con perfil o con ingresos / Cash Flow?"
                        : "Great. As a singer: add demos, repertoire, and city to your profile; PRO helps visibility. Many gigs pair live vocals + DJ the same night. Profile or income / Cash Flow next?";
                } else if (singerFollowUp && this.isShortNegative(userInput)) {
                    response = isSpanish
                        ? "Sin problema. Cuando quieras, arma el perfil con 1 demo y tu zona; sin eso es difícil cotizar. ¿Te guío con el perfil o con precios/paquetes?"
                        : "No rush. When you’re ready, add one demo and your area—without that it’s hard to quote. Want help with profile or pricing packages?";
                } else if (b2bStrategy && !b2bPlan && !b2bProfile && !b2bFinance && !b2bCalendar) {
                    response = isSpanish
                        ? "Te doy criterios prácticos, sin datos internos: (1) define tu paquete por valor percibido — horas, producción, equipo y riesgo; (2) ancla con reseñas y perfil verificado; (3) maneja objeciones separando precio vs. resultado; (4) sube ticket con add-ons claros (horas extra, MC, luces). Si quieres, bajamos esto a tu perfil MDJ o a tu flujo de cotización en la plataforma."
                        : "Here’s practical criteria—no internal data: (1) package by perceived value—hours, production, gear, risk; (2) anchor with reviews and a verified profile; (3) handle objections by splitting price vs. outcome; (4) raise ticket size with clear add-ons. Want to map this to your MDJ profile or quoting flow?";
                } else if (b2bPlan) {
                    response = isSpanish
                        ? "¡Excelente pregunta! El Plan PRO es la herramienta definitiva que usa la élite de DJs en la ciudad para tener máxima prioridad en búsquedas. ¿Quieres que elevemos tu perfil hoy mismo?"
                        : "Great question! The PRO Plan is the definitive tool used by the elite DJs in the city to have maximum search priority. Should we elevate your profile today?";
                } else if (b2bProfile) {
                    response = isSpanish
                        ? "Asi es. Tu Perfil Público es tu carta de presentación ejecutiva, y los clientes VIP reservan ahí directamente. Las buenas calificaciones aquí te abren la puerta a los mejores eventos. ¿Tu perfil ya está al nivel que exige Miami?"
                        : "Exactly. Your Public Profile is your executive business card, and VIP clients book you directly there. Great reviews here open the doors to the best events. Is your profile already at the level Miami demands?";
                } else if (b2bFinance) {
                    response = isSpanish
                        ? "Hablemos de negocios serios. El panel Flujo de caja te da visibilidad de ingresos y métricas; SoundForTips™ (propinas en cabina) va aparte y es MDJPRO de pago. ¿Ya revisaste tu Cash Flow?"
                        : "Let's talk serious business. Cash Flow shows your income and metrics; SoundForTips™ (live booth tips) is separate and requires paid DJ PRO. Have you checked your Cash Flow yet?";
                } else if (b2bCalendar) {
                    response = isSpanish
                        ? "Una ventaja crítica. Con el Radar de Clima y Calendario integrado, blindas tu agenda corporativa y mitigas riesgos de equipo protegido. ¿Tu agenda ya está sincronizada al 100%?"
                        : "A critical advantage. With the integrated Weather Radar and Calendar, your corporate schedule is bulletproof and you mitigate gear risks. Is your schedule 100% synced yet?";
                } else if (this.isShortAffirmative(userInput)) {
                    response = isSpanish
                        ? "Perfecto, seguimos. Para subir de nivel: perfil público con video y reseñas, precios claros, revisa ingresos en el dashboard y considera Plan PRO para prioridad en búsquedas. ¿Qué quieres atacar primero: perfil, ingresos o plan PRO?"
                        : "Great—let’s move on. Level up with a strong public profile (video, reviews, clear pricing), check income on your dashboard, and consider PRO for search priority. What first: profile, income, or PRO?";
                } else if (this.isShortNegative(userInput)) {
                    response = isSpanish
                        ? "Sin problema. Podemos subir el nivel paso a paso: completa fotos y demo en el perfil, define un paquete claro y pide reseñas a clientes satisfechos. ¿Te guío primero con el perfil o con la estructura de precios?"
                        : "No problem—we can level up step by step: add photos and a demo on your profile, define a clear package, and ask happy clients for reviews. Want help with profile or pricing structure first?";
                } else {
                    response = isSpanish
                        ? "Como te decía, nuestro Motor de Booking está diseñado para atraer clientes de nivel. En Miami DJ Beat exigimos excelencia. ¿Tienes el nivel para empezar a recibir estos eventos exclusivos?"
                        : "As I mentioned, our Booking Engine is designed to attract high-tier clients. At Miami DJ Beat, we demand excellence. Do you have the level required to start receiving these exclusive events?";
                }
                break;
        }

        if (!response || !String(response).trim()) {
            response = isSpanish
                ? "Puedo ayudarte con ventas, objeciones y criterios de negocio de forma clara; no manejo datos confidenciales ni secretos internos. ¿Buscas contratar un DJ, o eres DJ y quieres mejorar perfil, ingresos o plan?"
                : "I can help with sales, objections, and business criteria clearly—I don’t handle confidential data or internal secrets. Are you hiring a DJ, or are you a DJ looking to improve profile, income, or your plan?";
        }

        if (this.sessionState !== "B2B_EVANGELIST") {
            response = this.boothTailWithOptionalCloser(response, isSpanish);
        }

        this.addMessage("assistant", response);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.MDJ_Assistant) window.MDJ_Assistant.init();
});
