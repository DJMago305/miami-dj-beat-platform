/**
 * Trinquete / cuerda de reloj — timbre más metálico: ruido de impacto + parciales inarmónicos + FM breve.
 * Un chasquido por tarjeta al hacer scroll; scroll rápido = ráfaga (Web Audio sintético).
 */
(function () {
    'use strict';

    var ctx = null;

    function getCtx() {
        if (!ctx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        return ctx;
    }

    /**
     * Un “diente”: impacto (ruido filtrado agudo) + campanillas inarmónicas + FM corta (brillo metálico).
     */
    function scheduleRatchetAt(c, timeSec, gainMul) {
        gainMul = gainMul == null ? 1 : Math.max(0.12, Math.min(1.15, gainMul));
        var t = timeSec;
        var g0 = gainMul;

        var dur = 0.03;
        var nSamples = Math.max(1, Math.floor(c.sampleRate * dur));
        var buffer = c.createBuffer(1, nSamples, c.sampleRate);
        var data = buffer.getChannelData(0);
        var i;
        for (i = 0; i < nSamples; i++) {
            var env = Math.exp(-(i / nSamples) * 5.5);
            data[i] = (Math.random() * 2 - 1) * env;
        }
        var noise = c.createBufferSource();
        noise.buffer = buffer;
        var hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1400;
        var bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 4800;
        bp.Q.value = 2.35;
        var gN = c.createGain();
        gN.gain.setValueAtTime(0, t);
        gN.gain.linearRampToValueAtTime(0.11 * g0, t + 0.0011);
        gN.gain.exponentialRampToValueAtTime(0.0005, t + 0.028);
        noise.connect(hp);
        hp.connect(bp);
        bp.connect(gN);
        gN.connect(c.destination);
        noise.start(t);
        noise.stop(t + dur);

        var partials = [
            { f: 988, a: 0.068, d: 0.028 },
            { f: 2318, a: 0.044, d: 0.023 },
            { f: 4195, a: 0.03, d: 0.019 },
            { f: 6780, a: 0.017, d: 0.016 }
        ];
        for (i = 0; i < partials.length; i++) {
            (function (p, idx) {
                var osc = c.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = p.f;
                var g = c.createGain();
                var peak = p.a * g0 * 1.05;
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(peak, t + 0.00032 + idx * 0.00004);
                g.gain.exponentialRampToValueAtTime(0.00025, t + p.d);
                osc.connect(g);
                g.connect(c.destination);
                osc.start(t);
                osc.stop(t + p.d + 0.008);
            })(partials[i], i);
        }

        var carrier = c.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = 1125;
        var modul = c.createOscillator();
        modul.type = 'sine';
        modul.frequency.value = 292;
        var modDepth = c.createGain();
        modDepth.gain.setValueAtTime(0.0001, t);
        modDepth.gain.linearRampToValueAtTime(380 * g0, t + 0.00045);
        modDepth.gain.exponentialRampToValueAtTime(0.008, t + 0.024);
        modul.connect(modDepth);
        modDepth.connect(carrier.frequency);
        var cg = c.createGain();
        cg.gain.setValueAtTime(0, t);
        cg.gain.linearRampToValueAtTime(0.036 * g0, t + 0.00045);
        cg.gain.exponentialRampToValueAtTime(0.00025, t + 0.03);
        carrier.connect(cg);
        cg.connect(c.destination);
        modul.start(t);
        carrier.start(t);
        modul.stop(t + 0.034);
        carrier.stop(t + 0.034);
    }

    function mdjUiTickPlay() {
        /* No usar prefers-reduced-motion aquí: es sonido breve, no animación; bloquearlo dejaba las flechas mudas. */
        var c = getCtx();
        if (!c) return;
        if (c.state === 'suspended') c.resume().catch(function () {});
        scheduleRatchetAt(c, c.currentTime, 1);
    }

    function estimateCardStep(el) {
        if (!el) return null;
        var card = el.querySelector(':scope > .product-card');
        if (card) {
            var gap = parseFloat(getComputedStyle(el).gap);
            if (isNaN(gap)) gap = 15;
            return card.offsetWidth + gap;
        }
        var track = el.querySelector('.jobs-role-carousel-loop') || el.querySelector('.jobs-role-carousel-track');
        if (track) {
            card = track.querySelector('.role-photo-card');
            if (card) {
                var g2 = parseFloat(getComputedStyle(track).gap);
                if (isNaN(g2)) g2 = 16;
                return card.offsetWidth + g2;
            }
        }
        card = el.querySelector('.hero-glass-card, .talent-cat-card');
        if (card && card.parentElement === el) {
            var g3 = parseFloat(getComputedStyle(el).gap);
            if (isNaN(g3)) g3 = 14;
            return card.offsetWidth + g3;
        }
        card = el.querySelector('.hero-glass-card, .talent-cat-card');
        if (card) {
            var par = card.parentElement;
            var g4 = parseFloat(getComputedStyle(par).gap);
            if (isNaN(g4)) g4 = 14;
            return card.offsetWidth + g4;
        }
        return null;
    }

    function mdjUiTickBindScroll(el) {
        if (!el || el.nodeType !== 1) return;
        var lastScroll = el.scrollLeft;

        el.addEventListener(
            'scroll',
            function () {
                var c = getCtx();
                if (!c) return;
                if (c.state === 'suspended') c.resume().catch(function () {});

                var step = estimateCardStep(el);
                if (!step || step < 48) step = 300;

                var sl = el.scrollLeft;
                var oldIdx = Math.floor(lastScroll / step + 1e-9);
                var newIdx = Math.floor(sl / step + 1e-9);
                lastScroll = sl;

                var crossed = Math.abs(newIdx - oldIdx);
                if (crossed === 0) return;

                crossed = Math.min(crossed, 32);
                var t0 = c.currentTime;
                var staggerSec =
                    crossed > 14 ? 0.0068 : crossed > 7 ? 0.0088 : crossed > 3 ? 0.0105 : 0.012;
                var baseVol = crossed > 16 ? 0.72 : crossed > 8 ? 0.85 : 1;

                var i;
                for (i = 0; i < crossed; i++) {
                    var wobble = 0.94 + (i % 3) * 0.03;
                    scheduleRatchetAt(c, t0 + i * staggerSec, baseVol * wobble);
                }
            },
            { passive: true }
        );
    }

    function mdjUiTickAutoInit() {
        document.querySelectorAll('[data-mdj-ui-tick-scroll]').forEach(function (el) {
            if (el.dataset.mdjUiTickBound === '1') return;
            el.dataset.mdjUiTickBound = '1';
            mdjUiTickBindScroll(el);
        });
    }

    window.mdjUiTickPlay = mdjUiTickPlay;
    window.mdjUiTickBindScroll = mdjUiTickBindScroll;
    window.mdjUiTickAutoInit = mdjUiTickAutoInit;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mdjUiTickAutoInit);
    } else {
        mdjUiTickAutoInit();
    }

    document.addEventListener(
        'pointerdown',
        function once() {
            var c = getCtx();
            if (c && c.state === 'suspended') c.resume().catch(function () {});
            document.removeEventListener('pointerdown', once, true);
        },
        { capture: true, passive: true }
    );
})();
