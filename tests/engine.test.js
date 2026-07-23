const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../engine.js");

function tile(id, potency, color = "black") {
  return Engine.createTile({ id, color, potency });
}

test("the first element can only enter at the center", () => {
  const board = {};
  assert.deepEqual(Engine.legalPlacements(board, tile("b1", 4)), [{ q: 0, r: 0 }]);
  assert.equal(Engine.isLegalPlacement(board, tile("b2", 4), 1, 0), false);
});

test("a placement bonds greedily with every open neighbor", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 2), 0, 0);
  Engine.placeTile(board, tile("w1", 2, "white"), 1, 0);
  const placed = Engine.placeTile(board, tile("b2", 2), 0, 1);

  assert.equal(placed.remainingPotency, 0);
  assert.equal(board["0,0"].remainingPotency, 0);
  assert.equal(board["1,0"].remainingPotency, 0);
  assert.equal(Engine.isFormulaComplete(board), true);
  assert.equal(Engine.openPotency(board), 0);
});

test("a tile cannot touch a fully bonded element", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 1), 0, 0);
  Engine.placeTile(board, tile("w1", 1, "white"), 1, 0);

  assert.equal(Engine.isLegalPlacement(board, tile("b2", 4), 0, 1), false);
  assert.deepEqual(Engine.legalPlacements(board, tile("b3", 4)), []);
});

test("a tile cannot touch more open neighbors than its potency", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 3), 0, 0);
  Engine.placeTile(board, tile("w1", 3, "white"), 1, 0);

  assert.equal(Engine.isLegalPlacement(board, tile("b2", 1), 0, 1), false);
  assert.equal(Engine.isLegalPlacement(board, tile("b3", 2), 0, 1), true);
});

test("Calcination and Dissolution are recognized by completed structure", () => {
  const calcination = {};
  Engine.placeTile(calcination, tile("b1", 1), 0, 0);
  Engine.placeTile(calcination, tile("w1", 1, "white"), 1, 0);
  assert.equal(Engine.recognizeFormula(calcination).name, "Calcination");

  const dissolution = {};
  Engine.placeTile(dissolution, tile("b2", 2), 0, 0);
  Engine.placeTile(dissolution, tile("w2", 2, "white"), 1, 0);
  Engine.placeTile(dissolution, tile("b3", 2), 0, 1);
  assert.equal(Engine.recognizeFormula(dissolution).name, "Dissolution");
});

test("only named alchemical Formulas remain in the catalog", () => {
  assert.deepEqual(
    Engine.BASE_FORMULAS.map((formula) => formula.name),
    [
      "Calcination", "Dissolution", "Separation", "Conjunction",
      "Fermentation", "Distillation", "Fixation",
    ],
  );
  assert.equal(Engine.BASE_FORMULAS.some((formula) => /Derivative/.test(formula.name)), false);
});

test("base scoring counts only fulfilled tiles", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 3), 0, 0);
  Engine.placeTile(board, tile("w1", 1, "white"), 1, 0);

  assert.equal(board["1,0"].remainingPotency, 0);
  assert.equal(board["0,0"].remainingPotency, 2);
  assert.equal(Engine.formulaValue(board), 1);
  assert.equal(Engine.formulaValue(board, { includeOpen: true }), 4);
});

test("Transmutation replaces a board tile by exactly one potency", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 3), 0, 0);
  Engine.placeTile(board, tile("w1", 1, "white"), 1, 0);
  const replacement = tile("b2", 2);

  assert.equal(Engine.isLegalTransmutation(board, replacement, 0, 0), true);
  const placed = Engine.transmuteTile(board, replacement, 0, 0);
  assert.equal(placed.potency, 2);
  assert.equal(placed.remainingPotency, 1);
  assert.equal(placed.underTiles.length, 1);
  assert.equal(Engine.isLegalTransmutation(board, tile("b3", 4), 0, 0), false);
});

test("Manipulation cannot disconnect the remaining Formula", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 2), 0, 0);
  Engine.placeTile(board, tile("w1", 2, "white"), 1, 0);
  Engine.placeTile(board, tile("b2", 2), 2, 0);

  assert.deepEqual(Engine.legalTileMoves(board, "1,0"), []);
  assert.ok(Engine.legalTileMoves(board, "2,0").length > 0);
});

test("the open-potency equation holds after placement", () => {
  const board = {};
  Engine.placeTile(board, tile("b1", 4), 0, 0);
  const oldOpen = Engine.openPotency(board);
  const potency = 2;
  const bonds = 1;
  Engine.placeTile(board, tile("w1", potency, "white"), 1, 0);

  assert.equal(Engine.openPotency(board), oldOpen + potency - 2 * bonds);
});

test("decay only affects active tiles and collapses a slot at zero", () => {
  const slots = [
    { status: "live", tile: { id: "b1", color: "black", potency: 2 } },
    { status: "live", tile: null },
    { status: "collapsed", tile: null },
  ];

  const firstDecay = Engine.decaySlots(slots, 1);
  assert.equal(firstDecay.slots[0].tile.potency, 1);
  assert.deepEqual(firstDecay.slots[1], { status: "live", tile: null });
  assert.deepEqual(firstDecay.slots[2], { status: "collapsed", tile: null });
  assert.deepEqual(firstDecay.collapsedIndices, []);

  const secondDecay = Engine.decaySlots(firstDecay.slots, 1);
  assert.deepEqual(secondDecay.slots[0], { status: "collapsed", tile: null });
  assert.deepEqual(secondDecay.collapsedIndices, [0]);
});

test("Observe can collapse several occupied slots at once", () => {
  const slots = [
    { status: "live", tile: { id: "b1", color: "black", potency: 2 } },
    { status: "live", tile: { id: "b2", color: "black", potency: 1 } },
    { status: "live", tile: { id: "b3", color: "black", potency: 3 } },
  ];

  const result = Engine.decaySlots(slots, 2);
  assert.deepEqual(result.collapsedIndices, [0, 1]);
  assert.equal(result.slots[2].tile.potency, 1);
});

test("the canonical catalog includes Distillation and Fixation", () => {
  assert.deepEqual(
    Engine.BASE_FORMULAS.map((formula) => formula.name),
    [
      "Calcination", "Dissolution", "Separation", "Conjunction",
      "Fermentation", "Distillation", "Fixation",
    ],
  );

  const distillation = {};
  const pieces = [
    ["center", 4, 0, 0],
    ["a", 2, 1, 0],
    ["b", 2, 1, -1],
    ["c", 2, -1, 0],
    ["d", 2, -1, 1],
  ];
  for (const [id, potency, q, r] of pieces) {
    Engine.placeTile(
      distillation,
      Engine.createTile({ id, color: "black", potency }),
      q,
      r,
    );
  }
  assert.equal(Engine.recognizeFormula(distillation)?.name, "Distillation");

  const fixation = Object.fromEntries([
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ].map(([q, r], index) => [
    Engine.keyOf(q, r),
    { id: `ring-${index}`, color: "white", potency: 2, remainingPotency: 0, q, r },
  ]));
  assert.equal(Engine.recognizeFormula(fixation)?.name, "Fixation");
});
