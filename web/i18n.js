// I18n Global Manager
const i18n = {
    currentLang: localStorage.getItem('mdjpro_lang') || 'en',

    init() {
        this.updateUI();
        this.setupSwitchers();
    },

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('mdjpro_lang', lang);
        this.updateUI();
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
    },

    updateUI() {
        const langData = translations[this.currentLang];
        if (!langData) return;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langData[key]) {
                el.innerHTML = langData[key];
            }
        });

        // Placeholder support
        document.querySelectorAll('[data-i18n-hold]').forEach(el => {
            const key = el.getAttribute('data-i18n-hold');
            if (langData[key]) {
                el.placeholder = langData[key];
            }
        });

        // Update active state on switchers
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === this.currentLang);
        });
    },

    setupSwitchers() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.setLanguage(btn.getAttribute('data-lang'));
            });
        });
    }
};

// Global registration
window.i18n = i18n;
window.translations = translations;

document.addEventListener('DOMContentLoaded', () => {
    i18n.init();

    // ==========================================
    // ARTILLERÍA SOCIAL GLOBAL (MDJPRO Social Bar)
    // ==========================================
    const socialHTML = `
    <style>
        .social-sticky-bar {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(15, 15, 15, 0.4);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(197, 160, 89, 0.2);
            border-radius: 20px;
            padding: 15px 10px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            z-index: 8000;
        }
        .social-sticky-bar a {
            color: #fff;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            justify-content: center;
        }
        .social-sticky-bar a:hover {
            color: var(--gold);
            transform: translateX(-5px);
            filter: drop-shadow(0 0 8px rgba(197, 160, 89, 0.6));
        }
        
        .wa-floating-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: rgba(37, 211, 102, 0.85); /* Verde esmeralda traslúcido */
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            color: white;
            z-index: 8001;
            box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4);
            animation: pulse-wa 2.5s infinite;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s;
        }
        .wa-floating-btn:hover {
            transform: scale(1.1);
        }
        .wa-floating-btn svg {
            width: 34px;
            height: 34px;
        }
        @keyframes pulse-wa {
            0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7); }
            70% { box-shadow: 0 0 0 15px rgba(37, 211, 102, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }

        /* MOBILE ADAPTIVE */
        @media (max-width: 768px) {
            .social-sticky-bar {
                display: none; /* Ocultar barra lateral en móviles */
            }
            .wa-floating-btn {
                bottom: 20px;
                right: 20px;
                width: 55px;
                height: 55px;
            }
            .wa-floating-btn svg { width: 30px; height: 30px; }
        }
    </style>

    <!-- Barra Social (Desktop) -->
    <div class="social-sticky-bar">
        <!-- Instagram -->
        <a href="https://instagram.com/miamidjbeat" target="_blank" aria-label="Instagram">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        </a>
        <!-- Facebook -->
        <a href="https://facebook.com/miamidjbeat" target="_blank" aria-label="Facebook">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
        </a>
        <!-- TikTok -->
        <a href="https://tiktok.com/@miamidjbeat" target="_blank" aria-label="TikTok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
        </a>
    </div>

    <!-- Botón Maestro WhatsApp (Global) -->
    <a href="https://wa.me/13050000000?text=Hola,%20quisiera%20m%C3%A1s%20informaci%C3%B3n" target="_blank" class="wa-floating-btn" title="Contacta con un Productor">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
    </a>
    `;

    document.body.insertAdjacentHTML('beforeend', socialHTML);
});
