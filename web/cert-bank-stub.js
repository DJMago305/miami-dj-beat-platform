/* ══════════════════════════════════════════════════════════════════════════
   Banco de preguntas de certificación — MASTER_BANK.
   Ya no quedan dummies: S1 (Cultura, Mentalidad y Ética) tiene los 3
   reactivos de psicología de pista (Q_PSYCH_01/02/03, basados en
   web/content/psicologia-pista.md); S2 (Serato DJ Pro), S3 (Conocimiento
   Musical) y S4 (Operación y Seguridad) tienen 3 reactivos técnicos cada
   una (Q_SOFT_*, Q_HARM_*, Q_AUDIO_*). 13 preguntas totales — sigue por
   debajo de las 32 que promete la copy de certification.html; ampliar el
   banco es trabajo aparte.
   ══════════════════════════════════════════════════════════════════════════ */
window.MASTER_BANK = [
  {
    id: 'Q_PSYCH_01',
    section: 'S1: Cultura, Mentalidad y Ética',
    type: 'mc',
    points: 1,
    text: 'Estás en el peak hour. El centro de la pista sigue lleno, pero en el perímetro el público comienza a dispersarse hacia la barra y mirar el teléfono. ¿Cuál es el diagnóstico técnico?',
    options: [
      { k: 'a', t: 'La pista está en su punto óptimo; mientras el centro se mueva no se altera nada.' },
      { k: 'b', t: 'Fatiga auditiva o estancamiento de dinámica; la pista se mueve por inercia y requiere modulación de energía (cambio de tono/groove o respiro melódico).' },
      { k: 'c', t: 'Falta de volumen general; subir ganancia de medios en el máster.' },
      { k: 'd', t: 'El BPM es excesivo; bajar bruscamente 10 BPM en el siguiente compás.' }
    ],
    answer: 'b'
  },
  {
    id: 'Q_PSYCH_02',
    section: 'S1: Cultura, Mentalidad y Ética',
    type: 'mc',
    points: 1,
    text: 'Tras una transición experimental hacia un género nuevo, el 35% de la pista se retira de inmediato. ¿Cuál es la maniobra profesional adecuada?',
    options: [
      { k: 'a', t: 'Cortar el track en seco al compás 16 y lanzar un hit conocido en caliente.' },
      { k: 'b', t: 'Tomar el micrófono y pedir disculpas al público.' },
      { k: 'c', t: 'Mantener postura en cabina, completar una frase musical (32 compases) para no proyectar pánico visual y preparar salida armónica hacia zona segura.' },
      { k: 'd', t: 'Activar loop de 4 tiempos en el intro fallido para reintentar la mezcla.' }
    ],
    answer: 'c'
  },
  {
    id: 'Q_PSYCH_03',
    section: 'S1: Cultura, Mentalidad y Ética',
    type: 'short',
    points: 5,
    text: 'Caso Evento Corporativo Mixto (edades 25 a 60 años): El público joven solicita tech house/urbano y los directivos demandan pop/rock retro o clásicos latinos. Detalla en 3 o 4 pasos cómo estructurar los bloques de mezcla y la curva de energía para complacer a ambos sin vaciar el salón.',
    rubric: [
      'Divide el set en bloques alternados por rango de edad/estilo en vez de forzar un único género durante toda la noche.',
      'Ubica los picos de energía (tech house/urbano) en las horas donde ambos públicos ya están en pista, no al inicio del evento.',
      'Usa transiciones armónicas o puentes (remixes, versiones latinas, mashups) para pasar de un bloque a otro sin un corte que vacíe la pista.',
      'Reserva un bloque final de clásicos/retro para cerrar con ambos grupos integrados, evitando terminar la noche con el segmento que menos gente dejó bailando.'
    ]
  },
  {
    id: 'Q_SOFT_01',
    section: 'S2: Serato DJ Pro',
    type: 'mc',
    points: 2,
    text: 'Al importar pistas de géneros orgánicos (Funk, Disco de los 70s o Salsa clásica) a Serato o Rekordbox, el beatgrid automático suele desfasarse progresivamente hacia el final del track. ¿Cuál es el procedimiento técnico correcto?',
    options: [
      { k: 'a', t: 'Forzar un análisis en modo estático (BPM fijo) y aplicar Sync automático en cabina.' },
      { k: 'b', t: 'Cambiar a modo de análisis dinámico/flexible o ajustar manualmente marcadores de grid de tempo variable a lo largo del tema respetando la fluctuación del baterista.' },
      { k: 'c', t: 'Aumentar el pitch de la pista hasta que el BPM coincida con un valor entero.' },
      { k: 'd', t: 'Comprimir la pista en un DAW para eliminar la dinámica y reanalizar.' }
    ],
    answer: 'b'
  },
  {
    id: 'Q_SOFT_02',
    section: 'S2: Serato DJ Pro',
    type: 'mc',
    points: 2,
    text: '¿Cuál es la política estándar de redundancia y formato para dispositivos USB/SSD en entornos de directo profesionales (clubes y festivales con CDJs)?',
    options: [
      { k: 'a', t: 'Un único pendrive en formato NTFS con toda la biblioteca musical.' },
      { k: 'b', t: 'Dos o tres unidades idénticas formateadas en FAT32 (o MBR/exFAT según compatibilidad del hardware), sincronizadas con el software de exportación y un USB de rescate con tracks de emergencia.' },
      { k: 'c', t: 'Almacenamiento directo en la nube conectado por Wi-Fi público del local.' },
      { k: 'd', t: 'Un disco externo sin analizar conectando la laptop directamente a los CDJs mediante cable auxiliar.' }
    ],
    answer: 'b'
  },
  {
    id: 'Q_SOFT_03',
    section: 'S2: Serato DJ Pro',
    type: 'short',
    points: 4,
    text: 'Estrategia de Hot Cues y Criterio de Búsqueda: Detalla tu estándar de organización de Hot Cues (color, función o sección) para poder mezclar un tema desconocido o resolver una petición urgente en menos de 15 segundos sin cortar el flujo del set.',
    rubric: [
      'Asignación clara de puntos de entrada (intro mix, primer verso o caída principal).',
      'Marcado de zonas de salida segura (outro o bucle de 8/16 compases).',
      'Uso de colores o comentarios/tags por energía, género o tonalidad.',
      'Velocidad operativa y ausencia de dependencia exclusiva de la forma de onda visual.'
    ]
  },
  {
    id: 'Q_HARM_01',
    section: 'S3: Conocimiento Musical',
    type: 'mc',
    points: 2,
    text: 'Estás mezclando un track en 8A (A minor) en la Rueda de Camelot. Deseas realizar un salto de energía ascendente directo y marcado sin disonancia armónica destructiva. ¿Hacia qué tonalidad debes modular según la técnica armónica de energía?',
    options: [
      { k: 'a', t: 'Hacia 8B (C Major), manteniendo exactamente la misma energía melódica.' },
      { k: 'b', t: 'Modular sumando +7 en el reloj Camelot (+1 semitono hacia 3A / B-flat minor) o +2 posiciones (hacia 10A / B minor) para elevar la tensión armónica.' },
      { k: 'c', t: 'Hacia 1A (A-flat minor) con un fader cut violento.' },
      { k: 'd', t: 'Bajar 5 posiciones en el reloj Camelot para forzar un cambio de escala pentatónica.' }
    ],
    answer: 'b'
  },
  {
    id: 'Q_HARM_02',
    section: 'S3: Conocimiento Musical',
    type: 'mc',
    points: 2,
    text: 'Durante una transición en compás de 4/4, lanzas el nuevo tema en el compás 17 de una frase de 32 tiempos del tema saliente. ¿Qué error estructural estás cometiendo?',
    options: [
      { k: 'a', t: 'Clashing de fraseo: el drop o cambio de sección del nuevo track caerá desfasado respecto al clímax del track saliente, rompiendo la tensión natural que el público espera en compás 1.' },
      { k: 'b', t: 'Desalineación de fase acústica en frecuencias medias.' },
      { k: 'c', t: 'Sobrecarga de bits en el buffer de salida de audio.' },
      { k: 'd', t: 'No hay error alguno; cualquier compás impar es apto para soltar el drop.' }
    ],
    answer: 'a'
  },
  {
    id: 'Q_HARM_03',
    section: 'S3: Conocimiento Musical',
    type: 'short',
    points: 4,
    text: 'Resolución de Choque Armónico: Explica cómo resolver una mezcla entre dos tracks que chocan en tono pero tienen la energía rítmica perfecta para el momento (técnicas de ecualización, loops de percusión, uso de filtros, o modulación por transitorio).',
    rubric: [
      'Aislamiento de frecuencias melódicas conflictivas (EQ cut en medios/voces o uso de Stems).',
      'Uso de secciones percusivas neutras (intro/outro beats sin línea de bajo).',
      'Aplicación de filtros (High-Pass / Low-Pass) para camuflar el cruce de notas fundamentales.',
      'Timing de corte preciso en el transitorio principal o drop.'
    ]
  },
  {
    id: 'Q_AUDIO_01',
    section: 'S4: Operación y Seguridad',
    type: 'mc',
    points: 2,
    text: 'En un mezclador DJ profesional, ¿cuál es la consecuencia técnica de mantener los vúmetros de canal y máster constantemente en la zona roja (+6dB a +12dB) con la ganancia saturada?',
    options: [
      { k: 'a', t: 'El sonido tiene mayor presencia y llena mejor el recinto.' },
      { k: 'b', t: 'Se introduce distorsión armónica por recorte digital/analógico (clipping), se agota el headroom dinámico, se fatiga prematuramente el oído del público y se sobrecalientan o disparan los limitadores del sistema de sala.' },
      { k: 'c', t: 'Se activa automáticamente un compresor de seguridad sin alterar la señal de audio.' },
      { k: 'd', t: 'El procesador DSP compensa la ganancia aumentando el rango dinámico de los subwoofers.' }
    ],
    answer: 'b'
  },
  {
    id: 'Q_AUDIO_02',
    section: 'S4: Operación y Seguridad',
    type: 'mc',
    points: 2,
    text: '¿Por qué en una instalación profesional para eventos en vivo se exige el uso de líneas balanceadas (XLR o Jack 1/4" TRS) entre la cabina y el sistema de PA, en lugar de cables no balanceados (RCA)?',
    options: [
      { k: 'a', t: 'Porque los cables RCA no pueden transmitir frecuencias por debajo de 50 Hz.' },
      { k: 'b', t: 'Porque la línea balanceada utiliza dos conductores con polaridad invertida más malla que rechazan interferencias electromagnéticas y ruidos por bucle de masa (ground hum) en tiradas largas.' },
      { k: 'c', t: 'Porque el conector XLR entrega 12V de alimentación fantasma obligatoria a la controladora.' },
      { k: 'd', t: 'Únicamente por estética y resistencia mecánica del conector.' }
    ],
    answer: 'b'
  },
  {
    id: 'Q_AUDIO_03',
    section: 'S4: Operación y Seguridad',
    type: 'short',
    points: 4,
    text: 'Gestión del Monitoreo y Salud Auditiva en Cabina: Describe tu protocolo para configurar el volumen de los auriculares (cue) y el monitor de cabina (booth) en un entorno con alto nivel de presión sonora y rebote acústico de sala.',
    rubric: [
      'Alineación del monitor de cabina para vencer el retardo (delay) del PA principal sin generar volumen excesivo.',
      'Técnica de escucha en auriculares (aislamiento, split cue o referencia directa).',
      'Mantenimiento del nivel de ganancia dentro de límites seguros para prevenir acúfenos/tinnitus.',
      'Uso de protección auditiva pasiva o tapones de alta fidelidad atenuados si el entorno supera los 95 dBA.'
    ]
  }
];
