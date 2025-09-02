import { confirmDialog } from '/static/js/ui/confirm.js';
import { loadAreas, getAreaColor } from '/static/js/area-cache.js';

async function api(url, opts){
  const r = await fetch(url, {credentials:'same-origin', ...opts});
  if(!r.ok) throw new Error(await r.text());
  return r.json().catch(()=>({}));
}

function escapeHtml(str){
  return (str||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/'/g,'&#39;');
}

function autoTextColor(hex){
  hex = (hex||'').replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  if(hex.length!==6) return '#111827';
  const r=parseInt(hex.slice(0,2),16);
  const g=parseInt(hex.slice(2,4),16);
  const b=parseInt(hex.slice(4,6),16);
  const yiq = (r*299 + g*587 + b*114)/1000;
  return yiq >= 128 ? '#111827' : '#fff';
}

function noteCardHTML(n){
  const title = n.title ? `<div class="note-card__title">${escapeHtml(n.title)}</div>` : '';
  const clamped = (n.content||'').length>200 ? ' note-card__body--clamped' : '';
  const bg = n.color || getAreaColor(n.area_id);
  const fg = autoTextColor(bg);
  return `
  <article class="c-card note-card" data-note-id="${n.id}" data-area-id="${n.area_id||''}" data-project-id="${n.project_id||''}" data-pinned="${n.pinned?1:0}" data-title="${escapeHtml(n.title||'')}" style="--note-bg:${bg};--note-fg:${fg};">
    <button type="button" class="icon-btn note-card__pin js-pin${n.pinned?' is-active':''}" aria-label="${n.pinned?'Открепить':'Закрепить'}" data-tooltip="${n.pinned?'Открепить':'Закрепить'}"><svg class="icon"><use href="/static/img/ui/icons.svg#pin"/></svg></button>
    <div class="note-card__body${clamped}">
      ${title}
      <div class="note-card__text">${escapeHtml(n.content||'')}</div>
    </div>
    <div class="note-card__footer">
      <div class="note-chip note-chip--area chip--area">${escapeHtml(n.area?.name||'—')}</div>
      ${n.project ? `<div class="note-chip note-chip--project chip--project">${escapeHtml(n.project.name)}</div>` : ''}
      <div class="note-actions">
        <button type="button" class="icon-btn js-edit" aria-label="Редактировать" data-tooltip="Редактировать"><svg class="icon"><use href="/static/img/ui/icons.svg#edit"/></svg></button>
        <button type="button" class="icon-btn js-del" aria-label="Удалить" data-tooltip="Удалить"><svg class="icon"><use href="/static/img/ui/icons.svg#delete"/></svg></button>
      </div>
    </div>
  </article>`;
}

function renderViewModal(n){
  return `
    <div class="note-modal__header">
      <div class="note-modal__title">${escapeHtml(n.title||'')}</div>
      <div class="note-actions">
        <button type="button" class="icon-btn js-edit" aria-label="Редактировать" data-tooltip="Редактировать"><svg class="icon"><use href="/static/img/ui/icons.svg#edit"/></svg></button>
        <button type="button" class="icon-btn js-close" aria-label="Закрыть" data-tooltip="Закрыть"><svg class="icon"><use href="/static/img/ui/icons.svg#close"/></svg></button>
      </div>
    </div>
    <div class="note-modal__body"><div class="note-card__text">${escapeHtml(n.content||'')}</div></div>
    <div class="note-modal__footer">
      <div class="note-chip note-chip--area">${escapeHtml(n.areaName||'')}</div>
      ${n.projectName?`<div class="note-chip note-chip--project">${escapeHtml(n.projectName)}</div>`:''}
      <div class="note-actions">
        <button type="button" class="icon-btn js-del" aria-label="Удалить" data-tooltip="Удалить"><svg class="icon"><use href="/static/img/ui/icons.svg#delete"/></svg></button>
      </div>
    </div>`;
}

function renderEditModal(n){
  return `
    <form class="note-modal__form" method="dialog">
      <div class="note-modal__header">
        <input class="input" name="title" value="${escapeHtml(n.title||'')}" placeholder="Заголовок"/>
        <div class="note-actions">
          <button type="button" class="icon-btn js-close" aria-label="Закрыть" data-tooltip="Закрыть"><svg class="icon"><use href="/static/img/ui/icons.svg#close"/></svg></button>
        </div>
      </div>
      <div class="note-modal__body">
        <textarea class="textarea" name="content" rows="10">${escapeHtml(n.content||'')}</textarea>
      </div>
      <div class="note-modal__footer">
        <button type="button" class="icon-btn js-save" aria-label="Сохранить" data-tooltip="Сохранить"><svg class="icon"><use href="/static/img/ui/icons.svg#save"/></svg></button>
        <button type="button" class="icon-btn js-cancel" aria-label="Отмена" data-tooltip="Отмена"><svg class="icon"><use href="/static/img/ui/icons.svg#close"/></svg></button>
      </div>
    </form>`;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const grid = document.getElementById('notesGrid');
  const form = document.getElementById('quick-note');
  const noteDialog = document.getElementById('noteDialog');
  await loadAreas();
  if(!grid) return;

  document.querySelectorAll('.note-card').forEach(card=>{
    const bg = card.style.getPropertyValue('--note-bg') || getAreaColor(card.dataset.areaId);
    card.style.setProperty('--note-fg', autoTextColor(bg));
  });

  if(form){
    const areaSel = form.querySelector('select[name="area_id"]');
    const projSel = form.querySelector('select[name="project_id"]');
    const contentTA = form.querySelector('textarea[name="content"]');
    const pinBtn = form.querySelector('.js-qn-pin');
    let pinned = false;
    const areas = await loadAreas();
    areaSel.innerHTML = areas.map(a=>`<option value="${a.id}" data-color="${a.color||''}">${a.name}</option>`).join('');
    const inbox = areas.find(a=> (a.slug||'').toLowerCase()==='inbox' || a.name.toLowerCase()==='входящие');
    if(inbox) areaSel.value = inbox.id;
    async function refreshProjects(){
      const items = await api(`/api/v1/projects?area_id=${areaSel.value}`).catch(()=>[]);
      projSel.innerHTML = '<option value="">Без проекта</option>' + items.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    }
    areaSel.addEventListener('change', refreshProjects); refreshProjects();
    form.addEventListener('focusin', ()=>form.classList.remove('collapsed'));
    contentTA.addEventListener('input', ()=>{contentTA.style.height='auto';contentTA.style.height=Math.min(contentTA.scrollHeight,200)+'px';});
    pinBtn.addEventListener('click', ()=>{ pinned=!pinned; pinBtn.classList.toggle('is-active', pinned); });
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const fd = new FormData(form);
      const content = (fd.get('content')||'').toString().trim();
      if(!content) return;
      const title = (fd.get('title')||'').toString().trim();
      const payload = {content, area_id:Number(fd.get('area_id')), project_id:fd.get('project_id')?Number(fd.get('project_id')):null, pinned};
      if(title) payload.title = title;
      const created = await api('/api/v1/notes',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      form.reset(); pinned=false; pinBtn.classList.remove('is-active'); form.classList.add('collapsed'); if(inbox) areaSel.value=inbox.id; refreshProjects();
      const tmp=document.createElement('div'); tmp.innerHTML=noteCardHTML(created); grid.prepend(tmp.firstElementChild);
    });
  }

  let currentNote = null;
  let snapshot = null;

  function openNote(card){
    currentNote = {
      id:Number(card.dataset.noteId),
      title:card.dataset.title||'',
      areaName:card.querySelector('.chip--area')?.textContent||'',
      projectName:card.querySelector('.chip--project')?.textContent||'',
      content:card.querySelector('.note-card__text')?.textContent||''
    };
    noteDialog.innerHTML = renderViewModal(currentNote);
    noteDialog.dataset.mode='view';
    noteDialog.dataset.dirty='0';
    document.body.classList.add('modal-open');
    noteDialog.showModal();
  }

  function closeModal(){ document.body.classList.remove('modal-open'); noteDialog.close(); }
  function attemptClose(){
    if(noteDialog.dataset.mode==='edit' && noteDialog.dataset.dirty==='1'){
      confirmDialog({title:'Выйти без сохранения?', message:'Изменения будут потеряны.', okText:'Выйти', cancelText:'Продолжить'}).then(ok=>{ if(ok) closeModal(); });
    } else { closeModal(); }
  }
  noteDialog.addEventListener('cancel', e=>{ e.preventDefault(); attemptClose(); });

  noteDialog.addEventListener('click', async e=>{
    if(e.target === noteDialog){ attemptClose(); return; }
    if(e.target.closest('.js-close') || e.target.closest('.js-cancel')){ attemptClose(); return; }
    if(e.target.closest('.js-edit')){
      noteDialog.innerHTML = renderEditModal(currentNote);
      noteDialog.dataset.mode='edit';
      noteDialog.dataset.dirty='0';
      const form = noteDialog.querySelector('form');
      snapshot = {title: form.title.value, content: form.content.value};
      form.addEventListener('input', ()=>{
        noteDialog.dataset.dirty = (form.title.value!==snapshot.title || form.content.value!==snapshot.content)?'1':'0';
      });
      return;
    }
    if(e.target.closest('.js-save')){
      const form = noteDialog.querySelector('form');
      const title = form.title.value.trim();
      const content = form.content.value.trim();
      const payload = {};
      if(title !== snapshot.title) payload.title = title;
      if(content !== snapshot.content) payload.content = content;
      await api(`/api/v1/notes/${currentNote.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      currentNote.title = title; currentNote.content = content;
      const card = grid.querySelector(`[data-note-id="${currentNote.id}"]`);
      card.dataset.title = title;
      const body = card.querySelector('.note-card__body');
      const textEl = card.querySelector('.note-card__text');
      textEl.textContent = content;
      body.classList.toggle('note-card__body--clamped', content.length>200);
      let titleEl = card.querySelector('.note-card__title');
      if(title){ if(titleEl){ titleEl.textContent = title; } else { titleEl = document.createElement('div'); titleEl.className='note-card__title'; titleEl.textContent=title; body.prepend(titleEl); } }
      else if(titleEl){ titleEl.remove(); }
      noteDialog.innerHTML = renderViewModal(currentNote);
      noteDialog.dataset.mode='view';
      noteDialog.dataset.dirty='0';
      return;
    }
    if(e.target.closest('.js-del')){
      const ok = await confirmDialog({title:'Удалить заметку?', message:'Это действие нельзя отменить.', okText:'Удалить', cancelText:'Отмена'});
      if(!ok) return;
      await fetch(`/api/v1/notes/${currentNote.id}`, {method:'DELETE', credentials:'same-origin'});
      grid.querySelector(`[data-note-id="${currentNote.id}"]`)?.remove();
      closeModal();
      return;
    }
  });

  grid.addEventListener('click', async e=>{
    const card = e.target.closest('.note-card');
    if(!card) return;
    if(e.target.closest('.js-del')){
      const ok = await confirmDialog({title:'Удалить заметку?', message:'Это действие нельзя отменить.', okText:'Удалить', cancelText:'Отмена'});
      if(!ok) return;
      await fetch(`/api/v1/notes/${card.dataset.noteId}`, {method:'DELETE', credentials:'same-origin'});
      card.remove();
      return;
    }
    if(e.target.closest('.js-pin')){
      const newPinned = card.dataset.pinned !== '1';
      await api(`/api/v1/notes/${card.dataset.noteId}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pinned:newPinned})});
      card.dataset.pinned = newPinned?'1':'0';
      const pbtn = card.querySelector('.js-pin');
      pbtn.classList.toggle('is-active', newPinned);
      pbtn.setAttribute('aria-label', newPinned?'Открепить':'Закрепить');
      pbtn.dataset.tooltip = newPinned?'Открепить':'Закрепить';
      if(newPinned){ grid.prepend(card); } else { grid.append(card); }
      return;
    }
    if(e.target.closest('.js-edit')){
      openNote(card);
      noteDialog.querySelector('.js-edit')?.dispatchEvent(new Event('click'));
      return;
    }
    if(!e.target.closest('.icon-btn')){
      openNote(card);
    }
  });
});
