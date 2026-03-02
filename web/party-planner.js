document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const eventType = params.get('type') || 'Other';
    const leadId = params.get('lead');

    const formContent = document.getElementById('planner-form-content');
    const progressFill = document.getElementById('progress-fill');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');

    let currentStep = 0;
    let steps = [];
    let userInputData = {};
    let clientProfile = null;

    // Capture URL params for referrals/pre-selection
    const referralCode = params.get('ref') || '';
    const preSelectedDJ = params.get('dj') || '';

    // Load Client Profile if logged in
    const loadClientProfile = async () => {
        try {
            const db = window.getSupabaseClient();
            if (!db) return;
            const { data: { user } } = await db.auth.getUser();
            if (user) {
                const { data } = await db.from('client_profiles').select('*').eq('user_id', user.id).single();
                if (data) {
                    clientProfile = data;
                    renderStep(); // Re-render to show banner if needed
                }
            }
        } catch (e) {
            console.warn("Client profile not found or auth error.");
        }
    };

    const saveStepData = () => {
        const step = steps[currentStep];
        if (!step) return;
        step.questions.forEach(q => {
            if (q.type === 'container') return;
            if (q.type === 'checkbox_group') {
                const checked = Array.from(document.querySelectorAll(`input[name="${q.id}"]:checked`)).map(el => el.value);
                userInputData[q.id] = checked.length > 0 ? checked.join(', ') : 'Ninguno';
            } else {
                const el = document.getElementById(q.id);
                if (el) userInputData[q.id] = el.value || 'N/A';
            }
        });
    };

    const logisticsSteps = {
        title: "Logística y Lugar (Venue)",
        questions: [
            {
                id: "guest_count",
                label: "¿Cuántos invitados esperas?",
                type: "number",
                placeholder: "Ej: 150",
                onInput: (val) => {
                    const recDiv = document.getElementById('audio_recommendation');
                    if (!recDiv) return;
                    let rec = "Sistema de Audio Estándar Profesional.";
                    if (val > 150) rec = "⚠️ Recomendamos: Refuerzo de Audio Adicional (Subwoofers extra o Line Array) para cubrir el área.";
                    if (val > 300) rec = "🚨 Crítico: Requiere Sistema de Audio de Alta Potencia y posible ingeniero de sonido.";
                    recDiv.innerHTML = `💡 ${rec}`;
                }
            },
            {
                id: "audio_feedback",
                type: "container",
                html: '<div id="audio_recommendation" class="recommendation-box">💡 Ingresa la cantidad para ver recomendación de audio.</div>'
            },
            {
                id: "venue_restrictions",
                label: "¿El lugar tiene restricciones de incendios o alarmas sensibles?",
                type: "select",
                options: ["No hay restricciones conocidas", "No permite humo/niebla (Alarmas sensibles)", "No permite chispas (Fuego)", "Requiere permisos especiales para FX"],
                recommendation: "Es vital saber esto para evitar que se activen las alarmas de incendio durante el evento."
            },
            {
                id: "insurance_required",
                label: "¿El lugar exige Seguro de Responsabilidad Civil (Liability Insurance / COI)?",
                type: "select",
                options: ["No es necesario", "Sí, requieren COI (Certificate of Insurance)", "No estoy seguro, debo preguntar"],
                recommendation: "Muchos hoteles y salones en Miami exigen un COI de $1M-$2M por parte de los proveedores."
            },
            {
                id: "venue_manager_contact",
                label: "Datos del Manager del Lugar (si es necesario coordinar)",
                type: "textarea",
                placeholder: "Nombre, Email o Teléfono para coordinar logística."
            },
            {
                id: "special_fx",
                label: "¿Deseas agregar efectos especiales? (Sujeto a las reglas del lugar)",
                type: "checkbox_group",
                options: ["Chispas Frías (Cold Sparks)", "Nube de Humo Bajo (Dancing on Clouds)", "Máquina de Humo / Niebla", "CO2 Jets"],
            },
            {
                id: "fx_moments",
                label: "¿En qué momentos te gustaría usar los efectos?",
                type: "textarea",
                placeholder: "Ej: Chispas en la entrada, Nube en el primer baile..."
            }
        ]
    };

    const talentRentalSteps = {
        title: "Selección de Talentos (Rentals)",
        questions: [
            {
                id: "special_acts_group",
                label: "Marca con una palomita los servicios que necesitas para tu orden:",
                type: "checkbox_group",
                options: [
                    "DJ",
                    "MC / Animador",
                    "Saxofonista",
                    "Percusionista (Drums / Timbalero)",
                    "Cantante",
                    "Live Band",
                    "Influencer",
                    "Fotógrafo & Video",
                    "Productor de Eventos",
                    "Promotor",
                    "Artistic Manager"
                ],
                recommendation: "Al completar este plan, te mostraremos los talentos disponibles que coinciden con tu selección."
            }
        ]
    };

    const accessLogisticsSteps = {
        title: "Acceso y Montaje (Load-in)",
        questions: [
            {
                id: "load_in_access",
                label: "¿Cómo es el acceso para carga de equipos?",
                type: "select",
                options: ["Primer Piso (Acceso directo)", "Elevador de Carga", "Elevador de Pasajeros", "Escaleras (Especificar cuántas)", "Rampa de Carga"],
                recommendation: "Saber si hay escaleras o elevadores pequeños nos ayuda a traer el equipo de transporte adecuado."
            },
            {
                id: "power_outlets",
                label: "¿Hay tomas de corriente dedicadas para el DJ cerca de la mesa?",
                type: "select",
                options: ["Sí, circuitos independientes", "Sí, tomas estándar", "No estoy seguro, hay que revisar"],
                recommendation: "Para evitar picos de tensión y ruido eléctrico en el audio, MDJPRO requiere circuitos de 20 Amperios preferiblemente independientes."
            }
        ]
    };

    const sharedMusicSteps = {
        title: "Preferencias Musicales",
        questions: [
            {
                id: "music_content",
                label: "¿Cómo prefieres el contenido de las letras?",
                type: "select",
                options: ["Limpia (Clean - Sin palabras obscenas)", "Explícita (Dirty - Versiones originales)", "Solo Instrumental"],
                recommendation: "Para eventos de alto perfil, bodas y quinces, recomendamos versiones 'Clean' para mantener el profesionalismo."
            },
            {
                id: "must_play",
                label: "Géneros o Artistas indispensables (Must Play)",
                type: "textarea",
                placeholder: "Ej: Bad Bunny, 80s Rock, Salsa, Techno..."
            },
            {
                id: "do_not_play",
                label: "Géneros o Artistas prohibidos (Do Not Play)",
                type: "textarea",
                placeholder: "Música que NO quieres escuchar en tu evento."
            }
        ]
    };

    const lightingSteps = {
        title: "Iluminación y Efectos Visuales",
        questions: [
            {
                id: "lighting_style",
                label: "¿Qué tipo de iluminación ambiental prefieres?",
                type: "select",
                options: ["Uplighting (Colores en las paredes)", "Intelligent Lighting (Cabezas móviles)", "Efecto Discoteca (Luces rítmicas)", "Iluminación Minimalista / Elegante"],
                recommendation: "El 'Uplighting' de 18W Hex-LED permite una mezcla de color perfecta (RGBAW+UV) sin parpadeo en video."
            },
            {
                id: "uplighting_color",
                label: "Color de Uplighting preferido (si aplica)",
                type: "text",
                placeholder: "Ej: Ámbar, Azul MDJ, Rosa, Blanco Cálido..."
            },
            {
                id: "monogram",
                label: "¿Deseas un Gobo / Monograma Personalizado (Nombres en pared/piso)?",
                type: "select",
                options: ["No", "Sí, Proyección Estática", "Sí, Proyección Animada Digital"]
            }
        ]
    };

    const venueAtmosphereSteps = {
        title: "Ambiente Musical (Venue/Club)",
        questions: [
            {
                id: "venue_vibe",
                label: "¿Qué estilo musical requiere el lugar?",
                type: "select",
                options: [
                    "Open Format (Éxitos variados)",
                    "House / Tech House Professional",
                    "Deep House / Lounge (Sunset Vibe)",
                    "Afro House / Tribal",
                    "Urbano / Reggaeton de clase A",
                    "Chill Out / Terraza Instrumental"
                ],
                recommendation: "Para restaurantes y terrazas, 'Deep House' o 'Lounge' garantizan una atmósfera premium."
            },
            {
                id: "dj_role",
                label: "¿Cuál será el rol del DJ?",
                type: "select",
                options: [
                    "Warm Up (Preparar el ambiente)",
                    "Main Headliner (Momento cumbre)",
                    "Closing Set (Cierre con energía)",
                    "DJ de Soporte / Background"
                ]
            },
            {
                id: "performance_type",
                label: "Tipo de Performance / Set",
                type: "select",
                options: [
                    "Hit Line (Solo éxitos comerciales)",
                    "Underground / Deep Selection",
                    "After Party (Vibe extendido)",
                    "Open Format Professional"
                ]
            }
        ]
    };

    const mcTimelineSteps = {
        title: "Protocolo, MC y Hora Loca",
        questions: [
            {
                id: "mc_style",
                label: "¿Cuál es el estilo de animación que buscas?",
                type: "select",
                options: ["Elegante y Discreto (Solo anuncios)", "Interactivo y Enérgico (Anima la pista)", "Bilingüe (Español/Inglés - Recomendado)", "Solo Host Instrumental"],
                recommendation: "Un DJ/MC 'Bilingüe' es esencial en Miami para que todos los invitados se sientan incluidos."
            },
            {
                id: "special_acts",
                label: "¿Habrá algún cantante, show en vivo o acto especial?",
                type: "textarea",
                placeholder: "Ej: Cantante de ópera, saxofonista, show de baile..."
            },
            {
                id: "hora_loca_flow",
                label: "¿Cómo prefieres integrar la 'Hora Loca'?",
                type: "select",
                options: [
                    "Serrar con broche de oro (Al final del evento)",
                    "Abrir el Party (Justo después del protocolo)",
                    "Intermedio (Para re-energizar la pista)",
                    "No habrá Hora Loca",
                    "Personalizado (Especificar en notas)"
                ],
                recommendation: "Cerrar con 'Hora Loca' asegura que los invitados se vayan con la energía al máximo."
            },
            {
                id: "main_events_time",
                label: "Horarios Clave (Eventos Principales)",
                type: "textarea",
                placeholder: "Ej: Entrada 8:00 PM, Primer Baile 8:15 PM, Comida 9:00 PM, Hora Loca 11:00 PM..."
            }
        ]
    };

    const weddingSteps = [
        {
            title: "Recepción y Cocktail",
            questions: [
                {
                    id: "music_reception",
                    label: "¿Qué estilo de música prefieres para la recepción / cocktail?",
                    type: "select",
                    options: ["Deep House (Recomendado)", "Afro House", "Tech House / Lounge", "Instrumental Soft / Jazz", "Personalizado (Especificar abajo)", "Bailable (No recomendado)"],
                    recommendation: "Recomendamos 'Deep House' o 'Afro House' para un ambiente sofisticado."
                },
                {
                    id: "music_dinner",
                    label: "¿Qué música prefieres durante la HORA DE LA CENA?",
                    type: "select",
                    options: ["Instrumental (Piano / Cuerdas)", "Smooth Jazz / Bossanova", "Romantic Ballads", "Disney / Movie Soundtracks", "Lounge / Chill Out", "Personalizado (Especificar abajo)"],
                    recommendation: "Durante la cena, la música debe ser un fondo discreto que no interfiera con las conversaciones."
                },
                {
                    id: "music_special_requests",
                    label: "Canciones o géneros específicos para Cocktail / Cena",
                    type: "textarea",
                    placeholder: "Si elegiste 'Personalizado' o tienes canciones clave, escríbelas aquí."
                },
                {
                    id: "duration_reception",
                    label: "¿Cuánto durará el cocktail?",
                    type: "select",
                    options: ["45 min", "1 hora (Recomendado)", "1.5 horas", "Más de 2 horas"],
                }
            ]
        },
        sharedMusicSteps,
        {
            title: "Entrada y Protocolo",
            questions: [
                {
                    id: "court_entrance",
                    label: "¿Habrá entrada triunfal de la corte?",
                    type: "select",
                    options: ["Sí, con música específica", "No, entrada sencilla", "Solo los novios/quinceañera"],
                },
                {
                    id: "court_details",
                    label: "Detalles de la Corte y Música de Entrada",
                    type: "textarea",
                    placeholder: "Ej: 1. Padres - Canción A, 2. Damas/Caballeros - Canción B, 3. Novios - Canción C..."
                }
            ]
        }
    ];

    const formalDancesSteps = {
        title: "Bailes Formales y Protocolo",
        questions: [
            {
                id: "first_dance",
                label: "Primer Baile (Nombre de Canción y Artista)",
                type: "text",
                placeholder: "Ej: Perfect - Ed Sheeran"
            },
            {
                id: "parent_dances",
                label: "Bailes con Padres (Padre/Hija, Madre/Hijo)",
                type: "textarea",
                placeholder: "Ej: 1. Padre/Hija: Mi Niña - Juan Luis Guerra, 2. Madre/Hijo..."
            },
            {
                id: "cake_cutting",
                label: "Canción para el Corte de Pastel",
                type: "text",
                placeholder: "Ej: Sugar - Maroon 5"
            },
            {
                id: "toasts_names",
                label: "¿Quiénes darán brindis / discursos?",
                type: "textarea",
                placeholder: "Nombres y parentesco para que el MC los anuncie correctamente."
            },
            {
                id: "last_dance",
                label: "Canción de Cierre (Last Dance)",
                type: "text",
                placeholder: "Ej: I Gotta Feeling - Black Eyed Peas"
            }
        ]
    };

    const vendorCoordinationSteps = {
        title: "Coordinación con otros Proveedores",
        questions: [
            {
                id: "planner_name",
                label: "Nombre del Wedding/Event Planner",
                type: "text",
            },
            {
                id: "photographer_name",
                label: "Nombre del Fotógrafo / Videógrafo",
                type: "text",
                recommendation: "El DJ necesita coordinar con foto/video antes de cada momento clave para asegurar que nada se pierda."
            }
        ]
    };

    const generateSteps = () => {
        const isPremium = eventType === 'Wedding' || eventType === 'Quince';
        const isVenue = ['Club', 'Bar', 'Restaurant', 'Venue', 'Lounge'].includes(eventType);

        if (isPremium) {
            steps = [
                logisticsSteps,
                accessLogisticsSteps,
                talentRentalSteps,
                weddingSteps[0],
                sharedMusicSteps,
                weddingSteps[1],
                formalDancesSteps,
                lightingSteps,
                mcTimelineSteps,
                vendorCoordinationSteps
            ];
        } else if (isVenue) {
            // ULTRA FAST FLOW for professional venues
            steps = [
                logisticsSteps,
                talentRentalSteps,
                venueAtmosphereSteps,
                {
                    title: "Detalles Finales",
                    questions: [{ id: "general_notes", label: "Notas para el DJ (Horarios, DRESS CODE, etc.)", type: "textarea" }]
                }
            ];
        } else {
            steps = [
                expertChoiceSteps,
                logisticsSteps,
                talentRentalSteps,
                accessLogisticsSteps,
                sharedMusicSteps,
                lightingSteps,
                mcTimelineSteps,
                vendorCoordinationSteps,
                {
                    title: "Detalles del Evento",
                    questions: [{ id: "general_notes", label: "Notas adicionales para el DJ", type: "textarea" }]
                }
            ];
        }
        renderStep();
    };

    const renderStep = () => {
        const step = steps[currentStep];
        if (!step) return;

        // SKIP LOGIC: If expert choice is "Professional Criteria", skip most steps for non-premium
        if (currentStep > 0 && eventType !== 'Wedding' && eventType !== 'Quince') {
            if (userInputData['planning_type'] === "Confío en el Criterio Profesional de MDJPRO (Llenado rápido)") {
                // If they chose professional criteria, only show logistics and then finish.
                // Step 1 is logisticsSteps. Any step > 1 should be skipped.
                if (currentStep > 1) {
                    generatePDF();
                    return;
                }
            }
        }

        progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;

        const finalRef = referralCode || clientProfile?.source_ref;
        const isLoyaltyClient = (clientProfile?.total_events_booked || 0) > 0;

        const referralBanner = (currentStep === 0 && (finalRef || preSelectedDJ || isLoyaltyClient)) ? `
            <div class="recommendation-box" style="border: 1px solid var(--gold); margin-bottom: 25px; background: rgba(183, 148, 62, 0.05); padding: 20px; border-radius: 15px;">
                ${finalRef ? `
                    <div style="color:var(--gold); font-weight:800; font-size: 16px; margin-bottom: 5px;">🎁 CRÉDITO APLICADO</div>
                    <div style="font-size: 12px; opacity: 0.8;">Referencia: ${finalRef} - Tu descuento se verá reflejado en la cotización final.</div>
                ` : ''}
                ${isLoyaltyClient ? `
                    <div style="color:var(--gold); font-weight:800; font-size: 16px; margin-top: 10px;">🌟 BENEFICIO CLIENTE OFICIAL</div>
                    <div style="font-size: 12px; opacity: 0.8;">¡Gracias por volver! Tienes un descuento preferencial por ser cliente recurrente.</div>
                ` : ''}
                ${preSelectedDJ ? `<div style="margin-top: 15px; font-size: 14px;">🎧 Personalizando para: <strong style="color: var(--gold);">${decodeURIComponent(preSelectedDJ)}</strong></div>` : ''}
            </div>
        ` : '';

        formContent.innerHTML = `
            <h2>${step.title}</h2>
            ${referralBanner}
            ${step.questions.map(q => {
            if (q.type === 'container') return q.html;

            const savedVal = userInputData[q.id] || '';

            return `
                <div class="admin-card" style="margin-top: 20px;">
                    <label>${q.label}</label>
                    ${q.recommendation ? `<div class="recommendation-box">💡 ${q.recommendation}</div>` : ''}
                    ${q.type === 'select' ? `
                        <select id="${q.id}">
                            ${q.options.map(opt => `<option value="${opt}" ${savedVal === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    ` : q.type === 'textarea' ? `
                        <textarea id="${q.id}" rows="4" placeholder="${q.placeholder || ''}">${savedVal}</textarea>
                    ` : q.type === 'number' ? `
                        <input type="number" id="${q.id}" placeholder="${q.placeholder || ''}" value="${savedVal}" oninput="this.onCustomInput(this.value)">
                    ` : q.type === 'text' ? `
                        <input type="text" id="${q.id}" placeholder="${q.placeholder || ''}" value="${savedVal}">
                    ` : q.type === 'checkbox_group' ? `
                        <div id="${q.id}">
                            ${q.options.map(opt => `
                                <label style="display: block; margin-top: 10px; font-weight: normal;">
                                    <input type="checkbox" name="${q.id}" value="${opt}" ${savedVal.includes(opt) ? 'checked' : ''}> ${opt}
                                </label>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `}).join('')}
        `;

        // Handle custom input events
        step.questions.forEach(q => {
            if (q.onInput) {
                const el = document.getElementById(q.id);
                if (el) el.onCustomInput = q.onInput;
            }
        });

        prevBtn.style.display = currentStep === 0 ? 'none' : 'block';
        nextBtn.textContent = currentStep === steps.length - 1 ? 'Finalizar y Descargar PDF' : 'Continuar';
    };

    nextBtn.addEventListener('click', () => {
        saveStepData();
        if (currentStep < steps.length - 1) {
            currentStep++;
            renderStep();
        } else {
            generatePDF();
        }
    });

    prevBtn.addEventListener('click', () => {
        saveStepData();
        if (currentStep > 0) {
            currentStep--;
            renderStep();
        }
    });

    const generatePDF = async () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const blueprintData = {};

        // --- BRANDING HEADER ---
        doc.setFillColor(0, 0, 0); // Black background
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("Helvetica", "bold");
        doc.text("MDJPRO", 20, 25);

        doc.setFontSize(10);
        doc.setFont("Helvetica", "normal");
        doc.text("MIAMI DJ BEAT — EVENT BLUEPRINT v1.0", 20, 32);

        doc.setTextColor(183, 148, 62); // Gold color
        doc.setFontSize(10);
        doc.text("Professional Event Production & Management", 120, 23);
        doc.text("www.miamidjbeat.com | Miami, FL", 120, 30);
        doc.text("contact@miamidjbeat.com", 120, 37);

        // --- EVENT HEADER ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont("Helvetica", "bold");
        doc.text("DETALLES DEL EVENTO", 20, 55);

        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");
        doc.text(`Tipo de Evento: ${eventType}`, 20, 65);
        doc.text(`Fecha del Reporte: ${new Date().toLocaleDateString()}`, 20, 72);
        doc.text(`ID de Lead: ${leadId || 'MDJ-' + Math.floor(Math.random() * 10000)}`, 20, 79);

        let y = 95;
        steps.forEach(step => {
            // Check for page overflow
            if (y > 250) {
                doc.addPage();
                y = 20;
            }

            doc.setFillColor(245, 245, 245);
            doc.rect(20, y - 5, 170, 8, 'F');

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(12);
            doc.text(step.title.toUpperCase(), 25, y);
            y += 12;

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(10);
            step.questions.forEach(q => {
                if (q.type === 'container') return;

                const val = userInputData[q.id] || 'N/A';
                blueprintData[q.id] = val;

                // Wrap text for long answers
                const splitTitle = doc.splitTextToSize(`• ${q.label}:`, 165);
                doc.setFont("Helvetica", "bold");
                doc.text(splitTitle, 25, y);
                y += (splitTitle.length * 5);

                doc.setFont("Helvetica", "normal");
                const splitVal = doc.splitTextToSize(val, 155);
                doc.text(splitVal, 30, y);
                y += (splitVal.length * 5) + 3;

                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
            });
            y += 10;
        });

        // --- FOOTER & SIGNATURE ---
        if (y > 240) {
            doc.addPage();
            y = 30;
        }

        doc.setDrawColor(200, 200, 200);
        doc.line(20, y + 20, 90, y + 20);
        doc.line(120, y + 20, 190, y + 20);
        doc.setFontSize(8);
        doc.text("Firma del Cliente", 45, y + 25);
        doc.text("Firma Miami DJ Beat LLC", 140, y + 25);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        const footerText = "Este Guion de Evento (Blueprint) es propiedad intelectual de Miami DJ Beat LLC. La ejecución técnica y musical se basará en estos parámetros detallados.";
        doc.text(footerText, 105, 285, { align: 'center' });

        // --- EXPERT CERTIFICATION BLOCK ---
        if (y < 200) {
            y += 20;
            doc.setFillColor(0, 0, 0);
            doc.rect(20, y, 170, 35, 'F');

            doc.setTextColor(183, 148, 62); // Gold
            doc.setFontSize(10);
            doc.setFont("Helvetica", "bold");
            doc.text("MDJPRO PERFORMANCE & QUALITY STANDARD", 25, y + 10);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont("Helvetica", "normal");
            const certText = [
                "• VERIFICACIÓN ACÚSTICA: Optimización de presión sonora y cobertura de 180°.",
                "• GESTIÓN DE CABLES: Instalación de 'Clean-Look' sin cables visibles.",
                "• RESPALDO TÉCNICO: Sistema de redundancia activa para música y energía.",
                "• CERO FALLO: Protocolo de prueba de señal 60 min antes del inicio."
            ];
            doc.text(certText, 25, y + 18);
        }

        // Save to Supabase
        if (leadId) {
            try {
                const { error: updateError } = await supabase
                    .from('leads')
                    .update({
                        notes: JSON.stringify(blueprintData),
                        status: 'PLANNING_COMPLETE'
                    })
                    .eq('id', leadId);

                if (updateError) console.warn('Error updating lead data:', updateError);
                else console.log('Lead blueprint saved to Supabase');
            } catch (e) {
                console.error('Supabase update failed:', e);
            }
        }

        const rolesParam = encodeURIComponent(userInputData['special_acts_group'] || '');
        const dateParam = encodeURIComponent(userInputData['event_date'] || ''); // Assume shared or lead date

        doc.save(`Blueprint_${eventType}_${new Date().getTime()}.pdf`);
        alert("¡Felicidades! Tu plan de fiesta ha sido generado con estándares corporativos MDJPRO. Ahora verás los talentos disponibles.");
        window.location.href = `find-dj.html?roles=${rolesParam}&date=${dateParam}`;
    };

    loadClientProfile();
    generateSteps();
});
