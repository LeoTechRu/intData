export function handleHabitApiResponse(resp, btn){
  if(resp.status === 403){
    resp.json().then(d=>{
      if(d && d.error === 'tg_link_required'){
        alert('Для этого действия нужно связать Telegram-аккаунт');
      }
    });
    return true;
  }
  if(resp.status === 429){
    const retryHeader = parseInt(resp.headers.get('Retry-After') || '0', 10);
    resp.json().then(d=>{
      const retry = d && d.retry_after ? d.retry_after : retryHeader;
      if(btn){
        btn.disabled = true;
        setTimeout(()=>{ btn.disabled = false; }, retry * 1000);
      }
      alert(`Кулдаун: повторите через ${retry} сек.`);
    });
    return true;
  }
  return false;
}
