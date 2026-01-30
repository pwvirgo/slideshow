(function() {
  const form = document.getElementById('params-form');
  const statusEl = document.getElementById('status');
  const backBtn = document.getElementById('back-btn');
  const displayTimeMsInput = document.getElementById('displayTimeMs');

  // Parse URL params (to preserve index when returning to slideshow)
  const urlParams = new URLSearchParams(window.location.search);
  const imageIndex = urlParams.get('index') || 0;

  // Load current displayTimeMs from URL param or API
  async function loadParams() {
    // First check URL param
    if (urlParams.has('displayTimeMs')) {
      displayTimeMsInput.value = urlParams.get('displayTimeMs');
      return;
    }
    // Fall back to API
    try {
      const response = await fetch('/api/params');
      const params = await response.json();
      displayTimeMsInput.value = params.displayTimeMs;
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

  // Handle form submit - start slideshow
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const displayTime = parseInt(displayTimeMsInput.value);
    if (displayTime < 100) {
      showStatus('Display time must be at least 100ms', true);
      return;
    }

    // Navigate to slideshow with params, preserving image index
    window.location.href = '/slides?displayTimeMs=' + displayTime + '&index=' + imageIndex;
  });

  // Handle back button
  backBtn.addEventListener('click', () => {
    // Go back to slideshow at same position
    const displayTime = parseInt(displayTimeMsInput.value) || 5000;
    window.location.href = '/slides?displayTimeMs=' + displayTime + '&index=' + imageIndex;
  });

  // Initialize
  loadParams();
})();
