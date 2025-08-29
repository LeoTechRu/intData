// Автоматический SSO для Telegram WebApp
(function(){
  try {
    if (!window.Telegram || !Telegram.WebApp) return; // не в WebApp
  } catch (e) { return; }

  // Если уже авторизованы — ничего не делаем
  if (window.__LP_AUTH) return;

  var initData = (Telegram.WebApp && Telegram.WebApp.initData) || '';
  if (!initData) return;

  fetch('/api/v1/auth/tg-webapp/exchange', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ init_data: initData, href: location.href })
  })
  .then(function(r){ return r.json().catch(function(){ return {}; }); })
  .then(function(res){
    if (res && res.ok) {
      location.reload();
    } else {
      console.warn('TG WebApp SSO failed', res);
    }
  })
  .catch(function(e){ console.warn('TG WebApp SSO error', e); });
})();

