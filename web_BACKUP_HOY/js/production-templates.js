/**
 * Miami DJ Beat — Fábrica de producción: plantillas Event Flow (A4).
 * Cada tipo define bloques por defecto + `criticalFields`: lista para que negocio complete
 * (Capitán: rellenar labels / obligatoriedad según operación).
 *
 * @typedef {Object} MdjFlowCriticalField
 * @property {string} id
 * @property {string} labelEs
 * @property {string} labelEn
 * @property {string} scope 'event'|'block'|'vendor'
 * @property {boolean} [required]
 *
 * @typedef {Object} MdjFlowBlockTemplate
 * @property {string} id
 * @property {string} defaultStart
 * @property {string} defaultEnd
 * @property {string} titleEs
 * @property {string} titleEn
 * @property {string} actionsEs
 * @property {string} actionsEn
 *
 * @typedef {Object} MdjEventFlowTemplate
 * @property {string} type
 * @property {string} labelEs
 * @property {string} labelEn
 * @property {MdjFlowBlockTemplate[]} defaultBlocks
 * @property {MdjFlowCriticalField[]} criticalFields
 */

(function (global) {
  'use strict';

  /** @type {Object.<string, MdjEventFlowTemplate>} */
  global.MDJ_EVENT_FLOW_TEMPLATES = {
    wedding: {
      type: 'wedding',
      labelEs: 'Boda',
      labelEn: 'Wedding',
      defaultBlocks: [
        {
          id: 'load_in',
          defaultStart: '09:00',
          defaultEnd: '11:00',
          titleEs: 'Carga & montaje FOH / DJ',
          titleEn: 'Load-in & DJ / FOH setup',
          actionsEs: 'Línea eléctrica etiquetada, prueba tierra, listado entrada/salida consola.',
          actionsEn: 'Power distro labeled, ground check, console I/O sheet.'
        },
        {
          id: 'ceremony',
          defaultStart: '16:00',
          defaultEnd: '17:00',
          titleEs: 'Ceremonia',
          titleEn: 'Ceremony',
          actionsEs: 'Micrófonos reserva, playlist proceso, coordinación oficiante.',
          actionsEn: 'Backup mics, processional playlist, officiant cue sheet.'
        },
        {
          id: 'cocktail',
          defaultStart: '17:30',
          defaultEnd: '19:00',
          titleEs: 'Cóctel',
          titleEn: 'Cocktail',
          actionsEs: 'Nivel SPL moderado, zonificación altavoces.',
          actionsEn: 'Moderate SPL, speaker zoning.'
        },
        {
          id: 'reception',
          defaultStart: '19:30',
          defaultEnd: '23:30',
          titleEs: 'Recepción / baile',
          titleEn: 'Reception / dance',
          actionsEs: 'Timeline primer baile, torta, hora loca; contacto Maitre D.',
          actionsEn: 'First dance / cake / party block; Maître D contact.'
        }
      ],
      criticalFields: [
        {
          id: 'intro_song_bridal_party',
          labelEs: 'Canción entrada corte (bridal party)',
          labelEn: 'Bridal party entrance song',
          scope: 'event',
          required: true
        },
        {
          id: 'first_dance_song',
          labelEs: 'Canción baile novios',
          labelEn: 'First dance song',
          scope: 'event',
          required: true
        },
        {
          id: 'no_play_list',
          labelEs: 'Lo que el DJ jamás debe poner',
          labelEn: 'Do-not-play list (what the DJ must never play)',
          scope: 'event',
          required: false
        },
        {
          id: 'venue_contact',
          labelEs: 'Quién manda en el salón (contacto venue)',
          labelEn: 'Venue lead / who runs the room',
          scope: 'event',
          required: false
        }
      ]
    },
    quinceanera: {
      type: 'quinceanera',
      labelEs: 'Quinceañera',
      labelEn: 'Quinceañera',
      defaultBlocks: [
        {
          id: 'setup',
          defaultStart: '10:00',
          defaultEnd: '14:00',
          titleEs: 'Montaje salón + prueba luces',
          titleEn: 'Room setup + lighting check',
          actionsEs: 'Vals coreografía, pista LED, timeline entrada damas.',
          actionsEn: 'Court dance choreography, LED floor, court entrance timeline.'
        },
        {
          id: 'ceremony_q',
          defaultStart: '15:00',
          defaultEnd: '16:00',
          titleEs: 'Misa / ceremonia (si aplica)',
          titleEn: 'Mass / ceremony (if any)',
          actionsEs: 'Audio discreto, llegada transporte familia.',
          actionsEn: 'Discreet audio, family transport ETA.'
        },
        {
          id: 'main_party',
          defaultStart: '18:00',
          defaultEnd: '23:00',
          titleEs: 'Fiesta principal',
          titleEn: 'Main party',
          actionsEs: 'Cambio vestuario XV, sorpresas, hora loca preset.',
          actionsEn: 'XV outfit change, surprises, hora loca preset.'
        }
      ],
      criticalFields: [
        {
          id: 'vals_song',
          labelEs: 'El vals principal',
          labelEn: 'Main waltz (vals) track',
          scope: 'event',
          required: true
        },
        {
          id: 'surprise_dance_audio',
          labelEs: 'Baile sorpresa: ¿USB o link Spotify?',
          labelEn: 'Surprise dance: USB or Spotify link?',
          scope: 'event',
          required: false
        },
        {
          id: 'court_size',
          labelEs: 'Cuántos chambelanes / damas (espacio en pista)',
          labelEn: 'Court size — chambelanes / damas (floor layout)',
          scope: 'event',
          required: false
        }
      ]
    },
    runway: {
      type: 'runway',
      labelEs: 'Pasarela',
      labelEn: 'Runway / fashion',
      defaultBlocks: [
        {
          id: 'tech_rehearsal',
          defaultStart: '08:00',
          defaultEnd: '11:00',
          titleEs: 'Ensayo técnico + walk timing',
          titleEn: 'Tech rehearsal + walk timing',
          actionsEs: 'BPM por diseñador, contaje pasos, standby backstage.',
          actionsEn: 'BPM per designer, step counts, backstage standby.'
        },
        {
          id: 'show_a',
          defaultStart: '14:00',
          defaultEnd: '15:30',
          titleEs: 'Bloque show A',
          titleEn: 'Show block A',
          actionsEs: 'Line-check in-ears, cámara sync, spotlight cues.',
          actionsEn: 'In-ear line check, camera sync, spotlight cues.'
        },
        {
          id: 'show_b',
          defaultStart: '16:00',
          defaultEnd: '18:00',
          titleEs: 'Bloque show B',
          titleEn: 'Show block B',
          actionsEs: 'Rotación backstage, cambio cableado DJ si aplica.',
          actionsEn: 'Backstage rotation, DJ cabling change if any.'
        }
      ],
      criticalFields: [
        {
          id: 'lighting_tech_sync',
          labelEs: '¿Hay operador de luces o lo hace el DJ?',
          labelEn: 'Lighting operator vs DJ running lights?',
          scope: 'event',
          required: false
        },
        {
          id: 'model_exit_cue',
          labelEs: 'Señal para cambio de track (salida modelo)',
          labelEn: 'Cue for track change (model exit)',
          scope: 'block',
          required: false
        },
        {
          id: 'mic_type',
          labelEs: 'Micrófono: ¿headset, mano o inalámbrico?',
          labelEn: 'Mic type: headset, handheld, or wireless?',
          scope: 'event',
          required: false
        }
      ]
    },
    live_show: {
      type: 'live_show',
      labelEs: 'Show en vivo',
      labelEn: 'Live show',
      defaultBlocks: [
        {
          id: 'line_check',
          defaultStart: '14:00',
          defaultEnd: '17:00',
          titleEs: 'Line check & soundcheck',
          titleEn: 'Line check & soundcheck',
          actionsEs: 'Stage plot vs rack real, DI list, monitor mixes.',
          actionsEn: 'Stage plot vs actual rack, DI list, monitor mixes.'
        },
        {
          id: 'doors',
          defaultStart: '19:00',
          defaultEnd: '19:30',
          titleEs: 'Apertura puertas',
          titleEn: 'Doors',
          actionsEs: 'Walk-in playlist, seguridad entrada, merch.',
          actionsEn: 'Walk-in playlist, entry security, merch.'
        },
        {
          id: 'performance',
          defaultStart: '20:00',
          defaultEnd: '22:30',
          titleEs: 'Performance principal',
          titleEn: 'Main performance',
          actionsEs: 'Set breaks, hidratación, cambio instrumentos.',
          actionsEn: 'Set breaks, hydration, instrument swaps.'
        }
      ],
      criticalFields: [
        {
          id: 'set_time_start',
          labelEs: 'Hora exacta de salida a escena',
          labelEn: 'Exact on-stage start time',
          scope: 'event',
          required: false
        },
        {
          id: 'technical_rider_ok',
          labelEs: '¿Cumplimos con lo que pide el artista? (rider)',
          labelEn: 'Rider compliance confirmed with artist?',
          scope: 'vendor',
          required: false
        }
      ]
    }
  };

  global.mdjListEventFlowTemplateTypes = function () {
    return Object.keys(global.MDJ_EVENT_FLOW_TEMPLATES);
  };

  global.mdjCloneDefaultBlocksForType = function (type) {
    var t = global.MDJ_EVENT_FLOW_TEMPLATES[type] || global.MDJ_EVENT_FLOW_TEMPLATES.wedding;
    var en =
      global.i18n &&
      global.i18n.currentLang === 'en';
    return (t.defaultBlocks || []).map(function (b) {
      return {
        id: b.id,
        start: b.defaultStart,
        end: b.defaultEnd,
        title: en ? b.titleEn : b.titleEs,
        actions: en ? b.actionsEn : b.actionsEs,
        notes: ''
      };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
