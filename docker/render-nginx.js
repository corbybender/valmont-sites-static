const fs = require('fs');
const path = require('path');
const { listSites, getDefaultSite, normalizeHost } = require('../site-paths');

const OUTPUT_PATH = process.env.NGINX_OUTPUT_PATH || '/etc/nginx/conf.d/default.conf';
const sites = listSites();
const fallbackSite = getDefaultSite();
const adminHosts = (process.env.ADMIN_HOSTS || 'stage.valmont.it')
  .split(',')
  .map(normalizeHost)
  .filter(Boolean);

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
  lines.push('');
  lines.push('map $host $admin_host {');
  lines.push('    default 0;');
  for (const host of adminHosts) {
    lines.push(`    ${host} 1;`);
  }
  lines.push('}');
  lines.push('');
  lines.push('map "$site_slug:$admin_host" $known_host {');
  lines.push('    default 1;');
  lines.push('    ":0" 0;');
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
    '    root /app/sites/$site_slug/public;',
    '    index home.html;',
    '',
    '    include /app/deploy/url-redirects.nginx.conf;',
    '',
    '    ssi on;',
    '    ssi_silent_errors off;',
    '',
    '    location = /api/send-form {',
    '        if ($known_host = 0) { return 404; }',
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
    '    location ^~ /api/search {',
    '        if ($known_host = 0) { return 404; }',
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
    '    location ^~ /api/admin/ {',
    '        if ($admin_host = 0) { return 404; }',
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
    '    location ^~ /admin {',
    '        if ($admin_host = 0) { return 404; }',
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
    '        if ($known_host = 0) { return 404; }',
    '        internal;',
    '    }',
    '',
    '    location / {',
    '        if ($known_host = 0) { return 404; }',
    '        try_files $uri $uri.html $uri/ =404;',
    '    }',
    '',
    '    location ~* \\.(css|js|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|pdf)$ {',
    '        if ($known_host = 0) { return 404; }',
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
