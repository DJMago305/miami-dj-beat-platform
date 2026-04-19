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
        if (document.documentElement) {
            document.documentElement.lang = lang === 'es' ? 'es' : 'en';
        }
        this.updateUI();
        document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
    },

    /** Resolve string: active locale first, then the other (official fallback is English). */
    t(key) {
        const primary = translations[this.currentLang];
        const fallback = this.currentLang === 'es' ? translations.en : translations.es;
        if (!primary) return fallback[key] || '';
        return primary[key] ?? fallback[key] ?? '';
    },

    updateUI() {
        /* Siempre: <html lang> + pills auth (data-auth-btn). Nunca abortar si translations[lang] falta. */
        if (document.documentElement) {
            document.documentElement.lang = this.currentLang === 'es' ? 'es' : 'en';
        }

        const primary = translations[this.currentLang];
        if (primary) {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                if (el.hasAttribute && el.hasAttribute('data-auth-btn')) return;
                const key = el.getAttribute('data-i18n');
                const text = this.t(key);
                if (!text) return;
                if (el.tagName === 'OPTION') {
                    el.textContent = text;
                    return;
                }
                el.innerHTML = text;
            });

            document.querySelectorAll('[data-i18n-hold]').forEach(el => {
                const key = el.getAttribute('data-i18n-hold');
                const text = this.t(key);
                if (text) el.placeholder = text;
            });

            document.querySelectorAll('[data-i18n-aria]').forEach(el => {
                const key = el.getAttribute('data-i18n-aria');
                const text = this.t(key);
                if (text) el.setAttribute('aria-label', text);
            });
        }

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === this.currentLang);
        });

        if (typeof window.updateAuthButtons === 'function') {
            window.updateAuthButtons();
            requestAnimationFrame(() => {
                if (typeof window.updateAuthButtons === 'function') window.updateAuthButtons();
            });
        }
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
});
