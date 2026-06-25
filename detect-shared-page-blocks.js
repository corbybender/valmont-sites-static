const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const BASE = SITE.publicDir;
const SHARED_DIR = path.join(BASE, 'shared');

const SKIP_DIRS = new Set(['shared']);

const PAGE_BLOCK_DEFINITIONS = {
  'markets-we-serve': {
    sharedFile: 'markets-we-serve.html',
    description: 'Markets We Serve swiper carousel',
    openTagRe: /<div class="swiper-container">/i,
    fingerprint: 'Ag Machinery',
    canonicalFrom: 'home.html',
  },
  'questions-footer-cta': {
    sharedFile: 'questions-footer-cta.html',
    description: 'Contact / questions footer CTA',
    openTagRe: /<div class="utilityblock contact" id="utilityblockcontact">/i,
    fingerprint: 'Do you have a question or need more information',
    canonicalFrom: 'product-catalogs/welded-steel-tubing.html',
  },
};

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

function includeDirectiveFor(definition) {
  return `<!--#include virtual="/shared/${definition.sharedFile}" -->`;
}

function hasIncludeReference(html, definition) {
  return html.includes(includeDirectiveFor(definition));
}

function isInsideScriptOrStyle(html, index) {
  const before = html.slice(0, index);
  return (
    before.lastIndexOf('<script') > before.lastIndexOf('</script>') ||
    before.lastIndexOf('<style') > before.lastIndexOf('</style>')
  );
}

function findBlockOccurrences(html, definition) {
  const openTagRe = new RegExp(definition.openTagRe.source, 'gi');
  const occurrences = [];
  let match;

  while ((match = openTagRe.exec(html)) !== null) {
    const start = match.index;
    if (isInsideScriptOrStyle(html, start)) continue;

    const end = findDivEnd(html, start, match[0].length);
    if (end === -1) continue;

    const block = html.slice(start, end);
    occurrences.push({
      start,
      end,
      line: lineNumberAt(html, start),
      block,
      hash: hashBlock(block),
      length: block.length,
    });
  }

  return occurrences;
}

function scanBlock(definition, files) {
  const hits = [];
  const hashGroups = new Map();
  const includeRefs = [];

  for (const filePath of files) {
    const relPath = path.relative(BASE, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf8');

    if (hasIncludeReference(html, definition)) {
      includeRefs.push({ file: relPath, line: lineNumberAt(html, html.indexOf(includeDirectiveFor(definition))) });
      continue;
    }

    const occurrences = findBlockOccurrences(html, definition);
    for (const occurrence of occurrences) {
      hits.push({
        file: relPath,
        line: occurrence.line,
        length: occurrence.length,
        hash: occurrence.hash,
      });

      if (!hashGroups.has(occurrence.hash)) {
        hashGroups.set(occurrence.hash, {
          hash: occurrence.hash,
          length: occurrence.length,
          files: [],
          sampleFile: relPath,
          block: occurrence.block,
        });
      }
      hashGroups.get(occurrence.hash).files.push(relPath);
    }
  }

  return { hits, hashGroups, includeRefs, filesScanned: files.length };
}

function chooseCanonicalBlock(definition, hashGroups) {
  if (hashGroups.size === 0) return null;

  const preferred = definition.canonicalFrom;
  if (preferred) {
    for (const group of hashGroups.values()) {
      if (group.files.includes(preferred)) {
        return group;
      }
    }
  }

  return [...hashGroups.values()].sort((a, b) => {
    if (b.files.length !== a.files.length) return b.files.length - a.files.length;
    return b.length - a.length;
  })[0];
}

function replaceBlockWithInclude(html, definition) {
  if (hasIncludeReference(html, definition)) {
    return { html, changed: false, replaced: 0 };
  }

  const occurrences = findBlockOccurrences(html, definition);
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

function printBlockReport(blockId, definition, scan) {
  console.log(`${blockId} (${definition.description})`);
  console.log('-'.repeat(blockId.length + definition.description.length + 3));
  console.log(`Shared target: /shared/${definition.sharedFile}`);
  console.log(`Pages scanned: ${scan.filesScanned}`);
  console.log('');

  console.log('Inline occurrences:');
  if (scan.hits.length === 0) {
    console.log('  (none)');
  } else {
    for (const hit of scan.hits) {
      console.log(`  ${hit.file}:${hit.line} (${hit.length} chars, hash ${hit.hash})`);
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

  console.log('Variants:');
  if (scan.hashGroups.size === 0) {
    console.log('  (none found)');
  } else {
    for (const group of scan.hashGroups.values()) {
      console.log(`  hash ${group.hash} — ${group.files.length} file(s), ${group.length} chars`);
      console.log(`    sample: ${group.sampleFile}`);
    }
  }
  console.log('');

  if (scan.hits.length > 0) {
    const canonical = chooseCanonicalBlock(definition, scan.hashGroups);
    console.log(`Suggested canonical: ${canonical.sampleFile} (hash ${canonical.hash})`);
    console.log(`Run "node detect-shared-page-blocks.js apply ${blockId}" to extract`);
  } else if (scan.includeRefs.length > 0) {
    console.log('Block is already extracted to a shared include.');
  } else {
    console.log('Block was not found in page bodies.');
  }

  console.log('');
}

function applyBlock(blockId) {
  const definition = PAGE_BLOCK_DEFINITIONS[blockId];
  if (!definition) {
    throw new Error(`Unknown block "${blockId}"`);
  }

  const files = listPageHtmlFiles();
  const scan = scanBlock(definition, files);
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
    canonical = chooseCanonicalBlock(definition, scan.hashGroups);
    if (!canonical) {
      throw new Error(`No inline occurrences found for "${blockId}"`);
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
    const { html: nextHtml, changed, replaced } = replaceBlockWithInclude(html, definition);
    if (!changed) continue;

    fs.writeFileSync(filePath, nextHtml);
    updatedFiles++;
    replacedBlocks += replaced;
    console.log(`  Updated ${relPath} (${replaced} block(s))`);
  }

  return {
    blockId,
    sharedPath: path.relative(BASE, sharedPath).replace(/\\/g, '/'),
    canonicalHash: canonical.hash,
    blockLength: canonical.length,
    sourceFile: canonical.sampleFile,
    updatedFiles,
    replacedBlocks,
  };
}

function scanBlocks(blockIds) {
  const files = listPageHtmlFiles();
  console.log('Shared page block scan');
  console.log('======================');
  console.log(`Scanning ${files.length} page file(s), excluding /shared shell files`);
  console.log('');

  for (const blockId of blockIds) {
    printBlockReport(blockId, PAGE_BLOCK_DEFINITIONS[blockId], scanBlock(PAGE_BLOCK_DEFINITIONS[blockId], files));
  }
}

function main() {
  const mode = process.argv[2] || 'scan';
  const target = process.argv[3];
  const blockIds = Object.keys(PAGE_BLOCK_DEFINITIONS);

  if (mode === 'scan') {
    scanBlocks(target ? [target] : blockIds);
    return;
  }

  if (mode === 'apply') {
    const applyIds = !target || target === 'all' ? blockIds : [target];

    for (const blockId of applyIds) {
      if (!PAGE_BLOCK_DEFINITIONS[blockId]) {
        console.error(`Unknown block "${blockId}"`);
        process.exit(1);
      }
    }

    console.log('Extracting shared page blocks...\n');
    for (const blockId of applyIds) {
      console.log(`[${blockId}]`);
      const result = applyBlock(blockId);
      console.log(`  Created ${result.sharedPath} (${result.blockLength} chars, hash ${result.canonicalHash})`);
      console.log(`  Source: ${result.sourceFile}`);
      console.log(`  Updated ${result.updatedFiles} file(s), ${result.replacedBlocks} inline block(s) replaced`);
      console.log('');
    }

    scanBlocks(applyIds);
    return;
  }

  console.error('Usage:');
  console.error('  node detect-shared-page-blocks.js scan [block-id]');
  console.error('  node detect-shared-page-blocks.js apply [block-id|all]');
  console.error('');
  console.error('Blocks:', blockIds.join(', '));
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  PAGE_BLOCK_DEFINITIONS,
  findBlockOccurrences,
  scanBlock,
  applyBlock,
};
