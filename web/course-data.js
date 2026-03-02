/**
 * ============================================================
 * MDJPRO — COURSE DATA (course-data.js)
 * ============================================================
 * All course content is defined here as plain JS objects.
 * 
 * MANAGER PANEL INTEGRATION (FUTURE):
 * Each section maps 1-to-1 to a Supabase table:
 *
 *   COURSE_META        → table: courses           (id, title, subtitle, ...)
 *   DJ_TYPES           → table: course_dj_types   (id, order, icon, title, ...)
 *   COURSE_MODULES     → table: course_modules     (id, order, num, icon, title, ...)
 *   EXAM_QUESTIONS     → table: course_exam_qs     (id, order, question, opt_a, opt_b, opt_c, correct)
 *
 * When the manager panel is ready, replace each section below with:
 *   const { data } = await supabase.from('course_modules').select('*').order('order');
 *   COURSE_MODULES = data;
 *
 * ============================================================
 */

// ── 1. COURSE META ──────────────────────────────────────────────────────────
// Controls: hero title, subtitle, stats bar
const COURSE_META = {
    title: "Aprende el Arte de Ser DJ",
    subtitle_gold: "Desde Cero.",
    subtitle_blue: "Certifícate como Profesional.",
    description: "Todo lo que debes saber — Técnica de mezcla, software profesional, manejo de contratos, marketing personal y la mentalidad ganadora de un DJ de élite en Miami.",
    price_regular: "$397",
    price_now: "$197",
    price_label: "Pago único · Acceso de por vida",
    stats: [
        { num: "12", label: "Módulos" },
        { num: "40+", label: "Horas de contenido" },
        { num: "100%", label: "Online y a tu ritmo" },
        { num: "🏆", label: "Certificado Oficial" },
        { num: "∞", label: "Acceso de por vida" }
    ]
};

// ── 2. INTRO MANIFESTO ──────────────────────────────────────────────────────
// Controls: "Bienvenido al Mundo DJ" section — philosophy text
const COURSE_INTRO = {
    badge: "🎧 INTRODUCCIÓN OFICIAL · ANTES DE COMENZAR",
    heading: "Bienvenido al <gold>Mundo DJ.</gold>",
    lead: "Antes de tocar una sola tecla, necesitas entender lo que realmente significa llevar este título.",
    paragraphs: [
        "El mundo DJ es una familia universal. Una comunidad que comparte una disciplina, unas leyes y un esfuerzo que muy pocos están dispuestos a asumir.",
        "<gold>Ser DJ es un privilegio</gold> — y más que eso, es una condición. No todos reúnen los requisitos. No se trata de ganar dinero fácil ni de aprovechar los beneficios que los clubes y los clientes te pueden ofrecer. Ser DJ no es usar los beneficios: <em>es merecerlos y saber cómo usarlos</em>. No por conveniencia, sino por derecho.",
        "Porque ser DJ es un arte que nace desde muy adentro. No es algo que todo el mundo tiene. Es un propósito — aunque muchas veces se presente en diferentes etapas de la vida, no importa en qué momento llegó: <strong>siempre estuvo ahí</strong>, y forma parte de tu ADN.",
        "Por eso es fundamental tener la disciplina y el conocimiento adecuados. Es muy poco profesional — y poco convencional — estar en un negocio sin saber de qué se trata, o sin aprovechar cada etapa al máximo. <gold>Este curso existe para que eso nunca te pase.</gold>"
    ],
    pillars: [
        { icon: "⚖️", label: "Disciplina", color: "white", desc: "El DJ que no se entrena, no crece. La disciplina diaria separa al aficionado del profesional." },
        { icon: "🎯", label: "Conocimiento", color: "gold", desc: "Dominar la técnica, el equipo, el negocio y el protocolo. Saber de qué se trata cada etapa." },
        { icon: "🔥", label: "Propósito", color: "white", desc: "El DJ de élite no trabaja por dinero. Trabaja porque llevar la música a la gente es su razón de ser." }
    ]
};

// ── 3. DJ TYPES ─────────────────────────────────────────────────────────────
// Controls: "Los Tipos de DJ" cards — manager can add/edit/remove types
const DJ_TYPES = [
    {
        id: 1,
        num: "TIPO 01",
        color: "gold",        // gold | blue | green | purple | elite
        icon: "💒",
        title: "DJ de Bodas & Eventos Sociales",
        desc: "El arquitecto emocional. Su misión es crear momentos que las familias recuerden de por vida. Requiere tacto, repertorio amplio, manejo del micrófono y lectura emocional del ambiente.",
        tags: ["Bodas", "Quinceañeras", "Baby Showers"],
        active: true
    },
    {
        id: 2,
        num: "TIPO 02",
        color: "blue",
        icon: "🏙️",
        title: "DJ de Club & Nightlife",
        desc: "El comandante de la noche. Domina el energy management, las transiciones agresivas y sabe leer a cientos de personas en simultáneo. La técnica aquí es implacable y no hay lugar para errores.",
        tags: ["Nightclub", "Lounge", "Residencias"],
        active: true
    },
    {
        id: 3,
        num: "TIPO 03",
        color: "green",
        icon: "🏢",
        title: "DJ Corporativo",
        desc: "El profesional de alto nivel. Trabaja en lanzamientos de marca, convenciones y eventos ejecutivos. Requiere imagen impecable, versatilidad musical extrema y protocolo empresarial.",
        tags: ["Empresarial", "Convenciones", "Branding"],
        active: true
    },
    {
        id: 4,
        num: "TIPO 04",
        color: "purple",
        icon: "🎭",
        title: "DJ Animador / MC",
        desc: "El showman. Combina su rol de DJ con la animación del público, conducción de dinámicas y manejo de hora loca. Es el alma visible del evento — requiere carisma, improvisación y carácter.",
        tags: ["Animador", "MC", "Hora Loca"],
        active: true
    },
    {
        id: 5,
        num: "TIPO 05 · ÉLITE",
        color: "elite",
        icon: "🌐",
        title: "DJ Integral Miami DJ Beat PRO",
        desc: "El nivel máximo del ecosistema. Domina los cuatro tipos anteriores, gestiona su propio tech rider, firma contratos, maneja su imagen de marca y opera dentro de los estándares de calidad de Miami DJ Beat. Es el DJ al que los clientes premium buscan por nombre. Este curso te prepara para llegar aquí.",
        tags: [],
        active: true
    }
];

// ── 4. COURSE MODULES ────────────────────────────────────────────────────────
// Controls: the 12-module program grid
const COURSE_MODULES = [
    { id: 1, num: "MÓDULO 01", icon: "🎵", title: "Fundamentos del Sonido", level: "PRINCIPIANTE", desc: "BPM, compás musical, frecuencias, cómo el oído percibe la música y qué hace que una canción \"funcione\" en pista.", active: true },
    { id: 2, num: "MÓDULO 02", icon: "🎧", title: "Equipamiento Profesional", level: "PRINCIPIANTE", desc: "Consolas Pioneer, Denon, controladores, mixers, cartuchos. Qué comprar según tu presupuesto y estilo.", active: true },
    { id: 3, num: "MÓDULO 03", icon: "💻", title: "Software Profesional", level: "PRINCIPIANTE", desc: "Serato DJ Pro, Rekordbox, Virtual DJ y MDJPRO — configuración avanzada, flujos de trabajo y shortcuts élite.", active: true },
    { id: 4, num: "MÓDULO 04", icon: "🎚️", title: "Técnica de Mezcla", level: "INTERMEDIO", desc: "Beatmatching, EQ mixing, transiciones suaves, phrasing y cómo construir energía en una pista sin perder la audiencia.", active: true },
    { id: 5, num: "MÓDULO 05", icon: "🎤", title: "MC y Control de Pista", level: "INTERMEDIO", desc: "Cómo hablar al micrófono, leer al público, dirigir momentos especiales (primer baile, marcha nupcial, cápsulas de hora loca).", active: true },
    { id: 6, num: "MÓDULO 06", icon: "💡", title: "Producción e Iluminación", level: "INTERMEDIO", desc: "Control de luces DMX, sparks, efectos visuales y cómo crear ambientes que multiplican la experiencia del cliente.", active: true },
    { id: 7, num: "MÓDULO 07", icon: "📋", title: "Organización de Librería", level: "INTERMEDIO", desc: "Sistema de tags, géneros, décadas, listas para eventos. Cómo organizar 50,000 canciones para encontrar cualquier track en 5 segundos.", active: true },
    { id: 8, num: "MÓDULO 08", icon: "💼", title: "Contratos y Cotizaciones", level: "AVANZADO", desc: "Cómo redactar contratos, manejar depósitos, cláusulas de cancelación y protegerte legalmente en cada evento.", active: true },
    { id: 9, num: "MÓDULO 09", icon: "📱", title: "Marketing Personal DJ", level: "AVANZADO", desc: "Cómo construir tu marca en Instagram, TikTok y Mixcloud. Contenido que atrae clientes de alto valor sin gastar en publicidad.", active: true },
    { id: 10, num: "MÓDULO 10", icon: "💰", title: "Precios y Finanzas DJ", level: "AVANZADO", desc: "Cómo fijar tarifas, cuándo subir precios, manejar pagos, impuestos de freelancer y construir ingresos recurrentes.", active: true },
    { id: 11, num: "MÓDULO 11", icon: "🧠", title: "Mentalidad del DJ Élite", level: "AVANZADO", desc: "Gestión de nervios, manejo de imprevistos técnicos en vivo, protocolo ante fallos y cómo mantener el control bajo presión.", active: true },
    { id: 12, num: "MÓDULO 12", icon: "🏆", title: "Examen Final + Certificación", level: "CERTIFICACIÓN", desc: "Evaluación práctica y teórica. Al aprobar recibes tu Certificado Oficial de DJ Profesional Miami DJ Beat avalado por la industria.", active: true, featured: true }
];

// ── 5. EXAM QUESTIONS ────────────────────────────────────────────────────────
// Controls: the certification exam — manager can add/edit/remove questions
// RULE: If wrong answers > MAX_WRONG (3), DJ is locked out for COOLDOWN_DAYS (30)
const EXAM_CONFIG = {
    max_wrong: 3,        // Max errors allowed before lockout
    cooldown_days: 30,   // Days to wait before retaking after failure
    pass_rating_formula: "score / 20" // Maps 0-100 score to 0-5 star rating
};

const EXAM_QUESTIONS = [
    {
        id: 1,
        order: 1,
        question: "¿Cuál es la función principal del EQ en la mezcla de dos canciones?",
        opt_a: "A) Subir el volumen de la pista para que suene más fuerte",
        opt_b: "B) Controlar las frecuencias (bajos, medios, agudos) para una transición suave sin choques de sonido",
        opt_c: "C) Cambiar el tempo (BPM) de la canción automáticamente",
        correct: "b",
        active: true
    },
    {
        id: 2,
        order: 2,
        question: "Un cliente pide música 'Top 40' para una boda. ¿Qué significa esto?",
        opt_a: "A) Las 40 canciones más largas de la biblioteca",
        opt_b: "B) Canciones antiguas de los años 40",
        opt_c: "C) Las canciones más populares en las listas de éxitos actuales (pop comercial)",
        correct: "c",
        active: true
    },
    {
        id: 3,
        order: 3,
        question: "¿Qué es el 'beatmatching' y por qué es fundamental?",
        opt_a: "A) Es igualar el BPM de dos canciones para que suenen en sincronía al mezclar",
        opt_b: "B) Es elegir canciones del mismo artista para que combinen",
        opt_c: "C) Es un efecto de sonido que añade eco a la mezcla",
        correct: "a",
        active: true
    },
    {
        id: 4,
        order: 4,
        question: "Estás en un evento de 300 personas y el audio se corta. ¿Cuál es el protocolo correcto?",
        opt_a: "A) Improvisar con el teléfono y altavoces Bluetooth mientras se soluciona",
        opt_b: "B) Mantener la calma, usar el micrófono para avisar al público, identificar el fallo (cable, breaker, etc.) y resolverlo en máximo 90 segundos con el backup plan activo",
        opt_c: "C) Llamar al cliente para disculparte y esperar a que llegue un técnico externo",
        correct: "b",
        active: true
    },
    {
        id: 5,
        order: 5,
        question: "¿Cuál es la diferencia entre un 'rider técnico' y un contrato de servicio DJ?",
        opt_a: "A) Son el mismo documento con diferentes nombres",
        opt_b: "B) El rider técnico especifica los requerimientos de equipo y espacio; el contrato establece términos legales, pago y condiciones del evento",
        opt_c: "C) El rider es para eventos grandes y el contrato solo para bodas",
        correct: "b",
        active: true
    },
    {
        id: 6,
        order: 6,
        question: "Un cliente nuevo pregunta tu tarifa y luego dice 'otro DJ cobra $200 menos'. ¿Cuál es la mejor respuesta profesional?",
        opt_a: "A) Bajar inmediatamente el precio para no perder el cliente",
        opt_b: "B) Explicar el valor diferencial de tu servicio (experiencia, equipo, seguro, backup plan) sin entrar en guerra de precios",
        opt_c: "C) Ignorar el comentario y repetir tu precio original sin más explicación",
        correct: "b",
        active: true
    },
    {
        id: 7,
        order: 7,
        question: "¿Qué significa el término 'phrasing' en la mezcla profesional?",
        opt_a: "A) Mezclar canciones del mismo género solamente",
        opt_b: "B) Añadir frases de voz (MC) entre canciones",
        opt_c: "C) Sincronizar las transiciones con la estructura musical de la canción (cada 8, 16 o 32 tiempos) para que la mezcla suene natural",
        correct: "c",
        active: true
    },
    {
        id: 8,
        order: 8,
        question: "Para un evento de boda con 150 personas en un espacio cerrado de 30x20m, ¿qué configuración de audio es más adecuada?",
        opt_a: "A) Un solo altavoz de 15 pulgadas en el centro del salón",
        opt_b: "B) Sistema de dos tops activos + subwoofer, configurados en stereo y posicionados en los vértices del área de pista para cobertura uniforme",
        opt_c: "C) Altavoces pasivos sin amplificador externo para ahorrar en equipo",
        correct: "b",
        active: true
    },
    {
        id: 9,
        order: 9,
        question: "¿Qué es el 'harmonic mixing' (mezcla armónica)?",
        opt_a: "A) Mezclar canciones en el mismo key musical para que no choquen tonalmente",
        opt_b: "B) Mezclar exclusivamente música clásica con electrónica",
        opt_c: "C) Subir gradualmente el volumen durante 30 minutos al inicio del evento",
        correct: "a",
        active: true
    },
    {
        id: 10,
        order: 10,
        question: "Según las políticas de Miami DJ Beat, ¿cuándo debe recibirse el depósito mínimo para confirmar una fecha?",
        opt_a: "A) El mismo día del evento",
        opt_b: "B) Dentro de las 72 horas posteriores a la firma del contrato para considerar la fecha reservada oficialmente",
        opt_c: "C) El depósito es opcional y se puede pagar después del evento",
        correct: "b",
        active: true
    }
];

// ── EXPORT (for future module system) ───────────────────────────────────────
if (typeof module !== 'undefined') {
    module.exports = { COURSE_META, COURSE_INTRO, DJ_TYPES, COURSE_MODULES, EXAM_QUESTIONS, EXAM_CONFIG };
}
