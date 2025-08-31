import { loadPersonaBundle } from './services/personaTexts.js';

function shortName(u) {
  return u.fullName || u.nickname || u.email || 'Гость';
}

function renderSafeMd(md) {
  const frag = document.createDocumentFragment();
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0, m;
  while ((m = re.exec(md))) {
    if (m.index > last) frag.append(md.slice(last, m.index));
    const a = document.createElement('a');
    a.href = m[2];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = m[1];
    frag.append(a);
    last = re.lastIndex;
  }
  if (last < md.length) frag.append(md.slice(last));
  return frag;
}

export async function initPersonaHeader() {
  const mount = document.getElementById('personaHeader');
  if (!mount) return;

  const role = mount.dataset.persona;
  if (!role) return;

  const user = {
    fullName: mount.dataset.fullName || '',
    nickname: mount.dataset.nickname || '',
    email: mount.dataset.email || '',
  };

  const locale = document.documentElement.lang || 'ru';
  let bundle;
  try {
    bundle = await loadPersonaBundle(locale);
  } catch {
    return;
  }
  const texts = bundle[role];
  if (!texts) return;

  const wrap = document.createElement('div');
  wrap.className = 'persona-wrapper';
  wrap.style.position = 'relative';

  const badge = document.createElement('span');
  badge.className = 'persona-badge';
  badge.textContent = texts.label || shortName(user);
  badge.title = shortName(user);
  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;
  badge.setAttribute('aria-haspopup', 'dialog');
  badge.setAttribute('aria-expanded', 'false');

  const pop = document.createElement('div');
  pop.id = 'persona-popover';
  pop.className = 'persona-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Персонализация');
  pop.hidden = true;

  const title = document.createElement('div');
  title.className = 'persona-popover-title';
  title.textContent = shortName(user);
  pop.appendChild(title);

  const text = document.createElement('div');
  text.className = 'persona-popover-text';
  text.appendChild(renderSafeMd(texts.tooltipMd));
  pop.appendChild(text);

  const slogan = document.createElement('div');
  slogan.className = 'persona-popover-slogan';
  slogan.textContent = texts.slogan;
  pop.appendChild(slogan);

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !pop.hidden;
    pop.hidden = isOpen;
    badge.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target) && !pop.hidden) {
      pop.hidden = true;
      badge.setAttribute('aria-expanded', 'false');
    }
  });

  wrap.append(badge, pop);
  mount.appendChild(wrap);
}
