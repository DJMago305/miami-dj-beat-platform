async function loadRentalsData() {
    try {
        const response = await fetch('./data/rentals.json');
        if (!response.ok) throw new Error('Failed to load rentals data');
        const data = await response.json();

        // 1. Hydrate globals
        window.hlCharacters = data.horaLoca
            .filter(item => item.active)
            .sort((a, b) => a.sortOrder - b.sortOrder);
        
        window.talentData = data.talent;
        
        if (window.talentData.musicians) {
            window.talentData.musicians = window.talentData.musicians
                .filter(item => item.active)
                .sort((a, b) => a.sortOrder - b.sortOrder);
        }
        if (window.talentData.visuals) {
            window.talentData.visuals = window.talentData.visuals
                .filter(item => item.active)
                .sort((a, b) => a.sortOrder - b.sortOrder);
        }
    } catch (error) {
        console.error('Error loading rentals data:', error);
    }
}

// 2. Global Renderers
window.renderHoraLocaCharacters = () => {
    const grid = document.getElementById('horaloca-grid');
    if (!grid) return;

    grid.innerHTML = window.hlCharacters.map(char => `
        <div class="tile glass-card" style="padding:0; overflow:hidden; border-radius:15px; background:rgba(255,255,255,0.02);">
            <div style="height:140px; overflow:hidden;">
                <img src="${char.img}" style="width:100%; height:100%; object-fit:cover; transition: transform 0.5s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            </div>
            <div style="padding:15px;">
                <h4 style="font-size:15px; margin:0 0 5px 0;">${char.name}</h4>
                <div style="color:var(--gold); font-weight:700; font-size:16px; margin-bottom:12px;">$${char.price}.00</div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(197, 160, 89, 0.1);">
                    <span style="font-size:11px; font-weight:700; color:var(--gold);">Agregar al paquete</span>
                    <label class="switch" style="transform: scale(0.8);">
                        <input type="checkbox" id="toggle-${char.id}" onchange="togglePackageItem('${char.id}', '${char.name}', ${char.price})">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        </div>
    `).join('');
};

window.renderRoster = (type) => {
    const grid = document.getElementById('roster-grid');
    const rosterTitle = document.getElementById('roster-title');
    if (!grid) return;

    if (rosterTitle) {
        rosterTitle.textContent = type === 'musicians' ? 'Músicos de Élite' : 'Captura y Visuales';
    }
    const items = window.talentData[type] || [];

    grid.innerHTML = items.map(item => `
        <div class="tile glass-card" style="padding:0; overflow:hidden; border-radius:15px; background:rgba(255,255,255,0.02); display: flex; flex-direction: column;">
            <div style="height:160px; overflow:hidden; position: relative;">
                <img src="${item.img}" style="width:100%; height:100%; object-fit:cover; transition: transform 0.5s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                <div style="position: absolute; top: 10px; right: 10px; background: var(--gold); color: black; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 50px;">MIAMI DJ BEAT PRO</div>
            </div>
            <div style="padding:20px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <h4 style="font-size:16px; margin:0 0 8px 0; color: white;">${item.name}</h4>
                    <p style="font-size:12px; color:rgba(255,255,255,0.5); line-height:1.4; margin-bottom:15px;">${item.desc}</p>
                </div>
                <div>
                    <div style="color:var(--gold); font-weight:900; font-size:18px; margin-bottom:15px;">Desde $${item.price}.00</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(197, 160, 89, 0.1);">
                        <div style="flex-grow: 1;">
                            <div style="font-size:10px; font-weight:800; color:var(--gold);">AGREGAR AL PAQUETE</div>
                            <div style="font-size:9px; opacity: 0.4;">Sujeto a disponibilidad</div>
                        </div>
                        <label class="switch" style="transform: scale(0.8);">
                            <input type="checkbox" id="toggle-${item.id}" onchange="togglePackageItem('${item.id}', '${item.name}', ${item.price})">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
};

window.selectedPackage = [];

window.togglePackageItem = (id, name, price) => {
    const isChecked = document.getElementById('toggle-' + id).checked;
    if (isChecked) {
        window.selectedPackage.push({ id, name, price });
    } else {
        window.selectedPackage = window.selectedPackage.filter(item => item.id !== id);
    }
    window.updatePackageSummary();
};

window.updatePackageSummary = () => {
    const summaries = document.querySelectorAll('.package-summary-bar');
    const total = window.selectedPackage.reduce((sum, item) => sum + item.price, 0);
    const count = window.selectedPackage.length;

    summaries.forEach(bar => {
        if (count > 0) {
            bar.style.display = 'flex';
            bar.querySelector('.package-count').textContent = `${count} ítem${count > 1 ? 's' : ''} seleccionado${count > 1 ? 's' : ''}`;
            bar.querySelector('.package-total').textContent = `$${total}.00`;
        } else {
            bar.style.display = 'none';
        }
    });
};

document.addEventListener('DOMContentLoaded', loadRentalsData);
