# Shared Admin Page Editor

The admin editor is a shared tool served by the Node API relay, not by any
individual static site folder.

Production admin URL:

```text
https://stage.valmont.it/admin
```

Do not add `stage.valmont.it` to any `sites/<slug>/site.json` aliases. Docker
nginx treats it as an admin-only host through `ADMIN_HOSTS`.

## Required Azure App Settings

Set these on the Azure Web App:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong password>
ADMIN_SESSION_SECRET=<long random secret>
ADMIN_HOSTS=stage.valmont.it
```

For image uploads, use one of these Blob configurations.

Preferred:

```text
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<key>;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=<container>
AZURE_STORAGE_BASE_URL=https://<public-host-or-account>.blob.core.windows.net/<container>
AZURE_STORAGE_PREFIX=<optional-folder-prefix>
```

Also supported:

```text
AZURE_BLOB_CONTAINER_SAS_URL=https://<account>.blob.core.windows.net/<container>?<sas-token>
```

Alternative SAS parts:

```text
AZURE_STORAGE_ACCOUNT=<account>
AZURE_BLOB_CONTAINER=<container>
AZURE_STORAGE_SAS_TOKEN=<sas-token>
```

The SAS token needs permission to create/write blobs in the target container.
Uploaded images are stored under:

```text
admin-uploads/<site>/<yyyy>/<mm>/<timestamp>-<filename>
```

## Editing Model

The editor does not rewrite full pages. It injects temporary edit IDs into a
preview and saves constrained patches back to the source HTML files:

- Text/headline/list/table cell inner HTML
- Link text and `href`
- Image `src` and `alt`

Pages using SSI shared files are source-aware. Edits to visible header/footer
content are saved to the shared include file, while page body edits are saved to
that page's HTML file.

Each save creates a backup under `.backups/admin-edits/` and appends an audit
entry to `.backups/admin-edits.jsonl`.

## Local Testing

Run the relay and configure IIS proxying:

```powershell
$env:ADMIN_PASSWORD = "<local password>"
$env:ADMIN_SESSION_SECRET = "<local random secret>"
npm run forms
npm run iis:configure:proxy
```

Then open:

```text
http://valmonttubing.local/admin
```
