/* ── Miami DJ Beat — Certification Engine JS ──────────────────────
   Motor: 32 preguntas (MC auto-score + Short con rúbrica)
   Pre-Graduado: ≥ 80% Y fallos técnicos ≤ 2 | ID: MDB-YYYYMMDD-XXXX
   ─────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const LS_KEY = 'mdb_cert_last';

    /* ── MODO DE EVALUACIÓN ──────────────────────────────────────
       Público (default) → resultado inmediato.
       Evento/institucional → /certification.html?mode=review
           - No muestra score ni breakdown
           - Muestra solo ID + mensaje de validación
           - Email sí contiene resultado
       Activar sin tocar código: solo cambiar el link del evento. */
    const REVIEW_MODE = new URLSearchParams(window.location.search).get('mode') === 'review';


    /* ── QUESTION BANK (20 questions) ─────────────────── */
    const questions = [
        // SECCIÓN 1 — Fundamentos Estratégicos
        {
            id: 'q1', section: 'Sección 1 — Fundamentos Estratégicos', type: 'mc', points: 5,
            text: '¿Cuál es el error principal de organizar música únicamente por artista o álbum?',
            options: [
                { k: 'a', t: 'Ocupa demasiado espacio en el disco duro' },
                { k: 'b', t: 'No está optimizado para uso en vivo — dificulta encontrar tracks por función energética' },
                { k: 'c', t: 'Es difícil de exportar a USB' },
                { k: 'd', t: 'No permite calcular el BPM automáticamente' },
            ],
            answer: 'b',
            tip: 'Un sistema pro se organiza por función: energía, momento del set, tipo de evento.'
        },
        {
            id: 'q2', section: 'Sección 1 — Fundamentos Estratégicos', type: 'mc', points: 5,
            text: '¿En cuánto tiempo máximo un DJ profesional debería encontrar un track en cabina?',
            options: [
                { k: 'a', t: '20 segundos' },
                { k: 'b', t: '15 segundos' },
                { k: 'c', t: '10 segundos' },
                { k: 'd', t: '5 segundos' },
            ],
            answer: 'd',
            tip: 'Si tardas más de 5 segundos, el sistema está mal diseñado. En cabina no hay tiempo para buscar.'
        },
        {
            id: 'q3', section: 'Sección 1 — Fundamentos Estratégicos', type: 'short', points: 10,
            text: '¿Qué es más importante en cabina: BPM o energía? Explique brevemente (mínimo 4 líneas).',
            rubric: [
                'Diferencia entre BPM (técnico) y energía (emocional/percepción)',
                'Habla de lectura de pista y dinámica emocional del set',
                'Menciona que mismo BPM puede tener diferente impacto según tonalidad/voz/producción',
                'Concluye con criterio práctico de uso en cabina',
            ]
        },

        // SECCIÓN 2 — Serato DJ Profesional
        {
            id: 'q4', section: 'Sección 2 — Serato DJ Profesional', type: 'short', points: 10,
            text: '¿Qué diferencia existe entre un Crate y un Smart Crate en Serato?',
            rubric: [
                'Crate = carpeta manual curada por el DJ',
                'Smart Crate = se alimenta automáticamente por reglas definidas',
                'Menciona tipo de reglas (BPM, Genre, Year, Comments, Rating)',
                'Explica el beneficio operativo (actualización automática, consistencia)',
            ]
        },
        {
            id: 'q5', section: 'Sección 2 — Serato DJ Profesional', type: 'short', points: 10,
            text: '¿Qué campos de metadata son obligatorios para un DJ profesional? Mencione al menos 4 y explique su uso.',
            rubric: [
                'Incluye mínimo 4 campos (BPM, Key, Genre, Year, Comments, Rating, Subgénero)',
                'Explica el uso práctico de cada uno en vivo',
                'Menciona Comments como campo de inteligencia de cabina',
                'Enfoca búsqueda rápida y decisiones de cabina',
            ]
        },
        {
            id: 'q6', section: 'Sección 2 — Serato DJ Profesional', type: 'mc', points: 5,
            text: 'Antes de tocar en vivo, un track debe tener obligatoriamente:',
            options: [
                { k: 'a', t: 'Solo BPM correcto' },
                { k: 'b', t: 'Hot cues estructurados (Intro, Drop, Break, Outro) y beatgrid corregido' },
                { k: 'c', t: 'Solo la key detectada por el algoritmo' },
                { k: 'd', t: 'La portada del álbum correctamente actualizada' },
            ],
            answer: 'b',
            tip: 'Un track sin beatgrid corregido y hot cues pone en riesgo el set completo.'
        },
        {
            id: 'q7', section: 'Sección 2 — Serato DJ Profesional', type: 'short', points: 10,
            text: '¿Cuál es la función estratégica del campo "Comments" en Serato en un entorno Open Format?',
            rubric: [
                'Notas tácticas de transición (BPM puente, energía, género siguiente)',
                'Contexto de uso (peak, warmup, emergency)',
                'Alertas técnicas (intro larga, vocal explícita, versión clean)',
                'Acelera velocidad de decisión en cabina bajo presión',
            ]
        },

        // SECCIÓN 3 — Rekordbox Profesional
        {
            id: 'q8', section: 'Sección 3 — Rekordbox Profesional', type: 'short', points: 10,
            text: '¿Cuál es la diferencia entre una Playlist y una Intelligent Playlist en Rekordbox?',
            rubric: [
                'Playlist = manual, curada directamente por el DJ',
                'Intelligent Playlist = reglas automáticas (BPM, Key, Rating, Genre, My Tag)',
                'La Intelligent se actualiza automáticamente al añadir tracks nuevos',
                'Beneficio: consistencia sin mantenimiento manual',
            ]
        },
        {
            id: 'q9', section: 'Sección 3 — Rekordbox Profesional', type: 'short', points: 10,
            text: '¿Qué es "My Tag" en Rekordbox y por qué es útil en cabina con CDJ?',
            rubric: [
                'Sistema de etiquetado funcional personalizado (Warm Up, Peak, After, Underground, etc.)',
                'Permite filtrado rápido desde la pantalla del CDJ sin salir del set',
                'Organización por energía y función energética en lugar de solo género',
                'Mejora control y velocidad de decisión bajo presión en vivo',
            ]
        },
        {
            id: 'q10', section: 'Sección 3 — Rekordbox Profesional', type: 'short', points: 10,
            text: '¿Por qué el DJ profesional NO exporta toda la librería al USB? Explique el riesgo.',
            rubric: [
                'Búsqueda lenta por volumen excesivo',
                'Desorden visual y riesgo de versiones duplicadas',
                'Falta de curaduría por evento — el USB debe ser temático',
                'Profesional = USB1 OpenFormat / USB2 House+Tech / USB3 Emergency',
            ]
        },

        // SECCIÓN 4 — Automatización y Herramientas Modernas
        {
            id: 'q11', section: 'Sección 4 — Automatización Moderna', type: 'short', points: 10,
            text: 'Mencione al menos 3 tareas que pueden automatizarse con herramientas modernas de organización musical.',
            rubric: [
                'Menciona 3 tareas válidas (detección BPM/Key, limpieza masiva metadata, eliminación duplicados, clasificación energética, normalización, corrección beatgrid)',
                'Conecta al ahorro de tiempo y reducción de errores humanos',
                'Menciona impacto en consistencia de librería',
                'Distingue lo automatizable de lo que requiere criterio humano',
            ]
        },
        {
            id: 'q12', section: 'Sección 4 — Automatización Moderna', type: 'short', points: 10,
            text: '¿Por qué eliminar duplicados es crítico para el rendimiento profesional en cabina?',
            rubric: [
                'Confusión en búsqueda — dos archivos idénticos en sets distintos',
                'Riesgo de reproducir versión incorrecta (dirty en evento corporativo)',
                'Carga mental adicional que afecta decisiones bajo presión',
                'Consistencia de playlists y exports USB comprometida',
            ]
        },
        {
            id: 'q13', section: 'Sección 4 — Automatización Moderna', type: 'short', points: 10,
            text: '¿Qué ventaja competitiva tiene un DJ que usa una app externa para preprocesar su librería antes de importarla al software DJ?',
            rubric: [
                'Estandarización pre-import (metadata, nombres, estructura de carpetas)',
                'Acelera el workflow completo (import → curate → export USB)',
                'Reduce errores en vivo por mala metadata o duplicados no detectados',
                'Escalabilidad para manejar librerías de +50,000 tracks con consistencia',
            ]
        },

        // SECCIÓN 5 — Escenario Real
        {
            id: 'q14', section: 'Sección 5 — Escenario Real de Cabina', type: 'short', points: 15,
            text: 'Estás en un club Open Format. Vienes de Hip Hop a 95 BPM y necesitas subir a House a 124 BPM sin perder la pista. Describe detalladamente tu estrategia.',
            rubric: [
                'Propone track puente en BPM intermedio (100–112), no salta directo',
                'Menciona loop, breakdown, echo-out o acappella como herramienta de transición',
                'Mantiene coherencia emocional/energética durante el cruce',
                'Evita "subir el pitch brutalmente" como única estrategia — si lo menciona pierde puntos (penalización)',
            ]
        },
        {
            id: 'q15', section: 'Sección 5 — Escenario Real de Cabina', type: 'short', points: 10,
            text: 'El WiFi del club falla y toda tu librería dependía de streaming. ¿Qué demuestra eso sobre tu preparación?',
            rubric: [
                'Ausencia de backup offline — dependencia de infraestructura externa',
                'Riesgo reputacional directo ante cliente, venue y público',
                'Violación de principio básico: Emergency Crate local siempre presente',
                'Describe medidas correctivas: USB espejo + 20 tracks offline probados + redundancia',
            ]
        },

        // SECCIÓN 6 — Disciplina y Respeto
        {
            id: 'q16', section: 'Sección 6 — Disciplina y Respeto', type: 'mc', points: 5,
            text: 'Llegar exactamente a la hora del set (sin margen de preparación) normalmente demuestra:',
            options: [
                { k: 'a', t: 'Confianza y nivel de experiencia del DJ' },
                { k: 'b', t: 'Falta de planificación — el profesional llega 30–60 min antes para revisar cabina' },
                { k: 'c', t: 'Profesionalismo extremo — llegar justo es señal de respeto al anterior' },
                { k: 'd', t: 'Experiencia avanzada que no requiere preparación adicional' },
            ],
            answer: 'b',
            tip: 'El profesional llega temprano, revisa equipos, saluda al venue y no genera presión al DJ anterior.'
        },
        {
            id: 'q17', section: 'Sección 6 — Disciplina y Respeto', type: 'mc', points: 5,
            text: 'En un warm up, "quemar la pista" significa:',
            options: [
                { k: 'a', t: 'Bajar el volumen demasiado durante los primeros tracks' },
                { k: 'b', t: 'Subir energía con drops y bangers antes de tiempo, destruyendo la narrativa del set principal' },
                { k: 'c', t: 'Usar música all-instrumental durante el warm up' },
                { k: 'd', t: 'Mezclar con EQ plano sin ajustes de frecuencia' },
            ],
            answer: 'b',
            tip: 'El warm up construye. El headliner explota. Si quemas la pista antes, saboteas a quien sigue.'
        },
        {
            id: 'q18', section: 'Sección 6 — Disciplina y Respeto', type: 'short', points: 10,
            text: 'Describe el protocolo correcto para terminar tu set y entregar la cabina al siguiente DJ.',
            rubric: [
                'Comunicación previa (avisa con 10–15 min cuántos tracks le quedan)',
                'Entrega energética limpia — no corta en el peak, prepara el aterrizaje',
                'Respeta niveles de ganancia y EQ — no los cambia sin avisar',
                'No toca el "signature track" del siguiente DJ ni hace sabotaje sonoro',
            ]
        },

        // SECCIÓN 7 — Historia con Propósito
        {
            id: 'q19', section: 'Sección 7 — Historia con Propósito', type: 'short', points: 10,
            text: 'Menciona una etapa del DJing (Bronx / Disco / House / Techno / Rave / Digital) y extrae un valor profesional concreto que aplique hoy en cabina.',
            rubric: [
                'Identifica correctamente una etapa histórica real',
                'Extrae un valor claro (disciplina, comunidad, respeto, innovación, ética)',
                'Lo conecta con una conducta específica de cabina hoy',
                'Respuesta concreta y aplicable — no filosófica vacía',
            ]
        },
        {
            id: 'q20', section: 'Sección 7 — Historia con Propósito', type: 'mc', points: 5,
            text: 'Un DJ profesional respeta a otros DJs porque:',
            options: [
                { k: 'a', t: 'Así evita problemas con el personal de seguridad del venue' },
                { k: 'b', t: 'La cultura del DJing es un ecosistema — la reputación, el networking y la continuidad del evento dependen de ello' },
                { k: 'c', t: 'El público siempre lo exige explícitamente' },
                { k: 'd', t: 'El contrato de servicios lo especifica en todas las cláusulas' },
            ],
        },

        // SECCIÓN 8 — Conexiones Profesionales
        {
            id: 'q21', section: 'Sección 8 — Conexiones Profesionales', type: 'mc', points: 5,
            text: '¿Qué tipo de cable es más apropiado para enviar señal master a larga distancia en un club grande?',
            options: [
                { k: 'a', t: 'RCA' },
                { k: 'b', t: 'USB' },
                { k: 'c', t: 'XLR balanceado' },
                { k: 'd', t: 'Mini jack' },
            ],
            answer: 'c',
            tip: 'XLR balanceado cancela interferencia y mantiene señal limpia a grandes distancias.'
        },
        {
            id: 'q22', section: 'Sección 8 — Conexiones Profesionales', type: 'mc', points: 5,
            text: '¿Cuál es la principal ventaja de una conexión balanceada?',
            options: [
                { k: 'a', t: 'Más volumen de salida' },
                { k: 'b', t: 'Menos latencia digital' },
                { k: 'c', t: 'Cancelación de ruido por Phase Reversal' },
                { k: 'd', t: 'Más frecuencias graves' },
            ],
            answer: 'c',
            tip: 'La conexión balanceada usa 3 pines: hot, cold y tierra. El cold invierte fase y cancela ruido inducido.'
        },
        {
            id: 'q23', section: 'Sección 8 — Conexiones Profesionales', type: 'mc', points: 5,
            text: '¿Qué salida del mixer debe usarse exclusivamente para los monitores de cabina?',
            options: [
                { k: 'a', t: 'Master Out' },
                { k: 'b', t: 'Booth Out' },
                { k: 'c', t: 'Rec Out' },
                { k: 'd', t: 'Aux In' },
            ],
            answer: 'b',
            tip: 'Booth Out tiene su propio control de volumen — independiente del Master, protege tu escucha sin afectar el PA.'
        },

        // SECCIÓN 9 — Tipos de Cables
        {
            id: 'q24', section: 'Sección 9 — Tipos de Cables', type: 'mc', points: 5,
            text: 'Conectar un cable RCA de 15 metros a un sistema PA grande puede generar:',
            options: [
                { k: 'a', t: 'Más potencia de salida' },
                { k: 'b', t: 'Señal estéreo mejorada' },
                { k: 'c', t: 'Interferencia, ruido y pérdida de señal' },
                { k: 'd', t: 'Más claridad en medios' },
            ],
            answer: 'c',
            tip: 'RCA es no balanceado — a +5 metros pierde señal e introduce ruido inductivo. Nunca en PA grande.'
        },
        {
            id: 'q25', section: 'Sección 9 — Tipos de Cables', type: 'mc', points: 5,
            text: '¿Para qué se usa un cable Speakon?',
            options: [
                { k: 'a', t: 'Señal de línea entre mixer y interface' },
                { k: 'b', t: 'Conectar laptop al mixer' },
                { k: 'c', t: 'Amplificador a bocina pasiva (señal amplificada)' },
                { k: 'd', t: 'Conectar DJ controller' },
            ],
            answer: 'c',
            tip: 'Speakon lleva señal amplificada — no es señal de línea. Nunca lo uses en entradas de equipos.'
        },
        {
            id: 'q26', section: 'Sección 9 — Tipos de Cables', type: 'mc', points: 5,
            text: 'Enviar señal saturada (red-lining) al sistema principal durante un evento es:',
            options: [
                { k: 'a', t: 'Normal en clubs de alto volumen' },
                { k: 'b', t: 'Aceptable si el público baila fuerte' },
                { k: 'c', t: 'Un error profesional grave que puede dañar equipos' },
                { k: 'd', t: 'Necesario para maximizar potencia' },
            ],
            answer: 'c',
            tip: 'Red-lining distorsiona la señal, fuerza los amplificadores y daña bocinas. Control de ganancia = disciplina profesional.'
        },

        // SECCIÓN 10 — Equipos DJ (no hard gate — cuenta al score general)
        {
            id: 'q27', section: 'Sección 10 — Equipos DJ', type: 'mc', points: 5,
            text: '¿Qué equipo es el estándar "club standard" para DJs que trabajan en venues grandes?',
            options: [
                { k: 'a', t: 'Controlador + laptop' },
                { k: 'b', t: 'CDJs/XDJs + mixer independiente' },
                { k: 'c', t: 'Turntable con vinilo sin mixer' },
                { k: 'd', t: 'Bluetooth speaker' },
            ],
            answer: 'b',
            tip: 'CDJ/XDJ + mixer es el estándar global en clubs y festivales — saber operarlo es obligatorio para tocar en venues serios.'
        },
        {
            id: 'q28', section: 'Sección 10 — Equipos DJ', type: 'mc', points: 5,
            text: '¿Qué setup es más adecuado para un Mobile DJ (bodas/corporativo) por portabilidad?',
            options: [
                { k: 'a', t: '4 CDJs + mixer de 19" rack' },
                { k: 'b', t: '2 turntables + battle mixer' },
                { k: 'c', t: 'Controlador + laptop' },
                { k: 'd', t: 'Solo micrófono' },
            ],
            answer: 'c',
            tip: 'El controlador compacto + laptop es el setup más eficiente para mobile — portabilidad, rapidez y costo optimizado.'
        },
        {
            id: 'q29', section: 'Sección 10 — Equipos DJ', type: 'mc', points: 5,
            text: '¿Cuál es la ventaja principal del Standalone DJ (sin laptop)?',
            options: [
                { k: 'a', t: 'Más bass en las bajas frecuencias' },
                { k: 'b', t: 'Menos dependencia del computador — mayor fiabilidad' },
                { k: 'c', t: 'Siempre suena con más volumen' },
                { k: 'd', t: 'Mejor conectividad WiFi' },
            ],
            answer: 'b',
            tip: 'El standalone elimina la variable más frágil del setup: la laptop. Menos software = menos puntos de falla.'
        },
        {
            id: 'q30', section: 'Sección 10 — Equipos DJ', type: 'mc', points: 5,
            text: 'Un Scratch DJ / Turntablist normalmente requiere:',
            options: [
                { k: 'a', t: 'CDJ + USB exportado en Rekordbox' },
                { k: 'b', t: 'Controlador básico de entrada' },
                { k: 'c', t: 'Turntables + mixer (y DVS si aplica)' },
                { k: 'd', t: 'Solo configurar Rekordbox export' },
            ],
            answer: 'c',
            tip: 'El turntable es el instrumento del turntablist. DVS (Digital Vinyl System) permite usar vinilo para controlar Serato con archivos digitales.'
        },
        {
            id: 'q31', section: 'Sección 10 — Equipos DJ', type: 'mc', points: 5,
            text: 'Para festivales, además del equipo, ¿qué es crítico?',
            options: [
                { k: 'a', t: 'Tener buenas luces en el escenario' },
                { k: 'b', t: 'Ordenar playlists por artista' },
                { k: 'c', t: 'Preparación de USBs exportados, backups y compatibilidad de cabina' },
                { k: 'd', t: 'Tener cuenta verificada en Instagram' },
            ],
            answer: 'c',
            tip: 'En festival no hay tiempo de improvisar. USB exportado correctamente + backup + saber la cabina disponible = preparación básica.'
        },
        {
            id: 'q32', section: 'Sección 10 — Equipos DJ', type: 'mc', points: 5,
            text: '¿Qué error es típico de un DJ mal preparado para un club con CDJs?',
            options: [
                { k: 'a', t: 'Llevar un USB de backup' },
                { k: 'b', t: 'No saber operar CDJs y depender 100% de laptop sin plan B' },
                { k: 'c', t: 'Usar Booth Out para los monitores' },
                { k: 'd', t: 'Usar XLR balanceado para el PA' },
            ],
            answer: 'b',
            tip: 'No saber operar los CDJs de la cabina es una falla profesional grave. El DJ que llega sin dominar el standard de la cabina pone en riesgo el evento entero.'
        },
    ];

    const MAX_POINTS = questions.reduce((s, q) => s + q.points, 0);
    const SECTIONS = [...new Set(questions.map(q => q.section))];

    /* ── UNIQUE ID GENERATOR ────────────────────────────── */
    function genCertId() {
        const d = new Date();
        const pad = (n, l = 2) => String(n).padStart(l, '0');
        const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `MDB-${date}-${rnd}`;
    }

    /* ── HTML HELPERS ────────────────────────────────────── */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    /* ── STEP-BY-STEP ENGINE STATE ───────────────────────── */
    let currentQ = 0;
    let mcAnswers = {};   // { qid: 'a'|'b'|'c'|'d' }
    let shortTexts = {};   // { qid: 'texto...' }
    let shortScores = {};   // { qid: number }

    /* ── START EXAM ──────────────────────────────────────── */
    function startExam() {
        const name = $('djName').value.trim();
        const agree = $('codeAgree').checked;
        if (!name) { alert('Por favor ingresa tu nombre DJ antes de comenzar.'); $('djName').focus(); return; }
        if (!agree) { alert('Debes aceptar el Código Profesional para continuar.'); $('codeAgree').parentElement.scrollIntoView({ behavior: 'smooth' }); return; }
        currentQ = 0;
        mcAnswers = {}; shortTexts = {}; shortScores = {};
        $('quizIntro').classList.add('hidden');
        $('quizShell').classList.remove('hidden');
        $('year').textContent = new Date().getFullYear();
        renderStep();
        $('quizCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ── RENDER CURRENT STEP ─────────────────────────────── */
    function renderStep() {
        const q = questions[currentQ];
        const total = questions.length;
        const prog = Math.round(((currentQ + 1) / total) * 100);

        // Progress
        $('stepBar').style.width = prog + '%';
        $('stepLabel').textContent = `Pregunta ${currentQ + 1} de ${total}`;

        // Section badge
        $('stepSection').textContent = q.section;

        // Question header
        $('stepNum').textContent = `PREGUNTA ${currentQ + 1} DE ${total}`;
        $('stepPoints').textContent = q.points + ' pts';
        $('stepText').textContent = q.text;

        // Reset feedback
        $('stepFeedback').className = 'stepFeedback hidden';
        $('stepFeedback').innerHTML = '';

        if (q.type === 'mc') {
            $('stepShort').classList.add('hidden');
            const optsEl = $('stepOpts');
            optsEl.innerHTML = '';
            optsEl.classList.remove('hidden');

            const answered = mcAnswers[q.id] !== undefined;

            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'stepOpt';
                btn.innerHTML = `<span class="stepOptLetter">${opt.k.toUpperCase()}</span><span>${escapeHtml(opt.t)}</span>`;

                if (answered) {
                    btn.disabled = true;
                    if (opt.k === q.answer) btn.classList.add('correct');
                    else if (opt.k === mcAnswers[q.id]) btn.classList.add('wrong');
                } else {
                    btn.addEventListener('click', () => selectMC(q, opt.k));
                }
                optsEl.appendChild(btn);
            });

            if (answered) {
                showMCFeedback(q, mcAnswers[q.id]);
                $('btnNext').disabled = false;
            } else {
                $('btnNext').disabled = true;
            }

        } else {
            // Short answer
            $('stepOpts').innerHTML = '';
            $('stepOpts').classList.add('hidden');
            $('stepShort').classList.remove('hidden');

            const txt = $('stepTxt');
            const slider = $('stepSlider');
            const lbl = $('stepScoreLbl');

            txt.value = shortTexts[q.id] || '';
            slider.max = q.points;
            slider.value = shortScores[q.id] !== undefined ? shortScores[q.id] : 0;
            lbl.textContent = slider.value;

            // Rubric
            $('stepRubric').innerHTML = `
                <div class="rubricTitle">📋 Rúbrica de Auto-evaluación</div>
                <ul class="rubricList">${q.rubric.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
            `;

            // Slider enables SIGUIENTE once moved
            slider.oninput = () => {
                lbl.textContent = slider.value;
                $('btnNext').disabled = false;
            };

            $('btnNext').disabled = shortScores[q.id] === undefined;
        }

        // Button label
        $('btnNext').textContent = currentQ === total - 1 ? '🎯 CALCULAR RESULTADO' : 'SIGUIENTE →';
    }

    /* ── MC ANSWER SELECTION ─────────────────────────────── */
    function selectMC(q, key) {
        mcAnswers[q.id] = key;
        renderStep();
    }

    function showMCFeedback(q, given) {
        const correct = given === q.answer;
        const fb = $('stepFeedback');
        fb.className = 'stepFeedback ' + (correct ? 'correct' : 'wrong');
        fb.innerHTML = correct
            ? '✅ ¡Correcto!'
            : `❌ Incorrecto — La respuesta correcta es: <strong>${q.answer.toUpperCase()}</strong>`;
        if (q.tip) fb.innerHTML += `<div class="stepTip">💡 ${escapeHtml(q.tip)}</div>`;
    }

    /* ── NEXT STEP ───────────────────────────────────────── */
    function nextStep() {
        const q = questions[currentQ];

        // Save short-answer state before advancing
        if (q.type === 'short') {
            shortTexts[q.id] = $('stepTxt').value.trim();
            shortScores[q.id] = parseInt($('stepSlider').value) || 0;
        }

        if (currentQ < questions.length - 1) {
            currentQ++;
            $('btnNext').disabled = true;
            renderStep();
            $('quizCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            score();
        }
    }


    /* ── SCORE ──────────────────────────────────────────── */
    async function score() {
        const name = $('djName').value.trim();
        const agree = $('codeAgree').checked;

        if (!name) {
            alert('Por favor ingresa tu nombre DJ antes de calcular tu resultado.');
            $('djName').focus();
            return;
        }
        if (!agree) {
            alert('Debes aceptar el Código Profesional de Miami DJ Beat para recibir tu resultado.');
            $('codeAgree').parentElement.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        let totalEarned = 0;
        const sectionScores = {};
        SECTIONS.forEach(s => sectionScores[s] = { earned: 0, max: 0 });

        const mcMisses = [];
        const shortBlanks = [];

        questions.forEach(q => {
            sectionScores[q.section].max += q.points;

            if (q.type === 'mc') {
                const ans = mcAnswers[q.id] || null;
                if (ans === q.answer) {
                    totalEarned += q.points;
                    sectionScores[q.section].earned += q.points;
                } else {
                    mcMisses.push({ q, given: ans });
                }
            } else {
                const s = shortScores[q.id] || 0;
                const txt = shortTexts[q.id] || '';
                totalEarned += s;
                sectionScores[q.section].earned += s;
                if (!txt) shortBlanks.push(q);
            }
        });

        const pct = Math.round((totalEarned / MAX_POINTS) * 100);
        const certId = genCertId();

        /* ── Hard gate config ─────────────────────────────────
           Secciones 8 (Conexiones) y 9 (Cables) = bloque critico.
           ≥ 3 fallos → FAIL automático, sin importar el % general.
           Sección 10 (Equipos) NO tiene hard gate. */
        const TECHNICAL_SECTIONS = ['Sección 8 — Conexiones Profesionales', 'Sección 9 — Tipos de Cables'];
        const technicalMisses = mcMisses.filter(m => TECHNICAL_SECTIONS.includes(m.q.section)).length;

        // preGrad = pct ≥ 80% Y fallos técnicos ≤ 2
        const preGrad = pct >= 80 && technicalMisses <= 2;

        if (technicalMisses >= 3) {
            $('feedback').innerHTML = `
              <div style="padding:40px;border-radius:24px;background:rgba(229,62,62,0.06);border:1px solid rgba(229,62,62,0.3);text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">❌</div>
                <h3 style="font-size:22px;font-weight:900;color:#fc8181;margin-bottom:12px;">FAIL — Bloque Técnico</h3>
                <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;max-width:480px;margin:0 auto 20px;">
                  <strong style="color:#fff;">${technicalMisses} de 6</strong> preguntas técnicas incorrectas.<br>
                  El estándar profesional exige mínimo 4 correctas en Conexiones y Cables.
                </p>
                <div style="display:inline-block;padding:10px 20px;background:rgba(229,62,62,0.1);border:1px solid rgba(229,62,62,0.2);border-radius:12px;">
                  <p style="font-size:13px;color:#fc8181;margin:0;">Estudia los Módulos 5 y 6 y vuelve a intentarlo.</p>
                </div>
              </div>
            `;
            renderSectionBars(sectionScores, SECTIONS, TECHNICAL_SECTIONS, technicalMisses);
            $('result').classList.remove('hidden');
            $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        /* ── Supabase INSERT ────────────────────────────────── */
        let registry = "—";   // populated by DB trigger via select-after-insert
        try {
            const { error: insErr } = await supabaseClient
                .from('certificates')
                .insert([{
                    cert_id: certId,
                    dj_name: name,
                    email: $('djEmail').value.trim() || null,
                    theory_score: totalEarned,
                    theory_pct: pct,
                    pre_graduated: preGrad,
                }]);
            if (insErr) {
                console.error('Supabase insert error:', insErr);
            } else {
                // Separate select — safer under RLS than chaining .select() on insert
                const { data: regData } = await supabaseClient
                    .from('certificates')
                    .select('public_year, public_seq')
                    .eq('cert_id', certId)
                    .single();
                if (regData && regData.public_year && regData.public_seq) {
                    registry = `${regData.public_year}-${String(regData.public_seq).padStart(6, '0')}`;
                }
                console.log('Certificate stored. Registry:', registry);
            }
        } catch (err) {
            console.error('Insert failed:', err);
        }

        /* Level label */
        let level, levelColor;
        if (pct >= 80) { level = 'DJ Estructurado Profesional'; levelColor = 'var(--good)'; }
        else if (pct >= 65) { level = 'Nivel Intermedio Alto'; levelColor = 'var(--warn)'; }
        else if (pct >= 50) { level = 'Nivel Intermedio'; levelColor = 'var(--warn)'; }
        else { level = 'No Apto Profesional'; levelColor = 'var(--bad)'; }

        /* ── DISPLAY: PUBLIC vs REVIEW MODE ────────────────────────
           REVIEW_MODE = true  → Deferred (no score shown)
           REVIEW_MODE = false → Full instant feedback (default) */
        if (REVIEW_MODE) {
            // ── REVIEW MODE: minimal display, score deferred ──
            const badge = $('levelBadge');
            badge.textContent = 'En Revisión Oficial';
            badge.style.borderColor = 'var(--gold)';
            badge.style.color = 'var(--gold)';

            $('scoreLine').innerHTML =
                `<strong>ID de examen:</strong> <code>${certId}</code>`;

            $('preGradLine').innerHTML =
                `Tu examen ha sido registrado y enviado para validación oficial por el equipo Miami DJ Beat.<br>
                    <small style="color:var(--muted);">Verifica el estado en: <a href="/verify?id=${certId}" style="color:var(--gold);">/verify?id=${certId}</a></small>`;

            $('feedback').innerHTML = `
                  <div style="padding:40px;border-radius:24px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.2);text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">📋</div>
                    <h3 style="font-size:22px;font-weight:900;color:var(--gold);margin-bottom:12px;">Resultado enviado para validación oficial</h3>
                    <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;max-width:480px;margin:0 auto 20px;">
                      El equipo Miami DJ Beat revisará y comunicará el resultado oficial.
                    </p>
                    <div style="display:inline-block;padding:12px 24px;background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.25);border-radius:12px;">
                      <p style="font-size:13px;color:var(--muted);margin:0 0 4px;">ID de tu examen</p>
                      <code style="font-size:18px;color:var(--gold);font-weight:800;">${certId}</code>
                    </div>
                  </div>
                `;

        } else {
            // ── PUBLIC MODE: full instant feedback ──
            const badge = $('levelBadge');
            badge.textContent = level;
            badge.style.borderColor = levelColor;
            badge.style.color = levelColor;

            $('scoreLine').innerHTML =
                `${totalEarned}/${MAX_POINTS} pts &nbsp;·&nbsp; <strong>${pct}%</strong> &nbsp;·&nbsp; <strong>Registry #:</strong> <code>${registry}</code> &nbsp;·&nbsp; <strong>ID:</strong> <code>${certId}</code>`;

            $('preGradLine').innerHTML = preGrad
                ? `<span style="color:var(--good);font-weight:800;">✅ PRE-GRADUADO</span> — Apto para evaluación práctica (Nivel PRO). Presenta tu ID <strong>${certId}</strong> · Registry <strong>${registry}</strong> al instructor.`
                : (pct < 80)
                    ? `<span style="color:var(--bad);font-weight:800;">❌ NO PRE-GRADUADO</span> — Score insuficiente <strong>(${pct}%)</strong>. Mínimo requerido: 80%.`
                    : `<span style="color:var(--bad);font-weight:800;">❌ NO PRE-GRADUADO</span> — Bloque técnico: <strong>${technicalMisses} fallos</strong> en Conexiones/Cables. Máximo permitido: 2.`;

            // Animated section score bars
            renderSectionBars(sectionScores, SECTIONS, TECHNICAL_SECTIONS, technicalMisses);

            /* Section breakdown */
            const fb = [];
            fb.push(`<h3 style="margin-bottom:12px;font-size:16px;">Desglose por sección</h3>`);
            fb.push(`<div class="breakdown">`);
            SECTIONS.forEach(s => {
                const sc = sectionScores[s];
                const sp = Math.round((sc.earned / sc.max) * 100);
                const col = sp >= 80 ? 'var(--good)' : sp >= 60 ? 'var(--warn)' : 'var(--bad)';
                const isTech = TECHNICAL_SECTIONS.includes(s);
                const techMissesInSec = isTech ? mcMisses.filter(m => m.q.section === s).length : 0;
                const techBadge = isTech
                    ? `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;margin-left:8px;${techMissesInSec === 0 ? 'background:rgba(0,200,100,0.1);color:#48bb78;border:1px solid rgba(0,200,100,0.3);' :
                        techMissesInSec <= 2 ? 'background:rgba(255,191,0,0.1);color:#f6c90e;border:1px solid rgba(255,191,0,0.3);' :
                            'background:rgba(229,62,62,0.1);color:#fc8181;border:1px solid rgba(229,62,62,0.3);'
                    }">🔒 HARD GATE — ${techMissesInSec} fallo${techMissesInSec !== 1 ? 's' : ''}</span>`
                    : '';
                fb.push(`
                <div class="bkRow">
                  <span class="bkLabel">${escapeHtml(s)}${techBadge}</span>
                  <span class="bkScore" style="color:${col}">${sc.earned}/${sc.max} pts (${sp}%)</span>
                </div>
              `);
            });
            fb.push(`</div>`);

            /* MC misses */
            if (mcMisses.length) {
                fb.push(`<h3 style="margin:20px 0 12px;font-size:16px;">Preguntas de opción múltiple incorrectas</h3>`);
                mcMisses.forEach(({ q, given }) => {
                    const correct = q.options.find(o => o.k === q.answer);
                    fb.push(`
          <div class="kpi">
            <strong>${escapeHtml(q.text)}</strong>
            <p style="margin:6px 0 0;color:var(--bad);">Tu respuesta: ${given ? given.toUpperCase() : '—'}</p>
            <p style="margin:4px 0 0;color:var(--good);">Correcta: ${q.answer.toUpperCase()}) ${escapeHtml(correct ? correct.t : '')}</p>
            ${q.tip ? `<p style="margin:6px 0 0;color:var(--muted);font-size:13px;">💡 ${escapeHtml(q.tip)}</p>` : ''}
          </div>
        `);
                });
            }

            /* Declaration block */
            fb.push(`
      <div class="declarationBlock">
        <strong>Declaración Oficial — ${escapeHtml(name)}</strong>
        <p>
          "Reconozco que el DJing es una disciplina cultural con historia, técnica y ética.
          Me comprometo a respetar la cabina, a otros DJs y al público."
        </p>
        <p class="sigLine">
          Firma: <strong>${escapeHtml(name)}</strong> &nbsp;·&nbsp;
          Fecha: <strong>${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</strong> &nbsp;·&nbsp;
          ID: <strong>${certId}</strong>
        </p>
      </div>
    `);

            /* Print-only certificate block */
            fb.push(`
      <div class="printCert">
        <div class="printCertInner">
          <div class="printCertLogo">MIAMI DJ BEAT</div>
          <div class="printCertTitle">Certificación DJ Workflow Professional</div>
          <div class="printCertName">${escapeHtml(name)}</div>
          <div class="printCertLevel">${escapeHtml(level)}</div>
          <div class="printCertScore">${pct}% — ${totalEarned}/${MAX_POINTS} pts</div>
          <div class="printCertId">Registry: ${registry} &nbsp;·&nbsp; ID: ${certId}</div>
          <div class="printCertDate">Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div class="printCertVerify">Verificar en: miamidj.beat/verify?id=${certId}</div>
          <div class="printCertFooter">Miami DJ Beat LLC · Historia + Técnica + Ética</div>
        </div>
      </div>
    `);

            $('feedback').innerHTML = fb.join('');
            $('result').classList.remove('hidden');
            $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });

            /* ── CTA: proceed to Practical Evaluation if Pre-Grad ── */
            if (preGrad) {
                const practicalUrl = `practical-evaluation.html?name=${encodeURIComponent(name)}&certId=${encodeURIComponent(certId)}`;
                const actionsEl = document.querySelector('.resultActions');
                if (actionsEl) {
                    actionsEl.insertAdjacentHTML('afterbegin', `
                        <a href="${practicalUrl}"
                           style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;
                                  background:var(--gold);color:#000;border:none;border-radius:50px;
                                  font-size:14px;font-weight:800;cursor:pointer;letter-spacing:1px;
                                  text-decoration:none;transition:opacity .2s;"
                           onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
                           🎧 Ir a Evaluación Práctica →
                        </a>
                    `);
                }
            }

            /* ── localStorage: persist result ── */
            try {
                localStorage.setItem(LS_KEY, JSON.stringify({
                    name, certId, pct, totalEarned, level, preGrad,
                    date: new Date().toISOString()
                }));
            } catch (e) { /* quota exceeded or private mode */ }
        }   // end: else (public mode)

    }   // end: score()

    /* ── SECTION BARS ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
    function renderSectionBars(secScores, sections, technicalSecs, techMisses) {
        const el = $('sectionBars');
        if (!el) return;

        const rows = sections.map(name => {
            const sc = secScores[name] || { earned: 0, max: 1 };
            const pct = Math.round((sc.earned / sc.max) * 100);
            const cls = pct >= 80 ? 'good' : pct >= 60 ? 'warn' : 'bad';
            const isTech = technicalSecs.includes(name);
            const shortName = name.replace(/Sección \d+ — /, '');
            return { name, shortName, pct, cls, sc, isTech };
        });

        el.innerHTML = `
              <div class="kpi">
                <strong style="font-size:14px;">Desglose por Sección</strong>
                <div class="barsWrap" style="margin-top:14px;">
                  ${rows.map(r => `
                    <div class="barRow">
                      <div class="barTop">
                        <div class="barLabel">${escapeHtml(r.shortName)}${r.isTech ? ' <span style="font-size:10px;color:var(--warn);">🔒 TÉCNICO</span>' : ''}</div>
                        <div class="barValue">${r.sc.earned}/${r.sc.max} pts &middot; ${r.pct}%</div>
                      </div>
                      <div class="barTrack">
                        <div class="barFill ${r.cls}" data-pct="${r.pct}" style="width:0%;"></div>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <div class="barNote">
                  🔒 <strong>Hard Gate Técnico</strong>: ${techMisses} fallo${techMisses !== 1 ? 's' : ''} en bloque técnico
                  &nbsp;&middot;&nbsp; Máximo permitido: 2 &nbsp;&middot;&nbsp;
                  ${techMisses <= 2 ? '<span style="color:var(--good);">✔ Dentro del estándar</span>' : '<span style="color:var(--bad);">✖ Fuera del estándar</span>'}
                </div>
              </div>
            `;

        // Animate bars after a paint frame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.querySelectorAll('.barFill').forEach(bar => {
                    bar.style.width = bar.dataset.pct + '%';
                });
            });
        });
    }

    /* ── RESET ──────────────────────────────────────────── */
    function reset() {
        if (!confirm('¿Reiniciar toda la evaluación? Se perderán todas las respuestas.')) return;
        currentQ = 0;
        mcAnswers = {}; shortTexts = {}; shortScores = {};
        $('djName').value = '';
        $('djEmail').value = '';
        $('codeAgree').checked = false;
        $('quizShell').classList.add('hidden');
        $('quizIntro').classList.remove('hidden');
        $('result').classList.add('hidden');
        $('feedback').innerHTML = '';
        $('sectionBars').innerHTML = '';
        try { localStorage.removeItem(LS_KEY); } catch (e) { }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ── INIT ──────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        $('btnStart').addEventListener('click', startExam);
        $('btnNext').addEventListener('click', nextStep);
        $('btnReset').addEventListener('click', reset);
        $('btnPrint').addEventListener('click', () => window.print());

        /* Restore last DJ name from localStorage */
        try {
            const last = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
            if (last && last.name) $('djName').value = last.name;
        } catch (e) { }
    });

})();
