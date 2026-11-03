const express = require('express');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/search', async (req, res) => {
    try {
        const keyword = (req.query.q || '').trim().toLowerCase();
        const targetSite = (req.query.site || '').trim();

        if (!targetSite) {
            return res.json({ 
                results: [{
                    title: "Error: Target Website Required",
                    url: "#",
                    snippet: "Please specify a website in the target website box (e.g., soundgasm.net or wikipedia.org)."
                }]
            });
        }

        let cleanDomain = targetSite.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
        let foundTracks = [];
        let profileUrls = new Set();

        const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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';
        const searchQuery = `site:${cleanDomain} ${keyword}`;
        
        // Instruct Tavily to return up to 100 results instead of default 10
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: searchQuery,
                search_depth: "advanced",
                max_results: 100,
                include_domains: [cleanDomain]
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
        }

        const data = await response.json();
        const searchResults = data.results || [];

        const isAudioPlatform = cleanDomain.includes('soundgasm');

        if (isAudioPlatform) {
            // Audio Platform Logic: Deep scrape profile hubs
            searchResults.forEach(item => {
                const rawUrl = item.url || '';
                if (rawUrl.includes(cleanDomain)) {
                    try {
                        const u = new URL(rawUrl);
                        const parts = u.pathname.split('/').filter(Boolean);
                        
                        if (parts[0] === 'u' && parts.length >= 2) {
                            profileUrls.add(`https://${cleanDomain}/u/${parts[1]}`);
                        }
                        if (parts[0] === 'u' && parts.length >= 3) {
                            foundTracks.push({
                                title: item.title || parts[2].replace(/-/g, ' '),
                                url: rawUrl,
                                snippet: item.content || `Direct match for ${parts[1]}`
                            });
                        }
                    } catch (e) {}
                }
            });

            const profileFetchers = Array.from(profileUrls).map(async (profileUrl) => {
                try {
                    const pResp = await fetch(profileUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        signal: AbortSignal.timeout(5000)
                    });

                    if (!pResp.ok) return;

                    const pHtml = await pResp.text();
                    const $p = cheerio.load(pHtml);

                    $p('a').each((_, el) => {
                        const href = $p(el).attr('href') || '';
                        const linkText = $p(el).text().trim();

                        if (href.includes('/u/')) {
                            const fullUrl = href.startsWith('http') ? href : `https://${cleanDomain}${href}`;
                            try {
                                const trackUrlObj = new URL(fullUrl);
                                const pathSegments = trackUrlObj.pathname.split('/').filter(Boolean);

                                if (pathSegments[0] === 'u' && pathSegments.length >= 3) {
                                    const cleanTitle = linkText || pathSegments[2].replace(/-/g, ' ');
                                    if (!keyword || cleanTitle.toLowerCase().includes(keyword) || href.toLowerCase().includes(keyword)) {
                                        foundTracks.push({
                                            title: cleanTitle.replace(/ - Soundgasm$/i, ''),
                                            url: fullUrl,
                                            snippet: `Uploaded by ${pathSegments[1]} on Soundgasm`
                                        });
                                    }
                                }
                            } catch (e) {}
                        }
                    });
                } catch (err) {}
            });

            await Promise.all(profileFetchers);

        } else {
            // General Website Logic: Collect all 100 returned items directly
            searchResults.forEach(item => {
                if (item.url && item.url.includes(cleanDomain)) {
                    foundTracks.push({
                        title: item.title || 'Untitled Result',
                        url: item.url,
                        snippet: item.content || 'No description available.'
                    });
                }
            });
        }

        // Deduplicate results by URL
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const item of foundTracks) {
            if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                uniqueResults.push(item);
            }
        }

        // Fallback if zero items found
        if (uniqueResults.length === 0) {
            uniqueResults.push({
                title: `No results found for "${keyword}" on ${cleanDomain}`,
                url: `#`,
                snippet: `Try a different keyword or check your spelling.`
            });
        }

        res.json({ results: uniqueResults });

    } catch (err) {
        console.error("Search endpoint error:", err.message);
        res.status(500).json({ results: [{ title: "Server Error", url: "#", snippet: err.message }] });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});