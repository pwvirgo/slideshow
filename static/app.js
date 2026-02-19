// app.js — Slideshow viewer
// Responsibilities: fetch image list, display images, handle slideshow
// controls (pause, resume, next, prev, menu).
// In DB mode: menu shows Notes button to annotate images; data appended to CSV.

(function app() {
  // DOM elements
  var currentImage = document.getElementById('current-image');
  var preloadImage = document.getElementById('preload-image');
  var loadingEl = document.getElementById('loading');
  var pauseIndicator = document.getElementById('pause-indicator');
  var menuOverlay = document.getElementById('menu-overlay');
  var notesBtn = document.getElementById('notes-btn');
  var resumeBtn = document.getElementById('resume-btn');
  var imageCounter = document.getElementById('image-counter');
  var paramsLink = document.getElementById('params-link');
  var actionIndicator = document.getElementById('action-indicator');

  // Notes form elements
  var notesOverlay = document.getElementById('notes-overlay');
  var notesFotoId = document.getElementById('notes-foto-id');
  var notesFilename = document.getElementById('notes-filename');
  var notesPath = document.getElementById('notes-path');
  var notesDate = document.getElementById('notes-date');
  var notesNoteDt = document.getElementById('notes-note-dt');
  var notesTitle = document.getElementById('notes-title');
  var notesRenameTo = document.getElementById('notes-rename-to');
  var notesAction = document.getElementById('notes-action');
  var notesStatus = document.getElementById('notes-status');
  var notesCategory = document.getElementById('notes-category');
  var notesLocation = document.getElementById('notes-location');
  var notesRank = document.getElementById('notes-rank');
  var notesNote = document.getElementById('notes-note');
  var notesMsg = document.getElementById('notes-msg');
  var notesCancelBtn = document.getElementById('notes-cancel-btn');
  var notesSubmitBtn = document.getElementById('notes-submit-btn');

  // Parse URL params
  var urlParams = new URLSearchParams(window.location.search);

  // State
  var images = [];
  var source = 'folder';
  var currentIndex = parseInt(urlParams.get('index')) || 0;
  var displayTimeMs = parseInt(urlParams.get('displayTimeMs')) || 5000;
  var isPaused = false;
  var isMenuOpen = false;
  var currentForm = null; // 'notes' or null
  var hasImageError = false;
  var isErrorState = false; // true on startup error; Escape → Control Panel
  var timer = null;
  var currentFotoId = null;
  var currentFilename = '';
  var currentPath = '';
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

  // DB mode: fetch the foto_id, name, path, and dtCreated for the current image index
  async function fetchImageInfo(index) {
    if (source !== 'db') return;
    if (index < 0 || index >= images.length) return;
    try {
      var response = await fetch('/api/imageInfo/' + index);
      if (!response.ok) {
        currentFotoId = null;
        currentFilename = '';
        currentPath = '';
        currentDtCreated = '';
        return;
      }
      var data = await response.json();
      currentFotoId = data.id;
      currentFilename = data.name || '';
      currentPath = data.path || '';
      currentDtCreated = data.dtCreated || '';
    } catch {
      currentFotoId = null;
      currentFilename = '';
      currentPath = '';
      currentDtCreated = '';
    }
  }

  // Notes form
  function openNotesForm() {
    if (source !== 'db') return;
    closeMenu();
    currentForm = 'notes';
    notesFotoId.textContent = currentFotoId !== null ? String(currentFotoId) : 'Unknown';
    notesFilename.textContent = currentFilename || 'Unknown';
    notesPath.textContent = currentPath || 'Unknown';
    notesDate.textContent = currentDtCreated || 'Unknown';
    notesNoteDt.textContent = new Date().toISOString().split('T')[0];
    notesTitle.value = '';
    notesRenameTo.value = '';
    notesAction.value = '';
    notesStatus.value = '';
    notesCategory.value = '';
    notesLocation.value = '';
    notesRank.value = '';
    notesNote.value = '';
    notesMsg.textContent = '';
    notesMsg.className = 'action-status';
    notesOverlay.classList.add('visible');
  }

  function closeNotesForm() {
    currentForm = null;
    notesOverlay.classList.remove('visible');
  }

  async function submitNote() {
    if (source !== 'db' || currentFotoId === null) {
      notesMsg.textContent = 'No image selected';
      notesMsg.className = 'action-status error';
      return;
    }
    try {
      var rankVal = notesRank.value !== '' ? parseInt(notesRank.value) : null;
      var response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fotosId: currentFotoId,
          title: notesTitle.value.trim(),
          renameTo: notesRenameTo.value.trim(),
          action: notesAction.value.trim(),
          status: notesStatus.value.trim(),
          category: notesCategory.value.trim(),
          location: notesLocation.value.trim(),
          rank: rankVal,
          note: notesNote.value.trim(),
        }),
      });
      if (response.ok) {
        notesMsg.textContent = 'Note saved';
        notesMsg.className = 'action-status success';
        showActionToast('Note saved');
        setTimeout(closeNotesForm, 800);
      } else {
        var errData = await response.json();
        notesMsg.textContent = errData.error || 'Failed to save';
        notesMsg.className = 'action-status error';
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      notesMsg.textContent = 'Error saving note';
      notesMsg.className = 'action-status error';
    }
  }

  // Notes form button handlers
  notesCancelBtn.addEventListener('click', function () {
    closeNotesForm();
  });

  notesSubmitBtn.addEventListener('click', function () {
    submitNote();
  });

  // Notes button in menu
  notesBtn.addEventListener('click', function () {
    openNotesForm();
  });

  // Menu resume button
  resumeBtn.addEventListener('click', function () {
    closeMenu();
    resume();
  });

  // Display an image by index
  function showImage(index) {
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

    var nextIndex = (index + 1) % images.length;
    preloadImage.src = '/images/' + images[nextIndex];

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

  function openMenu() {
    if (isMenuOpen) return;
    isMenuOpen = true;
    menuOverlay.classList.add('visible');
    clearTimeout(timer);
    pause();
    // Auto-focus first item for keyboard navigation
    setTimeout(function () {
      var items = getMenuFocusable();
      if (items.length > 0) items[0].focus();
    }, 0);
  }

  function closeMenu() {
    if (!isMenuOpen) return;
    isMenuOpen = false;
    menuOverlay.classList.remove('visible');
  }

  function toggleMenu() {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // Menu keyboard navigation
  function getMenuFocusable() {
    var items = [];
    if (notesBtn && notesBtn.style.display !== 'none') items.push(notesBtn);
    if (resumeBtn) items.push(resumeBtn);
    if (paramsLink) items.push(paramsLink);
    return items;
  }

  function focusMenuNext() {
    var items = getMenuFocusable();
    if (items.length === 0) return;
    var idx = items.indexOf(document.activeElement);
    items[(idx + 1) % items.length].focus();
  }

  function focusMenuPrev() {
    var items = getMenuFocusable();
    if (items.length === 0) return;
    var idx = items.indexOf(document.activeElement);
    items[(idx - 1 + items.length) % items.length].focus();
  }

  // Show error message
  function showError(title, suggestion) {
    loadingEl.innerHTML = '<div style="text-align:center;max-width:500px;padding:20px;">' +
      '<div style="color:#ff6b6b;font-size:18px;margin-bottom:15px;">' + title + '</div>' +
      '<div style="color:#aaa;font-size:14px;">' + suggestion + '</div>' +
      '</div>';
  }

  // Handle image load error (e.g., SSD disconnected during slideshow)
  function handleImageError() {
    hasImageError = true;
    isErrorState = true;
    pause();
    currentImage.style.display = 'none';
    loadingEl.style.display = 'block';
    showError('Image failed to load',
      'The volume may have been disconnected. Press Space to retry or Esc to open Control Panel.');
  }

  // Handle successful image load
  function handleImageLoad() {
    if (hasImageError) {
      hasImageError = false;
      isErrorState = false;
      loadingEl.style.display = 'none';
      currentImage.style.display = 'block';
    }
  }

  // Retry loading current image after error
  function retryImage() {
    if (!hasImageError) return;
    loadingEl.innerHTML = 'Retrying...';
    var imagePath = '/images/' + images[currentIndex] + '?t=' + Date.now();
    currentImage.src = imagePath;
  }

  // Keyboard handler
  document.addEventListener('keydown', function (e) {
    // Error state: Esc → Control Panel; Space → retry if image load error
    if (isErrorState) {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.location.href = '/params';
      } else if (e.key === ' ' && hasImageError) {
        e.preventDefault();
        retryImage();
      }
      return;
    }

    if (images.length === 0) return;

    // Notes form is open
    if (currentForm === 'notes') {
      var activeId = document.activeElement ? document.activeElement.id : '';
      var notesInputIds = ['notes-title', 'notes-rename-to', 'notes-action',
        'notes-status', 'notes-category', 'notes-location', 'notes-rank'];
      if (notesInputIds.indexOf(activeId) !== -1) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeNotesForm();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          submitNote();
        }
        return;
      }
      // In the note textarea: Enter inserts newline (browser default); only Escape is intercepted
      if (e.key === 'Escape') {
        e.preventDefault();
        closeNotesForm();
      }
      return;
    }

    // Menu is open
    if (isMenuOpen) {
      var menuItems = getMenuFocusable();
      var focused = document.activeElement;
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) { focusMenuPrev(); } else { focusMenuNext(); }
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          focusMenuNext();
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          focusMenuPrev();
          break;
        case ' ':
          e.preventDefault();
          if (menuItems.indexOf(focused) !== -1) {
            focused.click();
          } else {
            closeMenu();
            resume();
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeMenu();
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

  // Initialize
  async function init() {
    try {
      var data = await fetchImages();
      images = data.images;
      source = data.source || 'folder';

      // Show Notes button in menu for DB mode
      if (source === 'db' && notesBtn) {
        notesBtn.style.display = 'block';
      }

      if (!urlParams.has('displayTimeMs')) {
        displayTimeMs = data.displayTimeMs;
      }

      // Startup error from server (e.g., missing files, bad DB path)
      if (data.errorInfo) {
        isErrorState = true;
        showError(data.errorInfo.error, data.errorInfo.suggestion);
        return;
      }

      if (images.length === 0) {
        isErrorState = true;
        showError('No images found', 'Check params.json settings and restart the server. Press Esc to open Control Panel.');
        return;
      }

      currentImage.addEventListener('error', handleImageError);
      currentImage.addEventListener('load', handleImageLoad);

      loadingEl.style.display = 'none';
      var startIndex = Math.min(currentIndex, images.length - 1);
      showImage(startIndex);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      isErrorState = true;
      showError('Failed to load images', 'Check that the server is running. Press Esc to open Control Panel.');
    }
  }

  init();
})();
