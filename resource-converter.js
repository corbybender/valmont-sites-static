const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      timeout: 120000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(fetchUrl(nextUrl));
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const err = new Error(`HTTP ${res.statusCode} for ${url}`);
          err.statusCode = res.statusCode;
          err.body = data;
          reject(err);
        });
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function slugifyName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'resource';
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

class ResourceConverter {
  constructor(site) {
    this.site = site;
    this.baseUrl = site.baseUrl;
    this.convertedDir = path.join(site.publicDir, 'converted');
    this.cache = new Map();
    this.inFlight = new Map();
    this.legacyHostRe = /(?:ScriptResource|WebResource)\.axd|Telerik\.Web\.UI/i;
    fs.mkdirSync(this.convertedDir, { recursive: true });
  }

  resolveUrl(rawUrl, pageUrl) {
    try {
      return new URL(decodeHtmlEntities(rawUrl), pageUrl || this.baseUrl).toString();
    } catch {
      return null;
    }
  }

  shouldConvert(tagName, rawUrl) {
    if (!rawUrl) return false;
    if (rawUrl.startsWith('/converted/')) return false;
    if (tagName === 'script') {
      return this.legacyHostRe.test(rawUrl);
    }
    if (tagName === 'link') {
      return /\.axd(\?|$)/i.test(rawUrl) || /Telerik\.Web\.UI/i.test(rawUrl);
    }
    return false;
  }

  targetPathFor(url, tagName) {
    const parsed = new URL(url);
    const lastPart = path.posix.basename(parsed.pathname) || 'resource';
    const stem = slugifyName(lastPart.replace(/\.axd$/i, '').replace(/\.[a-z0-9]+$/i, ''));
    const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
    const ext = tagName === 'link' ? 'css' : 'js';
    return `/converted/${stem}-${hash}.${ext}`;
  }

  isUsableConvertedFile(absolutePath) {
    if (!fs.existsSync(absolutePath)) return false;

    const stats = fs.statSync(absolutePath);
    if (stats.size === 0) return false;

    const preview = fs.readFileSync(absolutePath, 'utf8').trimStart();
    return !preview.startsWith('/* Failed to convert ');
  }

  async ensureWritten(url, tagName) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    if (this.inFlight.has(url)) {
      return this.inFlight.get(url);
    }

    const promise = (async () => {
      const relativePath = this.targetPathFor(url, tagName);
      const absolutePath = path.join(this.site.publicDir, relativePath.replace(/^\//, '').replace(/\//g, path.sep));

      if (!this.isUsableConvertedFile(absolutePath)) {
        try {
          const body = await fetchUrl(url);
          fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
          fs.writeFileSync(absolutePath, body);
        } catch (error) {
          fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
          fs.writeFileSync(absolutePath, `/* Failed to convert ${url}: ${error.message} */\n`);
          console.warn(`  WARN: failed to convert ${url} -> ${relativePath}: ${error.message}`);
        }
      }

      this.cache.set(url, relativePath);
      return relativePath;
    })();

    this.inFlight.set(url, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(url);
    }
  }

  replaceAttr(tag, attrName, replacement) {
    const attrRe = new RegExp(`\\b${attrName}\\s*=\\s*(["'])[^"']*\\1`, 'i');
    return tag.replace(attrRe, `${attrName}="${replacement}"`);
  }

  async rewriteTag(tag, pageUrl) {
    const srcMatch = tag.match(/\bsrc\s*=\s*(["'])([^"']+)\1/i);
    if (srcMatch) {
      const resolved = this.resolveUrl(srcMatch[2], pageUrl);
      if (this.shouldConvert('script', srcMatch[2]) && resolved) {
        const relativePath = await this.ensureWritten(resolved, 'script');
        return this.replaceAttr(tag, 'src', relativePath);
      }
      return tag;
    }

    const hrefMatch = tag.match(/\bhref\s*=\s*(["'])([^"']+)\1/i);
    if (hrefMatch) {
      const resolved = this.resolveUrl(hrefMatch[2], pageUrl);
      if (this.shouldConvert('link', hrefMatch[2]) && resolved) {
        const relativePath = await this.ensureWritten(resolved, 'link');
        return this.replaceAttr(tag, 'href', relativePath);
      }
    }

    return tag;
  }

  async replaceTags(html, tagName, pageUrl) {
    const re = tagName === 'script'
      ? /<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script>/gi
      : /<link\b[^>]*\bhref\s*=\s*["'][^"']+["'][^>]*\/?>/gi;

    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = re.exec(html)) !== null) {
      result += html.slice(lastIndex, match.index);
      result += await this.rewriteTag(match[0], pageUrl);
      lastIndex = re.lastIndex;
    }

    return result + html.slice(lastIndex);
  }

  async replaceInlineLegacyRefs(html, pageUrl) {
    const re = /\b(src|href)\s*=\s*(["'])([^"']*(?:ScriptResource|WebResource|Telerik\.Web\.UI)[^"']*)(\2)/gi;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = re.exec(html)) !== null) {
      result += html.slice(lastIndex, match.index);

      const attrName = match[1].toLowerCase();
      const resolved = this.resolveUrl(match[3], pageUrl);
      if (this.shouldConvert(attrName === 'src' ? 'script' : 'link', match[3]) && resolved) {
        const relativePath = await this.ensureWritten(resolved, attrName === 'src' ? 'script' : 'link');
        result += `${attrName}=${match[2]}${relativePath}${match[4]}`;
      } else {
        result += match[0];
      }

      lastIndex = re.lastIndex;
    }

    return result + html.slice(lastIndex);
  }

  async convertHtml(html, pageUrl) {
    let result = html;
    result = await this.replaceTags(result, 'script', pageUrl);
    result = await this.replaceTags(result, 'link', pageUrl);
    result = await this.replaceInlineLegacyRefs(result, pageUrl);
    return result;
  }
}

module.exports = { ResourceConverter };
