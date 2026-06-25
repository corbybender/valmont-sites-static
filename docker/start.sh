#!/usr/bin/env sh
set -eu

node /app/docker/render-nginx.js
node /app/api/form-server.js &
exec nginx -g 'daemon off;' -c /etc/nginx/nginx.conf
