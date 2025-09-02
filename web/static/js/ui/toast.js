export function showToast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.bottom = '20px';
  el.style.right = '20px';
  el.style.background = '#333';
  el.style.color = '#fff';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '4px';
  el.style.zIndex = 1000;
  document.body.appendChild(el);
  setTimeout(()=>{ el.remove(); }, 3000);
}
