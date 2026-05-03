/**
 * Multi-page zine carousels on /zines/
 */
const ZINE_CAROUSELS = {
  "volume-1": {
    label: "Volume 1 — workbook spreads",
    filenames: [
      "0.4V1.png",
      "0.5V1.png",
      "1V1.png",
      "2V1.png",
      "3V1.png",
      "4V1.png",
      "5V1.png",
      "6V1png.png",
      "7V1.png",
      "8V1.png",
      "9V1png.png",
      "10V1.png",
      "11V1.png",
      "12V1.png",
      "13V1.png",
      "14V1.png",
      "15V1.png",
      "16V1.png",
      "17V1.png",
    ],
  },
  "volume-2": {
    label: "Volume 2 — workbook spreads",
    filenames: [
      "1V2.png",
      "2V2.png",
      "3V2.png",
      "4V2.png",
      "5V2.png",
      "6V2.png",
      "7V2.png",
      "8V2.png",
      "9V2.png",
      "10V2.png",
      "11V2.png",
      "12V2.png",
      "13V2.png",
      "14V2.png",
      "15V2.png",
      "16V2.png",
      "17V2.png",
    ],
  },
  "volume-3": {
    label: "Volume 3 — Wasted Writings spreads",
    filenames: [
      "1V3.png",
      "2V3.png",
      "3V3.png",
      "4V3.png",
      "5V3.png",
      "6V3.png",
      "7V3.png",
      "8V3.png",
      "9V3.png",
      "10V3.png",
    ],
  },
};

function pagesForVolume(slug) {
  const c = ZINE_CAROUSELS[slug];
  if (!c) return [];
  const base = `/assets/zine/${slug}/pages`;
  return c.filenames.map((name) => `${base}/${name}`);
}

function carouselArrowButtons(figure) {
  const grid = figure.closest(".zine-volume-grid");
  const prevInGrid = grid?.querySelector(".zine-carousel__arrow--prev");
  const nextInGrid = grid?.querySelector(".zine-carousel__arrow--next");
  if (prevInGrid && nextInGrid) {
    return { prevBtn: prevInGrid, nextBtn: nextInGrid };
  }
  return {
    prevBtn: figure.querySelector(".zine-carousel__arrow--prev"),
    nextBtn: figure.querySelector(".zine-carousel__arrow--next"),
  };
}

function updateCarousel(figure, state) {
  const { config, pages, index } = state;
  const n = pages.length;
  const img = figure.querySelector(".zine-carousel__slide");
  const { prevBtn, nextBtn } = carouselArrowButtons(figure);
  if (!img || !prevBtn || !nextBtn) return;

  img.src = pages[index];
  img.alt = `${config.label} — page ${index + 1} of ${n}`;

  prevBtn.setAttribute("aria-label", "Previous page");
  nextBtn.setAttribute("aria-label", "Next page");
}

function initFigure(figure) {
  const group = figure.dataset.carouselGroup;
  const config = ZINE_CAROUSELS[group];
  if (!config) return;

  const pages = pagesForVolume(group);
  if (pages.length === 0) return;

  const state = { config, pages, index: 0 };

  const goPrev = () => {
    const n = pages.length;
    state.index = state.index <= 0 ? n - 1 : state.index - 1;
    updateCarousel(figure, state);
  };

  const goNext = () => {
    const n = pages.length;
    state.index = state.index >= n - 1 ? 0 : state.index + 1;
    updateCarousel(figure, state);
  };

  const { prevBtn, nextBtn } = carouselArrowButtons(figure);
  prevBtn?.addEventListener("click", goPrev);
  nextBtn?.addEventListener("click", goNext);

  updateCarousel(figure, state);
}

function initZineVolumeCarousels() {
  document.querySelectorAll("[data-zine-carousel][data-carousel-group]").forEach(initFigure);
}

initZineVolumeCarousels();
