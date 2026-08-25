import re

css_hero = """
/* Hero Panel Master-Detail UX */
.rental-hero-panel { display: flex; flex-wrap: wrap; background: rgba(0,0,0,0.4); border-radius: 15px; margin: 0 0 30px 0; border: 1px solid rgba(197,160,89,0.2); overflow: hidden; }
.rental-hero-media { flex: 1 1 300px; min-height: 250px; background: #000; position: relative; }
.rental-hero-media iframe { width: 100%; height: 100%; border: none; }
.rental-hero-media img { width: 100%; height: 100%; object-fit: cover; }
.rental-hero-info { flex: 1 1 300px; padding: 25px; display: flex; flex-direction: column; justify-content: center; }
.rental-badge-active { position:relative; width:max-content; margin-bottom:10px; background: var(--gold); color: black; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 50px; }
.rental-hero-title { margin: 0 0 10px 0; color: var(--gold); font-size: 26px; font-family: 'Playfair Display', serif; }
.rental-hero-price { font-size: 20px; font-weight: 800; margin-bottom: 15px; }
.rental-hero-desc { color: rgba(255,255,255,0.7); margin-bottom: 20px; line-height: 1.5; font-size: 14px; }
.rental-hero-action { margin-top: auto; }
.rental-grid-title { margin-bottom: 15px; color: white; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
.hidden-hero-asset { display: none !important; }
"""

with open('web/styles.css', 'r') as f:
    style_content = f.read()

if "Hero Panel Master-Detail UX" not in style_content:
    with open('web/styles.css', 'a') as f:
        f.write("\n" + css_hero)

with open('web/rentals.html', 'r') as f:
    html = f.read()

# Delete service-detail-modal
html = re.sub(r'<!-- ── DETAIL MODAL MULTIMEDIA.*?</div>\s*</div>\s*</div>', '', html, flags=re.DOTALL)

old_header = r'<div style="text-align: center; margin-bottom: 30px;">\s*<h2>Hora Loca Experience</h2>\s*<p>Selecciona los personajes para tu evento</p>\s*</div>\s*<div id="horaloca-grid" class="grid3">'

new_hero = """
            <div class="rental-hero-panel">
                <div id="hl-hero-media" class="rental-hero-media">
                    <iframe id="hl-hero-iframe" class="rental-hero-iframe hidden-hero-asset" src="" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                    <img id="hl-hero-img" class="rental-hero-img hidden-hero-asset" src="" alt="Hero">
                </div>
                <div class="rental-hero-info">
                    <div class="rental-badge-active">SELECCIÓN ACTIVA</div>
                    <h2 id="hl-hero-title" class="rental-hero-title">Hora Loca Experience</h2>
                    <div id="hl-hero-price" class="rental-hero-price"></div>
                    <p id="hl-hero-desc" class="rental-hero-desc">Selecciona un personaje debajo para ver detalles en video.</p>
                    <div class="rental-hero-action">
                        <button id="hl-hero-add-btn" class="btn primary full" data-action="hero-add-to-pack"></button>
                    </div>
                </div>
            </div>
            
            <h3 class="rental-grid-title">Catálogo Disponibles</h3>
            <div id="horaloca-grid" class="grid3">
"""
if '<div class="rental-hero-panel">' not in html:
    html = re.sub(old_header, new_hero.strip(), html)
    html = re.sub(r'styles\.css\?v=[\d\-\w]+', 'styles.css?v=20260320-HeroMode', html)
    with open('web/rentals.html', 'w') as f:
        f.write(html)
