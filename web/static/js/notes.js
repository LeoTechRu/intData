import { confirmDialog } from '/static/js/ui/confirm.js';

const COLORS = ['note-yellow','note-mint','note-blue','note-pink','note-gray'];

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
  <article class="c-card note-card ${n.color||''}" data-note-id="${n.id}" data-area-id="${n.area?.id||''}" data-pinned="${n.pinned?1:0}">
    <div class="c-card__top">
      <button type="button" class="ui-iconbtn js-pin${n.pinned?' is-active':''}" aria-label="${n.pinned?'Открепить':'Закрепить'}" data-tooltip="${n.pinned?'Открепить':'Закрепить'}"><svg><use href="#i-pin"/></svg></button>
      <button type="button" class="ui-iconbtn ui-iconbtn--danger js-del" aria-label="Удалить" data-tooltip="Удалить"><svg><use href="#i-trash"/></svg></button>
    </div>
    <div class="c-card__content">${(n.content||'').replace(/</g,'&lt;')}</div>
    <div class="c-card__bottom">
      <div class="chips">
        <span class="chip chip--area">${n.area?.name||'—'}</span>
        ${n.project ? `<span class="chip chip--project">${n.project.name}</span>` : ``}
      </div>
      <button type="button" class="ui-iconbtn js-edit" aria-label="Редактировать" data-tooltip="Редактировать"><svg><use href="#i-edit"/></svg></button>
    </div>
  </article>`;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const grid = document.getElementById('notesGrid');
  const form = document.getElementById('quick-note');
  if (!grid) return;

  const areas = await loadAreas();
  let inbox = areas.find(a => (a.slug||'').toLowerCase()==='inbox' || a.name.toLowerCase()==='входящие');

  // Инициализация селектов в форме
  if (form){
    const areaSel = form.querySelector('select[name="area_id"]');
    const projSel = form.querySelector('select[name="project_id"]');
    areaSel.innerHTML = areas.map(a=>`<option value="${a.id}" data-slug="${a.slug||''}">${a.name}</option>`).join('');
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
        project_id: fd.get('project_id') ? Number(fd.get('project_id')) : null,
        color: COLORS[Math.floor(Math.random()*COLORS.length)]
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
    const pin = e.target.closest('.js-pin');
    const areaChip = e.target.closest('.chip--area');
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
      saveBtn.type='button';
      saveBtn.className='ui-iconbtn'; saveBtn.setAttribute('aria-label','Сохранить'); saveBtn.dataset.tooltip='Сохранить';
      saveBtn.innerHTML = `<svg><use href="#i-check"/></svg>`;
      const cancelBtn = document.createElement('button');
      cancelBtn.type='button';
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

    if (pin){
      const newPinned = card.dataset.pinned !== '1';
      await api(`/api/v1/notes/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pinned:newPinned}) });
      card.dataset.pinned = newPinned ? '1' : '0';
      pin.classList.toggle('is-active', newPinned);
      pin.setAttribute('aria-label', newPinned ? 'Открепить' : 'Закрепить');
      pin.dataset.tooltip = newPinned ? 'Открепить' : 'Закрепить';
      if(newPinned){ grid.prepend(card); } else { grid.append(card); }
      return;
    }

    if (areaChip){
      const select = document.createElement('select');
      select.innerHTML = areas.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
      select.value = card.dataset.areaId || '';
      areaChip.replaceWith(select);
      select.focus();
      const restore = ()=> select.replaceWith(areaChip);
      select.addEventListener('blur', restore, {once:true});
      select.addEventListener('change', async ()=>{
        const aid = Number(select.value);
        await api(`/api/v1/notes/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({area_id:aid}) });
        card.dataset.areaId = aid;
        const a = areas.find(x=>x.id===aid);
        areaChip.textContent = a?.name || '—';
        select.replaceWith(areaChip);
      }, {once:true});
      return;
    }
  });
});
