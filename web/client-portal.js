/**
 * MDJPRO - Client Portal Logic
 * Handles real-time event tracking, installments, and feedback.
 */

const PortalApp = {
    currentLead: null,
    items: [],
    installments: [],
    isManager: false,

    async init() {
        const params = new URLSearchParams(window.location.search);
        const leadId = params.get('lead');
        this.isManager = params.get('mode') === 'manager';

        if (!leadId) {
            this.showNoLeadScreen();
            return;
        }

        if (this.isManager) {
            this.showManagerNotice();
        }

        await this.loadLeadData(leadId);
        this.setupEventListeners();

        // Handle Stripe payment return
        await this.handlePaymentReturn();
    },

    showManagerNotice() {
        const banner = document.createElement('div');
        banner.style = "background: var(--gold); color: #000; text-align: center; padding: 10px; font-weight: 800; position: fixed; top: 0; left: 0; right: 0; z-index: 10000; font-size: 14px;";
        banner.innerHTML = `🛠 MODO MANAGER ACTIVO - Los cambios que realices se reflejarán al cliente en tiempo real.`;
        document.body.prepend(banner);
        const header = document.querySelector('.header');
        if (header) header.style.marginTop = "40px";
    },

    async loadLeadData(leadId) {
        let leadData = null;
        try {
            const db = window.getSupabaseClient();
            if (db) {
                const { data, error } = await db.from('leads').select('*').eq('id', leadId).single();
                if (data) leadData = data;
            }
        } catch (e) {
            console.warn("Supabase fetch failed, using local fallback");
        }

        if (!leadData) {
            const saved = localStorage.getItem(`lead_${leadId}`);
            leadData = saved ? JSON.parse(saved) : {
                id: leadId,
                email: "client@example.com",
                event_type: "Evento Corporativo",
                event_date: "2026-12-31",
                location: "Miami Beach Convention Center",
                contact_person: "Gerardo V.",
                gate_code: "1234#",
                total_amount: 0,
                balance_paid: 1000,
                status: "CONFIRMED"
            };
        }

        this.currentLead = leadData;
        this.renderLeadInfo();
        await this.loadLeadItems(leadId);
        await this.fetchClientProfile(leadData.email);
        this.startCountdown();
    },

    async fetchClientProfile(email) {
        if (!email) return;
        try {
            const db = window.getSupabaseClient();
            if (db) {
                const { data } = await db.from('client_profiles').select('*').eq('email', email).single();
                if (data) this.clientProfile = data;
            }
        } catch (e) { console.warn("Client profile fetch skipped"); }
        this.renderLoyaltyBadge(this.clientProfile?.total_events_booked || 1);
        this.renderCart(); // Re-render cart with potential discounts
    },

    async loadLoyaltyTier(email) {
        if (!email) return;
        let eventCount = 1;
        try {
            const db = window.getSupabaseClient();
            if (db) {
                const { count, error } = await db
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('email', email);
                if (!error) eventCount = count || 1;
            }
        } catch (e) {
            console.warn("Could not fetch event count for loyalty");
        }

        this.renderLoyaltyBadge(eventCount);
    },

    renderLoyaltyBadge(count) {
        const container = document.getElementById('loyalty-tier-container');
        if (!container) return;

        let tierClass = 'tier-new';
        let tierName = 'Nuevo Cliente';
        let icon = '🌱';

        if (count >= 10) {
            tierClass = 'tier-diamond';
            tierName = 'Partner Diamante';
            icon = '💎';
        } else if (count >= 5) {
            tierClass = 'tier-gold';
            tierName = 'Socio Oro';
            icon = '🏆';
        } else if (count >= 2) {
            tierClass = 'tier-silver';
            tierName = 'Miembro Plata';
            icon = '🥈';
        }

        container.innerHTML = `
            <div class="loyalty-badge ${tierClass}">
                <span>${icon}</span>
                <span>${tierName}</span>
                <span style="opacity: 0.6; font-size: 10px; margin-left: 5px;">(${count} eventos)</span>
            </div>
        `;
    },

    async loadLeadItems(leadId) {
        let items = [];
        let meetings = [];
        if (this.currentLead.notes) {
            try {
                const parsed = JSON.parse(this.currentLead.notes);
                items = parsed.selected_services || [
                    { name: "DJ Performance (6 Hours)", price: 800, qty: 1 },
                    { name: "Sistema de Audio RCF Pro", price: 400, qty: 1 }
                ];
                meetings = parsed.meetings || [
                    { title: "Sita Telefónica", date: "Finalizada", status: "past" },
                    { title: "Visita Técnica Venue", date: "Mañana - 2:00 PM", status: "upcoming", location: "Doral, FL" }
                ];
            } catch (e) {
                items = [{ name: "DJ Performance (6 Hours)", price: 800, qty: 1 }];
                meetings = [{ title: "Cita Inicial", date: "Pendiente", status: "upcoming" }];
            }
        }
        this.items = items;
        this.meetings = meetings;
        this.renderCart();
        this.renderCalendar();
    },

    renderCalendar() {
        const container = document.getElementById('calendar-widget');
        if (!container) return;

        container.innerHTML = this.meetings.map((m, index) => `
            <div class="cart-item" style="flex-direction: column; align-items: flex-start; ${m.status === 'past' ? 'opacity: 0.5' : ''}">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span class="val">${m.title}</span>
                    ${this.isManager ? `<button onclick="PortalApp.removeMeeting(${index})" style="background:none; border:none; color:red; cursor:pointer;">×</button>` : ''}
                </div>
                <span class="fineprint">${m.date}</span>
                ${m.location ? `<span class="fineprint">📍 ${m.location}</span>` : ''}
            </div>
        `).join('');

        if (this.isManager) {
            const addBtn = document.createElement('button');
            addBtn.className = "btn-pill";
            addBtn.style.width = "100%";
            addBtn.style.marginTop = "10px";
            addBtn.textContent = "+ Programar Cita/Sita";
            addBtn.onclick = () => this.addMeetingPrompt();
            container.appendChild(addBtn);
        }
    },

    addMeetingPrompt() {
        const title = prompt("Título de la cita (Ej: Visita técnica):");
        if (!title) return;
        const date = prompt("Día y hora (Ej: Lunes 4:00 PM):");
        const location = prompt("Ubicación (opcional):");

        this.meetings.push({ title, date, location, status: "upcoming" });
        this.renderCalendar();
        this.syncCalendar();
    },

    removeMeeting(index) {
        if (confirm("¿Eliminar esta cita?")) {
            this.meetings.splice(index, 1);
            this.renderCalendar();
            this.syncCalendar();
        }
    },

    async syncCalendar() {
        const existingNotes = this.currentLead.notes ? JSON.parse(this.currentLead.notes) : {};
        existingNotes.meetings = this.meetings;
        this.currentLead.notes = JSON.stringify(existingNotes);
        this.syncLead();
    },

    renderLeadInfo() {
        const l = this.currentLead;
        document.getElementById('client-welcome').textContent = `¡Hola, ${l.contact_person || 'Cliente'}!`;
        document.getElementById('log-location').textContent = l.location;
        document.getElementById('log-datetime').textContent = `${l.event_date} - 7:00 PM`;
        document.getElementById('log-gate').textContent = l.gate_code || "A confirmar";
        document.getElementById('log-contact').textContent = l.contact_person || l.email;

        const eventDate = new Date(l.event_date);
        const deadline = new Date(eventDate);
        deadline.setDate(deadline.getDate() - 3);
        document.getElementById('pay-deadline').textContent = deadline.toLocaleDateString();

        if (new Date() > eventDate) {
            document.getElementById('feedback-card').style.display = 'block';
        }

        if (this.isManager) {
            this.makeLogisticsEditable();
        }
    },

    makeLogisticsEditable() {
        const labels = ['log-location', 'log-gate', 'log-contact'];
        labels.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.cursor = 'pointer';
            el.style.borderBottom = '1px dashed var(--gold)';
            el.title = "Click para editar (Manager)";
            el.onclick = () => {
                const newVal = prompt(`Editar ${id}:`, el.textContent);
                if (newVal !== null) {
                    el.textContent = newVal;
                    this.saveLogistics(id, newVal);
                }
            };
        });
    },

    async saveLogistics(fieldId, val) {
        const fieldMap = { 'log-location': 'location', 'log-gate': 'gate_code', 'log-contact': 'contact_person' };
        const dbField = fieldMap[fieldId];
        if (dbField) {
            this.currentLead[dbField] = val;
            this.syncLead();
        }
    },

    renderCart() {
        const container = document.getElementById('cart-container');
        let sub = 0;
        container.innerHTML = this.items.map((item, index) => {
            const itemTotal = item.price * item.qty;
            sub += itemTotal;
            return `
                <div class="cart-item">
                    <div>
                        <strong>${item.name}</strong><br>
                        <small class="fineprint">Cant: ${item.qty}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="val">$${itemTotal.toFixed(2)}</span>
                        ${this.isManager ? `<button onclick="PortalApp.removeItem(${index})" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold;">×</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        if (this.isManager) {
            const addBtn = document.createElement('button');
            addBtn.className = "btn primary full";
            addBtn.style.marginTop = "10px";
            addBtn.style.opacity = "0.8";
            addBtn.textContent = "+ Agregar Servicio (Catálogo)";
            addBtn.onclick = () => this.addServicePrompt();
            container.appendChild(addBtn);
        }

        let discount = 0;
        let discountNote = "";

        // 1. Referral Discount (Source Ref)
        if (this.clientProfile?.source_ref) {
            discount += 50; // Flat $50 discount for referral
            discountNote += `• Crédito Referido (${this.clientProfile.source_ref}): -$50.00<br>`;
        }

        // 2. Loyalty Discount (Returning Client)
        if ((this.clientProfile?.total_events_booked || 0) > 0) {
            const loyaltyDisc = sub * 0.05; // 5% for returning
            discount += loyaltyDisc;
            discountNote += `• Beneficio Cliente Oficial (5%): -$${loyaltyDisc.toFixed(2)}<br>`;
        }

        const tax = (sub - discount) * 0.07;
        const total = (sub - discount) + tax;

        document.getElementById('cart-subtotal').textContent = `$${sub.toFixed(2)}`;

        // Show Discount row if applicable
        const discRow = document.getElementById('cart-discount-row');
        const discVal = document.getElementById('cart-discount');
        if (discount > 0) {
            if (discRow) discRow.style.display = 'flex';
            if (discVal) discVal.innerHTML = `<span style="color:var(--gold);">${discountNote}</span>`;
        }

        document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

        this.currentLead.total_amount = total;
        this.updatePayments();
    },

    addServicePrompt() {
        const name = prompt("Nombre del servicio:");
        if (!name) return;
        const price = parseFloat(prompt("Precio ($):", "100"));
        if (isNaN(price)) return;

        this.items.push({ name, price, qty: 1 });
        this.renderCart();
        this.syncItems();
    },

    removeItem(index) {
        if (confirm("¿Eliminar este servicio?")) {
            this.items.splice(index, 1);
            this.renderCart();
            this.syncItems();
        }
    },

    async syncItems() {
        const existingNotes = this.currentLead.notes ? JSON.parse(this.currentLead.notes) : {};
        existingNotes.selected_services = this.items;
        this.currentLead.notes = JSON.stringify(existingNotes);
        this.syncLead();
    },

    async syncLead() {
        try {
            const db = window.getSupabaseClient();
            if (db) {
                const { error } = await db.from('leads').update(this.currentLead).eq('id', this.currentLead.id);
                if (error) throw error;
                console.log("Lead synced successfully");
            } else {
                throw new Error('no client');
            }
        } catch (e) {
            console.warn("Syncing to localStorage only");
            localStorage.setItem(`lead_${this.currentLead.id}`, JSON.stringify(this.currentLead));
        }
        this.updatePayments();
    },

    updatePayments() {
        const l = this.currentLead;
        const paid = parseFloat(l.balance_paid) || 0;
        const total = parseFloat(l.total_amount) || 0;
        const balance = total - paid;
        const progress = total > 0 ? (paid / total) * 100 : 0;

        document.getElementById('pay-total').textContent = `$${total.toFixed(2)}`;
        document.getElementById('pay-paid').textContent = `$${paid.toFixed(2)}`;
        document.getElementById('pay-balance').textContent = `$${balance.toFixed(2)}`;
        document.getElementById('pay-progress').style.width = `${progress}%`;

        // Payment status badge
        const pStatus = l.payment_status || 'UNPAID';
        const statusColors = { PAID: '#22c55e', PARTIAL: '#f59e0b', PENDING: '#c5a059', UNPAID: '#ef4444' };
        const payStatusEl = document.getElementById('pay-status-badge');
        if (payStatusEl) {
            payStatusEl.textContent = pStatus;
            payStatusEl.style.color = statusColors[pStatus] || '#fff';
        }

        // Show Stripe pay button to CLIENT if balance > 0 and not PAID
        if (!this.isManager && balance > 0 && pStatus !== 'PAID') {
            this.showStripePayButton(balance);
        }

        if (this.isManager && balance > 0) {
            this.showAbonoButton();
        }
    },

    showStripePayButton(balance) {
        let btn = document.getElementById('btn-stripe-pay');
        if (btn) return; // already shown
        btn = document.createElement('button');
        btn.id = 'btn-stripe-pay';
        btn.className = 'btn primary full';
        btn.style.marginTop = '14px';
        btn.style.background = 'linear-gradient(135deg, #635bff, #4b44e8)';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.gap = '8px';
        btn.innerHTML = `<span style="font-size:18px;">💳</span> Pagar Depósito ($${balance.toFixed(2)}) con Stripe`;
        btn.onclick = () => this.payDepositStripe(balance);
        const card = document.querySelector('.right-col .info-card');
        if (card) card.appendChild(btn);
    },

    async payDepositStripe(balance) {
        const btn = document.getElementById('btn-stripe-pay');
        if (btn) { btn.textContent = 'Conectando con Stripe...'; btn.disabled = true; }

        try {
            // Deposit = 30% of balance or minimum $150
            const depositAmount = Math.max(Math.round(balance * 0.30 * 100), 15000);
            const CHECKOUT_FN = 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/create-event-payment';

            const resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: this.currentLead.id,
                    amount_cents: depositAmount,
                    description: `Depósito de Reserva — ${this.currentLead.event_type} · ${this.currentLead.event_date}`,
                }),
            });

            const result = await resp.json();
            if (!result.ok || !result.url) throw new Error(result.error || 'No se pudo crear la sesión de pago');

            // Redirect to Stripe Checkout
            window.location.href = result.url;
        } catch (err) {
            alert('Error al conectar con Stripe: ' + err.message);
            if (btn) { btn.textContent = '💳 Reintentar Pago'; btn.disabled = false; }
        }
    },

    async handlePaymentReturn() {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        if (!paymentStatus) return;

        // Clean URL
        window.history.replaceState({}, '', window.location.pathname + '?lead=' + this.currentLead.id);

        if (paymentStatus === 'success') {
            // Update lead payment_status to PARTIAL (full confirmation comes via webhook)
            const db = window.getSupabaseClient();
            if (db) {
                const newPaid = (parseFloat(this.currentLead.balance_paid) || 0) +
                    Math.max(parseFloat(this.currentLead.total_amount) * 0.30, 150);
                await db.from('leads').update({
                    payment_status: 'PARTIAL',
                    balance_paid: newPaid,
                }).eq('id', this.currentLead.id);
                this.currentLead.payment_status = 'PARTIAL';
                this.currentLead.balance_paid = newPaid;
            }

            // Show success toast
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#22c55e;color:#000;padding:16px 28px;border-radius:16px;font-weight:900;font-size:15px;z-index:99999;box-shadow:0 8px 32px rgba(34,197,94,0.4);text-align:center;';
            toast.innerHTML = '✅ ¡Pago recibido!<br><small style="font-weight:600;">Tu depósito ha sido procesado. ¡Tu evento está confirmado!</small>';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 6000);

            this.updatePayments();
        } else if (paymentStatus === 'cancelled') {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(197,160,89,0.4);color:#fff;padding:14px 28px;border-radius:16px;font-weight:700;font-size:14px;z-index:99999;';
            toast.textContent = '⚠️ Pago cancelado. Puedes intentarlo nuevamente cuando desees.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }
    },

    showAbonoButton() {
        let btn = document.getElementById('btn-add-abono');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btn-add-abono';
            btn.className = 'btn secondary full';
            btn.style.marginTop = '10px';
            btn.textContent = "+ Registrar Abono (Pagar cuota)";
            btn.onclick = () => this.registerAbono();
            const card = document.querySelector('.right-col .info-card');
            if (card) card.appendChild(btn);
        }
    },

    registerAbono() {
        const amount = parseFloat(prompt("Monto a registrar ($):"));
        if (isNaN(amount) || amount <= 0) return;

        this.currentLead.balance_paid = (parseFloat(this.currentLead.balance_paid) || 0) + amount;
        alert(`Abono de $${amount} registrado con éxito.`);
        this.syncLead();
    },

    startCountdown() {
        const target = new Date(this.currentLead.event_date).getTime();
        const update = () => {
            const now = new Date().getTime();
            const diff = target - now;
            if (diff < 0) {
                document.getElementById('countdown').innerHTML = "<span class='btn-pill'>EVENTO FINALIZADO</span>";
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            document.getElementById('days').textContent = d.toString().padStart(2, '0');
            document.getElementById('hours').textContent = h.toString().padStart(2, '0');
            document.getElementById('mins').textContent = m.toString().padStart(2, '0');
        };
        update();
        setInterval(update, 60000);
    },

    setupEventListeners() {
        // ... previous listeners ...
        const stars = document.querySelectorAll('.star');
        let selectedRating = 0;

        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.val);
                stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
                const feedbackDiv = document.getElementById('low-rating-feedback');
                if (feedbackDiv) feedbackDiv.style.display = (selectedRating < 5) ? 'block' : 'none';
            });
        });

        document.getElementById('submit-review')?.addEventListener('click', async () => {
            if (selectedRating === 0) return alert("Por favor selecciona una calificación.");
            alert("¡Gracias por tu reseña! Ha sido enviada al equipo de MDJPRO.");
        });

        // Chat Listeners
        const chatSend = document.getElementById('chat-send');
        const chatInput = document.getElementById('chat-input');

        chatSend?.addEventListener('click', () => this.handleChatMessage());
        chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatMessage();
        });

        this.initChat();
    },

    initChat() {
        // Listen for new messages in real-time via Supabase
        // In this demo, we use a simple interval/mock
        this.addChatMessage({
            sender: 'manager',
            text: '¡Hola! Estoy listo para ayudarte con tu evento.',
            lang: 'es',
            translated: 'Hi! I am ready to help you with your event.'
        });
    },

    async handleChatMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        const sender = this.isManager ? 'manager' : 'client';

        // AI Bridge: Translation + Auto-Correct
        const processed = await this.aiBridgeProcess(text, sender);

        this.addChatMessage({
            sender: sender,
            text: processed.corrected,
            lang: this.currentLead.lang || 'es',
            translated: processed.translated
        });

        // Sync to Supabase in real app:
        // await supabase.from('messages').insert([{ lead_id: id, sender, text: processed.corrected, translated: processed.translated }]);
    },

    async aiBridgeProcess(text, sender) {
        // Simple AI Simulation for Auto-correct and Translation
        let corrected = text;

        if (sender === 'manager') {
            // Manager speaks ES -> Auto-correct ES + Translate to EN
            corrected = text
                .replace(/\bola\b/gi, "Hola")
                .replace(/\bkliente\b/gi, "cliente")
                .replace(/\bestas\b/gi, "estás")
                .replace(/\bestamos\b/gi, "estamos");

            const translation = await this.mockTranslate(corrected, 'en');
            return { corrected, translated: translation };
        } else {
            // Client speaks EN -> Translate to ES
            const translation = await this.mockTranslate(text, 'es');
            return { corrected: text, translated: translation };
        }
    },

    mockTranslate(text, targetLang) {
        const dictionary = {
            'hola': 'Hello',
            'estás': 'are you',
            'estamos': 'we are',
            'como': 'how',
            'cliente': 'client',
            'hi': 'hola',
            'how are you': '¿cómo estás?',
            'payment': 'pago',
            'total': 'total',
            'confirmed': 'confirmado',
            'event': 'evento'
        };

        let translated = text;
        const lower = text.toLowerCase();

        Object.keys(dictionary).forEach(key => {
            if (lower.includes(key)) {
                translated = translated.replace(new RegExp(key, 'gi'), dictionary[key]);
            }
        });

        if (translated === text) {
            translated = targetLang === 'en' ? `[AI Trans: ${text}]` : `[Traducción: ${text}]`;
        }

        return translated;
    },

    addChatMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const isMe = (this.isManager && msg.sender === 'manager') || (!this.isManager && msg.sender === 'client');
        const displayedText = (this.isManager && msg.sender === 'client') || (!this.isManager && msg.sender === 'manager')
            ? msg.translated : msg.text;

        const div = document.createElement('div');
        div.style = `max-width: 80%; padding: 10px; border-radius: 12px; font-size: 14px; ${isMe ? 'align-self: flex-end; background: var(--gold); color: #000;' : 'align-self: flex-start; background: rgba(255,255,255,0.1); color: #fff;'}`;

        div.innerHTML = `
            <strong>${msg.sender === 'manager' ? 'Admin' : 'Cliente'}:</strong><br>
            ${displayedText}
            ${!isMe ? `<br><small style="opacity:0.5; font-size: 10px;">Org: ${msg.text}</small>` : ''}
        `;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    showNoLeadScreen() {
        document.querySelector('.portal-header').innerHTML = `
            <div class="container" style="padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎧</div>
                <h1 style="font-size: 28px; margin-bottom: 10px;">Accede a tu Portal</h1>
                <p style="opacity: 0.7; margin-bottom: 30px;">Ingresa tu email para ver el estado de tu evento.</p>
                <div style="max-width: 400px; margin: 0 auto;">
                    <input type="email" id="portal-email-input" placeholder="tu@email.com"
                        style="width: 100%; padding: 14px 20px; border-radius: 50px; border: 1px solid rgba(197,160,89,0.4); background: rgba(255,255,255,0.05); color: #fff; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;">
                    <button onclick="PortalApp.searchByEmail()" class="btn primary"
                        style="width: 100%; padding: 14px; border-radius: 50px; font-size: 16px; font-weight: 900;">
                        🔍 Buscar mi Evento
                    </button>
                    <p id="portal-search-status" style="margin-top: 15px; font-size: 14px; opacity: 0.7;"></p>
                </div>
            </div>
        `;
        document.querySelector('main').innerHTML = '';
    },

    async searchByEmail() {
        const email = document.getElementById('portal-email-input')?.value.trim();
        const statusEl = document.getElementById('portal-search-status');
        if (!email) return;

        if (statusEl) statusEl.textContent = 'Buscando...';

        try {
            const db = window.getSupabaseClient();
            if (!db) throw new Error('no db');
            const { data, error } = await db
                .from('leads')
                .select('id, event_type, event_date, status')
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error || !data || data.length === 0) {
                if (statusEl) statusEl.textContent = '❌ No encontramos eventos para ese email.';
                return;
            }

            if (data.length === 1) {
                // Go directly to the portal
                window.location.href = `?lead=${data[0].id}`;
            } else {
                // Show list
                const list = data.map(l => `
                    <a href="?lead=${l.id}" style="display:block; padding: 12px 20px; margin-bottom: 10px;
                        background: rgba(197,160,89,0.1); border: 1px solid rgba(197,160,89,0.3);
                        border-radius: 15px; text-decoration: none; color: #fff;">
                        <strong>${l.event_type}</strong> — ${l.event_date}
                        <span style="float:right; font-size:12px; color: var(--gold);">${l.status}</span>
                    </a>
                `).join('');
                if (statusEl) statusEl.innerHTML = `<div style="margin-top:10px;">${list}</div>`;
            }
        } catch (e) {
            if (statusEl) statusEl.textContent = 'Error de conexión. Intenta de nuevo.';
        }
    },

    showError(msg) {
        document.body.innerHTML = `<div style="padding: 100px; text-align:center;"><h2>${msg}</h2><a href="index.html">Volver al inicio</a></div>`;
    }
};

document.addEventListener('DOMContentLoaded', () => PortalApp.init());
