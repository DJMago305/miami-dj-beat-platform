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
    userLanguage: null, // "es" or "en"
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
        console.log("Booth Assistant AI Initialized — State Machine & Negotiation Ready");
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
                this.addMessage("assistant", "Hello! I’m Booth — I help with bookings, plans, and DJ business in a clear, human way. I don’t share confidential or internal company data. / ¡Hola! Soy Booth: te ayudo con reservas, planes y negocio DJ con criterio claro. No comparto información confidencial ni secretos internos. ¿En qué te apoyo?");
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
            this.processAIResponse(text);
        }, 800);
    },

    addMessage: function (role, text) {
        const msgContainer = document.querySelector('.booth-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.textContent = text;
        msgContainer.appendChild(msgDiv);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    },

    processAIResponse: function (userInput) {
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

        // GLOBAL INTENT DETECTORS
        const isClientLaunch = /fiesta|dj|cuanto cuesta|cuesta|música|musica|evento|contratar|book|hire|party|wedding|boda|quince|15 años|15 anos|fecha|city|ciudad/.test(input);
        const isDJLaunch = /trabajar|clientes|gano|mejorar|trabajo|gig|work|apply|ganar|plan|pro\b|suscripcion|subscription|membresia|perfil|profile/.test(input);

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
            this.addMessage("assistant", response);
            return;
        }

        // GLOBAL INTERCEPT 2: PRICE DEFENSE SYSTEM (LOWBALLING PREMIUM EVENTS)
        if (isLowball || (isObjection && isPremiumEvent)) {
            this.sessionState = "B2C_QUALIFICATION"; // Lock them in the funnel
            response = isSpanish
                ? "Perfecto, gracias por decirme eso.\n\nTe explico rápido para que tengas claridad:\nUn evento importante (como bodas o 15 años) no funciona como una fiesta básica de $350. Ahí ya estamos hablando de una experiencia completa — música, animación, estructura del evento, momentos especiales…\n\nNuestros paquetes premium comienzan entre $1500 y $2000 dependiendo de lo que quieras incluir. Pero tranquilo, eso no significa que no se pueda ajustar.\n\nDéjame ayudarte a armar algo que tenga buen impacto sin romperte el presupuesto. ¿Para qué fecha es el evento y en qué ciudad?"
                : "Perfect, thanks for telling me that.\n\nLet me explain quickly for clarity:\nA major event (like a wedding or sweet 16) doesn't work like a basic $350 party. We are talking about a complete experience — music, MCing, event structure, special moments…\n\nOur premium packages start between $1500 and $2000 depending on what you want to include. But don't worry, that doesn't mean we can't adjust it.\n\nLet me help you build something with a great impact without breaking your budget. What date is the event and in what city?";
            this.addMessage("assistant", response);
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
                } else if (isClientLaunch && !isDJLaunch) {
                    this.sessionState = "B2C_QUALIFICATION";
                    response = isSpanish
                        ? "Hagámoslo realidad. Para darte la información exacta, ¿qué tipo de evento estás organizando, en qué ciudad y para qué fecha?"
                        : "Let's make it happen. To give you the exact information, what type of event are you organizing, in what city, and for what date?";
                } else if (isDJLaunch) {
                    this.sessionState = "B2B_EVANGELIST";
                    response = isSpanish
                        ? "Excelente. Aquí en Miami DJ Beat, no solo tocas música, manejas tu propio negocio. ¿Estás buscando optimizar tu Perfil, revisar tus Ingresos en el Dashboard, o ver lo de la Agenda?"
                        : "Excellent. Here at Miami DJ Beat, you don't just play music, you run your own business. Are you looking to optimize your Profile, check your Income Dashboard, or look at your Schedule?";
                } else {
                    response = isSpanish
                        ? "Sí claro, puedo ayudarte en lo que necesites.\n\nPara empezar, ¿estás buscando contratar un DJ o deseas trabajar como DJ en la plataforma?"
                        : "Yes of course, I can help you with whatever you need.\n\nTo begin, are you looking to hire a DJ, or do you want to work as a DJ on the platform?";
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
                response = isSpanish
                    ? "¡Genial! Solo haz clic en 'Reserve Your Date' en el panel de DJs para completar esta parte y acceder a tu Invoice Oficial. ¡Yo estaré aquí si me necesitas!"
                    : "Great! Just click on 'Reserve Your Date' in the DJ panel to complete this part and access your Official Invoice. I'll be here if you need me!";
                break;

            // SECONDARY STATE: B2B EVANGELIST
            case "B2B_EVANGELIST":
                const b2bProfile = /perfil|profile|estrellas|stars|rating|reviews|reseña|visibilidad/.test(input);
                const b2bFinance = /dinero|money|pago|finanzas|finance|dashboard|ingresos|cobrar|propinas|tips/.test(input);
                const b2bCalendar = /calendario|calendar|clima|weather|lluvia|organizar|planificar/.test(input);
                const b2bPlan = /plan|pro\b|suscripcion|subscription|membresia|precio/.test(input);
                const b2bStrategy = /estrategia|strategy|margen|margin|objetivo|kpi|objeci[oó]n|objection|negocio|business|pricing|precio justo|fee|honorario|criterio|decisi[oó]n|problema de negocio/.test(input);

                if (b2bStrategy && !b2bPlan && !b2bProfile && !b2bFinance && !b2bCalendar) {
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
                        ? "Hablemos de negocios serios. El Cash Flow Dashboard te da control total de ingresos y propinas, dándote la solidez para subir de nivel. ¿Ya activaste tu visión financiera en la plataforma?"
                        : "Let's talk serious business. The Cash Flow Dashboard gives you total control of income and tips, giving you the solidity to level up. Have you activated your financial vision on the platform yet?";
                } else if (b2bCalendar) {
                    response = isSpanish
                        ? "Una ventaja crítica. Con el Radar de Clima y Calendario integrado, blindas tu agenda corporativa y mitigas riesgos de equipo protegido. ¿Tu agenda ya está sincronizada al 100%?"
                        : "A critical advantage. With the integrated Weather Radar and Calendar, your corporate schedule is bulletproof and you mitigate gear risks. Is your schedule 100% synced yet?";
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

        this.addMessage("assistant", response);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.MDJ_Assistant) window.MDJ_Assistant.init();
});
