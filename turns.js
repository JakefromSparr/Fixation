(function initFixationTurns(root, factory) {
  const api = factory(root.FixationEngine, root.FixationSkillTree, root.FixationProgression);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationTurns = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createTurns(
  Engine,
  SkillTree,
  Progression,
) {
  "use strict";

  if (!Engine && typeof require === "function") Engine = require("./engine.js");
  if (!SkillTree && typeof require === "function") SkillTree = require("./skilltree.js");
  if (!Progression && typeof require === "function") Progression = require("./progression.js");

  const RULES = Object.freeze({
    roundLimit: Progression.RULES.maximumRounds,
    roundsToWin: Progression.RULES.roundsToWinGame,
    startingPool: 9,
    freshPotency: 3,
    slotCount: 3,
    poolTileCost: 6,
  });

  function createIdleState() {
    return {
      phase: "setup",
      match: 1,
      game: 1,
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
      formulas: [],
      discoveredFormulas: [],
      skills: SkillTree.createState(true),
      skillsEnabled: true,
      pendingPurchase: null,
      pendingManipulation: null,
      catalysis: null,
      nextTileNumber: 0,
    };
  }

  function createPlayer(name, color) {
    return {
      name,
      color,
      pool: 0,
      slots: [],
      ...Progression.createPlayerProgress(),
      skillUses: SkillTree.createUseState(),
    };
  }

  function startGame(blackName, whiteName, options = {}) {
    const state = createIdleState();
    state.players.black.name = blackName;
    state.players.white.name = whiteName;
    state.skills.enabled = options.skillsEnabled !== false;
    state.skillsEnabled = state.skills.enabled;
    state.phase = "playing";
    resetSkillUses(state);
    beginRound(state);
    return state;
  }

  function beginRound(state) {
    state.board = {};
    state.turn = 1;
    state.currentPlayer = state.round % 2 === 1 ? "black" : "white";
    state.lastMove = null;
    state.roundResult = null;
    state.pendingManipulation = null;
    state.catalysis = null;

    for (const player of Object.values(state.players)) {
      player.pool = (player.poolCapacity || RULES.startingPool) - 1;
      player.slots = createStartingSlots(state, player.color);
      player.stagnatePrimed = false;
    }
    return state;
  }

  function createStartingSlots(state, color) {
    return Array.from({ length: RULES.slotCount }, (_, index) => ({
      status: "live",
      tile: index === 0 ? createHandTile(state, color) : null,
    }));
  }

  function maximumPotency(state) {
    if (hasSkill(state, "quintessence")) return 5;
    if (hasSkill(state, "elevation")) return 4;
    return RULES.freshPotency;
  }

  function defaultExtractionPotency(state) {
    return maximumPotency(state);
  }

  function createHandTile(state, color, potency = defaultExtractionPotency(state)) {
    state.nextTileNumber += 1;
    return {
      id: `${color}-${state.nextTileNumber}`,
      color,
      potency,
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

  function hasSkill(state, id) {
    return SkillTree.isEffective(state.skills, id);
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

  function emptyLiveSlotIndices(player) {
    return player.slots
      .map((slot, index) => (slot.status === "live" && !slot.tile ? index : null))
      .filter((index) => index !== null);
  }

  function canExtract(player) {
    return player.pool > 0 && emptyLiveSlotIndices(player).length > 0;
  }

  function legalPlacementsForSlot(state, slotIndex) {
    const slot = currentPlayer(state).slots[slotIndex];
    if (!slot?.tile) return [];
    const tile = engineTileFor(slot.tile);
    const placements = Engine.legalPlacements(state.board, tile)
      .map((space) => ({ ...space, mode: "place" }));
    if (hasSkill(state, "transmutation")) {
      placements.push(...Engine.legalTransmutations(state.board, tile));
    }
    return placements;
  }

  function canContributeOnBoard(state, player, board) {
    return player.slots.some((slot) => {
      if (!slot.tile) return false;
      const tile = engineTileFor(slot.tile);
      return Engine.legalPlacements(board, tile).length > 0
        || (hasSkill(state, "transmutation")
          && Engine.legalTransmutations(board, tile).length > 0);
    });
  }

  function canContribute(state, player = currentPlayer(state)) {
    return canContributeOnBoard(state, player, state.board);
  }

  function canRefine(state, player) {
    return hasSkill(state, "refine")
      && player.slots.some((slot) => Boolean(slot.tile));
  }

  function canObserve(state, player) {
    return hasSkill(state, "observe") && hasActiveTile(player);
  }

  function canCirculate(state, player) {
    return hasSkill(state, "circulate")
      && emptyLiveSlotIndices(player).length >= 2
      && player.pool >= 2;
  }

  function canFulfill(state, player) {
    const emptyCount = emptyLiveSlotIndices(player).length;
    return hasSkill(state, "fulfill") && emptyCount > 0 && player.pool >= emptyCount;
  }

  function canEnergize(state, player) {
    return hasSkill(state, "energize")
      && !SkillTree.isSpent(player, "energize")
      && player.slots.some((slot) => slot.tile && slot.tile.potency < maximumPotency(state));
  }

  function canFlagrate(state, player) {
    return hasSkill(state, "flagrate")
      && !SkillTree.isSpent(player, "flagrate")
      && hasActiveTile(state.players[opponentColor(player.color)]);
  }

  function canRevitalize(state, player) {
    return hasSkill(state, "revitalize")
      && !SkillTree.isSpent(player, "revitalize")
      && player.slots.some((slot) => slot.status === "collapsed");
  }

  function reanimateTargets(state, player = currentPlayer(state)) {
    if (!hasSkill(state, "reanimate") || player.pool < 1 || player.poolCapacity < 2) return [];
    return SkillTree.ORDER.filter((id) => (
      id !== "reanimate"
      && SkillTree.isEffective(state.skills, id)
      && SkillTree.SKILLS[id].useLimit
      && SkillTree.isSpent(player, id)
    ));
  }

  function canCatalyze(state, player) {
    return hasSkill(state, "catalysis")
      && !SkillTree.isSpent(player, "catalysis")
      && !state.catalysis
      && player.pool > 0
      && player.poolCapacity > 1;
  }

  function canAcerbate(state, player) {
    return hasSkill(state, "acerbation")
      && !SkillTree.isSpent(player, "acerbation")
      && Engine.occupiedTiles(state.board).some((tile) => (
        tile.potency > 1 && tile.remainingPotency > 0
      ));
  }

  function canDulcify(state, player) {
    return hasSkill(state, "dulcification")
      && !SkillTree.isSpent(player, "dulcification")
      && Engine.occupiedTiles(state.board).some((tile) => tile.potency < maximumPotency(state));
  }

  function legalManipulationsForTile(state, fromKey) {
    if (!hasSkill(state, "manipulation") || state.pendingManipulation) return [];
    const player = currentPlayer(state);
    return Engine.legalTileMoves(state.board, fromKey).filter(({ q, r }) => {
      const board = Engine.cloneBoard(state.board);
      Engine.moveTile(board, fromKey, q, r);
      return canContributeOnBoard(state, player, board);
    });
  }

  function canManipulate(state) {
    if (!hasSkill(state, "manipulation") || state.pendingManipulation) return false;
    return Object.keys(state.board).some((key) => legalManipulationsForTile(state, key).length > 0);
  }

  function availableActions(state, player = currentPlayer(state)) {
    if (state.phase !== "playing") return [];
    const actions = [];
    if (canContribute(state, player)) actions.push("contribute");
    if (canExtract(player)) actions.push("extract");
    if (canRefine(state, player)) actions.push("refine");
    if (canObserve(state, player)) actions.push("observe");
    if (canCirculate(state, player)) actions.push("circulate");
    if (canFulfill(state, player)) actions.push("fulfill");
    if (hasSkill(state, "stagnate")
      && !SkillTree.isSpent(player, "stagnate")
      && actions.length) {
      actions.push("stagnate");
    }
    if (canEnergize(state, player)) actions.push("energize");
    if (canFlagrate(state, player)) actions.push("flagrate");
    if (canRevitalize(state, player)) actions.push("revitalize");
    if (reanimateTargets(state, player).length) actions.push("reanimate");
    if (canCatalyze(state, player)) actions.push("catalysis");
    if (canAcerbate(state, player)) actions.push("acerbation");
    if (canDulcify(state, player)) actions.push("dulcification");
    if (canManipulate(state)) actions.push("manipulation");

    if (state.catalysis?.playerColor === player.color) {
      const used = new Set(state.catalysis.actions);
      for (let index = actions.length - 1; index >= 0; index -= 1) {
        if (used.has(actions[index]) || actions[index] === "stagnate"
          || actions[index] === "catalysis") {
          actions.splice(index, 1);
        }
      }
    }
    const nonForfeit = [...actions];
    if (!hasSkill(state, "emanation") || nonForfeit.length === 0) actions.push("forfeit");
    if (state.catalysis?.playerColor === player.color && nonForfeit.length) {
      return actions.filter((action) => action !== "forfeit");
    }
    return actions;
  }

  function canForfeit(state) {
    return availableActions(state).includes("forfeit");
  }

  function decayPlayer(player, amount) {
    const result = Engine.decaySlots(player.slots, amount);
    player.slots = result.slots;
    return result;
  }

  function decaySingleSlot(player, slotIndex, amount) {
    const slot = player.slots[slotIndex];
    if (!slot?.tile) return { slots: player.slots, collapsedIndices: [] };
    const next = slot.tile.potency - amount;
    if (next <= 0) {
      player.slots[slotIndex] = { status: "collapsed", tile: null };
      return { slots: player.slots, collapsedIndices: [slotIndex] };
    }
    slot.tile.potency = next;
    return { slots: player.slots, collapsedIndices: [] };
  }

  function automaticDecay(state, player, amount) {
    if (hasSkill(state, "fixation")) {
      player.stagnatePrimed = false;
      return { slots: player.slots, collapsedIndices: [], fixed: true, stagnated: false };
    }
    if (player.stagnatePrimed) {
      player.stagnatePrimed = false;
      SkillTree.spendUse(player, "stagnate");
      return { slots: player.slots, collapsedIndices: [], stagnated: true };
    }
    return { ...decayPlayer(player, amount), stagnated: false };
  }

  function endTurnDecay(state, player) {
    if (state.catalysis?.playerColor === player.color
      && state.catalysis.actions.length === 0) {
      return emptyDecay();
    }
    return automaticDecay(state, player, 1);
  }

  function mergeDecay(...results) {
    return {
      collapsedIndices: [...new Set(results.flatMap((result) => result.collapsedIndices || []))],
      stagnated: results.some((result) => result.stagnated),
      fixed: results.some((result) => result.fixed),
    };
  }

  function performContribute(state, slotIndex, q, r) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    const sourceSlot = player.slots[slotIndex];
    if (!sourceSlot?.tile) return failed("Choose an active element.");
    const placedTile = engineTileFor(sourceSlot.tile);
    const destination = state.board[Engine.keyOf(q, r)];
    const transmuting = Boolean(destination);
    if (transmuting) {
      if (!hasSkill(state, "transmutation")
        || !Engine.isLegalTransmutation(state.board, placedTile, q, r)) {
        return failed("That element cannot transmute this tile.");
      }
    } else if (!Engine.isLegalPlacement(state.board, placedTile, q, r)) {
      return failed("That element cannot enter there.");
    }

    const oldOpenPotency = Engine.openPotency(state.board);
    const bondCount = Engine.neighborsOf(q, r)
      .filter((neighbor) => state.board[Engine.keyOf(neighbor.q, neighbor.r)])
      .length;
    const lockedPotency = sourceSlot.tile.potency;
    if (transmuting) Engine.transmuteTile(state.board, placedTile, q, r);
    else Engine.placeTile(state.board, placedTile, q, r);
    sourceSlot.tile = null;
    const decay = endTurnDecay(state, player);
    const newOpenPotency = Engine.openPotency(state.board);
    state.lastMove = {
      player: player.color,
      action: transmuting ? "transmutation" : "contribute",
      potency: lockedPotency,
      bonds: bondCount,
      oldOpenPotency,
      newOpenPotency,
    };
    state.pendingManipulation = null;
    const result = actionResult("contribute", player.color, decay, {
      potency: lockedPotency,
      bonds: bondCount,
      q,
      r,
      transmuted: transmuting,
    });
    finishAction(state, result);
    return result;
  }

  function extractionPotencies(state, count, requested) {
    const maximum = maximumPotency(state);
    if (!hasSkill(state, "activation")) {
      return Array.from({ length: count }, () => defaultExtractionPotency(state));
    }
    const values = Array.isArray(requested) ? requested : [requested];
    if (values.length !== count
      || values.some((value) => !Number.isInteger(value) || value < 1 || value > maximum)) {
      return null;
    }
    return values;
  }

  function performExtract(state, slotIndex, requestedPotency) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    const target = player.slots[slotIndex];
    if (!canExtract(player) || target?.status !== "live" || target.tile) {
      return failed("Choose an empty live slot.");
    }
    const potencies = extractionPotencies(state, 1, requestedPotency);
    if (!potencies) return failed("Choose a legal extraction potency.");
    const decay = endTurnDecay(state, player);
    player.slots[slotIndex].tile = createHandTile(state, player.color, potencies[0]);
    player.pool -= 1;
    const result = actionResult("extract", player.color, decay, { potencies });
    finishAction(state, result);
    return result;
  }

  function performCirculate(state, requestedPotencies) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    if (!canCirculate(state, player)) return failed("Circulate requires two empty live slots.");
    return performMultiExtract(state, player, "circulate", 2, requestedPotencies, true);
  }

  function performFulfill(state, requestedPotencies) {
    if (state.phase !== "playing") return failed("The round is not active.");
    const player = currentPlayer(state);
    if (!canFulfill(state, player)) return failed("There are no empty live slots to fulfill.");
    return performMultiExtract(
      state,
      player,
      "fulfill",
      emptyLiveSlotIndices(player).length,
      requestedPotencies,
      false,
    );
  }

  function performMultiExtract(state, player, action, count, requestedPotencies, drawBeforeDecay) {
    const potencies = extractionPotencies(state, count, requestedPotencies);
    if (!potencies) return failed("Choose a legal potency for every extracted tile.");
    const targets = emptyLiveSlotIndices(player).slice(0, count);
    let decay;
    if (drawBeforeDecay) {
      targets.forEach((slotIndex, index) => {
        player.slots[slotIndex].tile = createHandTile(state, player.color, potencies[index]);
      });
      decay = endTurnDecay(state, player);
    } else {
      decay = endTurnDecay(state, player);
      targets.forEach((slotIndex, index) => {
        if (player.slots[slotIndex]?.status === "live" && !player.slots[slotIndex].tile) {
          player.slots[slotIndex].tile = createHandTile(state, player.color, potencies[index]);
        }
      });
    }
    player.pool -= count;
    const result = actionResult(action, player.color, decay, { potencies, targets });
    finishAction(state, result);
    return result;
  }

  function performRefine(state, slotIndex) {
    if (state.phase !== "playing" || !hasSkill(state, "refine")) {
      return failed("Refine is not available.");
    }
    const player = currentPlayer(state);
    const slot = player.slots[slotIndex];
    if (!slot?.tile) return failed("Choose an active hand tile.");
    const targetedDecay = decaySingleSlot(player, slotIndex, 1);
    const automatic = endTurnDecay(state, player);
    const decay = {
      collapsedIndices: [...new Set([
        ...targetedDecay.collapsedIndices,
        ...automatic.collapsedIndices,
      ])],
      stagnated: automatic.stagnated,
    };
    const result = actionResult("refine", player.color, decay, { slotIndex });
    finishAction(state, result);
    return result;
  }

  function performObserve(state) {
    if (state.phase !== "playing" || !canObserve(state, currentPlayer(state))) {
      return failed("Observe is not available.");
    }
    const player = currentPlayer(state);
    const decay = mergeDecay(decayPlayer(player, 2), endTurnDecay(state, player));
    const result = actionResult("observe", player.color, decay);
    finishAction(state, result);
    return result;
  }

  function toggleStagnate(state) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !hasSkill(state, "stagnate")
      || SkillTree.isSpent(player, "stagnate")) {
      return failed("Stagnate is not available.");
    }
    player.stagnatePrimed = !player.stagnatePrimed;
    return { ok: true, action: "stagnate", primed: player.stagnatePrimed };
  }

  function performEnergize(state, slotIndex) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !canEnergize(state, player)) {
      return failed("Energize is not available.");
    }
    const tile = player.slots[slotIndex]?.tile;
    const maximum = maximumPotency(state);
    if (!tile || tile.potency >= maximum) return failed("Choose a tile below maximum potency.");
    tile.potency = Math.min(maximum, tile.potency + 2);
    SkillTree.spendUse(player, "energize");
    const result = actionResult("energize", player.color, endTurnDecay(state, player), {
      slotIndex,
      potency: tile.potency,
    });
    finishAction(state, result);
    return result;
  }

  function performFlagrate(state) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !canFlagrate(state, player)) {
      return failed("Flagrate is not available.");
    }
    const targetColor = opponentColor(player.color);
    const decay = mergeDecay(
      decayPlayer(state.players[targetColor], 1),
      endTurnDecay(state, player),
    );
    SkillTree.spendUse(player, "flagrate");
    const result = actionResult("flagrate", player.color, decay, { targetColor });
    finishAction(state, result);
    return result;
  }

  function performRevitalize(state, slotIndex) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !canRevitalize(state, player)) {
      return failed("Revitalize is not available.");
    }
    if (player.slots[slotIndex]?.status !== "collapsed") {
      return failed("Choose a collapsed slot.");
    }
    player.slots[slotIndex] = { status: "live", tile: null };
    SkillTree.spendUse(player, "revitalize");
    const result = actionResult("revitalize", player.color, emptyDecay(), { slotIndex });
    finishAction(state, result);
    return result;
  }

  function performReanimate(state, targetSkillId) {
    const player = currentPlayer(state);
    if (!reanimateTargets(state, player).includes(targetSkillId)) {
      return failed("Choose an expended single-use action.");
    }
    if (!SkillTree.restoreUse(player, targetSkillId)) {
      return failed("That action cannot be restored.");
    }
    burnPoolTile(player);
    const result = actionResult("reanimate", player.color, endTurnDecay(state, player), {
      targetSkillId,
      poolCapacity: player.poolCapacity,
    });
    finishAction(state, result);
    return result;
  }

  function performCatalysis(state) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !canCatalyze(state, player)) {
      return failed("Catalysis is not available.");
    }
    burnPoolTile(player);
    SkillTree.spendUse(player, "catalysis");
    state.catalysis = { playerColor: player.color, actions: [] };
    return {
      ok: true,
      action: "catalysis",
      intermediate: true,
      poolCapacity: player.poolCapacity,
    };
  }

  function burnPoolTile(player) {
    player.pool -= 1;
    player.poolCapacity -= 1;
  }

  function performDulcification(state, key) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !canDulcify(state, player)) {
      return failed("Dulcification is not available.");
    }
    const tile = Engine.increaseTilePotency(state.board, key, maximumPotency(state));
    if (!tile) return failed("Choose a board tile below maximum potency.");
    SkillTree.spendUse(player, "dulcification");
    state.lastMove = {
      player: player.color,
      action: "dulcification",
      oldOpenPotency: Engine.openPotency(state.board) - 1,
      newOpenPotency: Engine.openPotency(state.board),
    };
    const result = actionResult("dulcification", player.color, endTurnDecay(state, player), {
      key,
      potency: tile.potency,
    });
    finishAction(state, result);
    return result;
  }

  function performAcerbation(state, key) {
    const player = currentPlayer(state);
    if (state.phase !== "playing" || !canAcerbate(state, player)) {
      return failed("Acerbation is not available.");
    }
    const oldOpenPotency = Engine.openPotency(state.board);
    const tile = Engine.decreaseTilePotency(state.board, key);
    if (!tile) return failed("Choose a board tile with open potency.");
    SkillTree.spendUse(player, "acerbation");
    state.lastMove = {
      player: player.color,
      action: "acerbation",
      oldOpenPotency,
      newOpenPotency: Engine.openPotency(state.board),
    };
    const result = actionResult("acerbation", player.color, endTurnDecay(state, player), {
      key,
      potency: tile.potency,
    });
    finishAction(state, result);
    return result;
  }

  function performManipulationMove(state, fromKey, q, r) {
    if (state.phase !== "playing" || !legalManipulationsForTile(state, fromKey)
      .some((space) => space.q === q && space.r === r)) {
      return failed("That movement would disconnect or invalidate the Formula.");
    }
    const originalBoard = Engine.cloneBoard(state.board);
    Engine.moveTile(state.board, fromKey, q, r);
    state.pendingManipulation = {
      playerColor: state.currentPlayer,
      originalBoard,
      fromKey,
      toKey: Engine.keyOf(q, r),
    };
    return {
      ok: true,
      action: "manipulation",
      playerColor: state.currentPlayer,
      intermediate: true,
      fromKey,
      q,
      r,
    };
  }

  function cancelManipulation(state) {
    if (!state.pendingManipulation) return false;
    state.board = state.pendingManipulation.originalBoard;
    state.pendingManipulation = null;
    return true;
  }

  function performForfeit(state) {
    if (state.phase !== "playing") return failed("The round is not active.");
    if (!canForfeit(state)) {
      return failed("Emanation requires every legal action to be exhausted before Forfeit.");
    }
    const forfeitingColor = state.currentPlayer;
    const winnerColor = opponentColor(forfeitingColor);
    const emanation = hasSkill(state, "emanation");
    if (emanation && !Engine.isFormulaComplete(state.board)) {
      endDraw(state, forfeitingColor);
    } else {
      endRound(state, winnerColor, forfeitingColor);
    }
    return {
      ok: true,
      action: "forfeit",
      playerColor: forfeitingColor,
      roundEnded: true,
      roundResult: state.roundResult,
      collapsedIndices: [],
    };
  }

  function actionResult(action, playerColor, decay, details = {}) {
    return {
      ok: true,
      action,
      playerColor,
      collapsedIndices: decay.collapsedIndices || [],
      stagnated: decay.stagnated === true,
      roundEnded: false,
      ...details,
    };
  }

  function emptyDecay() {
    return { collapsedIndices: [], stagnated: false };
  }

  function failed(message) {
    return { ok: false, message };
  }

  function finishAction(state, result) {
    if (result.action === "contribute" && Engine.isFormulaComplete(state.board)) {
      endRound(state, result.playerColor, opponentColor(result.playerColor), "formula-complete");
      result.roundEnded = true;
      result.roundResult = state.roundResult;
      return;
    }
    if (state.catalysis?.playerColor === result.playerColor) {
      if (state.catalysis.actions.includes(result.action)) return;
      state.catalysis.actions.push(result.action);
      if (state.catalysis.actions.length < 2) {
        result.intermediate = true;
        return;
      }
      if (result.action === "revitalize") {
        const decay = automaticDecay(state, state.players[result.playerColor], 1);
        result.collapsedIndices = decay.collapsedIndices;
        result.stagnated = decay.stagnated;
      }
      state.catalysis = null;
    }
    advanceTurn(state);
  }

  function advanceTurn(state) {
    state.currentPlayer = opponentColor(state.currentPlayer);
    state.turn += 1;
  }

  function scoreFormula(state) {
    return Engine.formulaValue(state.board, {
      includeOpen: hasSkill(state, "reclamation"),
    });
  }

  function endRound(state, winnerColor, forfeitingColor, reason = "forfeit") {
    state.phase = "round-end";
    const formula = Engine.recognizeFormula(state.board);
    const fulfilled = Engine.isFormulaComplete(state.board);
    const newlyDiscovered = Boolean(
      formula && !state.discoveredFormulas.includes(formula.name),
    );
    const discoveryBonus = newlyDiscovered && hasSkill(state, "discovery");
    const baseValue = scoreFormula(state);
    const formulaDetails = {
      value: discoveryBonus ? baseValue * 2 : baseValue,
      baseValue,
      discoveryBonus,
      newlyDiscovered,
      tileCount: Engine.occupiedTiles(state.board).length,
      turns: state.turn,
      secure: Boolean(formula && hasSkill(state, "discovery")),
    };
    const progress = Progression.recordRound(
      state,
      winnerColor,
      reason,
      formulaDetails,
    );
    const formulaRecord = formulaDetails.tileCount
      ? createFormulaRecord(state, winnerColor, formula, fulfilled, formulaDetails)
      : null;
    if (formulaRecord) state.formulas.push(formulaRecord);
    if (formula && !state.discoveredFormulas.includes(formula.name)) {
      state.discoveredFormulas.push(formula.name);
    }
    state.roundResult = {
      winnerColor,
      forfeitingColor,
      reason,
      formula,
      fulfilled,
      formulaRecord,
      ...formulaDetails,
      ...progress,
    };
    if (progress.gameComplete && !progress.sessionComplete) {
      state.pendingPurchase = {
        buyerColor: winnerColor,
        resolved: false,
        purchasedSkillIds: [],
        poolPurchases: [],
      };
    }
  }

  function endDraw(state, forfeitingColor) {
    state.phase = "round-end";
    const progress = Progression.recordDraw();
    state.roundResult = {
      winnerColor: null,
      forfeitingColor,
      reason: "cats-game",
      formula: null,
      fulfilled: false,
      formulaRecord: null,
      value: 0,
      tileCount: Engine.occupiedTiles(state.board).length,
      turns: state.turn,
      ...progress,
    };
  }

  function createFormulaRecord(state, winnerColor, formula, fulfilled, details) {
    const signature = Engine.formulaSignature(state.board);
    const remembered = !formula
      ? state.formulas.find((record) => record.signature === signature && record.name)
      : null;
    return {
      id: `formula-${state.formulas.length + 1}`,
      name: formula?.name || remembered?.name || "",
      catalogName: formula?.name || null,
      description: formula?.description || "",
      valenceCode: Engine.valenceCode(state.board),
      edgeCount: Engine.edgeCount(state.board),
      signature,
      value: details.value,
      tileCount: details.tileCount,
      fulfilled,
      completedBy: winnerColor,
      discoveredBy: formula ? null : (remembered?.discoveredBy || remembered?.completedBy || null),
      match: state.match,
      game: state.game,
      round: state.round,
    };
  }

  function nameCurrentFormula(state, name) {
    const record = state.roundResult?.formulaRecord;
    if (!record) return failed("There is no claimed Formula to name.");
    if (!record.fulfilled) return failed("Only a fully fulfilled Formula can be named.");
    if (record.catalogName) return failed("Named Formulas cannot be renamed.");
    if (record.name && record.discoveredBy) return failed("This Formula already has a session name.");
    const cleanName = String(name || "").trim().slice(0, 40);
    if (!cleanName) return failed("Enter a name for this Formula.");
    record.name = cleanName;
    record.discoveredBy = record.completedBy;
    return { ok: true, formulaRecord: record };
  }

  function purchaseSkill(state, id) {
    const pending = state.pendingPurchase;
    if (!pending || pending.resolved) return failed("No skill purchase is pending.");
    const buyer = state.players[pending.buyerColor];
    const result = SkillTree.purchase(state.skills, id, buyer, {
      match: state.match,
      game: state.game,
    });
    if (!result.ok) return result;
    pending.purchasedSkillIds = pending.purchasedSkillIds || [];
    pending.purchasedSkillIds.push(id);
    return result;
  }

  function skipSkillPurchase(state) {
    if (!state.pendingPurchase || state.pendingPurchase.resolved) {
      return failed("No skill purchase is pending.");
    }
    state.pendingPurchase.resolved = true;
    return { ok: true };
  }

  function purchasePoolTile(state, color) {
    const pending = state.pendingPurchase;
    if (!pending || pending.resolved) return failed("No between-game purchase is pending.");
    const player = state.players[color];
    if (!player) return failed("Choose a player.");
    pending.poolPurchases = pending.poolPurchases || [];
    if (pending.poolPurchases.includes(color)) {
      return failed(`${player.name} already added a pool tile this window.`);
    }
    if (player.bankedPoints < RULES.poolTileCost) {
      return failed(`${player.name} needs ${RULES.poolTileCost - player.bankedPoints} more banked points.`);
    }
    player.bankedPoints -= RULES.poolTileCost;
    player.poolCapacity = (player.poolCapacity || RULES.startingPool) + 1;
    pending.poolPurchases.push(color);
    return {
      ok: true,
      color,
      player,
      cost: RULES.poolTileCost,
      poolCapacity: player.poolCapacity,
    };
  }

  function continueFromResult(state) {
    if (!state.roundResult) return state;
    if (state.roundResult.sessionComplete) return createIdleState();
    if (state.roundResult.gameComplete && state.pendingPurchase && !state.pendingPurchase.resolved) {
      return failed("Choose one Discovery or retain the points before continuing.");
    }
    const completedGame = state.roundResult.gameComplete;
    Progression.advance(state, state.roundResult);
    if (completedGame) resetSkillUses(state);
    state.pendingPurchase = null;
    state.phase = "playing";
    return beginRound(state);
  }

  function resetSkillUses(state) {
    for (const player of Object.values(state.players)) {
      player.skillUses = SkillTree.createUseState();
      player.stagnatePrimed = false;
    }
  }

  function setSkillsEnabled(state, enabled) {
    const betweenGames = state.phase === "setup"
      || (state.phase === "round-end" && state.roundResult?.gameComplete);
    if (!betweenGames) return failed("Skills can only be changed during setup or between games.");
    state.skills.enabled = enabled !== false;
    state.skillsEnabled = state.skills.enabled;
    return { ok: true, enabled: state.skills.enabled };
  }

  function normalizeLoadedState(state) {
    if (!state || !state.players || !state.board) {
      throw new Error("The saved duel is incomplete.");
    }
    state.nextTileNumber = Number.isInteger(state.nextTileNumber)
      ? state.nextTileNumber
      : highestTileNumber(state);
    state.match = Number.isInteger(state.match) ? state.match : 1;
    state.game = Number.isInteger(state.game) ? state.game : 1;
    state.round = Number.isInteger(state.round) ? state.round : 1;
    state.formulas = Array.isArray(state.formulas) ? state.formulas : [];
    state.discoveredFormulas = Array.isArray(state.discoveredFormulas)
      ? state.discoveredFormulas
      : state.formulas.map((record) => record.catalogName).filter(Boolean);
    const legacySkills = Object.values(state.players).flatMap((player) => [
      ...(player.unlockedSkills || []),
      ...(player.activeSkills || []),
    ]);
    state.skills = SkillTree.normalizeState(
      state.skills || { enabled: state.skillsEnabled !== false, discovered: legacySkills },
      state.skillsEnabled !== false,
    );
    state.skillsEnabled = state.skills.enabled;
    state.pendingPurchase = state.pendingPurchase || null;
    if (state.pendingManipulation?.originalBoard) {
      state.board = state.pendingManipulation.originalBoard;
    }
    state.pendingManipulation = null;
    state.catalysis = null;
    for (const player of Object.values(state.players)) {
      Progression.ensurePlayerProgress(player);
      player.poolCapacity = Number.isInteger(player.poolCapacity)
        ? player.poolCapacity
        : RULES.startingPool;
      player.skillUses = SkillTree.normalizeUses(player.skillUses);
      player.stagnatePrimed = Boolean(player.stagnatePrimed);
    }
    normalizeRoundResult(state);
    return state;
  }

  function normalizeRoundResult(state) {
    const result = state.roundResult;
    if (!result) return;
    result.gameComplete = Boolean(result.gameComplete);
    result.matchComplete = Boolean(result.matchComplete);
    result.sessionComplete = Boolean(result.sessionComplete);
    result.drawn = Boolean(result.drawn || result.reason === "cats-game");
    result.formulaPoints = Number(result.formulaPoints ?? result.value) || 0;
    result.securedPoints = Number(result.securedPoints) || 0;
    result.bankedPoints = Number(result.bankedPoints) || 0;
    result.discardedPoints = Number(result.discardedPoints) || 0;
    if (result.formulaRecord) {
      const savedRecord = state.formulas.find((record) => record.id === result.formulaRecord.id);
      if (savedRecord) result.formulaRecord = savedRecord;
      else state.formulas.push(result.formulaRecord);
    }
  }

  function highestTileNumber(state) {
    const ids = [
      ...Object.values(state.board).map((tile) => tile.id),
      ...Object.values(state.players).flatMap((player) => (
        (player.slots || []).map((slot) => slot.tile?.id).filter(Boolean)
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
    availableActions,
    beginRound,
    canContribute,
    canAcerbate,
    canDulcify,
    canExtract,
    canForfeit,
    canManipulate,
    cancelManipulation,
    continueFromResult,
    createIdleState,
    currentPlayer,
    defaultExtractionPotency,
    emptyLiveSlotIndices,
    engineTileFor,
    hasActiveTile,
    hasSkill,
    legalManipulationsForTile,
    legalPlacementsForSlot,
    liveSlotCount,
    maximumPotency,
    nameCurrentFormula,
    normalizeLoadedState,
    opponentColor,
    performCirculate,
    performCatalysis,
    performContribute,
    performAcerbation,
    performDulcification,
    performEnergize,
    performExtract,
    performFlagrate,
    performForfeit,
    performFulfill,
    performManipulationMove,
    performObserve,
    performReanimate,
    performRefine,
    performRevitalize,
    purchasePoolTile,
    purchaseSkill,
    reanimateTargets,
    resetSkillUses,
    setSkillsEnabled,
    skipSkillPurchase,
    startGame,
    toggleStagnate,
  });
});
