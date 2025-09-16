// Base API endpoint for all frontend requests
// Автовыбор: локально используем docker-compose порт 9001
// В проде — прежние боевые адреса (за nginx)
(function () {
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(location.host);
  const API = isLocal
    ? "http://localhost:9001/api/v1"
    : "https://vds.punkt-b.pro/backend/api/v1";
  // expose as both property and global variable for legacy scripts
  window.API_URL = API;
  // eslint-disable-next-line no-unused-vars, no-undef
  if (typeof API_URL === 'undefined') { window.API_URL = API; }
  // also create a var in global scope
  // eslint-disable-next-line no-undef
  API_URL = API;

  const DOMAIN = isLocal ? location.origin : "https://test.intdata.ru";
  const CABINET = DOMAIN;
  const DIAGNOSTICS = DOMAIN + "/diagnostics";
  const CONCLUSION = DOMAIN + "/conclusion";
  window.CABINET_URL = CABINET;
  window.DIAGNOSTICS_URL = DIAGNOSTICS;
  window.CONCLUSION_URL = CONCLUSION;
  window.POLICY_URL = DIAGNOSTICS + "/policy.html";
  window.PROFESSIONS_ALL_URL = DIAGNOSTICS + "/43-professions-all.html";
})();
