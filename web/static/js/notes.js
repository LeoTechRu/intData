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
  <article class="c-card note-card" style="--note-bg:${n.area?.color||'#F3F4F6'}" data-note-id="${n.id}" data-area-id="${n.area?.id||''}" data-project-id="${n.project?.id||''}" data-pinned="${n.pinned?1:0}">
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
      <div class="card-actions">
        <button type="button" class="ui-iconbtn js-share" aria-label="Поделиться" data-tooltip="Поделиться"><svg><use href="#i-share"/></svg></button>
        <button type="button" class="ui-iconbtn js-edit" aria-label="Редактировать" data-tooltip="Редактировать"><svg><use href="#i-edit"/></svg></button>
      </div>
    </div>
  </article>`;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const grid = document.getElementById('notesGrid');
  const form = document.getElementById('quick-note');
  const noteDialog = document.getElementById('noteDialog');
  const areaDialog = document.getElementById('areaDialog');
  const areaForm = document.getElementById('areaForm');
  if (!grid) return;

  const areas = await loadAreas();
  let inbox = areas.find(a => (a.slug||'').toLowerCase()==='inbox' || a.name.toLowerCase()==='входящие');

  if (form){
    const areaSel = form.querySelector('select[name="area_id"]');
    const projSel = form.querySelector('select[name="project_id"]');
    const titleInput = form.querySelector('input[name="title"]');
    const contentTA = form.querySelector('textarea[name="content"]');
    const pinBtn = form.querySelector('.js-qn-pin');
    let pinned = false;

    areaSel.innerHTML = areas.map(a=>`<option value="${a.id}" data-color="${a.color||''}">${a.name}</option>`).join('');
    if (inbox) areaSel.value = inbox.id;

    const refreshProjects = async () => {
      const aid = areaSel.value;
      const items = await loadProjects(aid).catch(()=>[]);
      projSel.innerHTML = `<option value=\"\">Без проекта</option>` + items.map(p=>`<option value=\"${p.id}\">${p.name}</option>`).join('');
    };
    areaSel.addEventListener('change', refreshProjects);
    refreshProjects();

    form.addEventListener('focusin', ()=>form.classList.remove('collapsed'));
    contentTA.addEventListener('input', ()=>{
      contentTA.style.height='auto';
      contentTA.style.height=Math.min(contentTA.scrollHeight,200)+'px';
    });

    pinBtn.addEventListener('click', ()=>{
      pinned=!pinned;
      pinBtn.classList.toggle('is-active', pinned);
      pinBtn.setAttribute('aria-label', pinned?'Открепить':'Закрепить');
      pinBtn.dataset.tooltip=pinned?'Открепить':'Закрепить';
    });

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const content = (fd.get('content')||'').toString().trim();
      if (!content) return;
      const title = (fd.get('title')||'').toString().trim();
      const payload = {
        content,
        area_id: Number(fd.get('area_id')),
        project_id: fd.get('project_id') ? Number(fd.get('project_id')) : null,
        pinned
      };
      if (title) payload.title = title;
      const created = await api('/api/v1/notes', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      form.reset();
      pinned=false;
      pinBtn.classList.remove('is-active');
      form.classList.add('collapsed');
      if (inbox) areaSel.value = inbox.id;
      refreshProjects();
      const tmp = document.createElement('div');
      tmp.innerHTML = noteCardHTML(created);
      grid.prepend(tmp.firstElementChild);
    });
  }

  async function openAreaDialog(card){
    const areaSel = areaForm.querySelector('select[name="area_id"]');
    const projSel = areaForm.querySelector('select[name="project_id"]');
    areaSel.innerHTML = areas.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
    areaSel.value = card.dataset.areaId || '';
    const loadProj = async ()=>{
      const items = await loadProjects(areaSel.value).catch(()=>[]);
      projSel.innerHTML = `<option value=\"\">Без проекта</option>` + items.map(p=>`<option value=\"${p.id}\">${p.name}</option>`).join('');
      if(card.dataset.projectId){projSel.value=card.dataset.projectId;}
    };
    areaSel.addEventListener('change', loadProj);
    await loadProj();
    const {returnValue} = await new Promise(resolve=>{
      areaDialog.addEventListener('close', ()=>resolve({returnValue:areaDialog.returnValue}), {once:true});
      areaDialog.showModal();
    });
    areaSel.removeEventListener('change', loadProj);
    if(returnValue==='save'){
      const aid = Number(areaSel.value);
      const pid = projSel.value ? Number(projSel.value) : null;
      await api(`/api/v1/notes/${card.dataset.noteId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({area_id:aid, project_id:pid}) });
      card.dataset.areaId=aid;
      card.dataset.projectId=pid||'';
      const a = areas.find(x=>x.id===aid);
      card.style.setProperty('--note-bg', a?.color || '#F3F4F6');
      card.querySelector('.chip--area').textContent = a?.name || '—';
      const projChip = card.querySelector('.chip--project');
      if(pid){
        const projItems = await loadProjects(aid).catch(()=>[]);
        const p = projItems.find(x=>x.id===pid);
        if(projChip){projChip.textContent=p?.name||'';} else if(p){ const chip=document.createElement('span'); chip.className='chip chip--project'; chip.textContent=p.name; card.querySelector('.chips').append(chip); }
      }else if(projChip){ projChip.remove(); }
    }
  }

  function openNoteDialog(card){
    noteDialog.innerHTML = noteCardHTML({
      id: Number(card.dataset.noteId),
      content: card.querySelector('.c-card__content').textContent,
      area:{id:card.dataset.areaId,name:card.querySelector('.chip--area').textContent,color:card.style.getPropertyValue('--note-bg')},
      project: card.dataset.projectId?{id:card.dataset.projectId,name:card.querySelector('.chip--project')?.textContent}:null,
      pinned: card.dataset.pinned==='1'
    });
    noteDialog.showModal();
  }

  async function handleCardAction(e){
    const del = e.target.closest('.js-del');
    const ed  = e.target.closest('.js-edit');
    const pin = e.target.closest('.js-pin');
    const share = e.target.closest('.js-share');
    const areaChip = e.target.closest('.chip--area');
    const card = e.target.closest('.c-card');
    if (!card) return;
    const id = card.dataset.noteId;
    const original = document.querySelector(`#notesGrid .c-card[data-note-id="${id}"]`);
    if (del){
      const ok = await confirmDialog({title:'Удалить заметку?', message:'Это действие нельзя отменить.'});
      if (!ok) return;
      await fetch(`/api/v1/notes/${id}`, {method:'DELETE', credentials:'same-origin'});
      original?.remove();
      if(card.closest('dialog')) card.closest('dialog').close();
      return;
    }
    if (ed){
      const contentEl = card.querySelector('.c-card__content');
      const old = contentEl.textContent;
      const ta = document.createElement('textarea');
      ta.value = old;
      ta.rows = Math.min(8, Math.max(3, old.split('\n').length));
      ta.style.width='100%';
      contentEl.replaceWith(ta);
      const panel = card.querySelector('.c-card__bottom');
      const actions = panel.querySelector('.card-actions');
      const saveBtn = document.createElement('button');
      saveBtn.type='button';
      saveBtn.className='ui-iconbtn'; saveBtn.setAttribute('aria-label','Сохранить'); saveBtn.dataset.tooltip='Сохранить';
      saveBtn.innerHTML = `<svg><use href="#i-check"/></svg>`;
      const cancelBtn = document.createElement('button');
      cancelBtn.type='button';
      cancelBtn.className='ui-iconbtn ui-iconbtn--muted'; cancelBtn.setAttribute('aria-label','Отмена'); cancelBtn.dataset.tooltip='Отмена';
      cancelBtn.innerHTML = `<svg><use href="#i-x"/></svg>`;
      actions.replaceChildren(cancelBtn, saveBtn);
      cancelBtn.addEventListener('click', ()=>{
        ta.replaceWith(Object.assign(document.createElement('div'),{className:'c-card__content', textContent: old}));
        actions.replaceChildren(document.createRange().createContextualFragment(`<button type=\"button\" class=\"ui-iconbtn js-share\" aria-label=\"Поделиться\" data-tooltip=\"Поделиться\"><svg><use href=\"#i-share\"/></svg></button><button type=\"button\" class=\"ui-iconbtn js-edit\" aria-label=\"Редактировать\" data-tooltip=\"Редактировать\"><svg><use href=\"#i-edit\"/></svg></button>`));
      });
      saveBtn.addEventListener('click', async ()=>{
        const content = ta.value.trim();
        await api(`/api/v1/notes/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content}) });
        ta.replaceWith(Object.assign(document.createElement('div'),{className:'c-card__content', textContent: content}));
        actions.replaceChildren(document.createRange().createContextualFragment(`<button type=\"button\" class=\"ui-iconbtn js-share\" aria-label=\"Поделиться\" data-tooltip=\"Поделиться\"><svg><use href=\"#i-share\"/></svg></button><button type=\"button\" class=\"ui-iconbtn js-edit\" aria-label=\"Редактировать\" data-tooltip=\"Редактировать\"><svg><use href=\"#i-edit\"/></svg></button>`));
        if(original && original!==card){
          original.querySelector('.c-card__content').textContent = content;
        }
      });
    }
    if (pin){
      const newPinned = card.dataset.pinned !== '1';
      await api(`/api/v1/notes/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pinned:newPinned}) });
      [card, original].forEach(c=>{
        if(!c) return;
        c.dataset.pinned = newPinned ? '1' : '0';
        const pbtn = c.querySelector('.js-pin');
        pbtn.classList.toggle('is-active', newPinned);
        pbtn.setAttribute('aria-label', newPinned ? 'Открепить' : 'Закрепить');
        pbtn.dataset.tooltip = newPinned ? 'Открепить' : 'Закрепить';
      });
      if(newPinned && original){ grid.prepend(original); }
      if(!newPinned && original){ grid.append(original); }
      return;
    }
    if (share){
      const text = card.querySelector('.c-card__content').textContent;
      if(navigator.share){ await navigator.share({text}); }
      else if(navigator.clipboard){ await navigator.clipboard.writeText(text); }
      return;
    }
    if (areaChip){
      await openAreaDialog(card);
      return;
    }
    if(!e.target.closest('.c-card__top') && !e.target.closest('.card-actions')){
      openNoteDialog(card);
    }
  }

  grid.addEventListener('click', handleCardAction);
  noteDialog.addEventListener('click', handleCardAction);
});
