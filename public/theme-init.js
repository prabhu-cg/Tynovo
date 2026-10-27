// Sets the colour theme before the first paint, so a dark-mode visitor never sees a white flash. A separate file, not inline,
// because the Content-Security-Policy forbids inline scripts. Keep it tiny, dependency-free and in step with src/modules/shared-ui/theme.ts.
(function () {
  var stored = null
  try { stored = localStorage.getItem('tynovo.theme') } catch { /* storage blocked: follow the system */ }
  var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
})()
