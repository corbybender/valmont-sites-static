const fs = require('fs');
const http = require('http');
const path = require('path');
const nodemailer = require('nodemailer');
const { getSiteForHost } = require('../site-paths');

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
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  const site = getSiteForHost(host);
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

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`Form relay listening on http://127.0.0.1:${port}${endpoint}`);
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
