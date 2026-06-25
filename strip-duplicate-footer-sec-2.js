const fs = require('fs');
const path = require('path');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const BASE = SITE.publicDir;
const SHARED_DIR = path.join(BASE, 'shared');
const FOOTER_INCLUDE = '<!--#include virtual="/shared/footer.html" -->';
const FOOTER_SEC_2_OPEN_RE = /<div\s+class="footer-sec-2"\s+id="footersec2">/i;

const SKIP_DIRS = new Set(['shared']);

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

function isInsideScriptOrStyle(html, index) {
  const before = html.slice(0, index);
  return (
    before.lastIndexOf('<script') > before.lastIndexOf('</script>') ||
    before.lastIndexOf('<style') > before.lastIndexOf('</style>')
  );
}

function lineNumberAt(html, index) {
  return html.slice(0, index).split('\n').length;
}

function listPageHtmlFiles(dir = BASE) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listPageHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function findFooterSec2Occurrences(html) {
  const openTagRe = new RegExp(FOOTER_SEC_2_OPEN_RE.source, 'gi');
  const occurrences = [];
  let match;

  while ((match = openTagRe.exec(html)) !== null) {
    const start = match.index;
    if (isInsideScriptOrStyle(html, start)) continue;

    const end = findDivEnd(html, start, match[0].length);
    if (end === -1) continue;

    occurrences.push({
      start,
      end,
      line: lineNumberAt(html, start),
      length: end - start,
    });
  }

  return occurrences;
}

function shouldStripFromPage(html, { requireFooterInclude = true } = {}) {
  if (!requireFooterInclude) return true;
  return html.includes(FOOTER_INCLUDE);
}

function stripDuplicateFooterSec2(html, options = {}) {
  if (!shouldStripFromPage(html, options)) {
    return { html, changed: false, removed: 0 };
  }

  const occurrences = findFooterSec2Occurrences(html);
  if (occurrences.length === 0) {
    return { html, changed: false, removed: 0 };
  }

  let result = html;
  for (const occurrence of [...occurrences].reverse()) {
    result = result.slice(0, occurrence.start) + result.slice(occurrence.end);
  }

  result = result.replace(/\n{3,}/g, '\n\n');

  return { html: result, changed: true, removed: occurrences.length };
}

function scanPages(files = listPageHtmlFiles()) {
  const hits = [];

  for (const filePath of files) {
    const relPath = path.relative(BASE, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf8');

    if (!shouldStripFromPage(html)) continue;

    const occurrences = findFooterSec2Occurrences(html);
    for (const occurrence of occurrences) {
      hits.push({
        file: relPath,
        line: occurrence.line,
        length: occurrence.length,
      });
    }
  }

  return { filesScanned: files.length, hits };
}

function applyCleanup(files = listPageHtmlFiles()) {
  let updatedFiles = 0;
  let removedBlocks = 0;
  const updated = [];

  for (const filePath of files) {
    const relPath = path.relative(BASE, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf8');
    const { html: nextHtml, changed, removed } = stripDuplicateFooterSec2(html);
    if (!changed) continue;

    fs.writeFileSync(filePath, nextHtml);
    updatedFiles++;
    removedBlocks += removed;
    updated.push({ file: relPath, removed });
  }

  return { updatedFiles, removedBlocks, updated };
}

function main() {
  const mode = process.argv[2] || 'scan';

  if (mode === 'scan') {
    const scan = scanPages();
    console.log('Duplicate footer-sec-2 scan');
    console.log('===========================');
    console.log(`Pages scanned: ${scan.filesScanned}`);
    console.log('');
    console.log('Inline footer-sec-2 blocks to remove (already in shared/footer.html):');
    if (scan.hits.length === 0) {
      console.log('  (none)');
    } else {
      for (const hit of scan.hits) {
        console.log(`  ${hit.file}:${hit.line} (${hit.length} chars)`);
      }
      console.log('');
      console.log(`Total: ${scan.hits.length} inline block(s) in ${new Set(scan.hits.map(h => h.file)).size} file(s)`);
      console.log('Run "node strip-duplicate-footer-sec-2.js apply" to remove them.');
    }
    return;
  }

  if (mode === 'apply') {
    console.log('Removing duplicate inline footer-sec-2 blocks...\n');
    const result = applyCleanup();
    for (const entry of result.updated) {
      console.log(`  Updated ${entry.file} (${entry.removed} block(s))`);
    }
    console.log('');
    console.log(`Updated ${result.updatedFiles} file(s), removed ${result.removedBlocks} inline block(s)`);
    console.log('');
    const scan = scanPages();
    console.log('Post-cleanup scan:');
    if (scan.hits.length === 0) {
      console.log('  (none — all duplicates removed)');
    } else {
      for (const hit of scan.hits) {
        console.log(`  ${hit.file}:${hit.line}`);
      }
    }
    return;
  }

  console.error('Usage:');
  console.error('  node strip-duplicate-footer-sec-2.js scan');
  console.error('  node strip-duplicate-footer-sec-2.js apply');
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  stripDuplicateFooterSec2,
  scanPages,
  applyCleanup,
  findFooterSec2Occurrences,
};
