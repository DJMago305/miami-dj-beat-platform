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
    text_en: "You are at peak hour. The center of the floor is still full, but around the edges the crowd is starting to drift toward the bar and look at their phones. What is the technical diagnosis?",
    options: [
      { k: 'a', t: 'La pista está en su punto óptimo; mientras el centro se mueva no se altera nada.', t_en: "The floor is at its optimum; as long as the center keeps moving, nothing needs to change." },
      { k: 'b', t: 'Fatiga auditiva o estancamiento de dinámica; la pista se mueve por inercia y requiere modulación de energía (cambio de tono/groove o respiro melódico).', t_en: "Auditory fatigue or stalled dynamics; the floor is moving on inertia and needs an energy modulation (change of key/groove or a melodic breather)." },
      { k: 'c', t: 'Falta de volumen general; subir ganancia de medios en el máster.', t_en: "Overall volume is too low; raise the mid gain on the master." },
      { k: 'd', t: 'El BPM es excesivo; bajar bruscamente 10 BPM en el siguiente compás.', t_en: "The BPM is too high; drop 10 BPM abruptly on the next bar." }
    ],
    answer: 'b'
  },
  {
    id: 'Q_PSYCH_02',
    section: 'S1: Cultura, Mentalidad y Ética',
    type: 'mc',
    points: 1,
    text: 'Tras una transición experimental hacia un género nuevo, el 35% de la pista se retira de inmediato. ¿Cuál es la maniobra profesional adecuada?',
    text_en: "After an experimental transition into a new genre, 35% of the floor leaves immediately. What is the right professional move?",
    options: [
      { k: 'a', t: 'Cortar el track en seco al compás 16 y lanzar un hit conocido en caliente.', t_en: "Cut the track dead at bar 16 and drop a well-known hit right away." },
      { k: 'b', t: 'Tomar el micrófono y pedir disculpas al público.', t_en: "Grab the microphone and apologize to the crowd." },
      { k: 'c', t: 'Mantener postura en cabina, completar una frase musical (32 compases) para no proyectar pánico visual y preparar salida armónica hacia zona segura.', t_en: "Hold your composure in the booth, finish one musical phrase (32 bars) so you don't project visual panic, and prepare a harmonic exit toward safe ground." },
      { k: 'd', t: 'Activar loop de 4 tiempos en el intro fallido para reintentar la mezcla.', t_en: "Activate a 4-beat loop on the failed intro to retry the mix." }
    ],
    answer: 'c'
  },
  {
    id: 'Q_PSYCH_03',
    section: 'S1: Cultura, Mentalidad y Ética',
    type: 'short',
    points: 5,
    text: 'Caso Evento Corporativo Mixto (edades 25 a 60 años): El público joven solicita tech house/urbano y los directivos demandan pop/rock retro o clásicos latinos. Detalla en 3 o 4 pasos cómo estructurar los bloques de mezcla y la curva de energía para complacer a ambos sin vaciar el salón.',
    text_en: "Mixed Corporate Event case (ages 25 to 60): the younger crowd asks for tech house/urban and the executives want retro pop/rock or Latin classics. Detail in 3 or 4 steps how you would structure the mix blocks and the energy curve to please both without emptying the room.",
    rubric: [
      'Divide el set en bloques alternados por rango de edad/estilo en vez de forzar un único género durante toda la noche.',
      'Ubica los picos de energía (tech house/urbano) en las horas donde ambos públicos ya están en pista, no al inicio del evento.',
      'Usa transiciones armónicas o puentes (remixes, versiones latinas, mashups) para pasar de un bloque a otro sin un corte que vacíe la pista.',
      'Reserva un bloque final de clásicos/retro para cerrar con ambos grupos integrados, evitando terminar la noche con el segmento que menos gente dejó bailando.'
    ],
    rubric_en: ["Splits the set into alternating blocks by age range/style instead of forcing a single genre all night.", "Places the energy peaks (tech house/urban) at the hours when both audiences are already on the floor, not at the start of the event.", "Uses harmonic transitions or bridges (remixes, Latin versions, mashups) to move from one block to the next without a cut that empties the floor.", "Reserves a final block of classics/retro to close with both groups together, avoiding ending the night with the segment that left the fewest people dancing."]
  },
  {
    id: 'Q_SOFT_01',
    section: 'S2: Serato DJ Pro',
    type: 'mc',
    points: 2,
    text: 'Al importar pistas de géneros orgánicos (Funk, Disco de los 70s o Salsa clásica) a Serato o Rekordbox, el beatgrid automático suele desfasarse progresivamente hacia el final del track. ¿Cuál es el procedimiento técnico correcto?',
    text_en: "When importing tracks from organic genres (Funk, 70s Disco or classic Salsa) into Serato or Rekordbox, the automatic beatgrid tends to drift progressively toward the end of the track. What is the correct technical procedure?",
    options: [
      { k: 'a', t: 'Forzar un análisis en modo estático (BPM fijo) y aplicar Sync automático en cabina.', t_en: "Force a static analysis (fixed BPM) and apply automatic Sync in the booth." },
      { k: 'b', t: 'Cambiar a modo de análisis dinámico/flexible o ajustar manualmente marcadores de grid de tempo variable a lo largo del tema respetando la fluctuación del baterista.', t_en: "Switch to dynamic/flexible analysis mode or manually adjust variable-tempo grid markers throughout the track, respecting the drummer's fluctuation." },
      { k: 'c', t: 'Aumentar el pitch de la pista hasta que el BPM coincida con un valor entero.', t_en: "Raise the track's pitch until the BPM matches a whole number." },
      { k: 'd', t: 'Comprimir la pista en un DAW para eliminar la dinámica y reanalizar.', t_en: "Compress the track in a DAW to remove the dynamics and re-analyze." }
    ],
    answer: 'b'
  },
  {
    id: 'Q_SOFT_02',
    section: 'S2: Serato DJ Pro',
    type: 'mc',
    points: 2,
    text: '¿Cuál es la política estándar de redundancia y formato para dispositivos USB/SSD en entornos de directo profesionales (clubes y festivales con CDJs)?',
    text_en: "What is the standard redundancy and format policy for USB/SSD drives in professional live environments (clubs and festivals with CDJs)?",
    options: [
      { k: 'a', t: 'Un único pendrive en formato NTFS con toda la biblioteca musical.', t_en: "A single NTFS-formatted flash drive with the entire music library." },
      { k: 'b', t: 'Dos o tres unidades idénticas formateadas en FAT32 (o MBR/exFAT según compatibilidad del hardware), sincronizadas con el software de exportación y un USB de rescate con tracks de emergencia.', t_en: "Two or three identical drives formatted FAT32 (or MBR/exFAT depending on hardware compatibility), synced with the export software, plus a rescue USB with emergency tracks." },
      { k: 'c', t: 'Almacenamiento directo en la nube conectado por Wi-Fi público del local.', t_en: "Direct cloud storage connected over the venue's public Wi-Fi." },
      { k: 'd', t: 'Un disco externo sin analizar conectando la laptop directamente a los CDJs mediante cable auxiliar.', t_en: "An unanalyzed external drive, connecting the laptop directly to the CDJs with an aux cable." }
    ],
    answer: 'b'
  },
  {
    id: 'Q_SOFT_03',
    section: 'S2: Serato DJ Pro',
    type: 'short',
    points: 4,
    text: 'Estrategia de Hot Cues y Criterio de Búsqueda: Detalla tu estándar de organización de Hot Cues (color, función o sección) para poder mezclar un tema desconocido o resolver una petición urgente en menos de 15 segundos sin cortar el flujo del set.',
    text_en: "Hot Cue Strategy and Search Criteria: Detail your Hot Cue organization standard (color, function or section) so you can mix an unfamiliar track or handle an urgent request in under 15 seconds without breaking the flow of the set.",
    rubric: [
      'Asignación clara de puntos de entrada (intro mix, primer verso o caída principal).',
      'Marcado de zonas de salida segura (outro o bucle de 8/16 compases).',
      'Uso de colores o comentarios/tags por energía, género o tonalidad.',
      'Velocidad operativa y ausencia de dependencia exclusiva de la forma de onda visual.'
    ],
    rubric_en: ["Clear assignment of entry points (intro mix, first verse or main drop).", "Marking of safe exit zones (outro or an 8/16-bar loop).", "Use of colors or comments/tags by energy, genre or key.", "Operating speed, without depending exclusively on the visual waveform."]
  },
  {
    id: 'Q_HARM_01',
    section: 'S3: Conocimiento Musical',
    type: 'mc',
    points: 2,
    text: 'Estás mezclando un track en 8A (A minor) en la Rueda de Camelot. Deseas realizar un salto de energía ascendente directo y marcado sin disonancia armónica destructiva. ¿Hacia qué tonalidad debes modular según la técnica armónica de energía?',
    text_en: "You are mixing a track in 8A (A minor) on the Camelot Wheel. You want a direct, marked upward energy jump without destructive harmonic dissonance. Which key should you modulate to, according to the harmonic energy technique?",
    options: [
      { k: 'a', t: 'Hacia 8B (C Major), manteniendo exactamente la misma energía melódica.', t_en: "To 8B (C Major), keeping exactly the same melodic energy." },
      { k: 'b', t: 'Modular sumando +7 en el reloj Camelot (+1 semitono hacia 3A / B-flat minor) o +2 posiciones (hacia 10A / B minor) para elevar la tensión armónica.', t_en: "Modulate by adding +7 on the Camelot clock (+1 semitone toward 3A / B-flat minor) or +2 positions (toward 10A / B minor) to raise the harmonic tension." },
      { k: 'c', t: 'Hacia 1A (A-flat minor) con un fader cut violento.', t_en: "To 1A (A-flat minor) with a violent fader cut." },
      { k: 'd', t: 'Bajar 5 posiciones en el reloj Camelot para forzar un cambio de escala pentatónica.', t_en: "Go down 5 positions on the Camelot clock to force a pentatonic scale change." }
    ],
    answer: 'b'
  },
  {
    id: 'Q_HARM_02',
    section: 'S3: Conocimiento Musical',
    type: 'mc',
    points: 2,
    text: 'Durante una transición en compás de 4/4, lanzas el nuevo tema en el compás 17 de una frase de 32 tiempos del tema saliente. ¿Qué error estructural estás cometiendo?',
    text_en: "During a transition in 4/4 time, you launch the new track on bar 17 of a 32-beat phrase of the outgoing track. What structural mistake are you making?",
    options: [
      { k: 'a', t: 'Clashing de fraseo: el drop o cambio de sección del nuevo track caerá desfasado respecto al clímax del track saliente, rompiendo la tensión natural que el público espera en compás 1.', t_en: "Phrasing clash: the new track's drop or section change will land out of step with the outgoing track's climax, breaking the natural tension the crowd expects on bar 1." },
      { k: 'b', t: 'Desalineación de fase acústica en frecuencias medias.', t_en: "Acoustic phase misalignment in the mid frequencies." },
      { k: 'c', t: 'Sobrecarga de bits en el buffer de salida de audio.', t_en: "Bit overload in the audio output buffer." },
      { k: 'd', t: 'No hay error alguno; cualquier compás impar es apto para soltar el drop.', t_en: "No mistake at all; any odd bar is fine for dropping the drop." }
    ],
    answer: 'a'
  },
  {
    id: 'Q_HARM_03',
    section: 'S3: Conocimiento Musical',
    type: 'short',
    points: 4,
    text: 'Resolución de Choque Armónico: Explica cómo resolver una mezcla entre dos tracks que chocan en tono pero tienen la energía rítmica perfecta para el momento (técnicas de ecualización, loops de percusión, uso de filtros, o modulación por transitorio).',
    text_en: "Harmonic Clash Resolution: Explain how to resolve a mix between two tracks that clash in key but have the perfect rhythmic energy for the moment (EQ techniques, percussion loops, use of filters, or transient-based modulation).",
    rubric: [
      'Aislamiento de frecuencias melódicas conflictivas (EQ cut en medios/voces o uso de Stems).',
      'Uso de secciones percusivas neutras (intro/outro beats sin línea de bajo).',
      'Aplicación de filtros (High-Pass / Low-Pass) para camuflar el cruce de notas fundamentales.',
      'Timing de corte preciso en el transitorio principal o drop.'
    ],
    rubric_en: ["Isolation of conflicting melodic frequencies (EQ cut on mids/vocals or use of Stems).", "Use of neutral percussive sections (intro/outro beats without a bass line).", "Application of filters (High-Pass / Low-Pass) to mask the crossing of fundamental notes.", "Precise cut timing on the main transient or drop."]
  },
  {
    id: 'Q_AUDIO_01',
    section: 'S4: Operación y Seguridad',
    type: 'mc',
    points: 2,
    text: 'En un mezclador DJ profesional, ¿cuál es la consecuencia técnica de mantener los vúmetros de canal y máster constantemente en la zona roja (+6dB a +12dB) con la ganancia saturada?',
    text_en: "On a professional DJ mixer, what is the technical consequence of keeping the channel and master meters constantly in the red zone (+6dB to +12dB) with saturated gain?",
    options: [
      { k: 'a', t: 'El sonido tiene mayor presencia y llena mejor el recinto.', t_en: "The sound has more presence and fills the room better." },
      { k: 'b', t: 'Se introduce distorsión armónica por recorte digital/analógico (clipping), se agota el headroom dinámico, se fatiga prematuramente el oído del público y se sobrecalientan o disparan los limitadores del sistema de sala.', t_en: "Harmonic distortion is introduced by digital/analog clipping, dynamic headroom is used up, the audience's ears tire prematurely, and the venue system's limiters overheat or trip." },
      { k: 'c', t: 'Se activa automáticamente un compresor de seguridad sin alterar la señal de audio.', t_en: "A safety compressor is activated automatically without altering the audio signal." },
      { k: 'd', t: 'El procesador DSP compensa la ganancia aumentando el rango dinámico de los subwoofers.', t_en: "The DSP processor compensates for the gain by increasing the dynamic range of the subwoofers." }
    ],
    answer: 'b'
  },
  {
    id: 'Q_AUDIO_02',
    section: 'S4: Operación y Seguridad',
    type: 'mc',
    points: 2,
    text: '¿Por qué en una instalación profesional para eventos en vivo se exige el uso de líneas balanceadas (XLR o Jack 1/4" TRS) entre la cabina y el sistema de PA, en lugar de cables no balanceados (RCA)?',
    text_en: "Why does a professional live-event installation require balanced lines (XLR or 1/4\" TRS jack) between the booth and the PA system, instead of unbalanced cables (RCA)?",
    options: [
      { k: 'a', t: 'Porque los cables RCA no pueden transmitir frecuencias por debajo de 50 Hz.', t_en: "Because RCA cables cannot carry frequencies below 50 Hz." },
      { k: 'b', t: 'Porque la línea balanceada utiliza dos conductores con polaridad invertida más malla que rechazan interferencias electromagnéticas y ruidos por bucle de masa (ground hum) en tiradas largas.', t_en: "Because a balanced line uses two polarity-inverted conductors plus a shield that reject electromagnetic interference and ground-loop noise (ground hum) over long runs." },
      { k: 'c', t: 'Porque el conector XLR entrega 12V de alimentación fantasma obligatoria a la controladora.', t_en: "Because the XLR connector delivers mandatory 12V phantom power to the controller." },
      { k: 'd', t: 'Únicamente por estética y resistencia mecánica del conector.', t_en: "Only for looks and the mechanical strength of the connector." }
    ],
    answer: 'b'
  },
  {
    id: 'Q_AUDIO_03',
    section: 'S4: Operación y Seguridad',
    type: 'short',
    points: 4,
    text: 'Gestión del Monitoreo y Salud Auditiva en Cabina: Describe tu protocolo para configurar el volumen de los auriculares (cue) y el monitor de cabina (booth) en un entorno con alto nivel de presión sonora y rebote acústico de sala.',
    text_en: "Monitoring and Hearing Health in the Booth: Describe your protocol for setting the headphone (cue) volume and the booth monitor in an environment with high sound pressure level and room acoustic bounce.",
    rubric: [
      'Alineación del monitor de cabina para vencer el retardo (delay) del PA principal sin generar volumen excesivo.',
      'Técnica de escucha en auriculares (aislamiento, split cue o referencia directa).',
      'Mantenimiento del nivel de ganancia dentro de límites seguros para prevenir acúfenos/tinnitus.',
      'Uso de protección auditiva pasiva o tapones de alta fidelidad atenuados si el entorno supera los 95 dBA.'
    ],
    rubric_en: ["Aligning the booth monitor to beat the main PA's delay without producing excessive volume.", "Headphone listening technique (isolation, split cue or direct reference).", "Keeping the gain level within safe limits to prevent tinnitus.", "Use of passive hearing protection or attenuated high-fidelity earplugs if the environment exceeds 95 dBA."]
  }
];
