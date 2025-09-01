import { confirmDialog } from '/static/js/ui/confirm.js';

async function api(url, opts){ const r = await fetch(url, {credentials:'same-origin', ...opts}); if(!r.ok) throw new Error(await r.text()); return r.json().catch(()=>({})); }

async function loadAreas(){
  const res = await api('/api/v1/areas?flat=1');
  return res.items || res || [];
}
async function loadProjects(area_id){
  const res = await api(`/api/v1/projects?area_id=${encodeURIComponent(area_id)}`);
  return res.items || res || [];
}

function noteCardHTML(n){
  return `
  <article class="c-card note-card ${n.color||''}" data-note-id="${n.id}">
    <div class="c-card__top">
      <button class="ui-iconbtn ui-iconbtn--danger js-del" aria-label="Удалить" data-tooltip="Удалить"><svg><use href="#i-trash"/></svg></button>
    </div>
    <div class="c-card__content">${(n.content||'').replace(/</g,'&lt;')}</div>
    <div class="c-card__bottom">
      <div class="chips">
        <span class="chip chip--area">${n.area?.name||'—'}</span>
        ${n.project ? `<span class="chip chip--project">${n.project.name}</span>` : ``}
      </div>
      <button class="ui-iconbtn js-edit" aria-label="Редактировать" data-tooltip="Редактировать"><svg><use href="#i-edit"/></svg></button>
    </div>
  </article>`;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const grid = document.getElementById('notesGrid');
  const form = document.getElementById('quick-note');
  if (!grid) return;

  // Инициализация селектов в форме
  if (form){
    const areaSel = form.querySelector('select[name="area_id"]');
    const projSel = form.querySelector('select[name="project_id"]');
    const areas = await loadAreas();
    areaSel.innerHTML = areas.map(a=>`<option value="${a.id}" data-slug="${a.slug||''}">${a.name}</option>`).join('');
    const inbox = areas.find(a => (a.slug||'').toLowerCase()==='inbox' || a.name.toLowerCase()==='входящие');
    if (inbox) areaSel.value = inbox.id;

    const refreshProjects = async () => {
      const aid = areaSel.value;
      if (!projSel) return;
      const items = await loadProjects(aid).catch(()=>[]);
      projSel.innerHTML = `<option value="">Без проекта</option>` + items.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    };
    areaSel?.addEventListener('change', refreshProjects);
    refreshProjects();

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        content: (fd.get('content')||'').toString().trim(),
        area_id: Number(fd.get('area_id')),
        project_id: fd.get('project_id') ? Number(fd.get('project_id')) : null
      };
      if (!payload.content) return;
      const created = await api('/api/v1/notes', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      form.reset();
      if (inbox) areaSel.value = inbox.id;
      const tmp = document.createElement('div');
      tmp.innerHTML = noteCardHTML(created);
      grid.prepend(tmp.firstElementChild);
    });
  }

  // Делегирование событий на карточках
  grid.addEventListener('click', async (e)=>{
    const del = e.target.closest('.js-del');
    const ed  = e.target.closest('.js-edit');
    const card = e.target.closest('.c-card');
    if (!card) return;
    const id = card.dataset.noteId;

    if (del){
      const ok = await confirmDialog({title:'Удалить заметку?', message:'Это действие нельзя отменить.'});
      if (!ok) return;
      await fetch(`/api/v1/notes/${id}`, {method:'DELETE', credentials:'same-origin'});
      card.remove();
      return;
    }

    if ( ed ){
      const contentEl = card.querySelector('.c-card__content');
      const old = contentEl.textContent;
      const ta = document.createElement('textarea');
      ta.value = old;
      ta.rows = Math.min(8, Math.max(3, old.split('\n').length));
      ta.style.width='100%';
      contentEl.replaceWith(ta);

      const panel = card.querySelector('.c-card__bottom');
      const saveBtn = document.createElement('button');
      saveBtn.className='ui-iconbtn'; saveBtn.setAttribute('aria-label','Сохранить'); saveBtn.dataset.tooltip='Сохранить';
      saveBtn.innerHTML = `<svg><use href="#i-check"/></svg>`;
      const cancelBtn = document.createElement('button');
      cancelBtn.className='ui-iconbtn ui-iconbtn--muted'; cancelBtn.setAttribute('aria-label','Отмена'); cancelBtn.dataset.tooltip='Отмена';
      cancelBtn.innerHTML = `<svg><use href="#i-x"/></svg>`;
      const right = document.createElement('div');
      right.append(cancelBtn, saveBtn);
      const left = panel.firstElementChild;
      panel.replaceChildren(left, right);

      cancelBtn.addEventListener('click', ()=>{
        ta.replaceWith(Object.assign(document.createElement('div'),{className:'c-card__content', textContent: old}));
        panel.replaceChildren(left, ed); // вернуть иконку редактирования
      });

      saveBtn.addEventListener('click', async ()=>{
        const content = ta.value.trim();
        await api(`/api/v1/notes/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content}) });
        ta.replaceWith(Object.assign(document.createElement('div'),{className:'c-card__content', textContent: content}));
        panel.replaceChildren(left, ed);
      });
    }
  });
});
