/**
 * MDJPRO - Knowledge Articles Loader
 * 
 * This script dynamically loads Markdown content from the /web/content/ directory
 * and injects it into the corresponding locked HTML containers in dj-knowledge.html.
 * This ensures the structural HTML remains untouched (LOCKED) while the content
 * can be easily updated and versioned via Markdown.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Map section IDs to their corresponding Markdown files
    const articleMap = {
        'manifesto': 'manifiesto.md',
        'el-selecta': 'selecta-jamaica.md',
        'bronx-birth': 'bronx-1973.md',
        'reading-floor': 'psicologia-pista.md',
        'dj-vs-entertainer': 'dj-vs-entertainer.md'
    };

    // 2. Simple Markdown to HTML parser for our specific structural needs
    // We only need to parse headers (#), images (![]()), bold (**), and lists (-)
    function parseMarkdown(mdText) {
        let html = mdText;
        
        // Headers (H1) - Usually we might drop this or format it if the HTML already has a title,
        // but since we are replacing the whole block, we'll format it as an H2 or H3
        html = html.replace(/^# (.*$)/gim, '<h2 style="font-family: \'Playfair Display\', serif; font-size: 32px; font-weight: 800; margin-bottom: 24px;">$1</h2>');
        
        // Images: ![alt](url) -> We add our editorial-img class
        html = html.replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" class="editorial-img" alt="$1" style="width: 100%; border-radius: 16px; margin-bottom: 32px;">');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italics
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Lists
        html = html.replace(/^- (.*$)/gim, '<li style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 12px;"><span style="color: var(--gold); margin-top: 4px;">•</span> <span>$1</span></li>');
        // Wrap lists in ul
        html = html.replace(/(<li.*<\/li>)/s, '<ul style="list-style: none; padding: 0; margin: 32px 0;">$1</ul>');
        
        // Paragraphs (anything not already a block tag or empty line)
        // This is a basic implementation. We split by double newline.
        const blocks = html.split('\n\n');
        html = blocks.map(block => {
            if (block.trim() === '') return '';
            if (block.startsWith('<h') || block.startsWith('<img') || block.startsWith('<ul')) return block;
            return `<p style="line-height: 1.8; color: rgba(255, 255, 255, 0.8); margin-bottom: 24px; font-size: 16px;">${block.trim().replace(/\n/g, '<br>')}</p>`;
        }).join('');

        return html;
    }

    // 3. Fetch and inject function
    async function loadArticleContent(sectionId, filename) {
        const sectionEl = document.getElementById(sectionId);
        if (!sectionEl) return;
        
        // Find the content container within the section (the one with the background)
        // If it doesn't exist (like in the manifesto), we'll inject into the section itself or a specific wrapper
        let contentContainer = sectionEl.querySelector('.content-wrapper');
        
        // If no explicit wrapper, let's look for the main stylized div
        if (!contentContainer) {
             const stylizedDivs = sectionEl.querySelectorAll('div[style*="background:rgba(255,255,255,0.02)"]');
             if (stylizedDivs.length > 0) {
                 contentContainer = stylizedDivs[0];
             } else {
                 // Fallback to the section itself if it's the specific manifesto structure
                 if (sectionId === 'manifesto') {
                     // Get the div right after the h2/h3 headers
                     contentContainer = sectionEl.querySelector('.manifesto-text-container') || sectionEl;
                 }
             }
        }

        if (!contentContainer) return;

        try {
            const response = await fetch(`./content/${filename}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const markdownText = await response.text();
            
            // Only update if we received valid content (not just the placeholder)
            if (markdownText && !markdownText.includes('(Contenido pendiente de añadir)')) {
                const parsedHTML = parseMarkdown(markdownText);
                
                // Clear existing inner HTML and inject new
                contentContainer.innerHTML = parsedHTML;
                contentContainer.style.animation = 'fadeIn 0.5s ease forwards';
            }
            
        } catch (error) {
            console.error(`Error loading article ${filename}:`, error);
        }
    }

    // 4. Load all articles on initial page load
    Object.entries(articleMap).forEach(([sectionId, filename]) => {
        loadArticleContent(sectionId, filename);
    });
    
    // Add simple fade in animation dynamically
    const styleBlock = document.createElement('style');
    styleBlock.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(styleBlock);
});
