const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEARCH_INDEXES_PATH = path.join(ROOT, 'search-indexes.txt');
const DEFAULT_API_VERSION = '2024-07-01';
const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig;
const routeMapCache = new Map();

function parsePositiveInt(value, defaultValue, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, maxValue);
}

function loadSearchIndexes(filePath = SEARCH_INDEXES_PATH) {
  if (!fs.existsSync(filePath)) return new Set();

  const names = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.split('|')[0]?.trim())
    .filter(Boolean);

  return new Set(names);
}

function getSearchConfig(site) {
  const config = site.search || {};
  if (!config.index) {
    throw new Error(`Search index is not configured for site "${site.slug}"`);
  }

  return {
    index: config.index,
    resultsPath: config.resultsPath || '/search/search-results',
    queryParam: config.queryParam || 'searchQuery',
    pageSize: parsePositiveInt(config.pageSize, 10, 50),
    titleFields: config.titleFields || ['Title', 'title', 'PageTitle', 'pageTitle', 'Name', 'name'],
    urlFields: config.urlFields || ['Link', 'link', 'Url', 'url', 'PageUrl', 'pageUrl'],
    contentFields: config.contentFields || ['Content', 'content', 'Description', 'description', 'Summary', 'summary'],
    guidFields: config.guidFields || ['OriginalItemId', 'Id', 'IdentityField', 'Link', 'link'],
    highlightFields: config.highlightFields || [],
  };
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('AZURE_SEARCH_BASE_URL is not configured');
  }
  return baseUrl;
}

function firstField(doc, fields) {
  for (const field of fields) {
    const value = doc[field];
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function firstHighlight(doc, fields) {
  const highlights = doc['@search.highlights'] || {};
  for (const field of fields) {
    const value = highlights[field];
    if (Array.isArray(value) && value.length) {
      return value.join(' ... ');
    }
  }
  return '';
}

function normalizeUrl(value) {
  if (!value) return '#';
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('/')) return value;
  return `/${value.replace(/^\/+/, '')}`;
}

function normalizeRoute(value) {
  if (!value) return '';
  const route = String(value)
    .trim()
    .replace(/^~\//, '/')
    .replace(/^\/+/, '/');

  if (!route || route === '/home') return '/';
  return route.startsWith('/') ? route : `/${route}`;
}

function isUsableSearchUrl(value) {
  if (!value) return false;
  if (/^\[[^\]]+\]/.test(value)) return false;
  if (/sitefinity/i.test(value)) return false;
  return /^(?:https?:)?\/\//i.test(value)
    || value.startsWith('/')
    || /^[a-z0-9][a-z0-9/_-]*(?:\.[a-z0-9]+)?$/i.test(value);
}

function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function routeForHtmlFile(site, file) {
  const relative = path.relative(site.publicDir, file).replace(/\\/g, '/');
  const withoutExtension = relative.replace(/\.html$/i, '');
  if (!withoutExtension || withoutExtension === 'home' || withoutExtension === 'index') return '/';
  return normalizeRoute(withoutExtension);
}

function addRouteMapping(map, guid, route) {
  const normalizedGuid = String(guid || '').toLowerCase();
  const normalizedRoute = normalizeRoute(route);
  if (!normalizedGuid || !normalizedRoute || map.has(normalizedGuid)) return;
  map.set(normalizedGuid, normalizedRoute);
}

function addPageSelfMappings(map, html, route) {
  const pageSiteNodeRe = /pageSiteNode=([0-9a-f-]{36})/ig;
  let match;
  while ((match = pageSiteNodeRe.exec(html)) !== null) {
    addRouteMapping(map, match[1], route);
  }
}

function buildGuidRouteMap(site) {
  const cacheKey = `${site.slug}:${site.publicDir}`;
  const cached = routeMapCache.get(cacheKey);
  if (cached) return cached;

  const map = new Map();

  for (const file of walkHtmlFiles(site.publicDir)) {
    const html = fs.readFileSync(file, 'utf8');
    addPageSelfMappings(map, html, routeForHtmlFile(site, file));
    for (const items of extractRadMenuItemData(html)) {
      addMenuItems(map, items);
    }
  }

  routeMapCache.set(cacheKey, map);
  return map;
}

function findMatchingBracket(text, openIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractRadMenuItemData(html) {
  const arrays = [];
  const marker = '"itemData":';
  let offset = 0;

  while (offset < html.length) {
    const markerIndex = html.indexOf(marker, offset);
    if (markerIndex === -1) break;

    const openIndex = html.indexOf('[', markerIndex + marker.length);
    if (openIndex === -1) break;

    const closeIndex = findMatchingBracket(html, openIndex);
    if (closeIndex === -1) {
      offset = openIndex + 1;
      continue;
    }

    try {
      const parsed = JSON.parse(html.slice(openIndex, closeIndex + 1));
      if (Array.isArray(parsed)) arrays.push(parsed);
    } catch (_) {
      // Some legacy pages have script fragments that look like RadMenu data but are not parseable.
    }

    offset = closeIndex + 1;
  }

  return arrays;
}

function addMenuItems(map, items) {
  for (const item of items || []) {
    const guid = item?.attributes?.['Sitefinity.PageGUID'];
    if (guid && item.navigateUrl) {
      addRouteMapping(map, guid, item.navigateUrl);
    }
    if (Array.isArray(item?.items)) {
      addMenuItems(map, item.items);
    }
  }
}

function extractGuids(value) {
  if (!value) return [];
  return [...String(value).matchAll(GUID_RE)].map((match) => match[0].toLowerCase());
}

function resolveResultUrl(doc, config, site) {
  const rawUrl = firstField(doc, config.urlFields);
  if (isUsableSearchUrl(rawUrl)) {
    return normalizeUrl(rawUrl);
  }

  const routeMap = buildGuidRouteMap(site);
  const candidateValues = [
    ...config.guidFields.map((field) => doc[field]),
    ...config.urlFields.map((field) => doc[field]),
  ];

  for (const value of candidateValues) {
    for (const guid of extractGuids(value)) {
      const route = routeMap.get(guid);
      if (route) return route;
    }
  }

  return '#';
}

function normalizeResult(doc, config, site) {
  const title = firstHighlight(doc, config.titleFields)
    || firstField(doc, config.titleFields)
    || firstField(doc, config.urlFields)
    || 'Search result';

  const snippet = firstHighlight(doc, config.contentFields)
    || firstField(doc, config.contentFields);

  return {
    title,
    url: resolveResultUrl(doc, config, site),
    snippet,
    score: doc['@search.score'] || null,
  };
}

function dedupeResults(results) {
  const seen = new Set();
  const deduped = [];

  for (const result of results) {
    const key = `${result.url}|${result.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

function buildAzurePayload(query, page, pageSize, config) {
  const skip = (page - 1) * pageSize;
  const payload = {
    search: query || '*',
    count: true,
    top: pageSize,
    skip,
  };

  if (config.highlightFields.length) {
    payload.highlight = [...new Set(config.highlightFields)].join(',');
    payload.highlightPreTag = '<strong>';
    payload.highlightPostTag = '</strong>';
  }

  return payload;
}

async function queryAzureSearch({ query, page, pageSize, site, env }) {
  const config = getSearchConfig(site);
  const indexes = loadSearchIndexes();
  if (indexes.size && !indexes.has(config.index)) {
    throw new Error(`Configured search index "${config.index}" was not found in search-indexes.txt`);
  }

  const baseUrl = normalizeBaseUrl(env.AZURE_SEARCH_BASE_URL);
  const apiKey = String(env.AZURE_SEARCH_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('AZURE_SEARCH_API_KEY is not configured');
  }

  const apiVersion = env.AZURE_SEARCH_API_VERSION || DEFAULT_API_VERSION;
  const url = `${baseUrl}/indexes/${encodeURIComponent(config.index)}/docs/search?api-version=${encodeURIComponent(apiVersion)}`;
  const effectivePageSize = parsePositiveInt(pageSize, config.pageSize, 50);
  const effectivePage = parsePositiveInt(page, 1, 1000);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildAzurePayload(query, effectivePage, effectivePageSize, config)),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Azure Search returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const docs = Array.isArray(data.value) ? data.value : [];

  return {
    query,
    page: effectivePage,
    pageSize: effectivePageSize,
    count: data['@odata.count'] || docs.length,
    resultsPath: config.resultsPath,
    queryParam: config.queryParam,
    results: dedupeResults(docs.map((doc) => normalizeResult(doc, config, site))),
  };
}

module.exports = {
  getSearchConfig,
  queryAzureSearch,
};
