// app.js — Slideshow viewer
// Responsibilities: fetch image list, display images, handle slideshow
// controls (pause, resume, next, prev, menu).
// In DB mode: menu shows d/f options, which open action forms.

(function app() {
  // DOM elements
  var currentImage = document.getElementById('current-image');
  var preloadImage = document.getElementById('preload-image');
  var loadingEl = document.getElementById('loading');
  var pauseIndicator = document.getElementById('pause-indicator');
  var menuOverlay = document.getElementById('menu-overlay');
  var dbActionsEl = document.getElementById('db-actions');
  var resumeBtn = document.getElementById('resume-btn');
  var imageCounter = document.getElementById('image-counter');
  var paramsLink = document.getElementById('params-link');
  var actionIndicator = document.getElementById('action-indicator');

  // Delete form elements
  var deleteOverlay = document.getElementById('delete-overlay');
  var deleteFilename = document.getElementById('delete-filename');
  var deleteDate = document.getElementById('delete-date');
  var deleteNote = document.getElementById('delete-note');
  var deleteStatus = document.getElementById('delete-status');
  var deleteCancelBtn = document.getElementById('delete-cancel-btn');
  var deleteSubmitBtn = document.getElementById('delete-submit-btn');

  // Favorite form elements
  var favoriteOverlay = document.getElementById('favorite-overlay');
  var favoriteFilename = document.getElementById('favorite-filename');
  var favoriteDate = document.getElementById('favorite-date');
  var favoriteNote = document.getElementById('favorite-note');
  var favoriteStatus = document.getElementById('favorite-status');
  var favoriteCancelBtn = document.getElementById('favorite-cancel-btn');
  var favoriteSubmitBtn = document.getElementById('favorite-submit-btn');

  // Parse URL params
  var urlParams = new URLSearchParams(window.location.search);

  // State
  var images = [];
  var source = 'folder';
  var currentIndex = parseInt(urlParams.get('index')) || 0;
  var displayTimeMs = parseInt(urlParams.get('displayTimeMs')) || 5000;
  var isPaused = false;
  var isMenuOpen = false;
  var currentForm = null; // 'delete', 'favorite', or null
  var hasImageError = false; // true when image failed to load
  var timer = null;
  var currentFotoId = null;
  var currentFilename = '';
  var currentDtCreated = '';

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

  // DB mode: fetch the foto_id, name, and dtCreated for the current image index
  async function fetchImageInfo(index) {
    if (source !== 'db') return;
    if (index < 0 || index >= images.length) return;
    try {
      var response = await fetch('/api/imageInfo/' + index);
      if (!response.ok) {
        // Index out of bounds or server error — silently ignore
        currentFotoId = null;
        currentFilename = '';
        currentDtCreated = '';
        return;
      }
      var data = await response.json();
      currentFotoId = data.id;
      currentFilename = data.name || '';
      currentDtCreated = data.dtCreated || '';
    } catch {
      // Network error — silently reset state
      currentFotoId = null;
      currentFilename = '';
      currentDtCreated = '';
    }
  }

  // DB mode: record an action on the current image
  async function recordAction(act, note, statusEl) {
    if (source !== 'db' || currentFotoId === null) {
      showActionToast('Actions only available in DB mode');
      return false;
    }
    try {
      var response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoId: currentFotoId, act: act, note: note || '' }),
      });
      if (response.ok) {
        statusEl.textContent = 'Recorded: ' + act;
        statusEl.className = 'action-status success';
        return true;
      } else {
        statusEl.textContent = 'Failed to record';
        statusEl.className = 'action-status error';
        return false;
      }
    } catch (error) {
      console.error('Failed to record action:', error);
      statusEl.textContent = 'Error recording action';
      statusEl.className = 'action-status error';
      return false;
    }
  }

  // Display an image by index
  function showImage(index) {
    // Ensure index is within bounds
    if (images.length === 0) return;
    if (index < 0 || index >= images.length) {
      index = 0;
    }
    currentIndex = index;
    var imagePath = '/images/' + images[index];
    currentImage.src = imagePath;
    currentImage.style.display = 'block';

    imageCounter.textContent = (index + 1) + ' / ' + images.length;
    paramsLink.href = '/params?displayTimeMs=' + displayTimeMs + '&index=' + index;

    // Preload next image
    var nextIndex = (index + 1) % images.length;
    preloadImage.src = '/images/' + images[nextIndex];

    // In DB mode, fetch the foto_id and filename for action recording
    fetchImageInfo(index);

    scheduleNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!isPaused && !isMenuOpen && !currentForm) {
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

  function pause() {
    if (!isPaused) {
      isPaused = true;
      pauseIndicator.classList.add('visible');
      clearTimeout(timer);
    }
  }

  function resume() {
    if (isPaused) {
      isPaused = false;
      pauseIndicator.classList.remove('visible');
      scheduleNext();
    }
  }

  function togglePause() {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }

  // Menu functions
  function openMenu() {
    if (isMenuOpen) return;
    isMenuOpen = true;
    menuOverlay.classList.add('visible');
    clearTimeout(timer);
    // Pause the slideshow when menu opens
    pause();
  }

  function closeMenu() {
    if (!isMenuOpen) return;
    isMenuOpen = false;
    menuOverlay.classList.remove('visible');
    // Stay paused after closing menu
  }

  function toggleMenu() {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // Action form functions
  function openDeleteForm() {
    if (source !== 'db') return;
    closeMenu();
    currentForm = 'delete';
    deleteFilename.textContent = currentFilename || 'Unknown';
    deleteDate.textContent = currentDtCreated || 'Unknown';
    deleteNote.value = '';
    deleteStatus.textContent = '';
    deleteStatus.className = 'action-status';
    deleteOverlay.classList.add('visible');
  }

  function closeDeleteForm() {
    currentForm = null;
    deleteOverlay.classList.remove('visible');
    // Stay paused
  }

  function openFavoriteForm() {
    if (source !== 'db') return;
    closeMenu();
    currentForm = 'favorite';
    favoriteFilename.textContent = currentFilename || 'Unknown';
    favoriteDate.textContent = currentDtCreated || 'Unknown';
    favoriteNote.value = '';
    favoriteStatus.textContent = '';
    favoriteStatus.className = 'action-status';
    favoriteOverlay.classList.add('visible');
  }

  function closeFavoriteForm() {
    currentForm = null;
    favoriteOverlay.classList.remove('visible');
    // Stay paused
  }

  // Button handlers for Delete form
  deleteCancelBtn.addEventListener('click', function () {
    closeDeleteForm();
  });

  deleteSubmitBtn.addEventListener('click', async function () {
    var note = deleteNote.value.trim();
    var success = await recordAction('delete', note, deleteStatus);
    if (success) {
      setTimeout(closeDeleteForm, 800);
    }
  });

  // Button handlers for Favorite form
  favoriteCancelBtn.addEventListener('click', function () {
    closeFavoriteForm();
  });

  favoriteSubmitBtn.addEventListener('click', async function () {
    var note = favoriteNote.value.trim();
    var success = await recordAction('favorite', note, favoriteStatus);
    if (success) {
      setTimeout(closeFavoriteForm, 800);
    }
  });

  // Menu resume button
  resumeBtn.addEventListener('click', function () {
    closeMenu();
    resume();
  });

  // Keyboard handlers
  document.addEventListener('keydown', function (e) {
    if (images.length === 0) return;

    // If Delete form is open
    if (currentForm === 'delete') {
      if (document.activeElement === deleteNote) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDeleteForm();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDeleteForm();
      }
      return;
    }

    // If Favorite form is open
    if (currentForm === 'favorite') {
      if (document.activeElement === favoriteNote) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeFavoriteForm();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFavoriteForm();
      }
      return;
    }

    // If menu is open
    if (isMenuOpen) {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          closeMenu();
          resume();
          break;
        case 'Escape':
          e.preventDefault();
          closeMenu();
          break;
        case 'd':
        case 'D':
          if (source === 'db') {
            e.preventDefault();
            openDeleteForm();
          }
          break;
        case 'f':
        case 'F':
          if (source === 'db') {
            e.preventDefault();
            openFavoriteForm();
          }
          break;
      }
      return;
    }

    // Normal slideshow keys
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (hasImageError) {
          retryImage();
        } else {
          togglePause();
        }
        break;
      case 'Escape':
        e.preventDefault();
        openMenu();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        prevImage();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextImage();
        break;
    }
  });

  // Show error message with styling
  function showError(title, suggestion) {
    loadingEl.innerHTML = '<div style="text-align:center;max-width:500px;padding:20px;">' +
      '<div style="color:#ff6b6b;font-size:18px;margin-bottom:15px;">' + title + '</div>' +
      '<div style="color:#aaa;font-size:14px;">' + suggestion + '</div>' +
      '</div>';
  }

  // Handle image load error (e.g., SSD disconnected)
  function handleImageError() {
    hasImageError = true;
    pause();
    currentImage.style.display = 'none';
    loadingEl.style.display = 'block';
    showError('Image failed to load', 'The volume may have been disconnected. Reconnect and press Space to retry.');
  }

  // Handle successful image load
  function handleImageLoad() {
    if (hasImageError) {
      hasImageError = false;
      loadingEl.style.display = 'none';
      currentImage.style.display = 'block';
    }
  }

  // Retry loading current image after error
  function retryImage() {
    if (!hasImageError) return;
    loadingEl.innerHTML = 'Retrying...';
    // Force reload by adding timestamp to URL
    var imagePath = '/images/' + images[currentIndex] + '?t=' + Date.now();
    currentImage.src = imagePath;
  }

  // Initialize
  async function init() {
    try {
      var data = await fetchImages();
      images = data.images;
      source = data.source || 'folder';

      // Show/hide DB actions in menu based on source
      if (source === 'db' && dbActionsEl) {
        dbActionsEl.style.display = 'block';
      }

      if (!urlParams.has('displayTimeMs')) {
        displayTimeMs = data.displayTimeMs;
      }

      // Check for error info from server
      if (data.errorInfo) {
        showError(data.errorInfo.error, data.errorInfo.suggestion);
        return;
      }

      if (images.length === 0) {
        showError('No images found', 'Check params.json settings and restart the server.');
        return;
      }

      // Set up image event handlers for runtime disconnections and recovery
      currentImage.addEventListener('error', handleImageError);
      currentImage.addEventListener('load', handleImageLoad);

      loadingEl.style.display = 'none';
      var startIndex = Math.min(currentIndex, images.length - 1);
      showImage(startIndex);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      showError('Failed to load images', 'Check that the server is running.');
    }
  }

  init();
})();
