(() => {
  const changes = new Map();
  let selected = null;

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
