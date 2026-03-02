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

document.addEventListener('DOMContentLoaded', () => i18n.init());
