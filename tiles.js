(function initFixationTiles(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationTiles = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTiles() {
  "use strict";

  const POTENCIES = Object.freeze([1, 2, 3, 4]);
  const HEX_POINTS = "25,2 75,2 99,44 75,86 25,86 1,44";
  const PALETTE = Object.freeze({
    black: Object.freeze({
      fill: "#261306",
      edge: "#120902",
      innerEdge: "rgba(230, 230, 230, 0.16)",
      pip: "#e6e6e6",
    }),
    white: Object.freeze({
      fill: "#e6e6e6",
      edge: "#8f8c8c",
      innerEdge: "rgba(255, 255, 255, 0.9)",
      pip: "#261306",
    }),
  });

  // The one-, two-, and three-potency layouts retain the centered vertical
  // language of the original pieces. Four uses a compact dice-like square.
  const PIP_LAYOUTS = Object.freeze({
    1: Object.freeze([[0, 0]]),
    2: Object.freeze([[0, -0.22], [0, 0.22]]),
    3: Object.freeze([[0, -0.34], [0, 0], [0, 0.34]]),
    4: Object.freeze([[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]),
  });

  function validColor(color) {
    return Object.prototype.hasOwnProperty.call(PALETTE, color);
  }

  function validPotency(potency) {
    return POTENCIES.includes(Number(potency));
  }

  function paletteFor(color) {
    return PALETTE[validColor(color) ? color : "black"];
  }

  function pipsFor(potency) {
    return PIP_LAYOUTS[Number(potency)] || [];
  }

  function handArtwork(tile) {
    if (!tile || !validColor(tile.color) || !validPotency(tile.potency)) return "";

    const palette = paletteFor(tile.color);
    const pips = pipsFor(tile.potency).map(([horizontal, vertical]) => {
      const cx = 50 + horizontal * 84;
      const cy = 44 + vertical * 84;
      return `<circle class="tile-pip" cx="${cx}" cy="${cy}" r="5.5" fill="${palette.pip}"/>`;
    }).join("");

    return [
      `<svg class="tile-art" viewBox="0 0 100 88" role="img" aria-label="${tile.color} potency ${tile.potency} tile" data-color="${tile.color}" data-potency="${tile.potency}">`,
      `<polygon points="${HEX_POINTS}" fill="${palette.fill}" stroke="${palette.edge}" stroke-width="2.5" stroke-linejoin="round"/>`,
      `<polyline points="26.5,6 73.5,6 94.5,44" fill="none" stroke="${palette.innerEdge}" stroke-width="1.4" stroke-linecap="round"/>`,
      pips,
      "</svg>",
    ].join("");
  }

  function traceHex(context, x, y, radius) {
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI / 3) * index;
      const pointX = x + radius * Math.cos(angle);
      const pointY = y + radius * Math.sin(angle);
      if (index === 0) context.moveTo(pointX, pointY);
      else context.lineTo(pointX, pointY);
    }
    context.closePath();
  }

  function drawArtwork(context, tile, x, y, size) {
    if (!context || !tile || !validColor(tile.color) || !validPotency(tile.potency)) {
      return false;
    }

    const palette = paletteFor(tile.color);
    const radius = size / 2 - 2;

    context.save();
    traceHex(context, x, y, radius);
    context.fillStyle = palette.fill;
    context.fill();
    context.strokeStyle = palette.edge;
    context.lineWidth = 2.2;
    context.lineJoin = "round";
    context.stroke();

    context.beginPath();
    context.moveTo(x - radius * 0.46, y - radius * 0.78);
    context.lineTo(x + radius * 0.46, y - radius * 0.78);
    context.lineTo(x + radius * 0.9, y);
    context.strokeStyle = palette.innerEdge;
    context.lineWidth = 1;
    context.lineCap = "round";
    context.stroke();

    context.fillStyle = palette.pip;
    const pipRadius = Math.max(3.1, radius * 0.11);
    for (const [horizontal, vertical] of pipsFor(tile.potency)) {
      context.beginPath();
      context.arc(
        x + horizontal * radius * 1.714,
        y + vertical * radius * Math.sqrt(3),
        pipRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
    return true;
  }

  // Compatibility shims for older interface code. Tiles are now procedural,
  // so there is no remote source to preload or image object to cache.
  function sourceFor() {
    return null;
  }

  function imageFor() {
    return null;
  }

  function hasArtwork(color, potency) {
    return validColor(color) && validPotency(potency);
  }

  function missingArtwork() {
    return [];
  }

  function preload() {}

  return Object.freeze({
    PALETTE,
    PIP_LAYOUTS,
    POTENCIES,
    drawArtwork,
    handArtwork,
    hasArtwork,
    imageFor,
    missingArtwork,
    preload,
    sourceFor,
  });
});
