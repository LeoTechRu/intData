// Неблокирующая confirm-модалка (aria-friendly)
export async function confirmDialog({title="Подтвердите действие", message="Вы уверены?", okText="Удалить", cancelText="Отмена"} = {}){
  return new Promise((resolve)=>{
    const wrap = document.createElement('div');
    wrap.className = 'ui-modal-wrap';
    wrap.innerHTML = `
      <div class="ui-modal-backdrop" role="presentation"></div>
      <div class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="md-title">
        <h3 id="md-title">${title}</h3>
        <p class="muted" style="margin:.5rem 0 1rem">${message}</p>
        <div class="ui-actions">
          <button class="btn btn-muted" data-act="cancel">${cancelText}</button>
          <button class="btn btn-danger" data-act="ok">${okText}</button>
        </div>
      </div>`;
    const css = document.createElement('style');
    css.textContent = `
      .ui-modal-wrap{position:fixed;inset:0;display:grid;place-items:center;z-index:1000}
      .ui-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.35)}
      .ui-modal{position:relative;background:#fff;border-radius:12px;padding:16px 18px;min-inline-size:280px;max-inline-size:92vw;box-shadow:0 10px 30px rgba(0,0,0,.15)}
      .ui-actions{display:flex;gap:8px;justify-content:flex-end}
      .btn{border:0;border-radius:10px;padding:8px 12px;cursor:pointer}
      .btn-muted{background:#f3f4f6;color:#111827}
      .btn-danger{background:#dc2626;color:#fff}
    `;
    document.body.append(css, wrap);
    const done = (ok) => { wrap.remove(); css.remove(); resolve(ok); };

    wrap.addEventListener('click', (e)=>{
      const a = e.target.closest('[data-act]');
      if (a) return done(a.dataset.act === 'ok');
      if (e.target.classList.contains('ui-modal-backdrop')) return done(false);
    });
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ done(false); document.removeEventListener('keydown', esc); } }, {once:true});
  });
}
