document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form') || document.querySelector('form');
    const keywordInput = document.getElementById('keyword-input') || document.querySelectorAll('input[type="text"]')[0];
    const siteInput = document.getElementById('site-input') || document.querySelectorAll('input[type="text"]')[1];
    
    let resultsContainer = document.getElementById('results-container') || document.querySelector('.results-container');
    
    // Pagination state
    let allSearchResults = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    if (!resultsContainer && searchForm) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'results-container';
        searchForm.after(resultsContainer);
    }

    if (!searchForm) return;

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const query = keywordInput ? keywordInput.value.trim() : '';
        const site = siteInput ? siteInput.value.trim() : '';

        if (!query && !site) return;

        resultsContainer.innerHTML = '<div style="padding:15px; font-weight:bold; text-align:center;">Searching across multiple indexes...</div>';

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&site=${encodeURIComponent(site)}`);
            const data = await response.json();

            allSearchResults = data.results || [];
            currentPage = 1;
            renderPage();
        } catch (error) {
            console.error('Error fetching search results:', error);
            resultsContainer.innerHTML = '<div style="padding:15px; color:red; text-align:center;">Failed to retrieve search results.</div>';
        }
    });

    function renderPage() {
        resultsContainer.innerHTML = '';

        if (!allSearchResults || allSearchResults.length === 0) {
            resultsContainer.innerHTML = '<div style="padding:15px; text-align:center;">No results found.</div>';
            return;
        }

        // Calculate slice indices for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageItems = allSearchResults.slice(startIndex, endIndex);
        const totalPages = Math.ceil(allSearchResults.length / itemsPerPage);

        // Render result cards
        pageItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'result-card';

            const title = item.title || 'Untitled Post';
            const url = item.url || '#';
            const snippet = item.snippet || '';

            card.innerHTML = `
                <h3 class="result-title">
                    <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(title)}</a>
                </h3>
                ${snippet ? `<p class="result-snippet">${escapeHTML(snippet)}</p>` : ''}
            `;

            resultsContainer.appendChild(card);
        });

        // Render Pagination Controls if there is more than 1 page
        if (totalPages > 1) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination-controls';
            paginationDiv.style.cssText = 'display:flex; justify-content:center; align-items:center; gap:15px; margin:20px 0;';

            const prevButton = document.createElement('button');
            prevButton.textContent = '← Previous';
            prevButton.disabled = currentPage === 1;
            prevButton.style.cssText = 'padding:8px 16px; border-radius:6px; border:1px solid #ccc; background:#fff; cursor:pointer;';
            if (prevButton.disabled) prevButton.style.opacity = '0.5';
            prevButton.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });

            const pageIndicator = document.createElement('span');
            pageIndicator.textContent = `Page ${currentPage} of ${totalPages} (${allSearchResults.length} total results)`;
            pageIndicator.style.cssText = 'font-size:0.95rem; color:#555;';

            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next →';
            nextButton.disabled = currentPage === totalPages;
            nextButton.style.cssText = 'padding:8px 16px; border-radius:6px; border:1px solid #ccc; background:#fff; cursor:pointer;';
            if (nextButton.disabled) nextButton.style.opacity = '0.5';
            nextButton.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderPage();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });

            paginationDiv.appendChild(prevButton);
            paginationDiv.appendChild(pageIndicator);
            paginationDiv.appendChild(nextButton);
            resultsContainer.appendChild(paginationDiv);
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&quot;');
    }
});