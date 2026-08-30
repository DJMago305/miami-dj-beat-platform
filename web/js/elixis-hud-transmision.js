/* ═══════════════════════════════════════════════════════════════════════
   ELIXIS · Simulador energetico de transmision (panel derecho, HUD)
   Creado 2026-08-29 a pedido directo del PO — especificacion literal:
   idle -> envelope_spawn -> envelope_charge -> beam_dispatch -> delivery_ack.

   QUE ES Y QUE NO ES: esto es el COMPONENTE VISUAL, un prototipo funcional
   independiente. Hoy (2026-08-29) elixis-realtime-session.ts solo tiene 3
   tools reales (consultar_elixis/recordar/olvidar) -- NINGUNA envia nada
   todavia (el "enviar_sms" que existe en otra parte del sistema, la
   memoria del PO, es de un modulo distinto, no de este workspace de voz).
   Por eso este archivo expone una API manual (montar/fijarEstado/cargar) Y
   un metodo de demostracion (demo()) para verse completo HOY sin esperar a
   que exista una tool real de envio -- cuando esa tool exista, quien la
   reciba en onTool() en staff.html solo tiene que llamar fijarEstado().

   Sin dependencias externas. Canvas 2D solo para la rejilla HUD de fondo
   en reposo (barata, unos pocos trazos por frame); todo lo demas (sobre,
   haz, receptor, pulso) es SVG + CSS keyframes puros, como pidio el ticket.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var ESTADOS = ['idle','envelope_spawn','envelope_charge','beam_dispatch','delivery_ack'];

  var HTML =
    '<div class="ehd-hud" data-estado="idle">' +
      '<canvas class="ehd-grid"></canvas>' +
      '<svg class="ehd-escena" viewBox="0 0 160 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="ehdCargaGrad" x1="0" y1="1" x2="0" y2="0">' +
            '<stop offset="0%" stop-color="var(--gold,#c5a059)" stop-opacity=".15"/>' +
            '<stop offset="100%" stop-color="var(--gold,#c5a059)" stop-opacity=".85"/>' +
          '</linearGradient>' +
          '<clipPath id="ehdSobreClip"><rect x="35" y="42" width="90" height="58" rx="6"/></clipPath>' +
        '</defs>' +
        '<path class="ehd-haz-ruta" d="M80,100 L80,190" fill="none" stroke="none"/>' +
        '<g class="ehd-sobre">' +
          '<rect class="ehd-sobre-relleno" x="35" y="100" width="90" height="0" clip-path="url(#ehdSobreClip)" fill="url(#ehdCargaGrad)"/>' +
          '<rect class="ehd-sobre-marco" x="35" y="42" width="90" height="58" rx="6" fill="rgba(10,14,22,.55)" stroke="var(--gold,#c5a059)" stroke-width="1.6"/>' +
          '<path class="ehd-sobre-solapa" d="M35,42 L80,78 L125,42" fill="none" stroke="var(--gold,#c5a059)" stroke-width="1.6" stroke-linejoin="round"/>' +
        '</g>' +
        '<text class="ehd-ready" x="80" y="118" text-anchor="middle">READY</text>' +
        '<circle class="ehd-particula" r="3.2" fill="var(--gold-lt,#e8c987)"/>' +
        '<circle class="ehd-particula ehd-particula-b" r="2.2" fill="var(--gold-lt,#e8c987)"/>' +
        '<g class="ehd-receptor" transform="translate(80,200)">' +
          '<circle class="ehd-receptor-pulso" r="14"/>' +
          '<circle r="14" fill="rgba(10,14,22,.7)" stroke="var(--line,rgba(255,255,255,.2))" stroke-width="1"/>' +
          '<text y="6" text-anchor="middle" font-size="16">🧍</text>' +
        '</g>' +
      '</svg>' +
    '</div>';

  var CSS_ID = 'ehd-estilos';
  var CSS = '' +
    '.ehd-hud{position:relative;width:100%;min-height:150px;flex:0 0 auto;border-radius:10px;overflow:hidden;background:rgba(0,0,0,.18);}' +
    '.ehd-grid{position:absolute;inset:0;width:100%;height:100%;opacity:.35;}' +
    '.ehd-escena{position:absolute;inset:0;width:100%;height:100%;}' +
    /* sobre: oculto en idle, aparece con glow perimetral en envelope_spawn+ */
    '.ehd-sobre{opacity:0;transform-origin:80px 71px;transform:scale(.82);transition:opacity .25s linear,transform .25s ease;}' +
    '.ehd-sobre-marco{filter:drop-shadow(0 0 0 rgba(197,160,89,0));transition:filter .3s ease;}' +
    '.ehd-hud[data-estado="envelope_spawn"] .ehd-sobre,' +
    '.ehd-hud[data-estado="envelope_charge"] .ehd-sobre,' +
    '.ehd-hud[data-estado="beam_dispatch"] .ehd-sobre,' +
    '.ehd-hud[data-estado="delivery_ack"] .ehd-sobre{opacity:1;transform:scale(1);}' +
    '.ehd-hud[data-estado="envelope_spawn"] .ehd-sobre-marco,' +
    '.ehd-hud[data-estado="envelope_charge"] .ehd-sobre-marco{animation:ehd-glow-pulso 1.8s ease-in-out infinite;}' +
    '@keyframes ehd-glow-pulso{0%,100%{filter:drop-shadow(0 0 1px rgba(197,160,89,.35))}50%{filter:drop-shadow(0 0 7px rgba(197,160,89,.85))}}' +
    /* relleno de carga: la altura real la fija JS (cargar(fraccion)) via --ehd-carga */
    '.ehd-sobre-relleno{transition:y .18s linear,height .18s linear;}' +
    /* badge READY: aparece solo cuando la carga llega a 1 (JS agrega .ehd-listo) */
    '.ehd-ready{fill:var(--gold-lt,#e8c987);font:800 13px/1 var(--mono,monospace);letter-spacing:.08em;opacity:0;transform:translateY(4px);' +
      'transform-box:fill-box;transform-origin:center;transition:opacity .2s ease,transform .2s ease;}' +
    '.ehd-hud.ehd-listo .ehd-ready{opacity:1;transform:translateY(0);animation:ehd-ready-pulso 1.4s ease-in-out infinite;}' +
    '@keyframes ehd-ready-pulso{0%,100%{opacity:1}50%{opacity:.55}}' +
    /* receptor: oculto hasta beam_dispatch */
    '.ehd-receptor{opacity:0;transition:opacity .2s linear;}' +
    '.ehd-hud[data-estado="beam_dispatch"] .ehd-receptor,' +
    '.ehd-hud[data-estado="delivery_ack"] .ehd-receptor{opacity:1;}' +
    '.ehd-receptor-pulso{fill:none;stroke:var(--gold,#c5a059);stroke-width:2;opacity:0;transform-origin:center;transform-box:fill-box;}' +
    '.ehd-hud[data-estado="delivery_ack"] .ehd-receptor-pulso{animation:ehd-pulso-recepcion .7s ease-out 2;}' +
    '@keyframes ehd-pulso-recepcion{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.1);opacity:0}}' +
    /* particulas de energia: viajan del sobre al receptor por offset-path solo en beam_dispatch */
    '.ehd-particula{opacity:0;offset-path:path("M80,100 L80,190");offset-rotate:0deg;filter:drop-shadow(0 0 3px var(--gold-lt,#e8c987));}' +
    '.ehd-hud[data-estado="beam_dispatch"] .ehd-particula{animation:ehd-viaje .55s linear forwards;}' +
    '.ehd-hud[data-estado="beam_dispatch"] .ehd-particula-b{animation-delay:.12s;}' +
    '@keyframes ehd-viaje{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}' +
    /* rejilla HUD de reposo: mas visible en idle, se atenua en cuanto pasa algo */
    '.ehd-hud[data-estado="idle"] .ehd-grid{opacity:.5;}' +
    '.ehd-hud:not([data-estado="idle"]) .ehd-grid{opacity:.12;}';

  function inyectarCSS(){
    if(document.getElementById(CSS_ID)) return;
    var s=document.createElement('style'); s.id=CSS_ID; s.textContent=CSS;
    document.head.appendChild(s);
  }

  /* Rejilla HUD: barata a proposito -- unas pocas lineas + una franja de
     escaneo, nunca por-pixel. Sigue corriendo en todos los estados (a
     opacidad baja fuera de idle) para que el fondo nunca se sienta apagado
     del todo, pero el costo real es minimo incluso en movil. */
  function dibujarRejilla(inst){
    var c=inst.canvas, ctx=inst.ctx; if(!c||!ctx) return;
    var r=c.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
    var W=Math.max(40,r.width), H=Math.max(40,r.height);
    if(c.width!==Math.round(W*dpr) || c.height!==Math.round(H*dpr)){
      c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    ctx.clearRect(0,0,W,H);
    var paso=22;
    ctx.strokeStyle='rgba(197,160,89,.14)'; ctx.lineWidth=1;
    for(var x=0;x<=W;x+=paso){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(var y=0;y<=H;y+=paso){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    inst.escaneoY=((inst.escaneoY||0)+0.6)%(H+30);
    var grad=ctx.createLinearGradient(0,inst.escaneoY-24,0,inst.escaneoY+24);
    grad.addColorStop(0,'rgba(197,160,89,0)'); grad.addColorStop(.5,'rgba(197,160,89,.22)'); grad.addColorStop(1,'rgba(197,160,89,0)');
    ctx.fillStyle=grad; ctx.fillRect(0,inst.escaneoY-24,W,48);
    inst.raf=requestAnimationFrame(function(){ dibujarRejilla(inst); });
  }

  function montar(contenedor){
    if(!contenedor) return null;
    inyectarCSS();
    var previo=contenedor.querySelector('.ehd-hud');
    if(previo) return previo._ehdInstancia;
    contenedor.insertAdjacentHTML('afterbegin', HTML);
    var raiz=contenedor.querySelector('.ehd-hud');
    var inst={
      raiz:raiz,
      canvas:raiz.querySelector('.ehd-grid'),
      relleno:raiz.querySelector('.ehd-sobre-relleno'),
      estado:'idle', raf:0, escaneoY:0, autoTimer:0
    };
    inst.ctx=inst.canvas.getContext('2d');
    raiz._ehdInstancia=inst;
    dibujarRejilla(inst);
    window.addEventListener('resize', function(){ if(document.body.contains(inst.canvas)) dibujarRejilla.__resize; });
    return inst;
  }

  /* fijarEstado(): quien llama decide CUANDO -- este modulo no adivina
     intencion de texto/voz, solo pinta el estado que le piden. beam_dispatch
     y delivery_ack encadenan solas hacia adelante (ver mas abajo) porque son
     una secuencia de una sola vez, no un estado en el que uno se "queda". */
  function fijarEstado(inst, nombre){
    if(!inst || ESTADOS.indexOf(nombre)===-1) return;
    clearTimeout(inst.autoTimer);
    inst.estado=nombre;
    inst.raiz.setAttribute('data-estado', nombre);
    if(nombre==='beam_dispatch'){
      /* el haz tarda .55s (ver @keyframes ehd-viaje) -- al llegar, pasa
         sola a delivery_ack sin que quien llamo tenga que medir el tiempo. */
      inst.autoTimer=setTimeout(function(){ fijarEstado(inst,'delivery_ack'); }, 600);
    } else if(nombre==='delivery_ack'){
      /* pulso de confirmacion (.7s x2, ver CSS) y vuelta sola a reposo. */
      inst.autoTimer=setTimeout(function(){ fijarEstado(inst,'idle'); cargar(inst,0); }, 1600);
    }
  }

  /* cargar(fraccion 0..1): altura real del relleno del sobre. Interior util
     del sobre = y:42..100 (58px). listo=true agrega el badge READY -- lo
     decide quien llama (ej. "ya llegamos a 1"), no un umbral fijo aqui,
     por si algun dia el criterio de "listo" no es solo longitud de texto. */
  function cargar(inst, fraccion){
    if(!inst || !inst.relleno) return;
    var f=Math.max(0,Math.min(1,fraccion||0));
    var alto=58*f;
    inst.relleno.setAttribute('y', 100-alto);
    inst.relleno.setAttribute('height', alto);
    inst.raiz.classList.toggle('ehd-listo', f>=1);
  }

  window.ElixisHudTransmision = {
    ESTADOS: ESTADOS.slice(),
    montar: montar,
    fijarEstado: fijarEstado,
    cargar: cargar,
    /* demo(): recorre los 5 estados solo, con datos falsos -- para que el
       PO (o cualquiera) vea el ciclo completo sin depender de una sesion de
       voz real ni de una tool de envio que hoy no existe. No la llama nada
       en produccion; es una utilidad de verificacion visual. */
    demo: function(inst){
      if(!inst) return;
      fijarEstado(inst,'envelope_spawn');
      var pct=0;
      var iv=setInterval(function(){
        pct+=0.12; cargar(inst,pct);
        if(pct>=1){ clearInterval(iv); fijarEstado(inst,'envelope_charge'); setTimeout(function(){ fijarEstado(inst,'beam_dispatch'); }, 700); }
      }, 160);
    }
  };
})();
