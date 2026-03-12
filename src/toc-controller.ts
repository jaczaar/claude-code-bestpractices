export function initTocController(): void {
  const slides = document.querySelectorAll<HTMLElement>('.slide');
  const tocItems = document.querySelectorAll<HTMLElement>('.toc-sidebar-list li');
  const progressFill = document.querySelector<HTMLElement>('.nav-progress-fill');
  const counter = document.querySelector<HTMLElement>('.slide-counter');
  const hint = document.querySelector<HTMLElement>('.nav-hint');
  const prevBtn = document.querySelector<HTMLElement>('.nav-prev');
  const nextBtn = document.querySelector<HTMLElement>('.nav-next');

  if (!slides.length) return;

  const totalSlides = slides.length;
  let currentIndex = 0;
  let isTransitioning = false;
  let firstNav = true;
  let modalOpen = false;

  function updateSidebarVisibility(): void {
    const chapter = slides[currentIndex].dataset.chapter;
    const isIntroOrFinal = chapter === '0' || chapter === '12';
    document.body.classList.toggle('intro-active', isIntroOrFinal);
  }

  function goToSlide(index: number): void {
    if (index === currentIndex || index < 0 || index >= totalSlides || isTransitioning) return;

    isTransitioning = true;

    if (firstNav && hint) {
      hint.classList.add('faded');
      firstNav = false;
    }

    slides[currentIndex].classList.remove('active');
    currentIndex = index;
    slides[currentIndex].classList.add('active');

    updateProgress();
    updateToc();
    updateSidebarVisibility();

    setTimeout(() => {
      isTransitioning = false;
    }, 450);
  }

  function next(): void {
    goToSlide(currentIndex + 1);
  }

  function prev(): void {
    goToSlide(currentIndex - 1);
  }

  function updateProgress(): void {
    const pct = totalSlides > 1 ? (currentIndex / (totalSlides - 1)) * 100 : 0;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (counter) counter.textContent = `${currentIndex + 1} / ${totalSlides}`;
  }

  function updateToc(): void {
    const chapter = slides[currentIndex].dataset.chapter;
    tocItems.forEach((li) => {
      li.classList.toggle('active', li.dataset.chapter === chapter);
    });
  }

  // ── Modal handling ──
  function openModal(id: string): void {
    const modal = document.getElementById(`modal-${id}`);
    if (!modal) return;
    modal.classList.add('open');
    modalOpen = true;
  }

  function closeAllModals(): void {
    document.querySelectorAll<HTMLElement>('.modal-overlay.open').forEach((m) => {
      m.classList.remove('open');
    });
    modalOpen = false;
  }

  // Modal trigger buttons
  document.querySelectorAll<HTMLElement>('.modal-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) openModal(modalId);
    });
  });

  // Modal close buttons
  document.querySelectorAll<HTMLElement>('.modal-close').forEach((btn) => {
    btn.addEventListener('click', closeAllModals);
  });

  // Click overlay backdrop to close
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  // ── Keyboard navigation ──
  document.addEventListener('keydown', (e) => {
    // Close modal on Escape
    if (e.key === 'Escape' && modalOpen) {
      closeAllModals();
      return;
    }

    // Don't navigate while modal is open
    if (modalOpen) return;

    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToSlide(totalSlides - 1);
    }
  });

  // Arrow button clicks
  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);

  // TOC clicks — jump to first slide of that chapter
  tocItems.forEach((li) => {
    li.addEventListener('click', (e) => {
      e.preventDefault();
      const chapter = li.dataset.chapter;
      const target = Array.from(slides).findIndex(
        (s) => s.dataset.chapter === chapter,
      );
      if (target !== -1) goToSlide(target);
    });
  });

  // Touch / swipe support
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    if (modalOpen) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (modalOpen) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      dx > 0 ? prev() : next();
    }
  }, { passive: true });

  // Initialize
  slides[0].classList.add('active');
  updateProgress();
  updateToc();
  updateSidebarVisibility();
}
