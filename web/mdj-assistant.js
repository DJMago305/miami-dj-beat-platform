/**
 * MDJPRO — Booth Assistant AI Logic
 * Handles AI Sales Agent, Negotiation, and Multilingual Support
 */

window.MDJ_Assistant = {
    isOpen: false,
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
        console.log("Booth Assistant AI Initialized — Sales & Negotiation Ready");
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
                this.addMessage("assistant", "Hello! I am Booth, your MDJPRO assistant. / ¡Hola! Soy Booth, tu asistente de MDJPRO. How can I help you today?");
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

        // Simulación de Cerebro AI (Venta/Negociación)
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
        const isSpanish = /[áéíóúñ]|hola|buenos|tardes|noches|como|puedes|vender|plan|precio/.test(input);

        let response = isSpanish
            ? "Entiendo lo que dices. Hablemos de cómo los modelos de negocio actuales pueden beneficiar tu carrera como DJ."
            : "I'm interested in what you're saying. Let's talk about how current business models can benefit your career.";

        if (input.includes("hola") || input.includes("hello") || input.includes("buenas")) {
            response = isSpanish
                ? "¡Hola! Soy bilingüe y puedo ayudarte con la plataforma o nuestros planes premium. ¿En qué puedo apoyarte?"
                : "Hello! I can speak multiple languages. How can I assist you with the platform or our premium plans?";
        } else if (input.includes("plan") || input.includes("pro") || input.includes("precio") || input.includes("price")) {
            response = isSpanish
                ? `¡Excelente pregunta! ${this.knowledgeBase.plans.PRO} ¿Te gustaría mejorar tu cuenta ahora para dominar el mercado de Miami?`
                : `Great question! ${this.knowledgeBase.plans.PRO} Would you like to upgrade now to dominate the Miami market?`;
        } else if (input.includes("sell") || input.includes("vende") || input.includes("negocia") || input.includes("negotiate")) {
            response = isSpanish
                ? "Estoy entrenado para negociar los mejores tratos. Nuestra plataforma te conecta con clientes de alto nivel en todo Florida."
                : "I am trained to negotiate the best deals. Our platform connects you with top-tier clients in Florida.";
        } else if (input.includes("salud") || input.includes("health") || input.includes("artistica") || input.includes("artistic")) {
            response = isSpanish
                ? `¡Tu salud profesional es clave! ${this.knowledgeBase.professionalHealth.artistic} ${this.knowledgeBase.professionalHealth.engagement} Se mide de forma estratégica para proteger tu carrera.`
                : `Professional health is key! ${this.knowledgeBase.professionalHealth.artistic} ${this.knowledgeBase.professionalHealth.engagement} It is strategically measured to protect your career.`;
        } else if (input.includes("dinero") || input.includes("money") || input.includes("finanzas") || input.includes("finance") || input.includes("pago")) {
            response = isSpanish
                ? `Hablemos de negocios. ${this.knowledgeBase.professionalHealth.financial} ${this.knowledgeBase.professionalHealth.tips} Recuerda que el Ticket Promedio indica tu valor de mercado.`
                : `Let's talk business. ${this.knowledgeBase.professionalHealth.financial} ${this.knowledgeBase.professionalHealth.tips} Remember your Average Ticket indicates your market value.`;
        } else if (input.includes("estrellas") || input.includes("stars") || input.includes("rating") || input.includes("reseña")) {
            response = isSpanish
                ? `El Índice Artístico es el corazón de tu perfil. Protegemos tu reputación analizando tu trayectoria global, no solo comentarios aislados. Es justicia técnica.`
                : `The Artistic Index is the heart of your profile. We protect your reputation by analyzing your global track record, not just isolated comments. It is technical justice.`;
        } else if (input.includes("idioma") || input.includes("language") || input.includes("espanol") || input.includes("spanish")) {
            response = "I can speak both English and Spanish to help you negotiate with any client in Miami. / Puedo hablar inglés y español para ayudarte a negociar con cualquier cliente en Miami.";
        }

        this.addMessage("assistant", response);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.MDJ_Assistant) window.MDJ_Assistant.init();
});
