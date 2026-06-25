const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITES_DIR = path.join(ROOT, 'sites');
const DEFAULT_SITE_SLUG = process.env.SITE_SLUG || 'valmonttubing';

function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function listSites() {
  if (!fs.existsSync(SITES_DIR)) return [];

  return fs.readdirSync(SITES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const siteDir = path.join(SITES_DIR, entry.name);
      const configPath = path.join(siteDir, 'site.json');
      if (!fs.existsSync(configPath)) return null;

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        ...config,
        slug: config.slug || entry.name,
        siteDir,
        publicDir: path.join(siteDir, config.publicDir || 'public'),
        dataDir: siteDir,
        configPath,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function getSiteBySlug(slug = DEFAULT_SITE_SLUG) {
  const normalized = String(slug || '').trim();
  const site = listSites().find((entry) => entry.slug === normalized);
  if (!site) {
    throw new Error(`Unknown site slug "${slug}"`);
  }
  return site;
}

function getDefaultSite() {
  const site = listSites().find((entry) => entry.slug === DEFAULT_SITE_SLUG) || listSites()[0];
  if (!site) {
    throw new Error(`No sites found under ${SITES_DIR}`);
  }
  return site;
}

function hostMatches(site, host) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return false;

  const hosts = [site.slug, ...(site.hosts || []), ...(site.aliases || [])]
    .map(normalizeHost)
    .filter(Boolean);

  return hosts.includes(normalizedHost);
}

function getSiteForHost(host) {
  const sites = listSites();
  const matched = sites.find((site) => hostMatches(site, host));
  return matched || getDefaultSite();
}

function getSitePaths(slug = DEFAULT_SITE_SLUG) {
  const site = getSiteBySlug(slug);
  return {
    ...site,
    rootDir: site.siteDir,
  };
}

module.exports = {
  ROOT,
  SITES_DIR,
  DEFAULT_SITE_SLUG,
  normalizeHost,
  listSites,
  getSiteBySlug,
  getDefaultSite,
  getSiteForHost,
  getSitePaths,
  hostMatches,
};
