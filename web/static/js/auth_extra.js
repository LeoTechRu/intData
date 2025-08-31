// auth: render backend errors if provided
(function(){
  if (!window.AUTH_ERRORS) return;
  const map = {
    username: 'input[name="username"]',
    email: 'input[name="email"]',
    password: '.form-login input[name="password"], .form-register input[name="password"]',
    password2: '.form-register input[name="password2"]'
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

(function(){
  function scorePwd(v){
    let s = 0;
    if (!v) return 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    if (v.length >= 12) s++;
    return Math.min(5, s);
  }
  function bind(input){
    const meter = input.closest('.field').querySelector('.pwd-meter');
    if (!meter) return;
    const bar = meter.firstElementChild;
    function upd(){
      const sc = scorePwd(input.value);
      meter.dataset.score = String(sc||1);
      bar.style.width = (sc*20||20) + '%';
    }
    input.addEventListener('input', upd); upd();
  }
  document.querySelectorAll('.form-register input[name="password"], .auth-form input[name="password"][autocomplete="new-password"]').forEach(bind);
})();

(function(){
  const field = document.querySelector('.form-register .pwd-field');
  if (!field) return;
  const input = field.querySelector('input[name="password"]');
  const hint = field.querySelector('.pwd-hint');
  if (!input || !hint) return;
  function show(){ field.classList.add('show-hint'); }
  function hide(){ field.classList.remove('show-hint'); }
  input.addEventListener('focus', show);
  input.addEventListener('input', show);
  input.addEventListener('blur', hide);
})();

