'use strict';

let activeSelectMenu = null;
let selectEnhanceFrame = 0;
let selectSyncTimer = null;

function enhanceSelects(root = document) {
  root.querySelectorAll('select:not([data-custom-select])').forEach(enhanceSelect);
  syncSelectLabels();
}

function enhanceSelect(select) {
  if (!select || select.dataset.customSelect || select.multiple) return;
  select.dataset.customSelect = '1';

  const shell = document.createElement('span');
  shell.className = 'select-shell';
  if (select.classList.contains('sort-select')) shell.classList.add('sort-select-shell');
  if (select.id) shell.dataset.selectId = select.id;
  select.parentNode.insertBefore(shell, select);
  shell.appendChild(select);

  select.classList.add('native-select');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const label = labelForSelect(select);
  if (label) trigger.setAttribute('aria-label', label);
  trigger.innerHTML = '<span class="select-value"></span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 4.5 6 8.5 10 4.5"/></svg>';
  shell.appendChild(trigger);

  select._customTrigger = trigger;
  select._customShell = shell;

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleSelectMenu(select);
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSelectMenu(select);
    } else if (event.key === 'Escape') {
      closeSelectMenu(true);
    }
  });
  select.addEventListener('change', () => syncSelectLabel(select));
  select.addEventListener('input', () => syncSelectLabel(select));
  syncSelectLabel(select);
}

function labelForSelect(select) {
  try {
    return [...(select.labels || [])].map((label) => label.textContent).join(' ').trim();
  } catch (_) {
    return '';
  }
}

function syncSelectLabel(select) {
  const trigger = select && select._customTrigger;
  if (!trigger) return;
  const option = select.selectedOptions && select.selectedOptions[0];
  const value = option ? option.textContent.trim() : '—';
  const target = trigger.querySelector('.select-value');
  if (target && target.textContent !== value) target.textContent = value;
  const label = labelForSelect(select);
  if (label) trigger.setAttribute('aria-label', label);
  trigger.disabled = !!select.disabled;
}

function syncSelectLabels() {
  document.querySelectorAll('select[data-custom-select]').forEach(syncSelectLabel);
}

function toggleSelectMenu(select) {
  if (activeSelectMenu && activeSelectMenu.select === select) {
    closeSelectMenu(true);
    return;
  }
  openSelectMenu(select);
}

function openSelectMenu(select) {
  const trigger = select && select._customTrigger;
  if (!trigger || select.disabled) return;
  closeSelectMenu();

  const menu = document.createElement('div');
  menu.className = 'select-menu';
  menu.setAttribute('role', 'listbox');
  [...select.options].forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'select-option' + (index === select.selectedIndex ? ' selected' : '');
    button.setAttribute('role', 'option');
    button.setAttribute('data-index', String(index));
    button.setAttribute('aria-selected', index === select.selectedIndex ? 'true' : 'false');
    if (option.disabled) button.disabled = true;
    const check = document.createElement('span');
    check.className = 'select-option-check';
    check.textContent = index === select.selectedIndex ? '✓' : '';
    button.appendChild(check);
    button.appendChild(document.createTextNode(option.textContent));
    menu.appendChild(button);
  });
  document.body.appendChild(menu);

  const rect = trigger.getBoundingClientRect();
  const width = Math.max(150, Math.round(rect.width));
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  menu.style.left = `${left}px`;
  menu.style.width = `${width}px`;
  if (spaceBelow < 160 && spaceAbove > spaceBelow) {
    menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    menu.style.maxHeight = `${Math.min(320, Math.max(120, spaceAbove))}px`;
  } else {
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.maxHeight = `${Math.min(320, Math.max(120, spaceBelow))}px`;
  }

  activeSelectMenu = { select, trigger, menu };
  trigger.classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');

  menu.addEventListener('click', (event) => {
    const option = event.target.closest('.select-option');
    if (!option || option.disabled) return;
    const index = Number(option.dataset.index);
    if (!Number.isInteger(index) || !select.options[index]) return;
    select.selectedIndex = index;
    syncSelectLabel(select);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelectMenu(true);
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSelectMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      closeSelectMenu();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const options = [...menu.querySelectorAll('.select-option:not(:disabled)')];
    if (!options.length) return;
    const current = options.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown'
      ? (current + 1 + options.length) % options.length
      : (current - 1 + options.length) % options.length;
    options[next].focus();
  });

  const selectedOption = menu.querySelector('.select-option.selected') || menu.querySelector('.select-option:not(:disabled)');
  if (selectedOption) {
    requestAnimationFrame(() => {
      if (!activeSelectMenu || activeSelectMenu.menu !== menu) return;
      selectedOption.focus({ preventScroll: true });
      selectedOption.scrollIntoView({ block: 'nearest' });
    });
  }
}

function closeSelectMenu(restoreFocus = false) {
  if (!activeSelectMenu) return;
  const { trigger, menu } = activeSelectMenu;
  trigger.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
  menu.remove();
  activeSelectMenu = null;
  if (restoreFocus) {
    try { trigger.focus({ preventScroll: true }); } catch (_) {}
  }
}

function initCustomSelects() {
  enhanceSelects(document);
  const observer = new MutationObserver(() => {
    if (selectEnhanceFrame) return;
    selectEnhanceFrame = requestAnimationFrame(() => {
      selectEnhanceFrame = 0;
      enhanceSelects(document);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (selectSyncTimer) clearInterval(selectSyncTimer);
  selectSyncTimer = setInterval(syncSelectLabels, 700);
  document.addEventListener('click', (event) => {
    if (!activeSelectMenu) return;
    if (event.target.closest('.select-menu') || event.target.closest('.select-trigger')) return;
    closeSelectMenu();
  });
  document.addEventListener('scroll', (event) => {
    if (!activeSelectMenu) return;
    if (event.target.closest && event.target.closest('.select-menu')) return;
    closeSelectMenu();
  }, true);
  window.addEventListener('resize', () => closeSelectMenu());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeSelectMenu) closeSelectMenu(true);
  });
  document.addEventListener('click', (event) => {
    const label = event.target.closest('label[for]');
    if (!label) return;
    const field = document.getElementById(label.htmlFor);
    if (field && field._customTrigger) {
      event.preventDefault();
      field._customTrigger.focus();
    }
  });
}


export { initCustomSelects, closeSelectMenu, syncSelectLabels };
