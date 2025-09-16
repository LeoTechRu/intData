// Diagnostics configuration shared by SPA and static forms
(function () {
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(location.host);
  const API = `${location.origin}/api/v1`;
  window.API_URL = API;
  if (typeof API_URL === 'undefined') {
    window.API_URL = API;
  }
  API_URL = API;

  const baseUrl = location.origin.replace(/\/$/, '');
  const CABINET = `${baseUrl}/diagnostics`;
  const FORMS = `${baseUrl}/diagnostics/forms`;
  const CONCLUSION = `${baseUrl}/diagnostics/conclusion`;

  window.CABINET_URL = CABINET;
  window.DIAGNOSTICS_URL = FORMS;
  window.CONCLUSION_URL = CONCLUSION;
  window.POLICY_URL = `${FORMS}/policy.html`;
  window.PROFESSIONS_ALL_URL = `${FORMS}/43-professions-all.html`;
})();
