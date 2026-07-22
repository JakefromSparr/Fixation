(function initFixationEngine(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createEngine() {
  "use strict";

  const DIRECTIONS = Object.freeze([
    Object.freeze({ q: 1, r: 0 }),
    Object.freeze({ q: -1, r: 0 }),
    Object.freeze({ q: 0, r: 1 }),
    Object.freeze({ q: 0, r: -1 }),
    Object.freeze({ q: 1, r: -1 }),
    Object.freeze({ q: -1, r: 1 }),
  ]);

  const BASE_FORMULAS = Object.freeze([
    Object.freeze({
      name: "Calcination",
      valenceCode: "1:1",
      edgeCount: 1,
      description: "Two volatile elements exhaust one another in a single bond.",
    }),
    Object.freeze({
      name: "Dissolution",
      valenceCode: "2:2:2",
      edgeCount: 3,
      description: "Three balanced elements close into a complete triangular bond.",
    }),
    Object.freeze({
      name: "Separation",
      valenceCode: "1:1:1:3",
      edgeCount: 3,
      description: "Three spent elements radiate from a volatile center.",
    }),
    Object.freeze({
      name: "Conjunction",
      valenceCode: "2:2:3:3",
      edgeCount: 5,
      description: "Four elements lock into a dense paired structure.",
    }),
    Object.freeze({
      name: "Fermentation",
      valenceCode: "1:1:2:3:3",
      edgeCount: 5,
      description: "A five-element arch closes around a single internal cycle.",
    }),
    Object.freeze({
      name: "Calcination Derivative",
      valenceCode: "1:1:2",
      edgeCount: 2,
      description: "A longer linear burn derived from Calcination.",
    }),
    Object.freeze({
      name: "Calcination Derivative",
      valenceCode: "1:1:2:2",
      edgeCount: 3,
      description: "A longer linear burn derived from Calcination.",
    }),
    Object.freeze({
      name: "Calcination Derivative",
      valenceCode: "1:1:2:2:2",
      edgeCount: 4,
      description: "A longer linear burn derived from Calcination.",
    }),
    Object.freeze({
      name: "Dissolution Derivative",
      valenceCode: "1:2:2:3",
      edgeCount: 4,
      description: "A triangular bond carrying one extended element.",
    }),
    Object.freeze({
      name: "Dissolution Derivative",
      valenceCode: "1:2:2:2:3",
      edgeCount: 5,
      description: "A larger structure derived from Dissolution.",
    }),
    Object.freeze({
      name: "Separation Derivative",
      valenceCode: "1:1:1:2:3",
      edgeCount: 4,
      description: "A branching structure derived from Separation.",
    }),
    Object.freeze({
      name: "Conjunction Derivative",
      valenceCode: "1:2:3:3:3",
      edgeCount: 6,
      description: "A dense five-element structure derived from Conjunction.",
    }),
  ]);

  function keyOf(q, r) {
    return `${q},${r}`;
  }

  function coordinatesOf(key) {
    const [q, r] = key.split(",").map(Number);
    return { q, r };
  }

  function neighborsOf(q, r) {
    return DIRECTIONS.map(({ q: dq, r: dr }) => ({ q: q + dq, r: r + dr }));
  }

  function createTile({ id, color, potency }) {
    if (!id || !["black", "white"].includes(color)) {
      throw new Error("A tile requires an id and a black or white color.");
    }
    if (!Number.isInteger(potency) || potency < 1) {
      throw new Error("Potency must be a positive integer.");
    }

    return {
      id,
      color,
      potency,
      remainingPotency: potency,
      q: null,
      r: null,
    };
  }

  function occupiedTiles(board) {
    return Object.values(board);
  }

  function openNeighborsAt(board, q, r) {
    return neighborsOf(q, r)
      .map(({ q: neighborQ, r: neighborR }) => board[keyOf(neighborQ, neighborR)])
      .filter(Boolean);
  }

  function isLegalPlacement(board, tile, q, r) {
    if (!tile || tile.remainingPotency <= 0 || board[keyOf(q, r)]) {
      return false;
    }

    if (occupiedTiles(board).length === 0) {
      return q === 0 && r === 0;
    }

    const touching = openNeighborsAt(board, q, r);
    if (touching.length === 0 || touching.length > tile.remainingPotency) {
      return false;
    }

    return touching.every((neighbor) => neighbor.remainingPotency > 0);
  }

  function legalPlacements(board, tile) {
    if (!tile) return [];
    if (occupiedTiles(board).length === 0) return [{ q: 0, r: 0 }];

    const candidates = new Map();
    for (const placed of occupiedTiles(board)) {
      for (const candidate of neighborsOf(placed.q, placed.r)) {
        const key = keyOf(candidate.q, candidate.r);
        if (!candidates.has(key) && isLegalPlacement(board, tile, candidate.q, candidate.r)) {
          candidates.set(key, candidate);
        }
      }
    }

    return [...candidates.values()];
  }

  function placeTile(board, tile, q, r) {
    if (!isLegalPlacement(board, tile, q, r)) {
      throw new Error(`Illegal placement at ${q},${r}.`);
    }

    const placed = { ...tile, q, r };
    board[keyOf(q, r)] = placed;

    for (const neighbor of openNeighborsAt(board, q, r)) {
      if (neighbor.id === placed.id) continue;
      placed.remainingPotency -= 1;
      neighbor.remainingPotency -= 1;
    }

    return placed;
  }

  function isFormulaComplete(board) {
    const tiles = occupiedTiles(board);
    return tiles.length > 1 && tiles.every((tile) => tile.remainingPotency === 0);
  }

  function hasLegalMove(board, tiles) {
    return tiles.some((tile) => legalPlacements(board, tile).length > 0);
  }

  function formulaValue(board) {
    return occupiedTiles(board).reduce((total, tile) => total + tile.potency, 0);
  }

  function openPotency(board) {
    return occupiedTiles(board).reduce(
      (total, tile) => total + tile.remainingPotency,
      0,
    );
  }

  function edgeCount(board) {
    let connections = 0;
    for (const tile of occupiedTiles(board)) {
      for (const neighbor of openNeighborsAt(board, tile.q, tile.r)) {
        if (tile.id < neighbor.id) connections += 1;
      }
    }
    return connections;
  }

  function valenceCode(board) {
    return occupiedTiles(board)
      .map((tile) => tile.potency)
      .sort((a, b) => a - b)
      .join(":");
  }

  function recognizeFormula(board) {
    if (!isFormulaComplete(board)) return null;
    const code = valenceCode(board);
    const edges = edgeCount(board);
    return BASE_FORMULAS.find((formula) => (
      formula.valenceCode === code && formula.edgeCount === edges
    )) || null;
  }

  function cloneBoard(board) {
    return Object.fromEntries(
      Object.entries(board).map(([key, tile]) => [key, { ...tile }]),
    );
  }

  function decaySlots(slots, amount) {
    if (!Array.isArray(slots) || !Number.isInteger(amount) || amount < 1) {
      throw new Error("Decay requires a slot array and a positive integer amount.");
    }

    const collapsedIndices = [];
    const nextSlots = slots.map((slot, index) => {
      if (slot.status === "collapsed" || !slot.tile) {
        return {
          ...slot,
          tile: slot.tile ? { ...slot.tile } : null,
        };
      }

      const nextPotency = slot.tile.potency - amount;
      if (nextPotency <= 0) {
        collapsedIndices.push(index);
        return { status: "collapsed", tile: null };
      }

      return {
        ...slot,
        tile: { ...slot.tile, potency: nextPotency },
      };
    });

    return { slots: nextSlots, collapsedIndices };
  }

  return Object.freeze({
    BASE_FORMULAS,
    DIRECTIONS,
    cloneBoard,
    coordinatesOf,
    createTile,
    decaySlots,
    edgeCount,
    formulaValue,
    hasLegalMove,
    isFormulaComplete,
    isLegalPlacement,
    keyOf,
    legalPlacements,
    neighborsOf,
    occupiedTiles,
    openPotency,
    placeTile,
    recognizeFormula,
    valenceCode,
  });
});
