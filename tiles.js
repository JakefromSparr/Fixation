(function initFixationTiles(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationTiles = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTiles() {
  "use strict";

  // Potency is the source of truth. Artwork is selected from this catalog whenever
  // the interface renders, so a decaying tile never has to manage its own image.
  const ARTWORK = Object.freeze({
    black: Object.freeze({
      1: "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.Black1.1_adrb7w.png",
      2: "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.Black2.1_fqnciy.png",
      3: "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.Black3.1_xcwdzj.png",
      4: null,
    }),
    white: Object.freeze({
      1: "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648920/Fixation.White1.1_gprwia.png",
      2: "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.White2.1._uplvln.png",
      3: "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648920/Fixation.White3.1._y63ltf.png",
      4: null,
    }),
  });

  const loadedImages = new Map();
  const failedSources = new Set();
  let preloadStarted = false;

  function keyFor(color, potency) {
    return `${color}:${potency}`;
  }

  function sourceFor(color, potency) {
    return ARTWORK[color]?.[potency] || null;
  }

  function imageFor(tile) {
    if (!tile) return null;
    return loadedImages.get(keyFor(tile.color, tile.potency)) || null;
  }

  function hasArtwork(color, potency) {
    return Boolean(sourceFor(color, potency));
  }

  function preload(onUpdate = () => {}) {
    if (preloadStarted || typeof Image === "undefined") return;
    preloadStarted = true;

    for (const color of Object.keys(ARTWORK)) {
      for (const potency of [1, 2, 3, 4]) {
        const source = sourceFor(color, potency);
        if (!source) continue;

        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          loadedImages.set(keyFor(color, potency), image);
          onUpdate();
        };
        image.onerror = () => {
          failedSources.add(source);
          onUpdate();
        };
        image.src = source;
      }
    }
  }

  function handArtwork(tile) {
    const image = imageFor(tile);
    if (!image) {
      return `<strong aria-hidden="true">${tile.potency}</strong>`;
    }

    const source = sourceFor(tile.color, tile.potency);
    return `<img class="tile-art" src="${source}" alt="${tile.color} potency-${tile.potency} element">`;
  }

  function drawArtwork(context, tile, x, y, size) {
    const image = imageFor(tile);
    if (!image) return false;
    context.drawImage(image, x - size / 2, y - size / 2, size, size);
    return true;
  }

  function missingArtwork() {
    return ["black", "white"].flatMap((color) => (
      [1, 2, 3, 4]
        .filter((potency) => !hasArtwork(color, potency))
        .map((potency) => ({ color, potency }))
    ));
  }

  return Object.freeze({
    ARTWORK,
    drawArtwork,
    failedSources,
    handArtwork,
    hasArtwork,
    imageFor,
    missingArtwork,
    preload,
    sourceFor,
  });
});
