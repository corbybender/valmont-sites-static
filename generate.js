const fs = require('fs');
const path = require('path');
const { getSitePaths } = require('./site-paths');

const SITE = getSitePaths();
const BASE = SITE.publicDir;
const WEBASSETS_BASE = 'https://webassets.valmont.com/';

function fixAssetPaths(html) {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])https?:\/\/az276019\.vo\.msecnd\.net\//gi,
    `$1${WEBASSETS_BASE}`
  );
}

function cleanCmsFluff(html) {
  let result = html;

  result = result.replace(
    /<link\b[^>]*\bhref=["'][^"']*(?:\.axd|Telerik\.Web\.UI|\/Sitefinity\/)[^"']*["'][^>]*>/gi,
    ''
  );

  result = result.replace(
    /<script\b[^>]*\bsrc=["'][^"']*(?:\.axd|MicrosoftAjax|kendo\.all\.min\.js|jquery-3\.6\.3|jquery-migrate-3\.4\.0)[^"']*["'][^>]*>\s*<\/script>/gi,
    ''
  );

  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    if (/(?:Telerik\.|Sitefinity|Sys\.Application|ScriptResource\.axd|\$create\s*\(\s*Telerik|RSSM_init|\$get\s*\(\s*['"]ctl)/i.test(match)) {
      return '';
    }
    return match;
  });

  result = result.replace(
    /<meta\b[^>]*\bname=["']Generator["'][^>]*\bcontent=["']Sitefinity[^"']*["'][^>]*>/gi,
    ''
  );

  result = result.replace(
    /<input\b[^>]*(?:__VIEWSTATE|__VIEWSTATEGENERATOR|_TSSM|_ClientState)[^>]*>/gi,
    ''
  );

  result = result.replace(
    /<input\b[^>]*\btype=["']hidden["'][^>]*\bdata-sf-role[^>]*>/gi,
    ''
  );

  result = result.replace(/<form\b[^>]*\bid=["']Form1["'][^>]*>/gi, '<div id="Form1">');
  result = result.replace(/<\/form>/gi, '</div>');

  result = result.replace(
    /<div class="breadcrumb" id="breadcrumb">[\s\S]*?<\/div>\s*(?=<div class="slide-carousel)/i,
    '<div class="breadcrumb" id="breadcrumb"></div>\n\n\t\t'
  );

  result = result.replace(
    /<img\b[^>]*\bsrc=['"][^'"]*Frontend-Assembly\/Telerik[^'"]*['"][^>]*>/gi,
    ''
  );

  result = result.replace(/<!--\s*\d+\.\d+\.\d+[^-]*-->/g, '');

  result = result.replace(/\sdata-sf-[a-z-]+(?:="[^"]*"|='[^']*')?/gi, '');

  result = result.replace(
    /<script\b[^>]*>\s*\$\.noConflict\s*\(\s*\)\s*;\s*<\/script>/gi,
    ''
  );

  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

function processHtml(html) {
  return cleanCmsFluff(fixAssetPaths(html));
}

function revertAbsoluteValmontPaths(html) {
  return html
    .replace(/https:\/\/www\.valmont\.com\/valmont2017/gi, '/valmont2017')
    .replace(/https:\/\/www\.valmont\.com\/scripts/gi, '/scripts');
}

function fixHtmlFiles(dir = BASE) {
  let fixed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixed += fixHtmlFiles(fullPath);
    } else if (entry.name.endsWith('.html')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const updated = processHtml(original);
      if (updated !== original) {
        fs.writeFileSync(fullPath, updated);
        console.log(`  Fixed: ${path.relative(BASE, fullPath)}`);
        fixed++;
      }
    }
  }
  return fixed;
}

function revertHtmlFiles(dir = BASE) {
  let reverted = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      reverted += revertHtmlFiles(fullPath);
    } else if (entry.name.endsWith('.html')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const updated = revertAbsoluteValmontPaths(original);
      if (updated !== original) {
        fs.writeFileSync(fullPath, updated);
        console.log(`  Reverted: ${path.relative(BASE, fullPath)}`);
        reverted++;
      }
    }
  }
  return reverted;
}

const urls = fs.readFileSync(path.join(SITE.dataDir, 'cleanedurls.txt'), 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0);

function slugToTitle(slug) {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/ Inch/g, '"')
    .replace(/\~/g, '');
}

function writePage(urlPath) {
  const parts = urlPath.split('/');
  const fileName = parts.pop() + '.html';
  const dirPath = path.join(BASE, ...parts);
  const filePath = path.join(dirPath, fileName);

  const title = slugToTitle(urlPath === 'home' ? 'Home' : urlPath.split('/').pop());

  const content = processHtml(`<!--#include virtual="/shared/header.html" -->
  <div class="page-content">
    <h1>${title}</h1>
    <p>Content for ${title} goes here.</p>
  </div>
<!--#include virtual="/shared/footer.html" -->`);

  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, content.trimStart() + '\n');
  console.log(`  Created: ${filePath}`);
}

if (require.main === module) {
  const mode = process.argv[2] || 'fix';

  if (mode === 'fix') {
    console.log('Processing HTML files (asset paths + CMS cleanup)...\n');
    const count = fixHtmlFiles();
    console.log(`\nDone! Updated ${count} file(s).`);
  } else if (mode === 'clean') {
    console.log('Removing Sitefinity/Telerik CMS references...\n');
    const count = fixHtmlFiles();
    console.log(`\nDone! Cleaned ${count} file(s).`);
  } else if (mode === 'revert') {
    console.log('Reverting absolute valmont.com asset paths to relative...\n');
    const count = revertHtmlFiles();
    console.log(`\nDone! Reverted ${count} file(s).`);
  } else if (mode === 'create') {
    urls.forEach(writePage);
    console.log('\nDone!');
  } else {
    console.error('Usage: node generate.js [fix|revert|create]');
    process.exit(1);
  }
}

module.exports = { fixAssetPaths, cleanCmsFluff, processHtml, fixHtmlFiles, revertHtmlFiles, writePage };
