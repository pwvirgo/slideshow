// params.js — Params page
// Responsibilities: load default param values from server, validate inputs,
// update server log level on change. Navigation is handled by native
// form GET submission (action="/slides").

(function() {
  const displayTimeMsInput = document.getElementById('displayTimeMs');
  const logLevelSelect = document.getElementById('logLevel');
  const indexInput = document.getElementById('index');
  const statusEl = document.getElementById('status');
  const backBtn = document.getElementById('back-btn');

  // Preserve image index from incoming URL
  const urlParams = new URLSearchParams(window.location.search);
  indexInput.value = urlParams.get('index') || 0;

  // Load current param values from URL or API
  async function loadParams() {
    if (urlParams.has('displayTimeMs')) {
      displayTimeMsInput.value = urlParams.get('displayTimeMs');
    }

    try {
      const response = await fetch('/api/params');
      const params = await response.json();
      if (!urlParams.has('displayTimeMs')) {
        displayTimeMsInput.value = params.displayTimeMs;
      }
      logLevelSelect.value = params.logLevel;
    } catch (error) {
      console.error('Failed to load params:', error);
    }
  }

  // Show status message
  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }

  // Update log level on server when changed
  logLevelSelect.addEventListener('change', async () => {
    try {
      const response = await fetch('/api/logLevel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logLevel: logLevelSelect.value }),
      });
      if (response.ok) {
        showStatus('Log level updated', false);
      } else {
        showStatus('Failed to update log level', true);
      }
    } catch (error) {
      console.error('Failed to set log level:', error);
      showStatus('Failed to update log level', true);
    }
  });

  // Back button: return to slideshow at same position
  backBtn.addEventListener('click', () => {
    if (document.referrer && document.referrer !== window.location.href) {
      window.history.back();
    } else {
      window.location.href = '/slides';
    }
  });

  // Initialize
  loadParams();
})();
