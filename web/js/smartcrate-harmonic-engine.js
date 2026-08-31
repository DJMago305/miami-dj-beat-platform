/* ═══════════════════════════════════════════════════════════════════
   SMARTCRATE IA · Convertidor Camelot + motor de recomendación armónica
   ═══════════════════════════════════════════════════════════════════
   2026-08-30, autorizado por el PO. Puro cálculo, sin dependencias, sin
   tocar disco ni red -- consume lo que ya extrajo el Indexador Serato
   (Dominio #6): tonalidad en notación TRADICIONAL ("Dm", "Abm", "F#"),
   nunca Camelot -- por eso hace falta este diccionario antes de poder
   comparar nada. Diccionario tal cual lo dio el PO, incluyendo
   enarmónicos (# y b).
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var CAMELOT_MENOR = {
    'abm':'1A', 'g#m':'1A',
    'ebm':'2A', 'd#m':'2A',
    'bbm':'3A', 'a#m':'3A',
    'fm':'4A',
    'cm':'5A',
    'gm':'6A',
    'dm':'7A',
    'am':'8A',
    'em':'9A',
    'bm':'10A',
    'f#m':'11A', 'gbm':'11A',
    'c#m':'12A', 'dbm':'12A',
  };
  var CAMELOT_MAYOR = {
    'b':'1B', 'cb':'1B',
    'f#':'2B', 'gb':'2B',
    'db':'3B', 'c#':'3B',
    'ab':'4B', 'g#':'4B',
    'eb':'5B', 'd#':'5B',
    'bb':'6B', 'a#':'6B',
    'f':'7B',
    'c':'8B',
    'g':'9B',
    'd':'10B',
    'a':'11B',
    'e':'12B',
  };

  /* Normaliza y convierte. Devuelve null (nunca un codigo inventado) si la
     notacion no esta en el diccionario -- pasa con generos que Serato a
     veces guarda distinto (ej. "Dm7", modos raros) o con tracks sin
     tonalidad analizada. */
  function claveACamelot(claveTexto){
    if(!claveTexto) return null;
    var norm = String(claveTexto).trim().toLowerCase().replace(/\s+/g, '');
    if(CAMELOT_MENOR.hasOwnProperty(norm)) return CAMELOT_MENOR[norm];
    if(CAMELOT_MAYOR.hasOwnProperty(norm)) return CAMELOT_MAYOR[norm];
    return null;
  }

  /* Las 4 reglas pedidas explicitamente, en este orden de prioridad:
     - mezcla_perfecta: mismo codigo exacto.
     - transicion_suave: mismo numero +-1 (rueda circular: 12 y 1 son vecinos).
     - cambio_modo: mismo numero, letra distinta (relativo mayor/menor).
     - salto_energia: mismo letra, +2 en numero (boost de energia, una sola
       direccion -- asi lo pidio el ticket, no +-2). */
  function analizarCompatibilidad(codigoA, codigoB){
    if(!codigoA || !codigoB) return null;
    if(codigoA === codigoB) return 'mezcla_perfecta';
    var numA = parseInt(codigoA, 10), letraA = codigoA.slice(-1);
    var numB = parseInt(codigoB, 10), letraB = codigoB.slice(-1);
    if(letraA === letraB){
      var diff = ((numB - numA + 12) % 12);
      if(diff === 1 || diff === 11) return 'transicion_suave';
      if(diff === 2) return 'salto_energia';
    }
    if(numA === numB && letraA !== letraB) return 'cambio_modo';
    return null;
  }

  function dentroDeRangoBpm(bpmActual, bpmCandidato, porcentaje){
    if(!bpmActual || !bpmCandidato) return false;
    var tolerancia = bpmActual * (porcentaje / 100);
    return Math.abs(bpmCandidato - bpmActual) <= tolerancia;
  }

  /* estimarNivelEnergia(track) -- base del motor #3 (Criterio Contextual por
     Evento, sin construir todavia). Rangos de BPM tal cual los dio el PO en
     el ticket 2026-08-30; el genero solo entra para partir el nivel 1 del 2
     dentro del mismo rango "<100 bpm" (el ticket los agrupa como un solo
     bloque "Warm-up/Lounge" sin frontera numerica entre ambos -- el genero
     es el unico dato que puede distinguirlos ahi). Fuera de ese caso el BPM
     manda solo, como pide el ticket con numeros explicitos.
     Devuelve null (nunca un nivel inventado) si el track no trae BPM real. */
  var GENEROS_NIVEL_1 = /loung|ambient|chill|downtempo|smooth|easy[\s-]?listening/i;

  function estimarNivelEnergia(track){
    var bpm = track && Number(track.bpm);
    if(!bpm || !isFinite(bpm) || bpm <= 0) return null;
    if(bpm < 100){
      var genero = String((track && track.genre) || '');
      return GENEROS_NIVEL_1.test(genero) ? 1 : 2;
    }
    if(bpm <= 118) return 3;
    if(bpm <= 128) return 4;
    return 5;
  }

  var ENERGIA_ETIQUETAS = {
    1: 'Warm-up / Lounge',
    2: 'Warm-up / Lounge',
    3: 'Mid-tempo / Groove',
    4: 'Dancefloor / Peak',
    5: 'Clímax / High Energy',
  };

  /* Porcentajes por tipo de evento -- DEFAULTS RAZONADOS por este hilo, NO
     verificados/prescritos por el PO (el ticket solo pidio "configurable
     por tipo de evento", sin numeros concretos por tipo). Ajustables sin
     tocar el motor -- son datos, no logica. */
  var RANGO_BPM_POR_EVENTO = {
    bodas: 3,
    quince: 4,
    corporativos: 3,
    clubs_latinos: 6,
    edm: 8,
  };
  var RANGO_BPM_DEFAULT = 4;

  /* calcularTracksCompatibles(trackActual, catalogo, opciones)
     opciones.porcentajeBpm -- numero directo, tiene prioridad
     opciones.tipoEvento -- clave de RANGO_BPM_POR_EVENTO, si no viene
       porcentajeBpm directo
     Devuelve [{ track, camelot, tipoCompatibilidad }], nunca el propio
     track de origen. */
  function calcularTracksCompatibles(trackActual, catalogo, opciones){
    opciones = opciones || {};
    var porcentajeBpm = typeof opciones.porcentajeBpm === 'number'
      ? opciones.porcentajeBpm
      : (RANGO_BPM_POR_EVENTO[opciones.tipoEvento] || RANGO_BPM_DEFAULT);
    var codigoActual = claveACamelot(trackActual && trackActual.key);
    if(!codigoActual || !Array.isArray(catalogo)) return [];
    var resultado = [];
    catalogo.forEach(function(t){
      if(!t || t === trackActual || t.id === trackActual.id) return;
      var codigoT = claveACamelot(t.key);
      var compat = analizarCompatibilidad(codigoActual, codigoT);
      if(!compat) return;
      if(!dentroDeRangoBpm(trackActual.bpm, t.bpm, porcentajeBpm)) return;
      resultado.push({ track: t, camelot: codigoT, tipoCompatibilidad: compat });
    });
    return resultado;
  }

  window.SmartCrateHarmonicEngine = {
    claveACamelot: claveACamelot,
    analizarCompatibilidad: analizarCompatibilidad,
    calcularTracksCompatibles: calcularTracksCompatibles,
    estimarNivelEnergia: estimarNivelEnergia,
    ENERGIA_ETIQUETAS: ENERGIA_ETIQUETAS,
    RANGO_BPM_POR_EVENTO: RANGO_BPM_POR_EVENTO,
    RANGO_BPM_DEFAULT: RANGO_BPM_DEFAULT,
  };
})();
