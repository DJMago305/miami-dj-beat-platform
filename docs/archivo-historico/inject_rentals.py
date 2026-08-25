import re
import os

css_payload = """
/* --- EXTENSION: RENTALS MULTIMEDIA ENHANCEMENT --- */
.rental-grid-card { padding:0; overflow:hidden; border-radius:15px; background:rgba(255,255,255,0.02); display: flex; flex-direction: column; }
.rental-media-box { height:180px; overflow:hidden; position: relative; }
.rental-img-zoom { width:100%; height:100%; object-fit:cover; transition: transform 0.5s; cursor: pointer; }
.rental-grid-card:hover .rental-img-zoom { transform: scale(1.1); }
.rental-badge-pro { position: absolute; top: 10px; right: 10px; background: var(--gold); color: black; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 50px; }
.rental-card-content { padding: 20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; }
.rental-card-title { font-size:16px; margin:0 0 8px 0; color: white; }
.rental-card-subtitle { font-size:12px; color:rgba(255,255,255,0.5); line-height:1.4; margin-bottom:15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.rental-card-price { color:var(--gold); font-weight:900; font-size:18px; margin-bottom:15px; }

.rental-action-bar { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(197, 160, 89, 0.1); }
.rental-switch-lbl { font-size:11px; font-weight:700; color:var(--gold); }
.rental-switch-wrap { transform: scale(0.8); margin: 0; }

.rental-btn-link { background: none; border: none; color: var(--gold); font-size: 11px; font-weight: 800; text-transform: uppercase; cursor: pointer; padding: 0; text-align: left; margin-bottom: 12px; letter-spacing: 0.5px; opacity: 0.9; }
.rental-btn-link:hover { opacity: 1; text-decoration: underline; }

.svc-detalle-hide { display: none !important; }
.svc-detalle-show { display: flex !important; }
.svc-detalle-card { max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto; padding: 0; outline: 1px solid rgba(197, 160, 89, 0.3); }
.svc-detalle-close { position: absolute; top: 15px; right: 20px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 40px; height: 40px; border: none; color: white; font-size: 24px; cursor: pointer; z-index: 50; display: flex; align-items: center; justify-content: center; }
.svc-detalle-media { width: 100%; height: 350px; background: #000; position: relative; border-radius: 15px 15px 0 0; overflow: hidden; }
.svc-detalle-media iframe { width: 100%; height: 100%; border: none; }
.svc-detalle-media img { width: 100%; height: 100%; object-fit: cover; }
.svc-detalle-body { padding: 30px; }
.svc-detalle-title { font-family: 'Playfair Display', serif; font-size: 32px; color: var(--gold); margin-bottom: 10px; }
.svc-detalle-price-box { font-size: 24px; font-weight: 800; margin-bottom: 20px; }
.svc-detalle-desc { color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 30px; }
.svc-detalle-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-bottom: 30px; }
.svc-detalle-gallery img { width:100%; height:80px; object-fit:cover; border-radius:8px; border: 1px solid rgba(255,255,255,0.1); }
.svc-detalle-btn { border-radius: 50px; }
"""

with open('web/styles.css', 'r') as f:
    if "RENTALS MULTIMEDIA ENHANCEMENT" not in f.read():
        with open('web/styles.css', 'a') as f_append:
            f_append.write("\n" + css_payload)

modal_payload = """
    <!-- ── DETAIL MODAL MULTIMEDIA (INYECCIÓN DE FASE 1) ── -->
    <div id="service-detail-modal" class="modal-overlay svc-detalle-hide">
        <div class="modal-content glass-card svc-detalle-card">
            <button id="close-service-modal" class="svc-detalle-close">&times;</button>
            <div id="modal-media-container" class="svc-detalle-media"></div>
            <div class="svc-detalle-body">
                <h2 id="modal-title" class="svc-detalle-title"></h2>
                <div class="svc-detalle-price-box">$<span id="modal-price"></span></div>
                <p id="modal-desc" class="svc-detalle-desc"></p>
                <div id="modal-gallery" class="svc-detalle-gallery"></div>
                <button id="modal-add-btn" class="btn primary full svc-detalle-btn">Agregar al Paquete</button>
            </div>
        </div>
    </div>
"""

with open('web/rentals.html', 'r') as f:
    html = f.read()

if 'id="service-detail-modal"' not in html:
    html = html.replace('<!-- MDJ Assistant Booth', modal_payload + '\n    <!-- MDJ Assistant Booth')
    html = re.sub(r'styles\.css\?v=[\d-]+', 'styles.css?v=20260320-FinalQA', html)

    with open('web/rentals.html', 'w') as f:
        f.write(html)
