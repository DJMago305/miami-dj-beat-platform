// web/articles-loader.js
// BEATS & TIPS DYNAMIC LOADER - MODO MILITAR

document.addEventListener('DOMContentLoaded', async () => {
    const articlesGrid = document.getElementById('articles-grid');
    if (!articlesGrid) return;

    try {
        const sb = window.getSupabaseClient ? window.getSupabaseClient() : supabase;
        const { data: articles, error } = await sb
            .from('mdjpro_articles')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            articlesGrid.innerHTML = '<p style="text-align:center; color:var(--muted);">Próximamente más artículos...</p>';
            return;
        }

        articlesGrid.innerHTML = ''; // Clear loading

        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'experience-card'; // Reuse premium card styles
            card.innerHTML = `
                <div class="exp-img" style="background-image: url('${article.image_url || './assets/article-placeholder.png'}');"></div>
                <div class="exp-content">
                    <div class="exp-venue">${article.title}</div>
                    <div class="exp-type">${article.category} · ${article.target_audience}</div>
                    <p class="exp-quote">${article.excerpt || ''}</p>
                    <a href="article.html?slug=${article.slug}" class="btn-pill" style="padding:8px 20px; font-size:12px; margin-top:10px; display:inline-block;">Leer más →</a>
                </div>
            `;
            articlesGrid.appendChild(card);
        });

    } catch (err) {
        console.error('Error loading articles:', err);
        articlesGrid.innerHTML = '<p>Error al cargar artículos.</p>';
    }
});
