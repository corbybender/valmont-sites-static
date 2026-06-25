const fs = require('fs');
const path = require('path');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const OUTPUT_PATH = path.join(SITE.dataDir, 'cleanedurls.txt');
const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES || 500);

function normalizePath(rawUrl) {
  if (!rawUrl) return null;
  let value = String(rawUrl).trim();
  if (!value) return null;
  if (value.startsWith('#')) return null;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(value)) return null;
  try {
    const parsed = new URL(value, SITE.baseUrl);
    if (parsed.hostname.toLowerCase() !== new URL(SITE.baseUrl).hostname.toLowerCase()) return null;
    if (!/^[a-z0-9._~\/-]*$/i.test(parsed.pathname.replace(/^\//, ''))) return null;
    if (/\.(axd|aspx|ashx|css|js|jpg|jpeg|png|gif|webp|svg|ico|pdf|xml|json|woff2?|ttf|eot)$/i.test(parsed.pathname)) return null;
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
}

function extractLinks(html) {
  const links = new Set();
  const re = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const normalized = normalizePath(match[1]);
    if (normalized) links.add(normalized);
  }
  return [...links];
}

async function fetchPage(urlPath) {
  const url = new URL(urlPath === '/' ? '/' : urlPath, SITE.baseUrl).toString();
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const text = await res.text();
  const finalUrl = new URL(res.url);
  return {
    res,
    text,
    finalPath: finalUrl.pathname.replace(/\/+$/, '') || '/',
    finalHost: finalUrl.hostname.toLowerCase(),
  };
}

async function crawl() {
  const queue = ['/', '/home'];
  const seen = new Set();
  const discovered = new Set();
  const pages = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const current = queue.shift();
    const normalized = current === '' ? '/' : current;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let result;
    try {
      result = await fetchPage(normalized);
    } catch (err) {
      continue;
    }

    if (result.finalHost !== new URL(SITE.baseUrl).hostname.toLowerCase()) continue;
    if (result.res.status !== 200) continue;
    if (!/text\/html/i.test(result.res.headers.get('content-type') || '')) continue;

    const finalPath = result.finalPath;
    if (!discovered.has(finalPath)) {
      discovered.add(finalPath);
      pages.push(finalPath);
    }

    for (const link of extractLinks(result.text)) {
      if (!seen.has(link)) queue.push(link);
    }
  }

  const lines = [...new Set(pages)]
    .map((p) => p.replace(/^\//, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .sort();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`);
  console.log(`Wrote ${lines.length} URL(s) to ${path.relative(SITE.dataDir, OUTPUT_PATH)}`);
}

crawl().catch((err) => {
  console.error(err);
  process.exit(1);
});
