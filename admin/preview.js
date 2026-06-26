(() => {
  const changes = new Map();
  let selected = null;
  let htmlButton = null;
  let modal = null;

  function editableTarget(target) {
    return target?.closest?.('[data-admin-edit-id]');
  }

  function summarize(el) {
    const kind = el.dataset.adminEditKind;
    return {
      type: 'admin-selection',
      id: el.dataset.adminEditId,
      kind,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 160),
      href: kind === 'link' ? el.getAttribute('href') || '' : '',
      src: kind === 'image' ? el.getAttribute('src') || '' : '',
      alt: kind === 'image' ? el.getAttribute('alt') || '' : '',
    };
  }

  function notifyCount() {
    window.parent.postMessage({ type: 'admin-change-count', count: changes.size }, window.location.origin);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function remember(el) {
    const kind = el.dataset.adminEditKind;
    const id = el.dataset.adminEditId;
    if (!id) return;
    if (kind === 'image') {
      changes.set(id, {
        id,
        kind,
        src: el.getAttribute('src') || '',
        alt: el.getAttribute('alt') || '',
      });
    } else if (kind === 'link') {
      changes.set(id, {
        id,
        kind,
        href: el.getAttribute('href') || '',
        html: el.innerHTML,
      });
    } else {
      changes.set(id, { id, kind: 'text', html: el.innerHTML });
    }
    notifyCount();
  }

  function ensureHtmlButton() {
    if (htmlButton) return htmlButton;
    htmlButton = document.createElement('button');
    htmlButton.type = 'button';
    htmlButton.className = 'admin-html-button';
    htmlButton.textContent = 'HTML';
    htmlButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openHtmlModal();
    });
    document.body.append(htmlButton);
    return htmlButton;
  }

  function positionHtmlButton() {
    if (!selected || !htmlButton) return;
    const rect = selected.getBoundingClientRect();
    const top = Math.max(8, rect.top + window.scrollY - 14);
    const left = Math.min(
      window.scrollX + document.documentElement.clientWidth - htmlButton.offsetWidth - 8,
      rect.right + window.scrollX - htmlButton.offsetWidth,
    );
    htmlButton.style.transform = 'translate(0, -100%)';
    htmlButton.style.top = `${top}px`;
    htmlButton.style.left = `${Math.max(8, left)}px`;
    htmlButton.hidden = false;
  }

  function updateHtmlButton() {
    if (!selected) {
      if (htmlButton) htmlButton.hidden = true;
      return;
    }
    ensureHtmlButton();
    requestAnimationFrame(positionHtmlButton);
  }

  function imageEditorHtml(el) {
    return `<label>Image URL<input id="admin-html-src" value="${escapeHtml(el.getAttribute('src') || '')}"></label>
      <label>Alt Text<input id="admin-html-alt" value="${escapeHtml(el.getAttribute('alt') || '')}"></label>`;
  }

  function htmlEditorHtml(el) {
    const kind = el.dataset.adminEditKind;
    const href = kind === 'link'
      ? `<label>Link URL<input id="admin-html-href" value="${escapeHtml(el.getAttribute('href') || '')}"></label>`
      : '';
    return `${href}<label>HTML<textarea id="admin-html-source" spellcheck="false">${escapeHtml(el.innerHTML)}</textarea></label>`;
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'admin-html-modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = `<div class="admin-html-modal" role="dialog" aria-modal="true" aria-labelledby="admin-html-title">
      <header>
        <h2 id="admin-html-title">Edit HTML</h2>
        <button type="button" class="admin-html-close" aria-label="Close">x</button>
      </header>
      <div class="admin-html-fields"></div>
      <footer>
        <button type="button" class="admin-html-cancel">Cancel</button>
        <button type="button" class="admin-html-apply">Apply HTML</button>
      </footer>
    </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('.admin-html-cancel, .admin-html-close')) {
        closeHtmlModal();
      }
      if (event.target.closest('.admin-html-apply')) {
        applyHtmlModal();
      }
    });
    document.body.append(modal);
    return modal;
  }

  function openHtmlModal() {
    if (!selected) return;
    const dialog = ensureModal();
    const fields = dialog.querySelector('.admin-html-fields');
    const kind = selected.dataset.adminEditKind;
    fields.innerHTML = kind === 'image' ? imageEditorHtml(selected) : htmlEditorHtml(selected);
    dialog.hidden = false;
    const firstField = fields.querySelector('textarea, input');
    firstField?.focus();
    if (firstField?.tagName === 'TEXTAREA') firstField.setSelectionRange(0, 0);
  }

  function closeHtmlModal() {
    if (modal) modal.hidden = true;
  }

  function applyHtmlModal() {
    if (!selected || !modal) return;
    const kind = selected.dataset.adminEditKind;
    if (kind === 'image') {
      selected.setAttribute('src', modal.querySelector('#admin-html-src')?.value || '');
      selected.setAttribute('alt', modal.querySelector('#admin-html-alt')?.value || '');
    } else {
      if (kind === 'link') selected.setAttribute('href', modal.querySelector('#admin-html-href')?.value || '');
      selected.innerHTML = modal.querySelector('#admin-html-source')?.value || '';
    }
    remember(selected);
    window.parent.postMessage(summarize(selected), window.location.origin);
    updateHtmlButton();
    closeHtmlModal();
  }

  document.addEventListener('click', (event) => {
    const el = editableTarget(event.target);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    if (selected) selected.classList.remove('admin-selected');
    selected = el;
    selected.classList.add('admin-selected');
    if (selected.dataset.adminEditKind !== 'image') {
      selected.setAttribute('contenteditable', 'true');
      selected.focus();
    }
    updateHtmlButton();
    window.parent.postMessage(summarize(selected), window.location.origin);
  }, true);

  document.addEventListener('input', (event) => {
    const el = editableTarget(event.target);
    if (el) remember(el);
  }, true);

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (msg.type === 'admin-set-link' && selected?.dataset.adminEditKind === 'link') {
      selected.setAttribute('href', msg.href || '');
      remember(selected);
    }
    if (msg.type === 'admin-set-image' && selected?.dataset.adminEditKind === 'image') {
      if (msg.src != null) selected.setAttribute('src', msg.src);
      if (msg.alt != null) selected.setAttribute('alt', msg.alt);
      remember(selected);
      window.parent.postMessage(summarize(selected), window.location.origin);
      updateHtmlButton();
    }
  });

  window.addEventListener('scroll', positionHtmlButton, true);
  window.addEventListener('resize', positionHtmlButton);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) closeHtmlModal();
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'h') {
      event.preventDefault();
      openHtmlModal();
    }
  });

  window.AdminEditor = {
    collectChanges() {
      if (selected && selected.dataset.adminEditKind !== 'image') remember(selected);
      return [...changes.values()];
    },
    clearChanges() {
      changes.clear();
      notifyCount();
    },
  };
})();
