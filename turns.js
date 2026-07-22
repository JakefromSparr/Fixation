(function initFixationTurns(root, factory) {
  const api = factory(root.FixationEngine);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationTurns = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTurns(Engine) {
  "use strict";

  if (!Engine && typeof require === "function") {
    Engine = require("./engine.js");
  }

  const RULES = Object.freeze({
    roundLimit: 3,
    roundsToWin: 2,
    startingPool: 9,
    freshPotency: 4,
    slotCount: 3,
  });

  function createIdleState() {
    return {
      phase: "setup",
      round: 1,
      turn: 1,
      currentPlayer: "black",
      board: {},
      players: {
        black: createPlayer("Black", "black"),
        white: createPlayer("White", "white"),
      },
      lastMove: null,
      roundResult: null,
      nextTileNumber: 0,
    };
  }

  function createPlayer(name, color) {
    return {
      name,
      color,
      pool: 0,
      rounds: 0,
      slots: [],
    };
  }

  function startGame(blackName, whiteName) {
    const state = createIdleState();
    state.players.black.name = blackName;
    state.players.white.name = whiteName;
    state.phase = "playing";
    beginRound(state);
    return state;
  }

  function beginRound(state) {
    state.board = {};
    state.turn = 1;
    state.currentPlayer = state.round % 2 === 1 ? "black" : "white";
    state.lastMove = null;
    state.roundResult = null;

    for (const player of Object.values(state.players)) {
      player.pool = RULES.startingPool - 1;
      player.slots = createStartingSlots(state, player.color);
    }

    return state;
  }

  function createStartingSlots(state, color) {
    return Array.from({ length: RULES.slotCount }, (_, index) => ({
      status: "live",
      tile: index === 0 ? createHandTile(state, color) : null,
    }));
  }

  function createHandTile(state, color) {
    state.nextTileNumber += 1;
    return {
      id: `${color}-${state.nextTileNumber}`,
      color,
      potency: RULES.freshPotency,
    };
  }

  function currentPlayer(state) {
    return state.players[state.currentPlayer];
  }

  function opponentColor(color) {
    return color === "black" ? "white" : "black";
  }

  function engineTileFor(handTile) {
    return Engine.createTile({
      id: handTile.id,
      color: handTile.color,
      potency: handTile.potency,
    });
  }

  function hasActiveTile(player) {
    return player.slots.some((slot) => Boolean(slot.tile));
  }

  function allSlotsCollapsed(player) {
    return player.slots.every((slot) => slot.status === "collapsed");
  }

  function liveSlotCount(player) {
    return player.slots.filter((slot) => slot.status === "live").length;
  }

  function canExtract(player) {
    return player.pool > 0
      && player.slots.some((slot) => slot.status === "live" && !slot.tile);
  }

  function legalPlacementsForSlot(state, slotIndex) {
    const slot = currentPlayer(state).slots[slotIndex];
    if (!slot?.tile) return [];
    return Engine.legalPlacements(state.board, engineTileFor(slot.tile));
  }

  function canContribute(state, player = currentPlayer(state)) {
    return player.slots.some((slot) => (
      slot.tile && Engine.legalPlacements(state.board, engineTileFor(slot.tile)).length > 0
    ));
  }

  function decayPlayer(player, amount) {
    const result = Engine.decaySlots(player.slots, amount);
    player.slots = result.slots;
    return result;
  }

  function performObserve(state) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    if (!hasActiveTile(player)) return failed("There are no active elements to observe.");

    const decay = decayPlayer(player, 2);
    const result = actionResult("observe", player.color, decay);
    resolveAfterAction(state, result);
    return result;
  }

  function performExtract(state, slotIndex) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    const target = player.slots[slotIndex];
    if (!canExtract(player) || target?.status !== "live" || target.tile) {
      return failed("Choose an empty live slot.");
    }

    const decay = decayPlayer(player, 1);
    player.slots[slotIndex].tile = createHandTile(state, player.color);
    player.pool -= 1;

    const result = actionResult("extract", player.color, decay);
    resolveAfterAction(state, result);
    return result;
  }

  function performContribute(state, slotIndex, q, r) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    const sourceSlot = player.slots[slotIndex];
    if (!sourceSlot?.tile) return failed("Choose an active element.");

    const placedTile = engineTileFor(sourceSlot.tile);
    if (!Engine.isLegalPlacement(state.board, placedTile, q, r)) {
      return failed("That element cannot enter there.");
    }

    const oldOpenPotency = Engine.openPotency(state.board);
    const bondCount = Engine.neighborsOf(q, r)
      .filter((neighbor) => state.board[Engine.keyOf(neighbor.q, neighbor.r)])
      .length;
    const lockedPotency = sourceSlot.tile.potency;

    Engine.placeTile(state.board, placedTile, q, r);
    sourceSlot.tile = null;

    const formulaComplete = Engine.isFormulaComplete(state.board);
    const decay = decayPlayer(player, 1);
    const newOpenPotency = Engine.openPotency(state.board);
    state.lastMove = {
      player: player.color,
      potency: lockedPotency,
      bonds: bondCount,
      oldOpenPotency,
      newOpenPotency,
    };

    const result = actionResult("contribute", player.color, decay, {
      potency: lockedPotency,
      bonds: bondCount,
      q,
      r,
    });
    resolveAfterAction(state, result, formulaComplete ? player.color : null);
    return result;
  }

  function actionResult(action, playerColor, decay, details = {}) {
    return {
      ok: true,
      action,
      playerColor,
      collapsedIndices: decay.collapsedIndices,
      roundEnded: false,
      ...details,
    };
  }

  function failed(message) {
    return { ok: false, message };
  }

  function resolveAfterAction(state, result, formulaWinner = null) {
    const player = state.players[result.playerColor];
    if (formulaWinner) {
      endRound(state, formulaWinner, "formula");
    } else if (allSlotsCollapsed(player)) {
      endRound(state, opponentColor(player.color), "collapse");
    } else {
      advanceTurn(state);
    }

    if (state.phase === "round-end") {
      result.roundEnded = true;
      result.roundResult = state.roundResult;
    }
  }

  function advanceTurn(state) {
    state.currentPlayer = opponentColor(state.currentPlayer);
    state.turn += 1;
  }

  function endRound(state, winnerColor, reason) {
    const winner = state.players[winnerColor];
    winner.rounds += 1;
    state.phase = "round-end";

    const formula = reason === "formula" ? Engine.recognizeFormula(state.board) : null;
    const matchComplete = winner.rounds >= RULES.roundsToWin
      || state.round >= RULES.roundLimit;
    state.roundResult = {
      winnerColor,
      reason,
      formula,
      matchComplete,
      value: Engine.formulaValue(state.board),
      tileCount: Engine.occupiedTiles(state.board).length,
      turns: state.turn,
    };
  }

  function continueFromResult(state) {
    if (!state.roundResult) return state;
    if (state.roundResult.matchComplete) return createIdleState();

    state.round += 1;
    state.phase = "playing";
    return beginRound(state);
  }

  function normalizeLoadedState(state) {
    if (!state || !state.players || !state.board) {
      throw new Error("The saved duel is incomplete.");
    }

    state.nextTileNumber = Number.isInteger(state.nextTileNumber)
      ? state.nextTileNumber
      : highestTileNumber(state);
    return state;
  }

  function highestTileNumber(state) {
    const ids = [
      ...Object.values(state.board).map((tile) => tile.id),
      ...Object.values(state.players).flatMap((player) => (
        player.slots.map((slot) => slot.tile?.id).filter(Boolean)
      )),
    ];

    return ids.reduce((highest, id) => {
      const number = Number(String(id).split("-").pop());
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
  }

  return Object.freeze({
    RULES,
    allSlotsCollapsed,
    beginRound,
    canContribute,
    canExtract,
    continueFromResult,
    createIdleState,
    currentPlayer,
    engineTileFor,
    hasActiveTile,
    legalPlacementsForSlot,
    liveSlotCount,
    normalizeLoadedState,
    opponentColor,
    performContribute,
    performExtract,
    performObserve,
    startGame,
  });
});
