(function() {
  // DOM elements
  const currentImage = document.getElementById('current-image');
  const preloadImage = document.getElementById('preload-image');
  const loadingEl = document.getElementById('loading');
  const pauseIndicator = document.getElementById('pause-indicator');
  const menuOverlay = document.getElementById('menu-overlay');
  const resumeBtn = document.getElementById('resume-btn');
  const imageCounter = document.getElementById('image-counter');

  // State
  let images = [];
  let currentIndex = 0;
  let displayTimeMs = 5000;
  let isPaused = false;
  let isMenuOpen = false;
  let timer = null;

  // Fetch image list from server
  async function fetchImages() {
    try {
      const response = await fetch('/api/images');
      const data = await response.json();
      images = data.images;
      displayTimeMs = data.displayTimeMs;

      if (images.length === 0) {
        loadingEl.textContent = 'No images found';
        return;
      }

      loadingEl.style.display = 'none';
      showImage(0);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      loadingEl.textContent = 'Failed to load images';
    }
  }

  // Display an image
  function showImage(index) {
    currentIndex = index;
    const imagePath = '/images/' + images[index];
    currentImage.src = imagePath;
    currentImage.style.display = 'block';

    // Update counter
    imageCounter.textContent = `${index + 1} / ${images.length}`;

    // Preload next image
    const nextIndex = (index + 1) % images.length;
    preloadImage.src = '/images/' + images[nextIndex];

    // Schedule next image if not paused
    scheduleNext();
  }

  // Schedule the next image
  function scheduleNext() {
    clearTimeout(timer);
    if (!isPaused && !isMenuOpen) {
      timer = setTimeout(() => {
        const nextIndex = (currentIndex + 1) % images.length;
        showImage(nextIndex);
      }, displayTimeMs);
    }
  }

  // Go to previous image
  function prevImage() {
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    showImage(prevIndex);
  }

  // Go to next image
  function nextImage() {
    const nextIndex = (currentIndex + 1) % images.length;
    showImage(nextIndex);
  }

  // Toggle pause state
  function togglePause() {
    isPaused = !isPaused;
    pauseIndicator.classList.toggle('visible', isPaused);

    if (!isPaused) {
      scheduleNext();
    } else {
      clearTimeout(timer);
    }
  }

  // Toggle menu
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    menuOverlay.classList.toggle('visible', isMenuOpen);

    if (isMenuOpen) {
      clearTimeout(timer);
    } else if (!isPaused) {
      scheduleNext();
    }
  }

  // Keyboard handlers
  document.addEventListener('keydown', (e) => {
    if (images.length === 0) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (isMenuOpen) {
          toggleMenu();
        }
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
    }
  });

  // Resume button click
  resumeBtn.addEventListener('click', () => {
    if (isMenuOpen) {
      toggleMenu();
    }
    if (isPaused) {
      togglePause();
    }
  });

  // Start the slideshow
  fetchImages();
})();
