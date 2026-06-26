const state = {
  site: '',
  pages: [],
  selected: null,
};

const els = {
  site: document.getElementById('site-select'),
  page: document.getElementById('page-select'),
  filter: document.getElementById('page-filter'),
  preview: document.getElementById('preview'),
  save: document.getElementById('save-page'),
  refresh: document.getElementById('refresh-preview'),
  status: document.getElementById('admin-status'),
  count: document.getElementById('change-count'),
  summary: document.getElementById('selected-summary'),
  hrefRow: document.getElementById('href-row'),
  href: document.getElementById('link-href'),
  imageRow: document.getElementById('image-row'),
  imageSrc: document.getElementById('image-src'),
  imageAlt: document.getElementById('image-alt'),
  imageUpload: document.getElementById('image-upload'),
  applyImage: document.getElementById('apply-image'),
};

function setStatus(message) {
  els.status.textContent = message || '';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body instanceof FormData ? undefined : { 'content-type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function selectedPage() {
  return els.page.value || '/';
}

function loadPreview() {
  const site = encodeURIComponent(els.site.value);
  const page = encodeURIComponent(selectedPage());
  els.preview.src = `/admin/preview?site=${site}&page=${page}`;
  setStatus('');
}

function renderPages() {
  const filter = els.filter.value.trim().toLowerCase();
  els.page.innerHTML = '';
  for (const page of state.pages) {
    if (filter && !`${page.route} ${page.title}`.toLowerCase().includes(filter)) continue;
    const option = document.createElement('option');
    option.value = page.route;
    option.textContent = `${page.route} - ${page.title}`;
    els.page.append(option);
  }
  if (!els.page.value && els.page.options.length) els.page.selectedIndex = 0;
}

async function loadPages() {
  const data = await api(`/api/admin/pages?site=${encodeURIComponent(els.site.value)}`);
  state.pages = data.pages;
  renderPages();
  loadPreview();
}

async function init() {
  const data = await api('/api/admin/sites');
  els.site.innerHTML = '';
  for (const site of data.sites) {
    const option = document.createElement('option');
    option.value = site.slug;
    option.textContent = `${site.siteName} (${site.slug})`;
    els.site.append(option);
  }
  await loadPages();
}

function updateSelection(data) {
  state.selected = data;
  els.summary.textContent = `${data.tag.toUpperCase()} ${data.kind}: ${data.text || data.src || ''}`;
  els.hrefRow.hidden = data.kind !== 'link';
  els.imageRow.hidden = data.kind !== 'image';
  if (data.kind === 'link') els.href.value = data.href || '';
  if (data.kind === 'image') {
    els.imageSrc.value = data.src || '';
    els.imageAlt.value = data.alt || '';
  }
}

function postToPreview(message) {
  els.preview.contentWindow?.postMessage(message, window.location.origin);
}

async function saveChanges() {
  const editor = els.preview.contentWindow?.AdminEditor;
  if (!editor) {
    setStatus('Preview is not ready.');
    return;
  }
  const changes = editor.collectChanges();
  if (!changes.length) {
    setStatus('No changes to save.');
    return;
  }
  setStatus('Saving...');
  const data = await api('/api/admin/save', {
    method: 'POST',
    body: JSON.stringify({
      site: els.site.value,
      page: selectedPage(),
      changes,
    }),
  });
  editor.clearChanges();
  els.count.textContent = '0 unsaved changes';
  setStatus(`Saved ${data.saved.reduce((sum, file) => sum + file.changes, 0)} changes across ${data.saved.length} file(s).`);
}

async function uploadImage(file) {
  const form = new FormData();
  form.set('site', els.site.value);
  form.set('file', file);
  const data = await api('/api/admin/upload', { method: 'POST', body: form });
  return data.url;
}

els.site.addEventListener('change', () => {
  loadPages().catch((error) => setStatus(error.message));
});

els.page.addEventListener('change', loadPreview);
els.filter.addEventListener('input', renderPages);
els.refresh.addEventListener('click', loadPreview);
els.save.addEventListener('click', () => saveChanges().catch((error) => setStatus(error.message)));

els.href.addEventListener('input', () => {
  postToPreview({ type: 'admin-set-link', href: els.href.value });
});

els.applyImage.addEventListener('click', () => {
  postToPreview({ type: 'admin-set-image', src: els.imageSrc.value, alt: els.imageAlt.value });
});

els.imageUpload.addEventListener('change', async () => {
  const file = els.imageUpload.files?.[0];
  if (!file) return;
  setStatus('Uploading image...');
  try {
    const url = await uploadImage(file);
    els.imageSrc.value = url;
    postToPreview({ type: 'admin-set-image', src: url, alt: els.imageAlt.value });
    setStatus('Image uploaded.');
  } catch (error) {
    setStatus(error.message);
  }
});

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data || {};
  if (data.type === 'admin-selection') updateSelection(data);
  if (data.type === 'admin-change-count') {
    els.count.textContent = `${data.count} unsaved change${data.count === 1 ? '' : 's'}`;
  }
});

init().catch((error) => setStatus(error.message));
