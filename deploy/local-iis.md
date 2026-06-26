# Local IIS Multi-Site Setup

This project can mirror the production multi-site layout in local IIS by creating
one IIS site per folder under `sites/`.

Run from an elevated PowerShell session:

```powershell
npm run iis:configure
```

The script reads each `sites/<slug>/site.json`, creates or updates an IIS site
named `nopayload-<slug>`, points it at `sites/<slug>/public`, and binds the
site to the `.local` alias from `site.json`.

Current local hostnames:

```text
http://cmt-poles.local/
http://valmonttubing.local/
```

The script also maintains this marked block in the Windows hosts file:

```text
# BEGIN nopayload local sites
127.0.0.1 cmt-poles.local
127.0.0.1 valmonttubing.local
# END nopayload local sites
```

To add another local site:

1. Add `sites/<slug>/site.json`.
2. Include `<slug>.local` in its `aliases`.
3. Put the generated static files under `sites/<slug>/public`.
4. Rerun `npm run iis:configure` as Administrator.

The generated per-site `web.config` enables SSI includes, `home.html` as the
default document, and extensionless URLs like `/marathon`.

## Local API Proxy

The static pages can be served by IIS alone. Search and form APIs require the
Node service:

```powershell
npm run forms
```

To proxy `/api/*` through IIS, install IIS Application Request Routing, then run:

```powershell
npm run iis:configure:proxy
```

That command enables ARR proxying at the IIS server level, preserves the original
host header, and writes each site's local `/api/*` proxy rule to
`http://127.0.0.1:8787/api/*`.

Without ARR, IIS will serve the static pages but `/api/search` and
`/api/send-form` will not be handled by IIS. The Node service must also be
running:

```powershell
npm run forms
```
