const fs = require('fs');
const http = require('http');
const path = require('path');
const nodemailer = require('nodemailer');
const { getSiteForHost } = require('../site-paths');
const { getSearchConfig, queryAzureSearch } = require('./search-service');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  return env;
}

function parseBool(value, defaultValue) {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function loadFormsConfig(site) {
  const formsConfigPath = path.join(site.dataDir, site.formsConfig || 'forms.config.json');
  return JSON.parse(fs.readFileSync(formsConfigPath, 'utf8'));
}

function getFormRoute(formsConfig, formId) {
  const id = (formId || 'contact-us').trim().toLowerCase();
  const form = formsConfig.forms?.[id] || {};
  return {
    formId: id,
    to: form.to || formsConfig.defaultTo,
    subject: form.subject || `Website form submission (${id})`,
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function buildBody(fields, formId) {
  const lines = [
    `Form: ${formId}`,
    `Submitted (UTC): ${new Date().toISOString()}`,
    '',
  ];

  for (const [key, value] of Object.entries(fields)) {
    if (['formId', 'subject', 'redirect'].includes(key)) continue;
    lines.push(`${key}: ${value}`);
  }

  return lines.join('\n');
}

function isSafeRedirect(url) {
  return typeof url === 'string'
    && url.startsWith('/')
    && !url.startsWith('//');
}

async function parseRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    return JSON.parse(raw || '{}');
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }

  throw new Error('Unsupported content type. Use application/x-www-form-urlencoded or application/json.');
}

function parseQuery(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

function getRequestSite(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  return getSiteForHost(host);
}

function createTransport(env) {
  const host = env.PROOFPOINT_Host;
  const port = Number(env.PROOFPOINT_Port || 587);
  const useAuth = parseBool(env.PROOFPOINT_UseAuthentication, true);
  const useSsl = parseBool(env.PROOFPOINT_UseSSL, true);

  if (!host) {
    throw new Error('PROOFPOINT_Host is not configured in .env');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: useSsl && port === 465,
    requireTLS: useSsl && port !== 465,
    auth: useAuth
      ? {
          user: env.PROOFPOINT_Username,
          pass: env.PROOFPOINT_Password,
        }
      : undefined,
  });
}

async function sendFormSubmission(fields, env, formsConfig) {
  const route = getFormRoute(formsConfig, fields.formId);
  if (!route.to) {
    throw new Error('No recipient configured for this form.');
  }

  const fromEmail = env.PROOFPOINT_DefaultSenderEmailAddress;
  const fromName = env.PROOFPOINT_DefaultSenderName || 'Valmont Industries';
  if (!fromEmail) {
    throw new Error('PROOFPOINT_DefaultSenderEmailAddress is not configured in .env');
  }

  const subject = fields.subject || route.subject;
  const replyTo = firstNonEmpty(fields.email, fields.Email);
  const transport = createTransport(env);

  await transport.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: route.to,
    subject,
    text: buildBody(fields, route.formId),
    replyTo: replyTo || undefined,
  });

  return route;
}

async function handleRequest(req, res, env) {
  const site = getRequestSite(req);
  const formsConfig = loadFormsConfig(site);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  try {
    const fields = await parseRequestBody(req);
    const route = await sendFormSubmission(fields, env, formsConfig);

    if (isSafeRedirect(fields.redirect)) {
      res.writeHead(303, { Location: fields.redirect });
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, formId: route.formId }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

const SEARCH_CLIENT_JS = `(() => {
  const state = { config: null };
  const queryKeys = ['searchQuery', 'q', 'query', 'search'];

  const text = (value) => String(value == null ? '' : value);
  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  async function getConfig() {
    if (state.config) return state.config;
    const response = await fetch('/api/search/config', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Search config unavailable');
    state.config = await response.json();
    return state.config;
  }

  function getQuery(config) {
    const params = new URLSearchParams(window.location.search);
    for (const key of [config.queryParam, ...queryKeys]) {
      const value = params.get(key);
      if (value && value.trim()) return value.trim();
    }
    return '';
  }

  function findSearchText(source) {
    const root = source?.closest?.('form') || document;
    const input = root.querySelector('.sfsearchTxt, input[type="search"], input[name*="search" i]');
    return input ? input.value.trim() : '';
  }

  async function submitSearch(source) {
    const config = await getConfig();
    const query = findSearchText(source);
    if (!query) return;
    const url = new URL(config.resultsPath || '/search/search-results', window.location.origin);
    url.searchParams.set(config.queryParam || 'searchQuery', query);
    window.location.href = url.toString();
  }

  function resultMarkup(result) {
    const title = result.title || result.url || 'Search result';
    const snippet = result.snippet ? '<p class="static-search-snippet">' + escapeHtml(result.snippet) + '</p>' : '';
    return '<li class="static-search-result"><a href="' + escapeHtml(result.url || '#') + '">' + escapeHtml(title) + '</a>' + snippet + '</li>';
  }

  async function renderResults() {
    const config = await getConfig();
    const stats = document.querySelector('.sfsearchResultStatistics, #ContentPlaceHolder1_C001_ctl00_ctl00_resultsStats');
    if (!stats) return;

    const query = getQuery(config);
    let container = document.getElementById('static-search-results');
    if (!container) {
      container = document.createElement('div');
      container.id = 'static-search-results';
      stats.insertAdjacentElement('afterend', container);
    }

    if (!query) {
      stats.textContent = '';
      container.innerHTML = '';
      return;
    }

    stats.textContent = 'Searching...';
    const page = Number(new URLSearchParams(window.location.search).get('page') || '1');
    const response = await fetch('/api/search?q=' + encodeURIComponent(query) + '&page=' + encodeURIComponent(page), {
      headers: { accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed');

    stats.textContent = data.count === 1
      ? '1 result for "' + query + '"'
      : data.count + ' results for "' + query + '"';
    container.innerHTML = data.results.length
      ? '<ol class="static-search-results">' + data.results.map(resultMarkup).join('') + '</ol>'
      : '<p class="static-search-empty">No results found.</p>';
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.sfsearchSubmit, input[type="submit"]');
    if (!button || !button.closest('.sfsearchBox')) return;
    event.preventDefault();
    submitSearch(button).catch(console.error);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target.matches?.('.sfsearchTxt, input[type="search"]')) return;
    event.preventDefault();
    submitSearch(event.target).catch(console.error);
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    renderResults().catch((error) => {
      const stats = document.querySelector('.sfsearchResultStatistics, #ContentPlaceHolder1_C001_ctl00_ctl00_resultsStats');
      if (stats) stats.textContent = error.message;
    });
  });
})();`;

async function handleSearchRequest(req, res, env) {
  const site = getRequestSite(req);
  const requestPath = req.url?.split('?')[0] || '/';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (requestPath === '/api/search/client.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(SEARCH_CLIENT_JS);
      return;
    }

    if (requestPath === '/api/search/config') {
      const config = getSearchConfig(site);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        resultsPath: config.resultsPath,
        queryParam: config.queryParam,
        pageSize: config.pageSize,
      }));
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      return;
    }

    const fields = req.method === 'POST'
      ? await parseRequestBody(req)
      : parseQuery(req);
    const query = firstNonEmpty(fields.q, fields.query, fields.searchQuery, fields.search) || '';
    const result = await queryAzureSearch({
      query,
      page: fields.page,
      pageSize: fields.pageSize,
      site,
      env,
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

function startServer(options = {}) {
  const env = { ...loadEnvFile(ENV_PATH), ...process.env, ...options.env };
  const port = Number(options.port || env.FORMS_SERVER_PORT || 8787);
  const endpoint = options.endpoint || '/api/send-form';

  const server = http.createServer((req, res) => {
    const requestPath = req.url?.split('?')[0] || '/';
    if (requestPath === endpoint || requestPath === `${endpoint}/`) {
      handleRequest(req, res, env);
      return;
    }

    if (requestPath === '/api/search'
      || requestPath === '/api/search/'
      || requestPath === '/api/search/config'
      || requestPath === '/api/search/client.js') {
      handleSearchRequest(req, res, env);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`API relay listening on http://127.0.0.1:${port}`);
    console.log(`Form endpoint: ${endpoint}`);
    console.log('Search endpoint: /api/search');
    console.log(`Proofpoint relay host: ${env.PROOFPOINT_Host || '(not set)'}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  loadEnvFile,
  loadFormsConfig,
  sendFormSubmission,
  startServer,
};
