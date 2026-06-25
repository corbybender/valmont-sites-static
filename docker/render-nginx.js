const fs = require('fs');
const path = require('path');
const { listSites, getDefaultSite, normalizeHost } = require('../site-paths');

const OUTPUT_PATH = process.env.NGINX_OUTPUT_PATH || '/etc/nginx/conf.d/default.conf';
const sites = listSites();
const fallbackSite = getDefaultSite();

function uniqueHosts(site) {
  return [...new Set([site.slug, ...(site.hosts || []), ...(site.aliases || [])])]
    .map(normalizeHost)
    .filter(Boolean);
}

function renderMap() {
  const lines = [
    'map_hash_bucket_size 128;',
    '',
    'map $host $site_slug {',
    '    default "";',
  ];

  for (const site of sites) {
    for (const host of uniqueHosts(site)) {
      lines.push(`    ${host} ${site.slug};`);
    }
  }

  lines.push(`    ~^.+\\.azurewebsites\\.net$ ${fallbackSite.slug};`);

  lines.push('}');
  return lines.join('\n');
}

function renderConfig() {
  const lines = [
    renderMap(),
    '',
    'server {',
    '    listen 8080;',
    '    server_name _;',
    '',
    `    if ($site_slug = "") { return 404; }`,
    '    root /app/sites/$site_slug/public;',
    '    index home.html;',
    '',
    '    include /app/deploy/url-redirects.nginx.conf;',
    '',
    '    ssi on;',
    '    ssi_silent_errors off;',
    '',
    '    location = /api/send-form {',
    '        proxy_pass http://127.0.0.1:8787;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_set_header X-Forwarded-Host $host;',
    '        proxy_set_header Connection "";',
    '    }',
    '',
    '    location ^~ /shared/ {',
    '        internal;',
    '    }',
    '',
    '    location / {',
    '        try_files $uri $uri.html $uri/ =404;',
    '    }',
    '',
    '    location ~* \\.(css|js|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|pdf)$ {',
    '        expires 7d;',
    '        add_header Cache-Control "public";',
    '        try_files $uri =404;',
    '    }',
    '',
    `    # Default site fallback: ${fallbackSite.slug}`,
    '}',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, renderConfig());
console.log(`Wrote ${OUTPUT_PATH}`);
