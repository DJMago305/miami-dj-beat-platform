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


    /* ── SHUFFLE ENGINE (Fisher-Yates) ──────────────────── */
    function shuffle(array) {
        let m = array.length, t, i;
        while (m) {
            i = Math.floor(Math.random() * m--);
            t = array[m];
            array[m] = array[i];
            array[i] = t;
        }
        return array;
    }

    /* ── RANDOMIZATION ENGINE ────────────────────────────── */
    function buildExam() {
        const s1_all = MASTER_BANK.filter(q => q.section === 'S1: Cultura, Mentalidad y Ética');
        const s2_all = MASTER_BANK.filter(q => q.section === 'S2: Serato DJ Pro');
        const s3_all = MASTER_BANK.filter(q => q.section === 'S3: Conocimiento Musical');
        const s4_all = MASTER_BANK.filter(q => q.section === 'S4: Operación y Seguridad');

        const mc = [
            ...shuffle([...s1_all]).slice(0, 6),
            ...shuffle([...s2_all]).slice(0, 6),
            ...shuffle([...s3_all]).slice(0, 6),
            ...shuffle([...s4_all]).slice(0, 7)
        ];

        const shortPool = MASTER_BANK.filter(q => q.type === 'short');
        const short = shuffle([...shortPool]).slice(0, 5);

        return shuffle([...mc, ...short]);
    }

    let questions = buildExam();

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
           Sección 4 (Operación y Seguridad) = bloque critico.
           Si falla > 2 en este bloque → FAIL técnico automático. */
        const TECHNICAL_SECTIONS = ['S4: Operación y Seguridad'];
        const technicalMisses = mcMisses.filter(m => TECHNICAL_SECTIONS.includes(m.q.section)).length;

        // preGrad = pct ≥ 80% Y fallos técnicos en S4 (Operación) ≤ 2
        const preGrad = pct >= 80 && technicalMisses <= 2;

        if (technicalMisses >= 3) {
            $('feedback').innerHTML = `
              <div style="padding:40px;border-radius:24px;background:rgba(229,62,62,0.06);border:1px solid rgba(229,62,62,0.3);text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">❌</div>
                <h3 style="font-size:22px;font-weight:900;color:#fc8181;margin-bottom:12px;">FAIL — Bloque Técnico</h3>
                <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;max-width:480px;margin:0 auto 20px;">
                  <strong style="color:#fff;">${technicalMisses} de 7</strong> preguntas de Operación/Seguridad incorrectas.<br>
                  El estándar de élite exige mínimo 5 correctas en Operación Profesional.
                </p>
                <div style="display:inline-block;padding:10px 20px;background:rgba(229,62,62,0.1);border:1px solid rgba(229,62,62,0.2);border-radius:12px;">
                  <p style="font-size:13px;color:#fc8181;margin:0;">Estudia los Módulos de Operación y vuelve a intentarlo.</p>
                </div>
              </div>
            `;
            renderSectionBars(sectionScores, SECTIONS, TECHNICAL_SECTIONS, technicalMisses);
            $('result').classList.remove('hidden');
            $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        /* ── Supabase INSERT ────────────────────────────────── */
        let registry = "—";
        try {
            const { error: insErr } = await supabaseClient
                .from('certificates')
                .insert([{
                    cert_number: certId,
                    student_name: name,
                    email: $('djEmail').value.trim() || null,
                    theory_score: totalEarned,
                    theory_pct: pct,
                    pre_graduated: preGrad,
                    verification_url: `${window.location.origin}/verify.html?id=${certId}`
                }]);
            if (insErr) {
                console.error('Supabase insert error:', insErr);
            } else {
                const { data: regData } = await supabaseClient
                    .from('certificates')
                    .select('public_year, public_seq')
                    .eq('cert_number', certId)
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
                    }">🔒 CRÍTICO (S4) — ${techMissesInSec} fallo${techMissesInSec !== 1 ? 's' : ''}</span>`
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

            /* Premium Certificate Link */
            if (preGrad) {
                fb.push(`
                  <div class="kpi" style="border: 2px solid var(--gold); background: rgba(197,160,89,0.05); text-align: center; padding: 30px;">
                    <h3 style="color: var(--gold); font-size: 20px; margin-bottom: 15px;">🏆 CERTIFICACIÓN DISPONIBLE</h3>
                    <p style="margin-bottom: 20px; font-size: 15px;">Tu certificado oficial de alta fidelidad está listo para ser generado.</p>
                    <a href="./certificate-template_v2.html?name=${encodeURIComponent(name)}&cert_no=${encodeURIComponent(certId)}&id=${encodeURIComponent(certId)}&date=${encodeURIComponent(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase())}" 
                       target="_blank" 
                       class="btn primary" 
                       style="background: var(--gold); border-color: var(--gold); color: #000; font-weight: 900; padding: 15px 30px;">
                       GENERAR CERTIFICADO (A4 PDF)
                    </a>
                    <p style="margin-top: 15px; font-size: 12px; color: var(--muted);">Recomendado: Usar "Guardar como PDF" en el diálogo de impresión.</p>
                  </div>
                `);
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
        questions = buildExam(); // Regenerar aleatorización al reiniciar
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
