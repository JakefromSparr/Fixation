const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../engine.js");
const SkillTree = require("../skilltree.js");
const Turns = require("../turns.js");
const Tiles = require("../tiles.js");

function enable(state, ...ids) {
  state.skills.discovered.push(...ids.filter((id) => !state.skills.discovered.includes(id)));
}

function calcinationBoard() {
  const board = {};
  Engine.placeTile(board, Engine.createTile({ id: "formula-black", color: "black", potency: 1 }), 0, 0);
  Engine.placeTile(board, Engine.createTile({ id: "formula-white", color: "white", potency: 1 }), 1, 0);
  return board;
}

function claimCalcination(state, winnerColor) {
  state.board = calcinationBoard();
  state.currentPlayer = Turns.opponentColor(winnerColor);
  state.turn = 3;
  return Turns.performForfeit(state);
}

test("a duel begins with one fresh element, two empty slots, and base actions only", () => {
  const state = Turns.startGame("Ada", "Bryn");
  assert.equal(state.currentPlayer, "black");
  assert.equal(state.players.black.pool, 8);
  assert.deepEqual(state.players.black.slots.map((slot) => slot.tile?.potency || null), [3, null, null]);
  assert.deepEqual(Turns.availableActions(state), ["contribute", "extract", "forfeit"]);
});

test("Extract decays active elements before adding a fresh potency-3 element", () => {
  const state = Turns.startGame("Ada", "Bryn");
  const result = Turns.performExtract(state, 1);
  assert.equal(result.ok, true);
  assert.deepEqual(state.players.black.slots.map((slot) => slot.tile?.potency || null), [2, 3, null]);
  assert.equal(state.players.black.pool, 7);
  assert.equal(state.currentPlayer, "white");
});

test("closing every potency immediately wins the round for the contributing player", () => {
  const state = Turns.startGame("Ada", "Bryn");
  state.players.black.slots[0].tile.potency = 1;
  Turns.performContribute(state, 0, 0, 0);
  state.players.white.slots[0].tile.potency = 1;
  const result = Turns.performContribute(state, 0, 1, 0);

  assert.equal(Engine.isFormulaComplete(state.board), true);
  assert.equal(result.roundEnded, true);
  assert.equal(state.phase, "round-end");
  assert.equal(state.roundResult.winnerColor, "white");
  assert.equal(state.roundResult.reason, "formula-complete");
});

test("Forfeit is the only action that ends a normal round", () => {
  const state = Turns.startGame("Ada", "Bryn");
  state.board = calcinationBoard();
  const result = Turns.performForfeit(state);

  assert.equal(result.roundEnded, true);
  assert.equal(state.roundResult.reason, "forfeit");
  assert.equal(state.roundResult.winnerColor, "white");
  assert.equal(state.roundResult.formula.name, "Calcination");
  assert.equal(state.roundResult.formulaPoints, 2);
  assert.deepEqual(state.discoveredFormulas, ["Calcination"]);
});

test("collapsed slots do not automatically end the round", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "observe");
  state.players.black.slots = [0, 1, 2].map((index) => ({
    status: "live",
    tile: { id: `black-doomed-${index}`, color: "black", potency: 2 },
  }));
  const result = Turns.performObserve(state);

  assert.deepEqual(result.collapsedIndices, [0, 1, 2]);
  assert.equal(result.roundEnded, false);
  assert.equal(state.phase, "playing");
});

test("a player with no legal action sees Forfeit as the only base option", () => {
  const state = Turns.startGame("Ada", "Bryn");
  state.players.black.pool = 0;
  state.players.black.slots = [0, 1, 2].map(() => ({ status: "collapsed", tile: null }));
  assert.deepEqual(Turns.availableActions(state), ["forfeit"]);
});

test("base scoring ignores open tiles while Reclamation counts them", () => {
  const base = Turns.startGame("Ada", "Bryn");
  Engine.placeTile(base.board, Engine.createTile({ id: "b3", color: "black", potency: 3 }), 0, 0);
  Engine.placeTile(base.board, Engine.createTile({ id: "w1", color: "white", potency: 1 }), 1, 0);
  base.currentPlayer = "black";
  Turns.performForfeit(base);
  assert.equal(base.roundResult.formulaPoints, 1);

  const reclaimed = Turns.startGame("Ada", "Bryn");
  enable(reclaimed, "reclamation");
  reclaimed.board = Engine.cloneBoard(base.board);
  reclaimed.currentPlayer = "black";
  Turns.performForfeit(reclaimed);
  assert.equal(reclaimed.roundResult.formulaPoints, 4);
});

test("only fulfilled Formulas may be named", () => {
  const open = Turns.startGame("Ada", "Bryn");
  Turns.performContribute(open, 0, 0, 0);
  Turns.performForfeit(open);
  assert.equal(Turns.nameCurrentFormula(open, "Rot").ok, false);

  const closed = Turns.startGame("Ada", "Bryn");
  claimCalcination(closed, "white");
  assert.equal(Turns.nameCurrentFormula(closed, "First Light").ok, false);
  assert.equal(closed.formulas[0].name, "Calcination");
});

test("Discovery doubles and immediately protects a named Formula the first time only", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "discovery");
  claimCalcination(state, "white");
  assert.equal(state.players.white.gamePoints, 4);
  assert.equal(state.players.white.securedGamePoints, 4);
  assert.equal(state.players.white.bankedPoints, 4);
  assert.equal(state.roundResult.discoveryBonus, true);
  Turns.continueFromResult(state);
  claimCalcination(state, "white");
  assert.equal(state.roundResult.formulaPoints, 2);
  assert.equal(state.roundResult.discoveryBonus, false);
});

test("a game winner may purchase multiple Discoveries before finishing", () => {
  const state = Turns.startGame("Ada", "Bryn");
  state.players.white.bankedPoints = 30;
  claimCalcination(state, "white");
  Turns.continueFromResult(state);
  claimCalcination(state, "white");

  assert.equal(state.roundResult.gameComplete, true);
  assert.equal(state.pendingPurchase.buyerColor, "white");
  assert.equal(Turns.continueFromResult(state).ok, false);
  assert.equal(Turns.purchaseSkill(state, "discovery").ok, true);
  assert.equal(Turns.purchaseSkill(state, "refine").ok, true);
  assert.equal(state.skills.discovered.includes("refine"), true);
  assert.equal(state.skills.discovered.includes("discovery"), true);
  assert.equal(state.pendingPurchase.resolved, false);

  Turns.skipSkillPurchase(state);
  Turns.continueFromResult(state);
  assert.equal(state.game, 2);
  assert.equal(state.round, 1);
  assert.equal(state.players.black.skillUses.stagnate, 0);
});

test("either player may buy one permanent pool tile per between-game window", () => {
  const state = Turns.startGame("Ada", "Bryn");
  state.players.black.bankedPoints = 12;
  state.players.white.bankedPoints = 12;
  claimCalcination(state, "white");
  Turns.continueFromResult(state);
  claimCalcination(state, "white");

  assert.equal(Turns.purchasePoolTile(state, "black").ok, true);
  assert.equal(Turns.purchasePoolTile(state, "white").ok, true);
  assert.equal(Turns.purchasePoolTile(state, "black").ok, false);
  assert.equal(state.players.black.poolCapacity, 10);
  assert.equal(state.players.white.poolCapacity, 10);
  Turns.skipSkillPurchase(state);
  Turns.continueFromResult(state);
  assert.equal(state.players.black.pool, 9);
  assert.equal(state.players.white.pool, 9);
});

test("Observe and Refine remain independently available", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "refine", "observe");
  state.players.black.slots[0].tile.potency = 4;
  assert.equal(Turns.availableActions(state).includes("refine"), true);
  assert.equal(Turns.availableActions(state).includes("observe"), true);
  Turns.performObserve(state);
  assert.equal(state.players.black.slots[0].tile.potency, 1);
});

test("Refine applies targeted decay and then normal end-turn decay to the full hand", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "refine");
  state.players.black.slots = [3, 4, 4].map((potency, index) => ({
    status: "live",
    tile: { id: `black-${index}`, color: "black", potency },
  }));

  Turns.performRefine(state, 0);
  assert.deepEqual(
    state.players.black.slots.map((slot) => slot.tile?.potency),
    [1, 3, 3],
  );
});

test("Stagnate prevents one automatic hand decay and is then spent", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "refine", "stagnate");
  assert.equal(Turns.toggleStagnate(state).primed, true);
  const result = Turns.performExtract(state, 1);
  assert.equal(result.stagnated, true);
  assert.equal(state.players.black.slots[0].tile.potency, 3);
  assert.equal(SkillTree.isSpent(state.players.black, "stagnate"), true);
});

test("actions apply normal decay while Revitalize does not", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "energize", "flagrate", "revitalize", "reanimate");
  state.players.black.slots[0].tile.potency = 2;
  Turns.performEnergize(state, 0);
  assert.equal(state.players.black.slots[0].tile.potency, 2);

  state.currentPlayer = "black";
  const before = state.players.white.slots[0].tile.potency;
  Turns.performFlagrate(state);
  assert.equal(state.players.white.slots[0].tile.potency, before - 1);

  state.currentPlayer = "black";
  state.players.black.slots[1] = { status: "collapsed", tile: null };
  Turns.performRevitalize(state, 1);
  assert.equal(state.players.black.slots[1].status, "live");

  state.currentPlayer = "black";
  assert.ok(Turns.reanimateTargets(state).includes("energize"));
  Turns.performReanimate(state, "energize");
  assert.equal(SkillTree.isSpent(state.players.black, "energize"), false);
  assert.equal(state.players.black.poolCapacity, 8);
  assert.equal(Turns.reanimateTargets(state).includes("reanimate"), false);
});

test("Circulate draws before decay while Fulfill decays before drawing", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "circulate", "fulfill");
  assert.equal(Turns.availableActions(state).includes("circulate"), true);
  assert.equal(Turns.availableActions(state).includes("fulfill"), true);
  Turns.performCirculate(state);
  assert.deepEqual(state.players.black.slots.map((slot) => slot.tile?.potency), [2, 2, 2]);

  const fulfilled = Turns.startGame("Ada", "Bryn");
  enable(fulfilled, "fulfill");
  Turns.performFulfill(fulfilled);
  assert.deepEqual(fulfilled.players.black.slots.map((slot) => slot.tile?.potency), [2, 3, 3]);
});

test("Quintessence extracts potency 5 and Activation selects any available potency", () => {
  const elevation = Turns.startGame("Ada", "Bryn");
  enable(elevation, "elevation");
  Turns.performExtract(elevation, 1);
  assert.equal(elevation.players.black.slots[1].tile.potency, 4);

  const quintessence = Turns.startGame("Ada", "Bryn");
  enable(quintessence, "quintessence");
  Turns.performExtract(quintessence, 1);
  assert.equal(quintessence.players.black.slots[1].tile.potency, 5);

  const activation = Turns.startGame("Ada", "Bryn");
  enable(activation, "quintessence", "activation");
  Turns.performExtract(activation, 1, 2);
  assert.equal(activation.players.black.slots[1].tile.potency, 2);
  activation.currentPlayer = "black";
  assert.equal(Turns.performExtract(activation, 2, 6).ok, false);
});

test("Reanimate is repeatable and permanently burns one pool tile per use", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "energize", "stagnate", "reanimate");
  state.players.black.skillUses.energize = 1;
  const capacity = state.players.black.poolCapacity;
  const pool = state.players.black.pool;
  assert.equal(Turns.performReanimate(state, "energize").ok, true);
  assert.equal(state.players.black.poolCapacity, capacity - 1);
  assert.equal(state.players.black.pool, pool - 1);
  state.currentPlayer = "black";
  state.players.black.skillUses.stagnate = 1;
  assert.equal(Turns.performReanimate(state, "stagnate").ok, true);
  assert.equal(state.players.black.poolCapacity, capacity - 2);
});

test("Catalysis burns a pool tile and grants two different actions with one final decay", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "catalysis", "energize");
  state.players.black.slots[0].tile.potency = 1;
  assert.equal(Turns.performCatalysis(state).ok, true);
  assert.equal(state.players.black.poolCapacity, 8);
  Turns.performExtract(state, 1);
  assert.equal(state.currentPlayer, "black");
  assert.equal(Turns.availableActions(state).includes("extract"), false);
  Turns.performEnergize(state, 0);
  assert.equal(state.currentPlayer, "white");
  assert.deepEqual(
    state.players.black.slots.map((slot) => slot.tile?.potency || null),
    [2, 2, null],
  );
});

test("Fixation prevents normal end-turn decay", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "fixation", "energize");
  state.players.black.slots[0].tile.potency = 1;
  Turns.performExtract(state, 1);
  assert.deepEqual(
    state.players.black.slots.map((slot) => slot.tile?.potency || null),
    [1, 3, null],
  );
});

test("Acerbation removes one open potency and still ends with hand decay", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "acerbation");
  Engine.placeTile(state.board, Engine.createTile({ id: "open", color: "white", potency: 3 }), 0, 0);
  const result = Turns.performAcerbation(state, "0,0");
  assert.equal(result.ok, true);
  assert.equal(state.board["0,0"].potency, 2);
  assert.equal(state.board["0,0"].remainingPotency, 2);
  assert.equal(state.players.black.slots[0].tile.potency, 2);
});

test("custom Formula names and discoverers return for equivalent structures", () => {
  const state = Turns.startGame("Ada", "Bryn");
  const first = Object.fromEntries([
    [0, 0, 1], [1, 0, 2], [2, 0, 2], [3, 0, 1],
  ].map(([q, r, potency], index) => [
    Engine.keyOf(q, r),
    {
      id: `custom-${index}`,
      color: index % 2 ? "white" : "black",
      potency,
      remainingPotency: 0,
      q,
      r,
    },
  ]));
  state.board = first;
  state.currentPlayer = "black";
  Turns.performForfeit(state);
  assert.equal(Turns.nameCurrentFormula(state, "The Vessel").ok, true);
  const signature = state.formulas[0].signature;

  Turns.continueFromResult(state);
  state.board = Object.fromEntries(
    Object.entries(first).map(([key, tile]) => {
      const q = tile.q + 3;
      const r = tile.r - 2;
      return [Engine.keyOf(q, r), { ...tile, q, r, color: tile.color === "black" ? "white" : "black" }];
    }),
  );
  state.currentPlayer = "black";
  Turns.performForfeit(state);
  assert.equal(state.roundResult.formulaRecord.signature, signature);
  assert.equal(state.roundResult.formulaRecord.name, "The Vessel");
  assert.equal(state.roundResult.formulaRecord.discoveredBy, "white");
});

test("Dulcification raises one board tile and Transmutation replaces by one", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "elevation", "dulcification", "transmutation");
  state.players.black.slots[0].tile.potency = 3;
  Turns.performContribute(state, 0, 0, 0);
  state.currentPlayer = "black";
  assert.equal(Turns.performDulcification(state, "0,0").ok, true);
  assert.equal(state.board["0,0"].potency, 4);

  state.currentPlayer = "white";
  state.players.white.slots[0].tile.potency = 3;
  const result = Turns.performContribute(state, 0, 0, 0);
  assert.equal(result.transmuted, true);
  assert.equal(state.board["0,0"].potency, 3);
  assert.equal(state.board["0,0"].underTiles.length, 1);
});

test("Manipulation moves a connected tile but does not consume the turn until Contribute", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "manipulation");
  state.board = {};
  Engine.placeTile(state.board, Engine.createTile({ id: "a", color: "black", potency: 3 }), 0, 0);
  Engine.placeTile(state.board, Engine.createTile({ id: "b", color: "white", potency: 2 }), 1, 0);
  const moves = Turns.legalManipulationsForTile(state, "1,0");
  assert.ok(moves.length > 0);
  const result = Turns.performManipulationMove(state, "1,0", moves[0].q, moves[0].r);
  assert.equal(result.intermediate, true);
  assert.equal(state.turn, 1);
  assert.equal(Turns.cancelManipulation(state), true);
  assert.ok(state.board["1,0"]);
});

test("Emanation blocks voluntary Forfeit and draws an exhausted open Formula", () => {
  const active = Turns.startGame("Ada", "Bryn");
  enable(active, "emanation");
  assert.equal(Turns.canForfeit(active), false);
  assert.equal(Turns.performForfeit(active).ok, false);

  const exhausted = Turns.startGame("Ada", "Bryn");
  enable(exhausted, "emanation");
  exhausted.players.black.pool = 0;
  exhausted.players.black.slots = [0, 1, 2].map(() => ({ status: "collapsed", tile: null }));
  Engine.placeTile(exhausted.board, Engine.createTile({ id: "open", color: "black", potency: 4 }), 0, 0);
  assert.deepEqual(Turns.availableActions(exhausted), ["forfeit"]);
  Turns.performForfeit(exhausted);
  assert.equal(exhausted.roundResult.drawn, true);
  assert.equal(exhausted.players.white.rounds, 0);
});

test("loading relinks the active Formula record and preserves shared progression", () => {
  const state = Turns.startGame("Ada", "Bryn");
  enable(state, "discovery");
  claimCalcination(state, "white");
  const loaded = Turns.normalizeLoadedState(JSON.parse(JSON.stringify(state)));
  const rename = Turns.nameCurrentFormula(loaded, "Remembered Light");

  assert.equal(rename.ok, false);
  assert.equal(loaded.formulas[0].name, "Calcination");
  assert.equal(loaded.roundResult.formulaRecord, loaded.formulas[0]);
  assert.equal(loaded.skills.discovered.includes("discovery"), true);
  assert.deepEqual(loaded.discoveredFormulas, ["Calcination"]);
});

test("every color and potency uses the procedural tile family", () => {
  for (const color of ["black", "white"]) {
    for (const potency of [1, 2, 3, 4, 5]) {
      const markup = Tiles.handArtwork({ color, potency });
      assert.equal(Tiles.hasArtwork(color, potency), true);
      assert.equal(Tiles.sourceFor(color, potency), null);
      assert.match(markup, new RegExp(`data-potency="${potency}"`));
      assert.equal((markup.match(/class="tile-pip"/g) || []).length, potency);
    }
  }
  assert.deepEqual(Tiles.missingArtwork(), []);
});
