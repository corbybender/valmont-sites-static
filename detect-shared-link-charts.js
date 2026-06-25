const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const BASE = SITE.publicDir;
const SHARED_DIR = path.join(BASE, 'shared');
const SCAN_ROOT = path.join(BASE, 'products-and-solutions');

const LINK_CHART_DEFINITIONS = {
  'round-6-25-to-16': {
    sharedFile: 'link-chart-6-25-to-16-round.html',
    description: '6.25 to 16.00 Inch Round Link Chart',
    h1Re: /6\.25 to 16\.00 Inch Round/i,
    canonicalFrom:
      'products-and-solutions/welded-steel-tubing/tubing-solutions/round-tubing---6-25-to-16-inch/6-25-inch-round-erw-steel-tubing.html',
  },
  'round-2-75-to-6': {
    sharedFile: 'link-chart-2-75-to-6-round.html',
    description: '2.75 to 6.00 Inch Round Link Chart',
    h1Re: /2\.75 to 6\.00 Inch Round/i,
    canonicalFrom:
      'products-and-solutions/welded-steel-tubing/tubing-solutions/round-tubing---2-75-to-6-inch/6-inch-round-erw-steel-tubing.html',
  },
  'round-1-05-to-2-50': {
    sharedFile: 'link-chart-1-05-to-2-50-round.html',
    description: '1.05 to 2.50 Inch Round Link Chart',
    h1Re: /1\.05 to 2\.(?:05|50) Inch Round/i,
    canonicalFrom:
      'products-and-solutions/welded-steel-tubing/tubing-solutions/round-tubing---1-05-to-2-50-inch/1-05-inch-round-erw-steel-tubing.html',
  },
  'square-rectangle-1-to-6': {
    sharedFile: 'link-chart-1-to-6-square-rectangle.html',
    description: '1.00 to 6.00 Inch Square & Rectangle Link Chart',
    h1Re: /1\.00 to 6\.00 Inch Square &(?:amp;)? Rectangle/i,
    canonicalFrom:
      'products-and-solutions/welded-steel-tubing/tubing-solutions/square-rectangle-tubing---up-to-6-inch/1-inch-square-erw-steel-tubing.html',
  },
};

function normalizeBlock(html) {
  return html.replace(/\s+/g, ' ').trim();
}

function hashBlock(html) {
  return crypto.createHash('sha256').update(normalizeBlock(html)).digest('hex').slice(0, 12);
}

function lineNumberAt(html, index) {
  return html.slice(0, index).split('\n').length;
}

function getIndentation(html, startIndex) {
  const lineStart = html.lastIndexOf('\n', startIndex) + 1;
  const match = html.slice(lineStart, startIndex).match(/^[\t ]*/);
  return match ? match[0] : '';
}

function isInsideScriptOrStyle(html, index) {
  const before = html.slice(0, index);
  return (
    before.lastIndexOf('<script') > before.lastIndexOf('</script>') ||
    before.lastIndexOf('<style') > before.lastIndexOf('</style>')
  );
}

function findTableEnd(html, tableOpenIndex) {
  let depth = 0;
  let pos = tableOpenIndex;
  const openRe = /<table\b[^>]*>/gi;
  const closeRe = /<\/table>/gi;

  openRe.lastIndex = tableOpenIndex;
  const firstOpen = openRe.exec(html);
  if (!firstOpen) return -1;

  depth = 1;
  pos = firstOpen.index + firstOpen[0].length;

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
      pos = nextClose.index + 8;
    }
  }

  return pos;
}

function findAllLinkChartBlocks(html, definition) {
  const h1Re = new RegExp(
    `<h1>\\s*([^<]*${definition.h1Re.source}[^<]*)\\s*<\\/h1>`,
    'gi'
  );
  const occurrences = [];

  for (const h1Match of html.matchAll(h1Re)) {
    if (isInsideScriptOrStyle(html, h1Match.index)) continue;

    const start = h1Match.index;
    let pos = start + h1Match[0].length;

    const afterH1 = html.slice(pos);
    const pMatch = afterH1.match(/^\s*<p\b[^>]*>[\s\S]*?<\/p>/i);
    if (pMatch) {
      pos += pMatch.index + pMatch[0].length;
    }

    const tableSearch = html.slice(pos).search(/<table\b/i);
    if (tableSearch === -1) continue;

    const tableStart = pos + tableSearch;
    const end = findTableEnd(html, tableStart);
    if (end === -1) continue;

    const block = html.slice(start, end);
    const tableOnly = html.slice(tableStart, end);

    occurrences.push({
      start,
      end,
      line: lineNumberAt(html, start),
      block,
      hash: hashBlock(block),
      tableHash: hashBlock(tableOnly),
      length: block.length,
    });
  }

  return occurrences;
}

function findLinkChartBlock(html, definition) {
  return findAllLinkChartBlocks(html, definition)[0] ?? null;
}

function listProductHtmlFiles(dir = SCAN_ROOT) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listProductHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function includeDirectiveFor(definition) {
  return `<!--#include virtual="/shared/${definition.sharedFile}" -->`;
}

function hasIncludeReference(html, definition) {
  return html.includes(includeDirectiveFor(definition));
}

function scanLinkChart(definition, files) {
  const hits = [];
  const blockGroups = new Map();
  const tableGroups = new Map();
  const includeRefs = [];

  for (const filePath of files) {
    const relPath = path.relative(BASE, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf8');

    if (hasIncludeReference(html, definition)) {
      includeRefs.push({
        file: relPath,
        line: lineNumberAt(html, html.indexOf(includeDirectiveFor(definition))),
      });
      continue;
    }

    const occurrences = findAllLinkChartBlocks(html, definition);
    for (const occurrence of occurrences) {
      hits.push({
        file: relPath,
        line: occurrence.line,
        length: occurrence.length,
        hash: occurrence.hash,
        tableHash: occurrence.tableHash,
      });

      if (!blockGroups.has(occurrence.hash)) {
        blockGroups.set(occurrence.hash, {
          hash: occurrence.hash,
          length: occurrence.length,
          files: [],
          sampleFile: relPath,
          block: occurrence.block,
        });
      }
      blockGroups.get(occurrence.hash).files.push(relPath);

      if (!tableGroups.has(occurrence.tableHash)) {
        tableGroups.set(occurrence.tableHash, {
          hash: occurrence.tableHash,
          files: [],
        });
      }
      tableGroups.get(occurrence.tableHash).files.push(relPath);
    }
  }

  return { hits, blockGroups, tableGroups, includeRefs, filesScanned: files.length };
}

function chooseCanonicalBlock(definition, blockGroups) {
  if (blockGroups.size === 0) return null;

  const preferred = definition.canonicalFrom;
  if (preferred) {
    for (const group of blockGroups.values()) {
      if (group.files.includes(preferred)) {
        return group;
      }
    }
  }

  return [...blockGroups.values()].sort((a, b) => {
    if (b.files.length !== a.files.length) return b.files.length - a.files.length;
    return b.length - a.length;
  })[0];
}

function replaceLinkChartWithInclude(html, definition) {
  if (hasIncludeReference(html, definition)) {
    return { html, changed: false, replaced: 0 };
  }

  const occurrences = findAllLinkChartBlocks(html, definition);
  if (occurrences.length === 0) {
    return { html, changed: false, replaced: 0 };
  }

  let result = html;
  let replaced = 0;

  for (const occurrence of [...occurrences].reverse()) {
    const indent = getIndentation(result, occurrence.start);
    const replacement = `${indent}${includeDirectiveFor(definition)}`;
    result = result.slice(0, occurrence.start) + replacement + result.slice(occurrence.end);
    replaced++;
  }

  return { html: result, changed: replaced > 0, replaced };
}

function printChartReport(chartId, definition, scan) {
  console.log(`${chartId} (${definition.description})`);
  console.log('-'.repeat(chartId.length + definition.description.length + 3));
  console.log(`Shared target: /shared/${definition.sharedFile}`);
  console.log(`Pages scanned: ${scan.filesScanned}`);
  console.log('');

  console.log('Inline link chart blocks:');
  if (scan.hits.length === 0) {
    console.log('  (none)');
  } else {
    for (const hit of scan.hits) {
      console.log(`  ${hit.file}:${hit.line} (${hit.length} chars, block ${hit.hash}, table ${hit.tableHash})`);
    }
  }
  console.log('');

  console.log('Already using shared include:');
  if (scan.includeRefs.length === 0) {
    console.log('  (none)');
  } else {
    for (const hit of scan.includeRefs) {
      console.log(`  ${hit.file}:${hit.line}`);
    }
  }
  console.log('');

  console.log('Block variants (h1 + description + table):');
  if (scan.blockGroups.size === 0) {
    console.log('  (none found)');
  } else {
    for (const group of scan.blockGroups.values()) {
      console.log(`  block ${group.hash} — ${group.files.length} file(s), ${group.length} chars`);
      console.log(`    sample: ${group.sampleFile}`);
    }
  }
  console.log('');

  console.log('Table-only variants:');
  if (scan.tableGroups.size === 0) {
    console.log('  (none found)');
  } else {
    for (const group of scan.tableGroups.values()) {
      console.log(`  table ${group.hash} — ${group.files.length} file(s)`);
    }
  }
  console.log('');

  if (scan.hits.length > 0) {
    const canonical = chooseCanonicalBlock(definition, scan.blockGroups);
    console.log(`Suggested canonical: ${canonical.sampleFile} (hash ${canonical.hash})`);
    console.log(`Run "node detect-shared-link-charts.js apply ${chartId}" to extract`);
  } else if (scan.includeRefs.length > 0) {
    console.log('Link chart is already extracted to a shared include.');
  } else {
    console.log('Link chart was not found.');
  }

  console.log('');
}

function applyLinkChart(chartId) {
  const definition = LINK_CHART_DEFINITIONS[chartId];
  if (!definition) {
    throw new Error(`Unknown link chart "${chartId}"`);
  }

  const files = listProductHtmlFiles();
  const scan = scanLinkChart(definition, files);
  const sharedPath = path.join(SHARED_DIR, definition.sharedFile);
  let canonical;

  if (fs.existsSync(sharedPath)) {
    const block = fs.readFileSync(sharedPath, 'utf8').trim();
    canonical = {
      block,
      hash: hashBlock(block),
      length: block.length,
      sampleFile: path.relative(BASE, sharedPath).replace(/\\/g, '/'),
    };
  } else {
    canonical = chooseCanonicalBlock(definition, scan.blockGroups);
    if (!canonical) {
      throw new Error(`No inline link chart blocks found for "${chartId}"`);
    }

    fs.mkdirSync(SHARED_DIR, { recursive: true });
    fs.writeFileSync(sharedPath, canonical.block.trim() + '\n');
  }

  let updatedFiles = 0;
  let replacedBlocks = 0;

  for (const filePath of files) {
    const relPath = path.relative(BASE, filePath).replace(/\\/g, '/');
    if (relPath === path.posix.join('shared', definition.sharedFile)) continue;

    const html = fs.readFileSync(filePath, 'utf8');
    const { html: nextHtml, changed, replaced } = replaceLinkChartWithInclude(html, definition);
    if (!changed) continue;

    fs.writeFileSync(filePath, nextHtml);
    updatedFiles++;
    replacedBlocks += replaced;
    console.log(`  Updated ${relPath}`);
  }

  return {
    chartId,
    sharedPath: path.relative(BASE, sharedPath).replace(/\\/g, '/'),
    canonicalHash: canonical.hash,
    blockLength: canonical.length,
    sourceFile: canonical.sampleFile,
    updatedFiles,
    replacedBlocks,
    inlineFound: scan.hits.length,
  };
}

function scanCharts(chartIds) {
  const files = listProductHtmlFiles();
  console.log('Shared link chart scan');
  console.log('======================');
  console.log(`Scanning ${files.length} file(s) under products-and-solutions/`);
  console.log('');

  for (const chartId of chartIds) {
    printChartReport(chartId, LINK_CHART_DEFINITIONS[chartId], scanLinkChart(LINK_CHART_DEFINITIONS[chartId], files));
  }
}

function main() {
  const mode = process.argv[2] || 'scan';
  const target = process.argv[3];
  const chartIds = Object.keys(LINK_CHART_DEFINITIONS);

  if (mode === 'scan') {
    scanCharts(target ? [target] : chartIds);
    return;
  }

  if (mode === 'apply') {
    const applyIds = !target || target === 'all' ? chartIds : [target];

    for (const chartId of applyIds) {
      if (!LINK_CHART_DEFINITIONS[chartId]) {
        console.error(`Unknown link chart "${chartId}"`);
        process.exit(1);
      }
    }

    console.log('Extracting shared link charts...\n');
    for (const chartId of applyIds) {
      console.log(`[${chartId}]`);
      const result = applyLinkChart(chartId);
      console.log(`  Shared file: ${result.sharedPath} (${result.blockLength} chars, hash ${result.canonicalHash})`);
      console.log(`  Source: ${result.sourceFile}`);
      console.log(`  Updated ${result.updatedFiles} file(s), ${result.replacedBlocks} inline block(s) replaced`);
      console.log('');
    }

    scanCharts(applyIds);
    return;
  }

  console.error('Usage:');
  console.error('  node detect-shared-link-charts.js scan [chart-id]');
  console.error('  node detect-shared-link-charts.js apply [chart-id|all]');
  console.error('');
  console.error('Charts:', chartIds.join(', '));
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  LINK_CHART_DEFINITIONS,
  findLinkChartBlock,
  scanLinkChart,
  applyLinkChart,
};
