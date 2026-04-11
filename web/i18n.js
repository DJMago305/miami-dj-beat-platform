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
        const primary = translations[this.currentLang];
        if (!primary) return;
        if (document.documentElement) {
            document.documentElement.lang = this.currentLang === 'es' ? 'es' : 'en';
        }

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);
            if (text) el.innerHTML = text;
        });

        // Placeholder support
        document.querySelectorAll('[data-i18n-hold]').forEach(el => {
            const key = el.getAttribute('data-i18n-hold');
            const text = this.t(key);
            if (text) el.placeholder = text;
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
});
