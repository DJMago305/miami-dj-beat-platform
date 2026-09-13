/* ══════════════════════════════════════════════════════════════════════════
   STUB TEMPORAL — banco de preguntas de certificación.
   NO ES CONTENIDO REAL. Desbloquea certification.js (que explotaba en
   MASTER_BANK.filter(...) porque el banco real nunca llegó a este repo — ver
   diagnóstico previo) con 4 preguntas de relleno, obviamente falsas, una por
   cada sección que exige buildExam(). Reemplazar por el banco real de 32
   preguntas antes de considerar esta página lista para producción.
   ══════════════════════════════════════════════════════════════════════════ */
window.MASTER_BANK = [
  {
    id: 'dummy-s1-1',
    section: 'S1: Cultura, Mentalidad y Ética',
    type: 'mc',
    points: 1,
    text: 'DUMMY QUESTION S1: [Contenido pendiente de carga oficial]',
    options: [
      { k: 'a', t: 'Test A' },
      { k: 'b', t: 'Test B' },
      { k: 'c', t: 'Test C' }
    ],
    answer: 'a'
  },
  {
    id: 'dummy-s2-1',
    section: 'S2: Serato DJ Pro',
    type: 'mc',
    points: 1,
    text: 'DUMMY QUESTION S2: [Contenido pendiente de carga oficial]',
    options: [
      { k: 'a', t: 'Test A' },
      { k: 'b', t: 'Test B' },
      { k: 'c', t: 'Test C' }
    ],
    answer: 'a'
  },
  {
    id: 'dummy-s3-1',
    section: 'S3: Conocimiento Musical',
    type: 'mc',
    points: 1,
    text: 'DUMMY QUESTION S3: [Contenido pendiente de carga oficial]',
    options: [
      { k: 'a', t: 'Test A' },
      { k: 'b', t: 'Test B' },
      { k: 'c', t: 'Test C' }
    ],
    answer: 'a'
  },
  {
    id: 'dummy-s4-1',
    section: 'S4: Operación y Seguridad',
    type: 'mc',
    points: 1,
    text: 'DUMMY QUESTION S4: [Contenido pendiente de carga oficial]',
    options: [
      { k: 'a', t: 'Test A' },
      { k: 'b', t: 'Test B' },
      { k: 'c', t: 'Test C' }
    ],
    answer: 'a'
  }
];
