const fs = require('fs');
const https = require('https');
const path = require('path');
const { stripDuplicateFooterSec2 } = require('./strip-duplicate-footer-sec-2.js');
const { ResourceConverter } = require('./resource-converter.js');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const BASE = SITE.publicDir;
const SHARED_DIR = path.join(BASE, 'shared');
const BASE_URL = SITE.baseUrl || 'https://www.valmonttubing.com';
const SHELL_URL_PATH = 'home';
const SHELL_MODE = SITE.shellMode || 'legacy-div';
const SHELL_HEAD_CACHE = path.join(SITE.dataDir, '.shell-head-inner.html');
const SHELL_HEADER_INNER_CACHE = path.join(SITE.dataDir, '.shell-header-inner.html');
const HEADER_DIV_TAG = '<div class="header" id="header">';
const resourceConverter = new ResourceConverter(SITE);
const urls = fs.readFileSync(path.join(SITE.dataDir, 'cleanedurls.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(l => l);
const SEARCH_CLIENT_SCRIPT = '<script src="/api/search/client.js"></script>';
const SEARCH_WIDGET_ID_RE = /^cph(?:Fa)?Search_/i;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      timeout: 120000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(fetch(nextUrl));
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          const err = new Error(`HTTP ${res.statusCode} for ${url}`);
          err.statusCode = res.statusCode;
          err.body = data;
          reject(err);
        });
        return;
      }

      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function maskScriptsAndStyles(html) {
  const blocks = [];
  const masked = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const token = `<!--__BLOCK_${blocks.length}__-->`;
    blocks.push(match);
    return token;
  });
  return { masked, blocks };
}

function unmaskScriptsAndStyles(html, blocks) {
  return html.replace(/<!--__BLOCK_(\d+)__-->/g, (_, index) => blocks[Number(index)] ?? '');
}

function findDivEnd(html, openIndex, openTagLength) {
  let depth = 1;
  let pos = openIndex + openTagLength;
  const openRe = /<div\b[^>]*>/gi;
  const closeRe = /<\/div>/gi;

  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;

    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);

    if (!nextClose) return -1;

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      pos = nextClose.index + 6;
    }
  }

  return pos;
}

function findTagBounds(html, tagName, startIndex = 0) {
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'ig');
  const closeRe = new RegExp(`</${tagName}>`, 'ig');
  const openMatch = openRe.exec(html.slice(startIndex));
  if (!openMatch) return null;

  const openIndex = startIndex + openMatch.index;
  const openTag = openMatch[0];
  const closeIndex = html.toLowerCase().indexOf(`</${tagName}>`, openIndex + openTag.length);
  if (closeIndex === -1) return null;

  return {
    openIndex,
    openTag,
    closeIndex,
    endIndex: closeIndex + tagName.length + 3,
  };
}

function extractHeadInner(rawHtml) {
  const match = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return match ? match[1] : '';
}

function extractHeadAssets(headInner) {
  const tags = [];
  const re = /<link\b[^>]*\/?>|<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let match;
  while ((match = re.exec(headInner)) !== null) {
    tags.push(match[0]);
  }
  return tags;
}

function normalizeHeadTag(tag) {
  return tag.replace(/\s+/g, ' ').replace(/\s*\/>/g, '>').trim();
}

function diffHeadExtras(pageHeadInner, shellHeadInner) {
  if (!shellHeadInner) return extractHeadAssets(pageHeadInner).join('\n');

  const shellTags = new Set(
    extractHeadAssets(shellHeadInner).map(normalizeHeadTag)
  );

  return extractHeadAssets(pageHeadInner)
    .filter(tag => !shellTags.has(normalizeHeadTag(tag)))
    .join('\n');
}

function extractHeaderDivInner(masked, blocks) {
  const headerOpen = masked.indexOf(HEADER_DIV_TAG);
  if (headerOpen === -1) return '';

  const headerEnd = findDivEnd(masked, headerOpen, HEADER_DIV_TAG.length);
  if (headerEnd === -1) return '';

  const inner = masked.slice(headerOpen + HEADER_DIV_TAG.length, headerEnd - 6);
  return unmaskScriptsAndStyles(inner.trim(), blocks);
}

function extractSfContentBlocks(html) {
  const blocks = [];
  const marker = /<div class=['"]sfContentBlock['"]>/gi;
  let match;

  while ((match = marker.exec(html)) !== null) {
    const start = match.index;
    const end = findDivEnd(html, start, match[0].length);
    if (end === -1) break;
    blocks.push(html.slice(start, end));
  }

  return blocks;
}

function normalizeBlock(block) {
  return block.replace(/\s+/g, ' ').trim();
}

function diffHeaderInnerExtras(pageHeaderInner, shellHeaderInner) {
  if (!shellHeaderInner || !pageHeaderInner) return '';

  const shellBlocks = new Set(
    extractSfContentBlocks(shellHeaderInner).map(normalizeBlock)
  );

  return extractSfContentBlocks(pageHeaderInner)
    .filter(block => !shellBlocks.has(normalizeBlock(block)))
    .join('\n');
}

function extractSemanticShell(rawHtml) {
  const docStart = rawHtml.search(/<!DOCTYPE\s+html>/i);
  if (docStart === -1) return null;

  const headerBounds = findTagBounds(rawHtml, 'header', docStart);
  const footerBounds = findTagBounds(rawHtml, 'footer', headerBounds ? headerBounds.endIndex : docStart);
  if (!headerBounds || !footerBounds || headerBounds.endIndex >= footerBounds.openIndex) {
    return null;
  }

  const header = rawHtml.slice(docStart, headerBounds.endIndex).trimStart();
  const body = rawHtml.slice(headerBounds.endIndex, footerBounds.openIndex).trim();
  const footer = rawHtml.slice(footerBounds.openIndex).trim();
  const pageTail = rawHtml.slice(footerBounds.endIndex).trim();

  return { header, body, footer, pageTail };
}

function buildSemanticPageOutput(parts) {
  const sections = ['<!--#include virtual="/shared/header.html" -->'];
  if (parts.pageHeadExtras?.trim()) {
    sections.push(parts.pageHeadExtras.trim());
  }
  if (parts.body.trim()) {
    sections.push(stripDuplicateFooterSec2(parts.body, { requireFooterInclude: false }).html);
  }
  sections.push('<!--#include virtual="/shared/footer.html" -->');
  if (parts.pageTail?.trim()) {
    sections.push(parts.pageTail.trim());
  }
  return processHtml(sections.join('\n') + '\n');
}

function normalizeCmtHeader(html) {
  let result = html;
  result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${SITE.siteName}</title>`);
  result = result.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${SITE.siteName}" />`
  );
  result = result.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${SITE.siteName}" />`
  );
  result = result.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${SITE.siteName}" />`
  );
  result = result.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="keywords" content="${SITE.siteName}" />`
  );
  return result;
}

function injectSearchClient(html) {
  if (!SITE.search || html.includes(SEARCH_CLIENT_SCRIPT)) return html;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${SEARCH_CLIENT_SCRIPT}\n</body>`);
  }

  return `${html}\n${SEARCH_CLIENT_SCRIPT}\n`;
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildStaticSearchWidget(widgetId) {
  const safeId = escapeAttr(widgetId);
  const inputId = `${safeId}_searchTextBox`;
  const buttonId = `${safeId}_searchButton`;
  const mainId = `${safeId}_main`;

  return [
    `<fieldset id="${mainId}" class="sfsearchBox static-search-box" data-static-search-box="true">`,
    `    <input name="${escapeAttr(SITE.search.queryParam || 'searchQuery')}" type="text" id="${inputId}" class="sfsearchTxt" autocomplete="off" />`,
    `    <input type="button" value="Search" id="${buttonId}" class="sfsearchSubmit" />`,
    '</fieldset>',
  ].join('\n');
}

function replaceSearchWidgetDivs(html) {
  let result = '';
  let cursor = 0;
  const openDivRe = /<div\b[^>]*\bid\s*=\s*(["'])(cph(?:Fa)?Search_[^"']+)\1[^>]*>/gi;
  let match;

  while ((match = openDivRe.exec(html)) !== null) {
    const widgetId = match[2];
    if (!SEARCH_WIDGET_ID_RE.test(widgetId)) continue;

    const end = findDivEnd(html, match.index, match[0].length);
    if (end === -1) continue;

    result += html.slice(cursor, match.index);
    result += `${match[0]}\n${buildStaticSearchWidget(widgetId)}\n</div>`;
    cursor = end;
    openDivRe.lastIndex = end;
  }

  return result + html.slice(cursor);
}

function stripSitefinitySearchInitializers(html) {
  return html.replace(
    /\s*\$create\(Telerik\.Sitefinity\.Services\.Search\.Web\.UI\.Public\.SearchBox,[\s\S]*?\$get\(["']cph(?:Fa)?Search_[^"']+["']\)\);\s*/g,
    '\n'
  );
}

function normalizeStaticSearch(html) {
  if (!SITE.search) return html;
  return stripSitefinitySearchInitializers(replaceSearchWidgetDivs(html));
}

function extractParts(rawHtml, shellHeadInner = null, shellHeaderInner = null) {
  const { masked, blocks } = maskScriptsAndStyles(rawHtml);

  const docStart = masked.search(/<!DOCTYPE\s+html>/i);
  if (docStart === -1) return null;

  const headerOpen = masked.indexOf(HEADER_DIV_TAG);
  if (headerOpen === -1) return null;

  const headerEnd = findDivEnd(masked, headerOpen, HEADER_DIV_TAG.length);
  if (headerEnd === -1) return null;

  const footerMatch = masked.match(/<div\s+class="footer"[^>]*>/);
  if (!footerMatch) return null;

  const footerStart = footerMatch.index;
  if (headerEnd >= footerStart) return null;

  const footerEnd = findDivEnd(masked, footerStart, footerMatch[0].length);
  const formCloseIdx = masked.lastIndexOf('</form>');
  const pageTailEnd = formCloseIdx > footerEnd ? formCloseIdx : masked.length;

  const header = unmaskScriptsAndStyles(masked.slice(docStart, headerEnd).trimStart(), blocks);
  const body = unmaskScriptsAndStyles(masked.slice(headerEnd, footerStart).trim(), blocks);
  const footer = unmaskScriptsAndStyles(masked.slice(footerStart).trim(), blocks);
  const pageTail = footerEnd === -1
    ? ''
    : unmaskScriptsAndStyles(masked.slice(footerEnd, pageTailEnd).trim(), blocks);
  const pageHeadInner = unmaskScriptsAndStyles(extractHeadInner(rawHtml), blocks);
  const pageHeadExtras = diffHeadExtras(pageHeadInner, shellHeadInner);
  const pageHeaderInner = extractHeaderDivInner(masked, blocks);
  const pageHeaderExtras = diffHeaderInnerExtras(pageHeaderInner, shellHeaderInner);

  return { header, body, footer, pageTail, pageHeadExtras, pageHeaderExtras };
}

function loadShellCache() {
  return {
    headInner: fs.existsSync(SHELL_HEAD_CACHE)
      ? fs.readFileSync(SHELL_HEAD_CACHE, 'utf8')
      : '',
    headerInner: fs.existsSync(SHELL_HEADER_INNER_CACHE)
      ? fs.readFileSync(SHELL_HEADER_INNER_CACHE, 'utf8')
      : '',
  };
}

function saveShellCache(rawHtml, masked, blocks) {
  const headInner = extractHeadInner(rawHtml);
  const headerInner = extractHeaderDivInner(masked, blocks);

  fs.writeFileSync(SHELL_HEAD_CACHE, headInner);
  fs.writeFileSync(SHELL_HEADER_INNER_CACHE, headerInner);

  return { headInner, headerInner };
}

function buildPageOutput(urlPath, parts) {
  const sections = ['<!--#include virtual="/shared/header.html" -->'];

  if (parts.pageHeadExtras.trim()) {
    sections.push(parts.pageHeadExtras.trim());
  }

  if (parts.pageHeaderExtras.trim()) {
    sections.push(parts.pageHeaderExtras.trim());
  }

  sections.push(stripDuplicateFooterSec2(parts.body, { requireFooterInclude: false }).html);

  if (parts.pageTail.trim() && urlPath !== SHELL_URL_PATH) {
    sections.push(parts.pageTail.trim());
  }

  sections.push('<!--#include virtual="/shared/footer.html" -->');
  return processHtml(sections.join('\n') + '\n');
}

async function fetchHtml(urlPath) {
  const fullUrl = urlPath ? `${BASE_URL}/${urlPath}` : BASE_URL;
  return fetch(fullUrl);
}

async function writeShell() {
  if (SHELL_MODE === 'semantic-header-footer') {
    console.log(`Fetching shell from ${BASE_URL}/${SHELL_URL_PATH} ...`);
    const html = await fetchHtml(SHELL_URL_PATH);
    const convertedHtml = await resourceConverter.convertHtml(html, `${BASE_URL}/${SHELL_URL_PATH}`);
    const shell = extractSemanticShell(convertedHtml);
    if (!shell) {
      console.log('  No reusable shell detected; falling back to full-page copies.');
      return null;
    }

    fs.mkdirSync(SHARED_DIR, { recursive: true });
    const headerHtml = normalizeStaticSearch(await resourceConverter.convertHtml(normalizeCmtHeader(shell.header), `${BASE_URL}/${SHELL_URL_PATH}`));
    fs.writeFileSync(path.join(SHARED_DIR, 'header.html'), headerHtml + '\n');
    const footerHtml = injectSearchClient(normalizeStaticSearch(await resourceConverter.convertHtml(shell.footer, `${BASE_URL}/${SHELL_URL_PATH}`)));
    fs.writeFileSync(path.join(SHARED_DIR, 'footer.html'), footerHtml + '\n');
    fs.writeFileSync(SHELL_HEAD_CACHE, extractHeadInner(convertedHtml));

    console.log(`  shared/header.html (${shell.header.length} chars)`);
    console.log(`  shared/footer.html (${shell.footer.length} chars)`);

    return { semantic: true, headInner: extractHeadInner(convertedHtml) };
  }

  console.log(`Fetching shell from ${BASE_URL}/${SHELL_URL_PATH} ...`);
  const html = await fetchHtml(SHELL_URL_PATH);
  const convertedHtml = await resourceConverter.convertHtml(html, `${BASE_URL}/${SHELL_URL_PATH}`);
  const { masked, blocks } = maskScriptsAndStyles(convertedHtml);
  const shellCache = saveShellCache(convertedHtml, masked, blocks);
  const parts = extractParts(convertedHtml, shellCache.headInner, shellCache.headerInner);

  if (!parts) {
    console.log('  No reusable shell detected; falling back to full-page copies.');
    return null;
  }

  fs.mkdirSync(SHARED_DIR, { recursive: true });
  const headerHtml = normalizeStaticSearch(await resourceConverter.convertHtml(parts.header, `${BASE_URL}/${SHELL_URL_PATH}`));
  fs.writeFileSync(path.join(SHARED_DIR, 'header.html'), headerHtml + '\n');
  const footerHtml = injectSearchClient(normalizeStaticSearch(await resourceConverter.convertHtml(parts.footer, `${BASE_URL}/${SHELL_URL_PATH}`)));
  fs.writeFileSync(path.join(SHARED_DIR, 'footer.html'), footerHtml + '\n');

  console.log(`  shared/header.html (${parts.header.length} chars)`);
  console.log(`  shared/footer.html (${parts.footer.length} chars)`);
  console.log(`  shell head cache (${shellCache.headInner.length} chars)`);
  console.log(`  shell header-inner cache (${shellCache.headerInner.length} chars)`);

  return shellCache;
}

async function processPage(urlPath, shellCache) {
  const fullUrl = `${BASE_URL}/${urlPath}`;
  console.log(`  Fetching: ${fullUrl}`);

  let html;
  try {
    html = await fetch(fullUrl);
  } catch (e) {
    console.error(`  SKIP: ${fullUrl} - ${e.message}`);
    return;
  }

  const convertedHtml = await resourceConverter.convertHtml(html, fullUrl);
  const fileParts = urlPath.split('/');
  const fileName = fileParts.pop() + '.html';
  const dirPath = path.join(BASE, ...fileParts);
  const filePath = path.join(dirPath, fileName);
  const output = injectSearchClient(normalizeStaticSearch(convertedHtml));

  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, output);
  console.log(`  Written: ${filePath} (full page copy)`);
}

async function main() {
  const mode = process.argv[2] || 'all';
  const singlePage = process.argv[3];

  if (mode === 'shell') {
    await writeShell();
    console.log('\nDone!');
    return;
  }

  if (mode === 'page') {
    if (!singlePage) {
      console.error('Usage: node fetch-pages.js page <url-path>');
      process.exit(1);
    }
    let shellCache = loadShellCache();
    if (!shellCache.headInner || !shellCache.headerInner) {
      shellCache = await writeShell();
    }
    await processPage(singlePage, shellCache);
    console.log('\nDone!');
    return;
  }

  let shellCache = loadShellCache();

  if (mode === 'all') {
    shellCache = await writeShell();
    console.log('');
  } else if (!shellCache.headInner || !shellCache.headerInner) {
    console.log('No shell cache found; fetching shell first...\n');
    shellCache = await writeShell();
    console.log('');
  }

  const pageList = mode === 'pages' ? urls : urls;

  let i = 0;
  for (const urlPath of pageList) {
    i++;
    console.log(`[${i}/${pageList.length}] ${urlPath}`);
    await processPage(urlPath, shellCache);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
