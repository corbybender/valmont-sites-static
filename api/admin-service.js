const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { getSiteBySlug, listSites } = require('../site-paths');

const ROOT = path.join(__dirname, '..');
const ADMIN_DIR = path.join(ROOT, 'admin');
const BACKUP_DIR = path.join(ROOT, '.backups', 'admin-edits');
const AUDIT_PATH = path.join(ROOT, '.backups', 'admin-edits.jsonl');
const EDITABLE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'img', 'span', 'strong', 'em', 'td', 'th', 'figcaption', 'button']);
const VOID_TAGS = new Set(['img']);

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    cookies[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return cookies;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function getAdminConfig(env) {
  return {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || '',
    secret: env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || crypto.randomBytes(32).toString('hex'),
  };
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createSessionCookie(username, req, env) {
  const config = getAdminConfig(env);
  const payload = base64url(JSON.stringify({
    username,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  }));
  const token = `${payload}.${sign(payload, config.secret)}`;
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `nopayload_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

function clearSessionCookie() {
  return 'nopayload_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

function getSession(req, env) {
  const token = parseCookies(req).nopayload_admin;
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const config = getAdminConfig(env);
  const expected = sign(payload, config.secret);
  if (Buffer.byteLength(signature || '') !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function requireAdmin(req, res, env) {
  const session = getSession(req, env);
  if (session) return session;
  sendJson(res, 401, { success: false, error: 'Admin login required' });
  return null;
}

async function readBody(req, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, maxBytes) {
  const body = await readBody(req, maxBytes);
  return JSON.parse(body.toString('utf8') || '{}');
}

function safeCompare(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function resolvePagePath(site, page) {
  let normalized = String(page || '/').split('?')[0].replace(/\\/g, '/').trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/+/g, '/');
  if (normalized === '/') normalized = '/home';
  if (!normalized.toLowerCase().endsWith('.html')) normalized += '.html';
  if (normalized.includes('/../') || normalized.includes('..\\')) {
    throw new Error('Invalid page path');
  }

  const fullPath = path.resolve(site.publicDir, `.${normalized}`);
  const publicRoot = path.resolve(site.publicDir);
  if (!fullPath.startsWith(publicRoot + path.sep) && fullPath !== publicRoot) {
    throw new Error('Page path escapes site public folder');
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Page not found: ${page}`);
  }
  return { fullPath, key: normalized };
}

function fileKeyToPath(site, fileKey) {
  return resolvePagePath(site, fileKey).fullPath;
}

function routeForFile(site, filePath) {
  const relative = path.relative(site.publicDir, filePath).replace(/\\/g, '/');
  const route = `/${relative.replace(/\.html$/i, '')}`;
  return route === '/home' || route === '/index' ? '/' : route;
}

function extractTitle(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || '';
  return title.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function listPages(site) {
  const pages = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'shared' || entry.name === 'converted') continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        const html = fs.readFileSync(fullPath, 'utf8');
        pages.push({
          route: routeForFile(site, fullPath),
          file: path.relative(site.publicDir, fullPath).replace(/\\/g, '/'),
          title: extractTitle(html) || routeForFile(site, fullPath),
        });
      }
    }
  }
  walk(site.publicDir);
  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

function isInsideBlockedRange(index, ranges) {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function blockedRanges(html) {
  const ranges = [];
  const re = /<(script|style|head)\b[\s\S]*?<\/\1>/ig;
  let match;
  while ((match = re.exec(html)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function findTagEnd(html, start) {
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

function findCloseTag(html, tag, from) {
  const re = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'ig');
  re.lastIndex = from;
  let depth = 1;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) return { start: match.index, end: match.index + match[0].length };
    } else if (!match[0].endsWith('/>')) {
      depth += 1;
    }
  }
  return null;
}

function getEditableOccurrences(html) {
  const ranges = blockedRanges(html);
  const re = /<([a-z0-9]+)\b[^>]*>/ig;
  const occurrences = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (!EDITABLE_TAGS.has(tag) || isInsideBlockedRange(match.index, ranges)) continue;
    if (match[0].startsWith('</')) continue;

    const openEnd = findTagEnd(html, match.index);
    if (openEnd === -1) continue;

    if (VOID_TAGS.has(tag) || match[0].endsWith('/>')) {
      occurrences.push({ id: occurrences.length, tag, start: match.index, openEnd, end: openEnd + 1 });
      continue;
    }

    const close = findCloseTag(html, tag, openEnd + 1);
    if (!close) continue;
    occurrences.push({
      id: occurrences.length,
      tag,
      start: match.index,
      openEnd,
      closeStart: close.start,
      closeEnd: close.end,
      end: close.end,
    });
  }
  return occurrences;
}

function addAttribute(openTag, name, value) {
  const safeValue = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  if (new RegExp(`\\s${name}\\s*=`, 'i').test(openTag)) {
    return openTag.replace(new RegExp(`(\\s${name}\\s*=\\s*)(["'])([\\s\\S]*?)\\2`, 'i'), `$1"${safeValue}"`);
  }
  return openTag.replace(/>$/, ` ${name}="${safeValue}">`);
}

function injectEditIdsIntoSegment(html, fileKey, counters) {
  const occurrences = getEditableOccurrences(html);
  let result = html;
  for (const occurrence of [...occurrences].reverse()) {
    const id = counters[fileKey] || 0;
    counters[fileKey] = id + 1;
    const openTag = result.slice(occurrence.start, occurrence.openEnd + 1);
    const kind = occurrence.tag === 'img' ? 'image' : occurrence.tag === 'a' ? 'link' : 'text';
    const updated = addAttribute(addAttribute(addAttribute(openTag, 'data-admin-edit-id', `${fileKey}::${id}`), 'data-admin-edit-kind', kind), 'data-admin-source-file', fileKey);
    result = result.slice(0, occurrence.start) + updated + result.slice(occurrence.openEnd + 1);
  }
  return result;
}

function renderSourceForEdit(site, fileKey, counters, seen = new Set()) {
  if (seen.has(fileKey)) return '';
  seen.add(fileKey);
  const fullPath = fileKeyToPath(site, fileKey);
  const html = fs.readFileSync(fullPath, 'utf8');
  const includeRe = /<!--\s*#include\s+virtual=["']([^"']+)["']\s*-->/ig;
  let output = '';
  let lastIndex = 0;
  let match;
  while ((match = includeRe.exec(html)) !== null) {
    output += injectEditIdsIntoSegment(html.slice(lastIndex, match.index), fileKey, counters);
    try {
      output += renderSourceForEdit(site, match[1], counters, seen);
    } catch (_) {
      output += match[0];
    }
    lastIndex = match.index + match[0].length;
  }
  output += injectEditIdsIntoSegment(html.slice(lastIndex), fileKey, counters);
  seen.delete(fileKey);
  return output;
}

function injectPreviewAssets(html, siteSlug, page) {
  const payload = `<script>window.__NOPAYLOAD_ADMIN_CONTEXT__=${JSON.stringify({ site: siteSlug, page })};</script><script src="/admin/assets/preview.js"></script>`;
  const css = '<link rel="stylesheet" href="/admin/assets/preview.css">';
  let result = html;
  if (/<\/head>/i.test(result)) {
    result = result.replace(/<\/head>/i, `${css}</head>`);
  } else {
    result = `${css}${result}`;
  }
  if (/<\/body>/i.test(result)) {
    return result.replace(/<\/body>/i, `${payload}</body>`);
  }
  return `${result}${payload}`;
}

function shouldProxyAssetAttribute(attr, value) {
  const url = String(value || '').trim();
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  if (url.startsWith('/admin/') || url.startsWith('/api/')) return false;
  if (attr.toLowerCase() === 'href') {
    return /\.(?:css|ico|png|jpe?g|gif|webp|svg|woff2?|ttf|eot|pdf)(?:[?#].*)?$/i.test(url);
  }
  return true;
}

function adminAssetUrl(siteSlug, assetPath) {
  return `/admin/site-assets/${encodeURIComponent(siteSlug)}${assetPath}`;
}

function rewritePreviewAssetUrls(html, siteSlug) {
  let next = html.replace(/\b(src|poster|href)\s*=\s*(["'])(\/[^"']*)\2/ig, (match, attr, quote, value) => {
    if (!shouldProxyAssetAttribute(attr, value)) return match;
    return `${attr}=${quote}${adminAssetUrl(siteSlug, value)}${quote}`;
  });

  next = next.replace(/\bsrcset\s*=\s*(["'])([^"']*)\1/ig, (match, quote, value) => {
    const rewritten = value.split(',').map((part) => {
      const pieces = part.trim().split(/\s+/);
      if (pieces[0]?.startsWith('/') && !pieces[0].startsWith('//')) {
        pieces[0] = adminAssetUrl(siteSlug, pieces[0]);
      }
      return pieces.join(' ');
    }).join(', ');
    return `srcset=${quote}${rewritten}${quote}`;
  });

  return next;
}

function sanitizeBasicHtml(value) {
  let html = String(value || '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)\b[\s\S]*?<\s*\/\s*\1\s*>/ig, '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)\b[^>]*\/?\s*>/ig, '');
  html = html.replace(/\son[a-z]+\s*=\s*(["']).*?\1/ig, '');
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/ig, '');
  html = html.replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/ig, '');
  return html;
}

function isSafeUrl(value) {
  const url = String(value || '').trim();
  return !url || url.startsWith('/') || url.startsWith('#') || /^https?:\/\//i.test(url) || /^mailto:/i.test(url) || /^tel:/i.test(url);
}

function replaceAttribute(openTag, name, value) {
  const escaped = String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  if (new RegExp(`\\s${name}\\s*=`, 'i').test(openTag)) {
    return openTag.replace(new RegExp(`(\\s${name}\\s*=\\s*)(["'])([\\s\\S]*?)\\2`, 'i'), `$1"${escaped}"`);
  }
  return openTag.replace(/\/?>$/, (ending) => ` ${name}="${escaped}"${ending}`);
}

function applyChange(html, occurrence, change) {
  if (!occurrence) throw new Error(`Editable element not found: ${change.id}`);
  if (change.kind === 'image') {
    if (occurrence.tag !== 'img') throw new Error('Image change targets a non-image element');
    if (!isSafeUrl(change.src)) throw new Error('Unsafe image URL');
    let openTag = html.slice(occurrence.start, occurrence.openEnd + 1);
    openTag = replaceAttribute(openTag, 'src', change.src || '');
    openTag = replaceAttribute(openTag, 'alt', change.alt || '');
    return html.slice(0, occurrence.start) + openTag + html.slice(occurrence.openEnd + 1);
  }

  let openTag = html.slice(occurrence.start, occurrence.openEnd + 1);
  if (change.kind === 'link') {
    if (occurrence.tag !== 'a') throw new Error('Link change targets a non-link element');
    if (!isSafeUrl(change.href)) throw new Error('Unsafe link URL');
    openTag = replaceAttribute(openTag, 'href', change.href || '');
  }

  const inner = sanitizeBasicHtml(change.html);
  return html.slice(0, occurrence.start)
    + openTag
    + html.slice(occurrence.openEnd + 1, occurrence.closeStart)
      .replace(/[\s\S]*/, inner)
    + html.slice(occurrence.closeStart);
}

function backupFile(filePath, siteSlug) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const relative = path.relative(ROOT, filePath);
  const backupPath = path.join(BACKUP_DIR, siteSlug, timestamp, relative);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function appendAudit(entry) {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.appendFileSync(AUDIT_PATH, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`);
}

function groupChangesByFile(changes) {
  const grouped = new Map();
  for (const change of changes || []) {
    const [fileKey, idText] = String(change.id || '').split('::');
    const id = Number(idText);
    if (!fileKey || !Number.isInteger(id)) throw new Error(`Invalid edit id: ${change.id}`);
    if (!grouped.has(fileKey)) grouped.set(fileKey, []);
    grouped.get(fileKey).push({ ...change, numericId: id });
  }
  return grouped;
}

function savePageChanges(site, changes, username) {
  const saved = [];
  const grouped = groupChangesByFile(changes);
  for (const [fileKey, fileChanges] of grouped.entries()) {
    const filePath = fileKeyToPath(site, fileKey);
    const original = fs.readFileSync(filePath, 'utf8');
    const occurrences = getEditableOccurrences(original);
    let next = original;
    const sorted = [...fileChanges].sort((a, b) => b.numericId - a.numericId);
    for (const change of sorted) {
      next = applyChange(next, occurrences[change.numericId], change);
    }
    if (next === original) continue;
    const backupPath = backupFile(filePath, site.slug);
    fs.writeFileSync(filePath, next, 'utf8');
    saved.push({
      file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      backup: path.relative(ROOT, backupPath).replace(/\\/g, '/'),
      changes: fileChanges.length,
    });
  }

  appendAudit({ user: username, site: site.slug, files: saved });
  return saved;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  }[ext] || 'application/octet-stream';
}

function serveAdminAsset(req, res, assetPath) {
  const fullPath = path.resolve(ADMIN_DIR, assetPath.replace(/^\/+/, ''));
  if (!fullPath.startsWith(ADMIN_DIR + path.sep) || !fs.existsSync(fullPath)) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return true;
  }
  send(res, 200, fs.readFileSync(fullPath), {
    'Content-Type': contentTypeFor(fullPath),
    'Cache-Control': 'no-store',
  });
  return true;
}

function rewriteCssAssetUrls(css, siteSlug) {
  return css.replace(/url\(\s*(["']?)(\/(?!\/|admin\/|api\/)[^"')]+)\1\s*\)/ig, (_match, quote, value) => {
    return `url(${quote}${adminAssetUrl(siteSlug, value)}${quote})`;
  });
}

function serveSiteAsset(req, res, siteSlug, assetPath) {
  const site = getSiteBySlug(siteSlug);
  const cleanAssetPath = `/${String(assetPath || '').split('?')[0].replace(/^\/+/, '')}`;
  if (cleanAssetPath.includes('/../') || cleanAssetPath.includes('..\\')) {
    send(res, 400, 'Invalid asset path', { 'Content-Type': 'text/plain; charset=utf-8' });
    return true;
  }

  const fullPath = path.resolve(site.publicDir, `.${cleanAssetPath}`);
  const publicRoot = path.resolve(site.publicDir);
  if (!fullPath.startsWith(publicRoot + path.sep) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return true;
  }

  if (path.extname(fullPath).toLowerCase() === '.css') {
    send(res, 200, rewriteCssAssetUrls(fs.readFileSync(fullPath, 'utf8'), site.slug), {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    return true;
  }

  send(res, 200, fs.readFileSync(fullPath), {
    'Content-Type': contentTypeFor(fullPath),
    'Cache-Control': 'no-store',
  });
  return true;
}

function parseMultipartBuffer(buffer, contentType) {
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1];
  if (!boundary) throw new Error('Multipart boundary missing');
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = [];
  let offset = buffer.indexOf(delimiter);
  while (offset !== -1) {
    offset += delimiter.length;
    if (buffer.slice(offset, offset + 2).toString() === '--') break;
    if (buffer.slice(offset, offset + 2).toString() === '\r\n') offset += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), offset);
    if (headerEnd === -1) break;
    const headers = buffer.slice(offset, headerEnd).toString('utf8');
    let next = buffer.indexOf(delimiter, headerEnd + 4);
    if (next === -1) next = buffer.length;
    let body = buffer.slice(headerEnd + 4, next);
    if (body.slice(-2).toString() === '\r\n') body = body.slice(0, -2);

    const name = headers.match(/name="([^"]+)"/i)?.[1];
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    const type = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
    if (name && filename) {
      files.push({ field: name, filename, contentType: type, buffer: body });
    } else if (name) {
      fields[name] = body.toString('utf8');
    }
    offset = next;
  }
  return { fields, files };
}

function getBlobConfig(env) {
  const containerSasUrl = env.AZURE_BLOB_CONTAINER_SAS_URL || env.AZURE_STORAGE_CONTAINER_SAS_URL;
  if (containerSasUrl) {
    const url = new URL(containerSasUrl);
    const sas = url.search ? url.search.slice(1) : '';
    url.search = '';
    return { containerUrl: url.toString().replace(/\/+$/, ''), sas };
  }

  const account = env.AZURE_STORAGE_ACCOUNT || env.AZURE_BLOB_ACCOUNT;
  const container = env.AZURE_BLOB_CONTAINER || env.AZURE_STORAGE_CONTAINER;
  const sas = String(env.AZURE_STORAGE_SAS_TOKEN || env.AZURE_BLOB_SAS_TOKEN || '').replace(/^\?/, '');
  if (account && container && sas) {
    return {
      containerUrl: `https://${account}.blob.core.windows.net/${container}`,
      sas,
    };
  }

  throw new Error('Azure Blob upload is not configured. Set AZURE_BLOB_CONTAINER_SAS_URL, or AZURE_STORAGE_ACCOUNT + AZURE_BLOB_CONTAINER + AZURE_STORAGE_SAS_TOKEN.');
}

function safeFilename(filename) {
  return path.basename(String(filename || 'upload.bin')).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'upload.bin';
}

async function uploadToBlob(site, file, env) {
  const config = getBlobConfig(env);
  if (!/^image\//i.test(file.contentType)) throw new Error('Only image uploads are allowed');
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const blobName = `admin-uploads/${site.slug}/${yyyy}/${mm}/${Date.now()}-${safeFilename(file.filename)}`;
  const uploadUrl = `${config.containerUrl}/${blobName}${config.sas ? `?${config.sas}` : ''}`;
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-version': '2023-11-03',
      'Content-Type': file.contentType,
      'Content-Length': String(file.buffer.length),
    },
    body: file.buffer,
  });
  if (!response.ok) {
    throw new Error(`Azure Blob upload failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  return `${config.containerUrl}/${blobName}`;
}

async function handleLogin(req, res, env) {
  const config = getAdminConfig(env);
  if (!config.password) {
    sendJson(res, 503, { success: false, error: 'ADMIN_PASSWORD is not configured' });
    return true;
  }
  const body = await readJson(req);
  if (!safeCompare(body.username, config.username) || !safeCompare(body.password, config.password)) {
    sendJson(res, 401, { success: false, error: 'Invalid username or password' });
    return true;
  }
  sendJson(res, 200, { success: true }, { 'Set-Cookie': createSessionCookie(config.username, req, env) });
  return true;
}

async function handleAdminRequest(req, res, env) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  try {
    if (pathname === '/admin/login' && req.method === 'POST') return handleLogin(req, res, env);
    if (pathname === '/admin/logout') {
      send(res, 302, '', { Location: '/admin', 'Set-Cookie': clearSessionCookie() });
      return true;
    }

    if (pathname.startsWith('/admin/assets/')) {
      return serveAdminAsset(req, res, pathname.replace('/admin/assets/', ''));
    }

    if (pathname.startsWith('/admin/site-assets/')) {
      const session = requireAdmin(req, res, env);
      if (!session) return true;
      const parts = pathname.replace('/admin/site-assets/', '').split('/');
      const siteSlug = decodeURIComponent(parts.shift() || '');
      return serveSiteAsset(req, res, siteSlug, `/${parts.join('/')}`);
    }

    if (pathname === '/admin' || pathname === '/admin/') {
      if (!getSession(req, env)) {
        return serveAdminAsset(req, res, 'login.html');
      }
      return serveAdminAsset(req, res, 'index.html');
    }

    if (pathname === '/admin/preview') {
      const session = requireAdmin(req, res, env);
      if (!session) return true;
      const site = getSiteBySlug(url.searchParams.get('site'));
      const page = url.searchParams.get('page') || '/';
      const { key } = resolvePagePath(site, page);
      const html = rewritePreviewAssetUrls(renderSourceForEdit(site, key, {}), site.slug);
      send(res, 200, injectPreviewAssets(html, site.slug, key), {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      return true;
    }

    if (pathname === '/api/admin/session') {
      const session = getSession(req, env);
      sendJson(res, session ? 200 : 401, { authenticated: Boolean(session), user: session?.username || null });
      return true;
    }

    if (pathname === '/api/admin/sites') {
      const session = requireAdmin(req, res, env);
      if (!session) return true;
      sendJson(res, 200, {
        sites: listSites().map((site) => ({ slug: site.slug, siteName: site.siteName || site.slug })),
      });
      return true;
    }

    if (pathname === '/api/admin/pages') {
      const session = requireAdmin(req, res, env);
      if (!session) return true;
      const site = getSiteBySlug(url.searchParams.get('site'));
      sendJson(res, 200, { pages: listPages(site) });
      return true;
    }

    if (pathname === '/api/admin/save' && req.method === 'POST') {
      const session = requireAdmin(req, res, env);
      if (!session) return true;
      const body = await readJson(req, 5 * 1024 * 1024);
      const site = getSiteBySlug(body.site);
      const saved = savePageChanges(site, body.changes || [], session.username);
      sendJson(res, 200, { success: true, saved });
      return true;
    }

    if (pathname === '/api/admin/upload' && req.method === 'POST') {
      const session = requireAdmin(req, res, env);
      if (!session) return true;
      const body = await readBody(req, 25 * 1024 * 1024);
      const parsed = parseMultipartBuffer(body, req.headers['content-type'] || '');
      const site = getSiteBySlug(parsed.fields.site);
      const file = parsed.files[0];
      if (!file) throw new Error('No uploaded file found');
      const publicUrl = await uploadToBlob(site, file, env);
      appendAudit({ user: session.username, site: site.slug, upload: publicUrl });
      sendJson(res, 200, { success: true, url: publicUrl });
      return true;
    }
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message });
    return true;
  }

  return false;
}

module.exports = {
  handleAdminRequest,
  getEditableOccurrences,
  savePageChanges,
};
