// params.js — Control Panel
// Display time and log level take effect immediately.
// Other fields require Save + server restart.

(function() {
  var displayTimeMsInput = document.getElementById('displayTimeMs');
  var logLevelSelect = document.getElementById('logLevel');
  var sourceSelect = document.getElementById('source');
  var dbPathInput = document.getElementById('dbPath');
  var whereClauseInput = document.getElementById('whereClause');
  var imageFolderPathInput = document.getElementById('imageFolderPath');
  var maxDepthInput = document.getElementById('maxDepth');
  var maxFilesInput = document.getElementById('maxFiles');
  var indexInput = document.getElementById('index');
  var statusEl = document.getElementById('status');
  var saveBtn = document.getElementById('save-btn');
  var resumeBtn = document.getElementById('resume-btn');
  var dbParamsDiv = document.getElementById('db-params');
  var folderParamsDiv = document.getElementById('folder-params');

  // Preserve image index from incoming URL
  var urlParams = new URLSearchParams(window.location.search);
  indexInput.value = urlParams.get('index') || 0;

  // Show/hide source-specific sections
  function updateSourceUI(source) {
    if (source === 'db') {
      dbParamsDiv.style.display = 'block';
      folderParamsDiv.style.display = 'none';
    } else {
      dbParamsDiv.style.display = 'none';
      folderParamsDiv.style.display = 'block';
    }
  }

  sourceSelect.addEventListener('change', function() {
    updateSourceUI(sourceSelect.value);
  });

  // Load current param values
  async function loadParams() {
    // Check URL for displayTimeMs
    if (urlParams.has('displayTimeMs')) {
      displayTimeMsInput.value = urlParams.get('displayTimeMs');
    }

    try {
      var response = await fetch('/api/params');
      var params = await response.json();

      if (!urlParams.has('displayTimeMs')) {
        displayTimeMsInput.value = params.displayTimeMs;
      }
      logLevelSelect.value = params.logLevel;
      sourceSelect.value = params.source || 'folder';
      dbPathInput.value = params.dbPath || '';
      whereClauseInput.value = params.whereClause || '';
      imageFolderPathInput.value = params.imageFolderPath || '';
      maxDepthInput.value = params.maxDepth || 3;
      maxFilesInput.value = params.maxFiles || 200;

      updateSourceUI(params.source || 'folder');
    } catch (error) {
      console.error('Failed to load params:', error);
    }
  }

  // Show status message
  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(function() {
      statusEl.className = 'status';
    }, 5000);
  }

  // Log level changes immediately
  logLevelSelect.addEventListener('change', async function() {
    try {
      var response = await fetch('/api/logLevel', {
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
      showStatus('Failed to update log level', true);
    }
  });

  // Save all params to params.json
  saveBtn.addEventListener('click', async function() {
    try {
      var response = await fetch('/api/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceSelect.value,
          dbPath: dbPathInput.value,
          whereClause: whereClauseInput.value,
          imageFolderPath: imageFolderPathInput.value,
          maxDepth: parseInt(maxDepthInput.value) || 3,
          maxFiles: parseInt(maxFilesInput.value) || 200,
        }),
      });
      if (response.ok) {
        showStatus('Saved. Restart server to apply.', false);
      } else {
        var data = await response.json();
        showStatus(data.error || 'Failed to save', true);
      }
    } catch (error) {
      showStatus('Failed to save', true);
    }
  });

  // Resume returns to slideshow with current display time
  resumeBtn.addEventListener('click', function() {
    var idx = indexInput.value || 0;
    var dt = displayTimeMsInput.value || 5000;
    window.location.href = '/slides?displayTimeMs=' + dt + '&index=' + idx;
  });

  loadParams();
})();
