// auth: render backend errors if provided
(function(){
  if (!window.AUTH_ERRORS) return;
  const map = {
    username: 'input[name="username"]',
    email: 'input[name="email"]',
    password: '.form-login input[name="password"]'
  };
  Object.entries(window.AUTH_ERRORS).forEach(([name, msg])=>{
    const sel = map[name] || `input[name="${name}"]`;
    document.querySelectorAll(sel).forEach(inp=>{
      const wrap = inp.closest('.field'); if (!wrap) return;
      wrap.classList.add('invalid');
      const err = wrap.querySelector('.error-text'); if (err) err.textContent = msg;
    });
  });
})();

// remind password
(function(){
  const btn = document.querySelector('.form-login .remind-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const username = document.querySelector('.form-login input[name="username"]').value;
    const body = new URLSearchParams({ username });
    try {
      const resp = await fetch('/auth/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      const data = await resp.json();
      alert(data.detail || 'Операция выполнена');
    } catch (e) {
      alert('Ошибка восстановления');
    }
  });
})();
