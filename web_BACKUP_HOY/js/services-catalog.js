let catalogData = [];
let currentCategory = '';
let currentItem = null;

async function initServicesCatalog() {
    try {
        const response = await fetch('./data/services-catalog.json');
        if (!response.ok) throw new Error('Catalog missing');
        const data = await response.json();
        
        catalogData = data.categories;
        if(catalogData.length > 0) {
            currentCategory = catalogData[0].id;
            renderTabs();
            renderGrid();
            attachGlobalEventListeners();
        }
    } catch (e) { console.error('Error loading services catalog:', e); }
}

function renderTabs() {
    const nav = document.getElementById('services-tabs-nav');
    if (!nav) return;
    nav.innerHTML = catalogData.map(cat => `
        <button class="svc-tab-btn ${cat.id === currentCategory ? 'active' : ''}" data-category-id="${cat.id}">
            ${cat.title}
        </button>
    `).join('');
}

function renderGrid() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    
    const category = catalogData.find(c => c.id === currentCategory);
    if (!category) return;
    
    const items = category.items.filter(i => i.active).sort((a,b) => a.sortOrder - b.sortOrder);
    
    grid.innerHTML = items.map(item => `
        <div class="tile glass-card dynamic-card-layout">
            <div class="dynamic-card-media">
                <img src="${item.cover}" class="dynamic-card-img" alt="${item.name}">
                <div class="dynamic-card-badge">MDJ BEAT EXCLUSIVE</div>
            </div>
            <div class="dynamic-card-body">
                <div>
                    <h4 class="dynamic-card-title">${item.name}</h4>
                    <p class="dynamic-card-desc">${item.desc}</p>
                </div>
                <div>
                    <div class="dynamic-card-price">$${item.price}.00</div>
                    <div class="dynamic-card-actions">
                        <button class="btn outline full view-more-btn action-btn-styled" data-item-id="${item.id}">Ver más</button>
                        <button class="btn primary full add-item-btn action-btn-styled" data-item-id="${item.id}">Agregar</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function attachGlobalEventListeners() {
    // 1. Delegación de Navegación de Tabs
    document.getElementById('services-tabs-nav')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.svc-tab-btn');
        if(!btn) return;
        currentCategory = btn.dataset.categoryId;
        renderTabs();
        renderGrid();
    });

    // 2. Delegación Dinámica de Grid (Botones "Ver más" y "Agregar")
    document.getElementById('services-grid')?.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-more-btn');
        const addBtn = e.target.closest('.add-item-btn');
        
        if (viewBtn) {
            openDetailModal(viewBtn.dataset.itemId);
        } else if (addBtn) {
            alert('Agregado a la orden (Fase 2) - ID: ' + addBtn.dataset.itemId);
        }
    });

    // 3. Cierre de Modal General
    document.getElementById('close-service-modal')?.addEventListener('click', () => {
        const modal = document.getElementById('service-detail-modal');
        if (modal) {
            modal.classList.add('hidden-modal');
            modal.classList.remove('visible-modal');
        }
        document.body.style.overflow = '';
        currentItem = null;
        document.getElementById('modal-media-container').innerHTML = ''; // Detener frames
    });
    
    // 4. Add desde dentro del Modal
    document.getElementById('modal-add-btn')?.addEventListener('click', () => {
        if(currentItem) {
            alert('Agregado a la orden (Fase 2) - ID: ' + currentItem.id);
        }
    });
}

function openDetailModal(itemId) {
    const category = catalogData.find(c => c.id === currentCategory);
    if (!category) return;
    
    currentItem = category.items.find(i => i.id === itemId);
    if(!currentItem) return;
    
    document.getElementById('modal-title').textContent = currentItem.name;
    document.getElementById('modal-price').textContent = currentItem.price + ".00";
    document.getElementById('modal-desc').textContent = currentItem.desc;
    
    // Media Inject
    const mediaContainer = document.getElementById('modal-media-container');
    if(currentItem.videos && currentItem.videos.length > 0) {
        mediaContainer.innerHTML = `<iframe src="${currentItem.videos[0]}" class="media-iframe"></iframe>`;
    } else {
        mediaContainer.innerHTML = `<img src="${currentItem.cover}" class="media-cover">`;
    }
    
    // Gallery Inject
    const galleryContainer = document.getElementById('modal-gallery');
    if(currentItem.gallery && currentItem.gallery.length > 0) {
        galleryContainer.innerHTML = currentItem.gallery.map(img => `
            <img src="${img}" class="gallery-thumb">
        `).join('');
    } else {
        galleryContainer.innerHTML = '';
    }
    
    const modal = document.getElementById('service-detail-modal');
    if (modal) {
        modal.classList.remove('hidden-modal');
        modal.classList.add('visible-modal');
        document.body.style.overflow = 'hidden';
    }
}

document.addEventListener('DOMContentLoaded', initServicesCatalog);
