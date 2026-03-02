/**
 * BEATBOT - MDJPRO AI Assistant (2027 Premium)
 * Multilingual Sales Agent capable of explaining services, translating, 
 * and assisting in closing deals in the Client Portal.
 */

class BeatBot {
    constructor() {
        this.isOpen = false;
        this.currentLang = 'es'; // Default
        this.state = "IDLE";

        // Service Catalog Knowledge
        this.knowledge = {
            'es': {
                'welcome': "¡Hola! Soy BeatBot. Estoy aquí para explicarte nuestros servicios, ayudarte a contratar y resolver cualquier duda técnica. ¿En qué puedo apoyarte?",
                'audio': "Ofrecemos sistemas RCF Pro. El 'Audio Base' ($120) es ideal para 50 personas. Para eventos grandes, recomendamos el 'Audio Premium' con Subwoofers duales.",
                'led': "Nuestras pantallas LED son de alta resolución (P2.9). El costo base es de $600 por sección. Son ideales para bodas y eventos corporativos con visuales dinámicos.",
                'talent': "Contamos con MCs bilingües ($450), Timbaleros ($300) y la famosa 'Hora Loca' ($650). Todos nuestros DJs están verificados por MDJPRO.",
                'closing': "¡Excelente elección! Si estás listo, puedo ayudarte a cerrar el trato ahora mismo. Solo necesitas confirmar los servicios en tu carrito y proceder al depósito inicial.",
                'translate': "¡Claro! I can speak English if you prefer. How can I help you today?"
            },
            'en': {
                'welcome': "Hello! I'm BeatBot. I'm here to explain our services, help you with booking, and solve any technical questions. How can I assist you today?",
                'audio': "We offer RCF Pro systems. The 'Base Audio' ($120) is perfect for 50 people. For larger events, we recommend 'Premium Audio' with dual subwoofers.",
                'led': "Our LED screens are high resolution (P2.9). Starting at $600 per section. They are perfect for weddings and corporate events with dynamic visuals.",
                'talent': "We have bilingual MCs ($450), Percussionists ($300), and the famous 'Hora Loca' ($650). All our DJs are MDJPRO verified.",
                'closing': "Great choice! If you're ready, I can help you close the deal right now. Just confirm the services in your cart and proceed with the initial deposit.",
                'translate': "¡Por supuesto! Puedo hablar español si prefieres. ¿En qué te ayudo?"
            }
        };

        this.init();
    }

    init() {
        this.injectUI();
        this.bindEvents();
    }

    injectUI() {
        if (document.getElementById('beatbot-widget')) return;
        const widget = document.createElement('div');
        widget.id = 'beatbot-widget';
        widget.innerHTML = `
            <div class="bot-trigger" id="bot-trigger">
                <div class="pulse"></div>
                <span style="font-size: 24px; position: relative;">🤖</span>
            </div>
            <div class="bot-window" id="bot-window">
                <div class="bot-header">
                    <img src="./assets/logo.jpg" alt="BeatBot">
                    <div class="info">
                        <h4>BeatBot AI</h4>
                        <div class="status">Online | Sales Agent</div>
                    </div>
                </div>
                <div class="bot-messages" id="bot-messages">
                    <div class="msg bot">${this.knowledge[this.currentLang].welcome}</div>
                </div>
                <div class="bot-suggestions" id="bot-suggestions">
                    <button class="suggest-btn" onclick="beatbot.ask('Precios de Audio')">Audio</button>
                    <button class="suggest-btn" onclick="beatbot.ask('Pantallas LED')">LED</button>
                    <button class="suggest-btn" onclick="beatbot.ask('Contratar DJ')">Book DJ</button>
                    <button class="suggest-btn" onclick="beatbot.setLanguage('en')">English 🇺🇸</button>
                    <button class="suggest-btn" onclick="beatbot.setLanguage('es')">Español 🇪🇸</button>
                </div>
                <div class="bot-input-area">
                    <input type="text" id="bot-input" placeholder="Pregúntame lo que quieras...">
                    <button class="bot-send" id="bot-send">➔</button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    }

    bindEvents() {
        const trigger = document.getElementById('bot-trigger');
        const windowEl = document.getElementById('bot-window');
        const input = document.getElementById('bot-input');
        const send = document.getElementById('bot-send');

        if (trigger) trigger.onclick = () => {
            this.isOpen = !this.isOpen;
            windowEl.classList.toggle('open', this.isOpen);
        };

        if (send) send.onclick = () => this.handleInput();
        if (input) input.onkeypress = (e) => { if (e.key === 'Enter') this.handleInput(); };
    }

    setLanguage(lang) {
        this.currentLang = lang;
        this.addMessage(this.knowledge[lang].translate, 'bot');
        const input = document.getElementById('bot-input');
        if (input) input.placeholder = lang === 'es' ? "Pregúntame lo que quieras..." : "Ask me anything...";
    }

    handleInput() {
        const input = document.getElementById('bot-input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage(text, 'user');
        input.value = '';

        setTimeout(() => this.processQuery(text), 600);
    }

    addMessage(text, sender) {
        const container = document.getElementById('bot-messages');
        if (!container) return;
        const msg = document.createElement('div');
        msg.className = `msg ${sender}`;
        msg.innerText = text;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    ask(query) {
        this.handleInputExternally(query);
    }

    handleInputExternally(text) {
        this.addMessage(text, 'user');
        setTimeout(() => this.processQuery(text), 600);
    }

    processQuery(query) {
        const lowQuery = query.toLowerCase();
        let response = "";

        // Check for Loyalty Tier in DOM
        const tierEl = document.querySelector('.loyalty-badge');
        const tierName = tierEl ? tierEl.textContent.trim() : null;

        // Language detection - Auto switch
        if (lowQuery.includes('english') || lowQuery.includes('in english')) {
            this.currentLang = 'en';
        } else if (lowQuery.includes('español') || lowQuery.includes('en español')) {
            this.currentLang = 'es';
        }

        const k = this.knowledge[this.currentLang];

        if (lowQuery.includes('tier') || lowQuery.includes('nivel') || lowQuery.includes('puntos') || lowQuery.includes('loyalty')) {
            if (tierName) {
                response = this.currentLang === 'es'
                    ? `Actualmente tienes el estatus de ${tierName}. ¡Gracias por tu lealtad constante con Miami DJ Beat!`
                    : `You currently have ${tierName} status. Thank you for your continued loyalty to Miami DJ Beat!`;
            } else {
                response = this.currentLang === 'es'
                    ? "Tu nivel de lealtad se basa en la cantidad de eventos que has realizado con nosotros. ¡Pronto verás recompensas exclusivas!"
                    : "Your loyalty level is based on the number of events you've held with us. Exclusive rewards coming soon!";
            }
        } else if (lowQuery.includes('audio') || lowQuery.includes('sonido')) {
            response = k.audio;
        } else if (lowQuery.includes('led') || lowQuery.includes('pantalla')) {
            response = k.led;
        } else if (lowQuery.includes('talent') || lowQuery.includes('dj') || lowQuery.includes('mc') || lowQuery.includes('hora loca')) {
            response = k.talent;
        } else if (lowQuery.includes('cerrar') || lowQuery.includes('contratar') || lowQuery.includes('book') || lowQuery.includes('pagar')) {
            response = k.closing;
            // Interaction: Open payment section if in Portal
            if (window.location.href.includes('client-portal')) {
                const paySection = document.getElementById('payments-section');
                if (paySection) {
                    paySection.scrollIntoView({ behavior: 'smooth' });
                    paySection.style.boxShadow = "0 0 30px var(--gold)";
                    setTimeout(() => paySection.style.boxShadow = "", 2000);
                }
            }
        } else if (lowQuery.includes('hola') || lowQuery.includes('hello')) {
            if (tierName && tierName.includes('DIAMOND')) {
                response = this.currentLang === 'es'
                    ? `¡Es un honor saludarte de nuevo, nuestro socio DIAMANTE! ¿En qué podemos servirte hoy?`
                    : `It's an honor to greet you again, our DIAMOND partner! How can we serve you today?`;
            } else {
                response = k.welcome;
            }
        } else {
            response = this.currentLang === 'es'
                ? "Entiendo. Puedo explicarte sobre Audio, Pantallas LED, DJ Talent o informarte sobre tu Nivel de Lealtad. ¿Qué prefieres?"
                : "I understand. I can explain Audio, LED Screens, DJ Talent, or inform you about your Loyalty Tier. What do you prefer?";
        }

        this.addMessage(response, 'bot');
    }
}

// Global instance
window.beatbot = new BeatBot();
