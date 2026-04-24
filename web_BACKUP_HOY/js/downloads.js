async function loadDownloadData() {
    try {
        const response = await fetch('./data/downloads.json');
        const data = await response.json();

        // Version
        const versionEl = document.getElementById('app-version');
        if (versionEl) {
            versionEl.textContent = `${data.app} ${data.version}`;
        }

        // Size
        const sizeEl = document.getElementById('app-size');
        if (sizeEl) {
            sizeEl.textContent = `${data.size}`;
        }

        // Download button
        const btn = document.getElementById('download-btn');
        if (btn) {
            btn.href = data.url;
        }

    } catch (error) {
        console.error('Error loading download data:', error);
    }
}

// Ejecutar cuando cargue la página
document.addEventListener('DOMContentLoaded', loadDownloadData);
