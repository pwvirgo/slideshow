// app.js — Slideshow viewer
// Responsibilities: fetch image list, display images, handle slideshow
// controls (pause, resume, next, prev, menu).
// In DB mode: also fetch image metadata and record user actions via
// an action panel that pauses the slideshow.

(function app() {
  // DOM elements
  var currentImage = document.getElementById('current-image');
  var preloadImage = document.getElementById('preload-image');
  var loadingEl = document.getElementById('loading');
  var pauseIndicator = document.getElementById('pause-indicator');
  var menuOverlay = document.getElementById('menu-overlay');
  var resumeBtn = document.getElementById('resume-btn');
  var imageCounter = document.getElementById('image-counter');
  var paramsLink = document.getElementById('params-link');
  var actionIndicator = document.getElementById('action-indicator');

  // Action panel elements
  var actionOverlay = document.getElementById('action-overlay');
  var actionFilename = document.getElementById('action-filename');
  var actionNoteInput = document.getElementById('action-note');
  var actionStatus = document.getElementById('action-status');
  var actionResumeBtn = document.getElementById('action-resume-btn');
  var actionButtons = document.querySelectorAll('.action-btn');

  // Parse URL params
  var urlParams = new URLSearchParams(window.location.search);

  // State
  var images = [];
  var source = 'folder';
  var currentIndex = parseInt(urlParams.get('index')) || 0;
  var displayTimeMs = parseInt(urlParams.get('displayTimeMs')) || 5000;
  var isPaused = false;
  var isMenuOpen = false;
  var isActionPanelOpen = false;
  var timer = null;
  var currentFotoId = null;
  var currentFilename = '';

  // Show a brief toast for action feedback
  function showActionToast(message) {
    if (!actionIndicator) return;
    actionIndicator.textContent = message;
    actionIndicator.classList.add('visible');
    setTimeout(function () {
      actionIndicator.classList.remove('visible');
    }, 1500);
  }

  // Fetch image list from server
  async function fetchImages() {
    var folder = urlParams.get('folder');
    var apiUrl = folder ? '/api/images?folder=' + encodeURIComponent(folder) : '/api/images';
    var response = await fetch(apiUrl);
    return await response.json();
  }

  // DB mode: fetch the foto_id and name for the current image index
  async function fetchImageInfo(index) {
    if (source !== 'db') return;
    try {
      var response = await fetch('/api/imageInfo/' + index);
      var data = await response.json();
      currentFotoId = data.id;
      currentFilename = data.name || '';
    } catch (error) {
      console.error('Failed to fetch image info:', error);
      currentFotoId = null;
      currentFilename = '';
    }
  }

  // DB mode: record an action on the current image
  async function recordAction(act, note) {
    if (source !== 'db' || currentFotoId === null) {
      showActionToast('Actions only available in DB mode');
      return;
    }
    try {
      var response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoId: currentFotoId, act: act, note: note || '' }),
      });
      if (response.ok) {
        actionStatus.textContent = 'Recorded: ' + act;
        actionStatus.style.color = '#6bff6b';
      } else {
        actionStatus.textContent = 'Failed to record: ' + act;
        actionStatus.style.color = '#ff6b6b';
      }
    } catch (error) {
      console.error('Failed to record action:', error);
      actionStatus.textContent = 'Error recording action';
      actionStatus.style.color = '#ff6b6b';
    }
  }

  // Open action panel — pauses slideshow and shows filename + note input
  function openActionPanel() {
    if (source !== 'db') {
      showActionToast('Actions only available in DB mode');
      return;
    }
    if (isActionPanelOpen) return;

    // Pause if not already paused
    if (!isPaused) {
      isPaused = true;
      pauseIndicator.classList.add('visible');
      clearTimeout(timer);
    }

    isActionPanelOpen = true;
    actionFilename.textContent = currentFilename || 'Unknown file';
    actionNoteInput.value = '';
    actionStatus.textContent = '';
    // Clear any previously selected button
    actionButtons.forEach(function (btn) { btn.classList.remove('selected'); });
    actionOverlay.classList.add('visible');
  }

  // Close action panel — stays paused, user must hit Space or Resume to continue
  function closeActionPanel() {
    if (!isActionPanelOpen) return;
    isActionPanelOpen = false;
    actionOverlay.classList.remove('visible');
  }

  // Display an image by index
  function showImage(index) {
    currentIndex = index;
    var imagePath = '/images/' + images[index];
    currentImage.src = imagePath;
    currentImage.style.display = 'block';

    imageCounter.textContent = (index + 1) + ' / ' + images.length;
    paramsLink.href = '/params?index=' + index + '&displayTimeMs=' + displayTimeMs;

    // Preload next image
    var nextIndex = (index + 1) % images.length;
    preloadImage.src = '/images/' + images[nextIndex];

    // In DB mode, fetch the foto_id and filename for action recording
    fetchImageInfo(index);

    scheduleNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!isPaused && !isMenuOpen && !isActionPanelOpen) {
      timer = setTimeout(function () {
        var nextIndex = (currentIndex + 1) % images.length;
        showImage(nextIndex);
      }, displayTimeMs);
    }
  }

  function prevImage() {
    showImage((currentIndex - 1 + images.length) % images.length);
  }

  function nextImage() {
    showImage((currentIndex + 1) % images.length);
  }

  function togglePause() {
    isPaused = !isPaused;
    pauseIndicator.classList.toggle('visible', isPaused);
    if (!isPaused) {
      scheduleNext();
    } else {
      clearTimeout(timer);
      console.log('Paused on image ' + currentIndex + ': ' + images[currentIndex]);
    }
  }

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    menuOverlay.classList.toggle('visible', isMenuOpen);
    if (isMenuOpen) {
      clearTimeout(timer);
    } else if (!isPaused) {
      scheduleNext();
    }
  }

  // Action button clicks in the panel
  actionButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var act = btn.getAttribute('data-act');
      var note = actionNoteInput.value.trim();
      // Highlight the clicked button
      actionButtons.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      recordAction(act, note);
    });
  });

  // Action panel resume button
  actionResumeBtn.addEventListener('click', function () {
    closeActionPanel();
    if (isPaused) {
      togglePause();
    }
  });

  // Keyboard handlers
  document.addEventListener('keydown', function (e) {
    if (images.length === 0) return;

    // If action panel is open, handle keys within it
    if (isActionPanelOpen) {
      // Let typing in the note input work normally
      if (document.activeElement === actionNoteInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeActionPanel();
        }
        return;
      }
      switch (e.key) {
        case 'f':
          e.preventDefault();
          var noteF = actionNoteInput.value.trim();
          actionButtons.forEach(function (b) { b.classList.remove('selected'); });
          document.querySelector('.action-btn[data-act="favorite"]').classList.add('selected');
          recordAction('favorite', noteF);
          break;
        case 'd':
          e.preventDefault();
          var noteD = actionNoteInput.value.trim();
          actionButtons.forEach(function (b) { b.classList.remove('selected'); });
          document.querySelector('.action-btn[data-act="delete"]').classList.add('selected');
          recordAction('delete', noteD);
          break;
        case 'r':
          e.preventDefault();
          var noteR = actionNoteInput.value.trim();
          actionButtons.forEach(function (b) { b.classList.remove('selected'); });
          document.querySelector('.action-btn[data-act="rotate"]').classList.add('selected');
          recordAction('rotate', noteR);
          break;
        case ' ':
          e.preventDefault();
          closeActionPanel();
          if (isPaused) togglePause();
          break;
        case 'Escape':
          e.preventDefault();
          closeActionPanel();
          break;
      }
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (isMenuOpen) toggleMenu();
        togglePause();
        break;
      case 'Escape':
        e.preventDefault();
        toggleMenu();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        prevImage();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextImage();
        break;
      // Action keys: open the action panel
      case 'f':
      case 'd':
      case 'r':
        e.preventDefault();
        openActionPanel();
        break;
    }
  });

  // Menu resume button
  resumeBtn.addEventListener('click', function () {
    if (isMenuOpen) toggleMenu();
    if (isPaused) togglePause();
  });

  // Initialize
  async function init() {
    try {
      var data = await fetchImages();
      images = data.images;
      source = data.source || 'folder';

      if (!urlParams.has('displayTimeMs')) {
        displayTimeMs = data.displayTimeMs;
      }

      if (images.length === 0) {
        loadingEl.textContent = 'No images found';
        return;
      }

      loadingEl.style.display = 'none';
      var startIndex = Math.min(currentIndex, images.length - 1);
      showImage(startIndex);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      loadingEl.textContent = 'Failed to load images';
    }
  }

  init();
})();
