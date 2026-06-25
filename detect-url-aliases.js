const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const BASE = __dirname;
const BASE_URL = SITE.baseUrl || 'https://www.valmonttubing.com';
const URL_LIST_PATH = path.join(SITE.dataDir, 'cleanedurls.txt');
const OUTPUT_JSON = path.join(BASE, 'deploy', 'url-redirects.json');
const OUTPUT_NGINX = path.join(BASE, 'deploy', 'url-redirects.nginx.conf');
const OUTPUT_IIS = path.join(BASE, 'deploy', 'url-redirects.iis.xml');
const MANUAL_REDIRECTS_PATH = path.join(BASE, 'deploy', 'manual-redirects.json');

const SKIP_PATH_PREFIXES = [
  'sitefinity',
  'scripts/',
  'valmont2017/',
  'shared/',
  'api/',
  'global/',
];

const HREF_RE = /href=["'](\/[^"'#?]+)["']/gi;

function normalizePath(rawPath) {
  if (!rawPath) return '';
  let p = rawPath.trim().replace(/\\/g, '/');
  p = p.replace(/^https?:\/\/[^/]+\/?/i, '');
  p = p.replace(/^\//, '').replace(/\/+$/, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep original when malformed
  }
  return p.toLowerCase();
}

function isInternalPath(pathValue) {
  if (!pathValue) return false;
  if (!/^[a-z0-9._\-\/]+$/i.test(pathValue)) return false;
  if (pathValue.includes('..')) return false;
  if (/\.(axd|aspx|ashx|js|css|jpg|jpeg|png|gif|webp|svg|ico|pdf|xml|json|woff2?|ttf)$/i.test(pathValue)) {
    return false;
  }
  return !SKIP_PATH_PREFIXES.some(prefix => pathValue === prefix.replace(/\/$/, '') || pathValue.startsWith(prefix));
}

function loadKnownUrls() {
  return fs.readFileSync(URL_LIST_PATH, 'utf8')
    .split('\n')
    .map(line => normalizePath(line.trim()))
    .filter(Boolean);
}

function fetchWithRedirects(urlPath, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    const hops = [];

    const go = (pathValue, redirectsLeft) => {
      const normalized = normalizePath(pathValue);
      const url = `${BASE_URL}/${normalized}`;

      https.get(url, {
        timeout: 120000,
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
      }, (res) => {
        const hop = {
          path: normalized,
          status: res.statusCode,
          location: res.headers.location ? normalizePath(res.headers.location) : null,
        };
        hops.push(hop);

        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          go(hop.location, redirectsLeft - 1);
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            hops,
            finalPath: hops[hops.length - 1].path,
            finalStatus: hops[hops.length - 1].status,
            body,
            bodyHash: hashBody(body),
            bodyLength: body.length,
          });
        });
      }).on('error', reject);
    };

    go(urlPath, maxRedirects);
  });
}

function hashBody(html) {
  return crypto.createHash('sha256')
    .update(html.replace(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 16);
}

function extractInternalLinks(html) {
  const links = new Map();
  let match;

  while ((match = HREF_RE.exec(html)) !== null) {
    const normalized = normalizePath(match[1]);
    if (!isInternalPath(normalized)) continue;
    if (!links.has(normalized)) links.set(normalized, 0);
    links.set(normalized, links.get(normalized) + 1);
  }

  return links;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scanUrls(options = {}) {
  const delayMs = options.delayMs ?? 120;
  const knownUrls = loadKnownUrls();
  const knownSet = new Set(knownUrls);

  const linkSources = new Map();
  const pageResults = new Map();

  console.log(`Scanning ${knownUrls.length} known URL(s) from ${path.basename(URL_LIST_PATH)}...`);

  for (let i = 0; i < knownUrls.length; i++) {
    const urlPath = knownUrls[i];
    process.stdout.write(`\r  [${i + 1}/${knownUrls.length}] ${urlPath}`.padEnd(100));

    try {
      const result = await fetchWithRedirects(urlPath);
      pageResults.set(urlPath, result);

      for (const [linkedPath, count] of extractInternalLinks(result.body)) {
        if (!linkSources.has(linkedPath)) linkSources.set(linkedPath, new Set());
        linkSources.get(linkedPath).add(urlPath);
        linkSources.get(linkedPath).__count = (linkSources.get(linkedPath).__count || 0) + count;
      }
    } catch (err) {
      pageResults.set(urlPath, { error: err.message, hops: [{ path: urlPath, status: 0, location: null }] });
    }

    await sleep(delayMs);
  }

  console.log('\nProbing discovered internal links not in cleanedurls.txt...');

  const discovered = [...linkSources.keys()].filter(pathValue => !knownSet.has(pathValue));
  const probeResults = new Map();

  for (let i = 0; i < discovered.length; i++) {
    const urlPath = discovered[i];
    process.stdout.write(`\r  [${i + 1}/${discovered.length}] ${urlPath}`.padEnd(100));

    try {
      probeResults.set(urlPath, await fetchWithRedirects(urlPath));
    } catch (err) {
      probeResults.set(urlPath, { error: err.message, hops: [{ path: urlPath, status: 0, location: null }] });
    }

    await sleep(delayMs);
  }

  console.log('\nAnalyzing redirects and duplicate content...');

  const redirects = [];
  const redirectKeys = new Set();
  const brokenLinks = [];
  const externalLegacy = [];
  const softDuplicates = [];

  function addRedirect(from, to, meta) {
    const fromNorm = normalizePath(from);
    const toNorm = normalizePath(to);
    if (!fromNorm || !toNorm || fromNorm === toNorm) return;
    const key = `${fromNorm}=>${toNorm}`;
    if (redirectKeys.has(key)) return;
    redirectKeys.add(key);
    redirects.push({ from: fromNorm, to: toNorm, ...meta });
  }

  for (const [urlPath, result] of pageResults) {
    if (result.error) continue;
    if (result.hops.length > 1 || [301, 302, 307, 308].includes(result.hops[0]?.status)) {
      addRedirect(urlPath, result.finalPath, {
        type: 'redirect',
        status: result.hops[0].status,
        source: 'known-url',
      });
    }
  }

  for (const [urlPath, result] of probeResults) {
    const linkedFrom = [...(linkSources.get(urlPath) || [])];

    if (result.error) {
      brokenLinks.push({ path: urlPath, reason: result.error, linkedFrom });
      continue;
    }

    if (result.finalStatus === 404) {
      brokenLinks.push({ path: urlPath, reason: '404', linkedFrom });
      continue;
    }

    if (result.hops.length > 1 || [301, 302, 307, 308].includes(result.hops[0]?.status)) {
      addRedirect(urlPath, result.finalPath, {
        type: 'redirect',
        status: result.hops[0].status,
        source: 'discovered-link',
        linkedFrom,
      });
      continue;
    }

    if (result.finalStatus === 200 && !knownSet.has(urlPath)) {
      externalLegacy.push({
        path: urlPath,
        linkedFrom,
        bodyHash: result.bodyHash,
        bodyLength: result.bodyLength,
      });
    }
  }

  const hashToCanonical = new Map();
  for (const [urlPath, result] of pageResults) {
    if (result.error || result.finalStatus !== 200) continue;
    if (!hashToCanonical.has(result.bodyHash)) {
      hashToCanonical.set(result.bodyHash, urlPath);
      continue;
    }

    const canonical = hashToCanonical.get(result.bodyHash);
    if (canonical !== urlPath) {
      softDuplicates.push({
        from: urlPath,
        to: canonical,
        bodyHash: result.bodyHash,
      });
      addRedirect(urlPath, canonical, {
        type: 'duplicate-content',
        status: 200,
        source: 'body-hash',
      });
    }
  }

  redirects.sort((a, b) => a.from.localeCompare(b.from));

  return {
    scannedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    knownUrlCount: knownUrls.length,
    discoveredLinkCount: discovered.length,
    redirects,
    brokenLinks: brokenLinks.sort((a, b) => a.path.localeCompare(b.path)),
    unmappedLivePages: externalLegacy.sort((a, b) => a.path.localeCompare(b.path)),
    softDuplicates,
  };
}

function nginxRewriteLine(from, to) {
  const fromPattern = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const target = to.startsWith('/') ? to : `/${to}`;
  return `    rewrite ^/${fromPattern}/?$ ${target} permanent;`;
}

function generateNginxRedirects(redirects) {
  const lines = [
    '# Auto-generated by detect-url-aliases.js — legacy URL redirects',
    '# Include from deploy/nginx.conf inside the server block, before location /',
    '',
  ];

  for (const entry of redirects) {
    lines.push(`    # ${entry.source}${entry.linkedFrom?.length ? ` (linked from ${entry.linkedFrom.slice(0, 2).join(', ')})` : ''}`);
    lines.push(nginxRewriteLine(entry.from, entry.to));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function generateIisRedirects(redirects) {
  const lines = [
    '        <!-- Auto-generated by detect-url-aliases.js -->',
  ];

  for (const entry of redirects) {
    const fromPattern = entry.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const target = entry.to.startsWith('/') ? entry.to : `/${entry.to}`;
    lines.push(`        <rule name="Redirect alias ${entry.from}" stopProcessing="true">`);
    lines.push(`          <match url="^${fromPattern}/?$" ignoreCase="true" />`);
    lines.push(`          <action type="Redirect" url="${target}" redirectType="Permanent" />`);
    lines.push('        </rule>');
  }

  return `${lines.join('\n')}\n`;
}

function printReport(report) {
  console.log('URL alias scan');
  console.log('==============');
  console.log(`Known URLs scanned: ${report.knownUrlCount}`);
  console.log(`Discovered internal links probed: ${report.discoveredLinkCount}`);
  console.log('');

  console.log(`Redirects to add (${report.redirects.length}):`);
  if (report.redirects.length === 0) {
    console.log('  (none)');
  } else {
    for (const entry of report.redirects) {
      const extra = entry.linkedFrom?.length ? ` ← linked from ${entry.linkedFrom.slice(0, 2).join(', ')}` : '';
      console.log(`  /${entry.from}  →  /${entry.to}  [${entry.type}, HTTP ${entry.status}]${extra}`);
    }
  }
  console.log('');

  console.log(`Broken links (${report.brokenLinks.length}):`);
  if (report.brokenLinks.length === 0) {
    console.log('  (none)');
  } else {
    for (const entry of report.brokenLinks) {
      console.log(`  /${entry.path}  (${entry.reason})`);
    }
  }
  console.log('');

  console.log(`Live 200 pages not in cleanedurls.txt (${report.unmappedLivePages.length}):`);
  if (report.unmappedLivePages.length === 0) {
    console.log('  (none)');
  } else {
    for (const entry of report.unmappedLivePages) {
      console.log(`  /${entry.path}`);
    }
  }
  console.log('');
}

function loadManualRedirects() {
  if (!fs.existsSync(MANUAL_REDIRECTS_PATH)) {
    return { overrides: {}, additional: [] };
  }

  const data = JSON.parse(fs.readFileSync(MANUAL_REDIRECTS_PATH, 'utf8'));
  return {
    overrides: data.overrides || {},
    additional: data.additional || [],
  };
}

function applyManualRedirects(report) {
  const manual = loadManualRedirects();
  const byFrom = new Map(report.redirects.map(entry => [entry.from, entry]));

  for (const [from, to] of Object.entries(manual.overrides)) {
    const fromNorm = normalizePath(from);
    const toNorm = normalizePath(to);
    const existing = byFrom.get(fromNorm);
    if (existing) {
      existing.to = toNorm;
      existing.type = 'redirect';
      existing.source = 'manual-override';
    } else {
      const entry = {
        from: fromNorm,
        to: toNorm,
        type: 'redirect',
        status: 301,
        source: 'manual-override',
      };
      byFrom.set(fromNorm, entry);
    }
  }

  for (const entry of manual.additional) {
    const fromNorm = normalizePath(entry.from);
    const toNorm = normalizePath(entry.to);
    if (fromNorm === toNorm) continue;
    byFrom.set(fromNorm, {
      from: fromNorm,
      to: toNorm,
      type: 'redirect',
      status: 301,
      source: 'manual-addition',
      note: entry.note || null,
    });
  }

  report.redirects = [...byFrom.values()].sort((a, b) => a.from.localeCompare(b.from));
  return report;
}

function mergeNginxInclude() {
  const nginxPath = path.join(BASE, 'deploy', 'nginx.conf');
  const includeLine = '    include url-redirects.nginx.conf;';
  let content = fs.readFileSync(nginxPath, 'utf8');

  if (!content.includes(includeLine)) {
    content = content.replace(
      /(\n    index home\.html;\n\n)/,
      `$1${includeLine}\n`,
    );
  }

  fs.writeFileSync(nginxPath, content);
}

function applyReport(report) {
  const merged = applyManualRedirects({ ...report, redirects: [...report.redirects] });
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(merged, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_NGINX, generateNginxRedirects(merged.redirects));
  fs.writeFileSync(OUTPUT_IIS, generateIisRedirects(merged.redirects));

  mergeNginxInclude();
  mergeIisRules();

  console.log(`Wrote ${path.relative(BASE, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(BASE, OUTPUT_NGINX)}`);
  console.log(`Wrote ${path.relative(BASE, OUTPUT_IIS)}`);
  console.log('Updated deploy/nginx.conf and web.config with generated redirect rules.');
}

function mergeIisRules() {
  const webConfigPath = path.join(BASE, 'web.config');
  const iisRules = fs.readFileSync(OUTPUT_IIS, 'utf8').trim();
  let content = fs.readFileSync(webConfigPath, 'utf8');
  const beginMarker = '<!-- BEGIN url-redirects -->';
  const endMarker = '<!-- END url-redirects -->';
  const block = `${beginMarker}\n${iisRules}\n        ${endMarker}`;

  if (content.includes(beginMarker)) {
    content = content.replace(
      new RegExp(`${beginMarker}[\\s\\S]*?${endMarker}`),
      block,
    );
  } else {
    content = content.replace(
      /<rules>\s*\n/,
      `<rules>\n${block}\n`,
    );
  }

  fs.writeFileSync(webConfigPath, content);
}

async function main() {
  const mode = process.argv[2] || 'scan';

  if (mode === 'apply-config') {
    const report = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    console.log('Re-applying redirect configs from deploy/url-redirects.json + manual overrides...\n');
    applyReport(report);
    printReport(applyManualRedirects({ ...report, redirects: [...report.redirects] }));
    return;
  }

  const report = await scanUrls();
  printReport(report);

  if (mode === 'apply') {
    console.log('Writing redirect configs...\n');
    applyReport(report);
  } else {
    console.log('Run "node detect-url-aliases.js apply" to write redirect configs.');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  scanUrls,
  generateNginxRedirects,
  generateIisRedirects,
  applyManualRedirects,
  applyReport,
  normalizePath,
};
