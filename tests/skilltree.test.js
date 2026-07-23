const test = require("node:test");
const assert = require("node:assert/strict");
const SkillTree = require("../skilltree.js");

function buyer(points = 50) {
  return { color: "black", bankedPoints: points };
}

test("the two root discoveries begin available and prerequisites branch from them", () => {
  const state = SkillTree.createState();
  assert.deepEqual(SkillTree.availablePurchases(state, 50), ["refine", "discovery"]);

  const black = buyer();
  assert.equal(SkillTree.purchase(state, "refine", black).ok, true);
  assert.deepEqual(
    SkillTree.availablePurchases(state, 50),
    ["stagnate", "circulate", "discovery"],
  );
});

test("joint requirements gate Flagrate, Reanimate, Emanation, and Activation", () => {
  const state = SkillTree.createState();
  state.discovered.push("refine", "stagnate", "observe");
  assert.equal(SkillTree.purchaseStatus(state, "flagrate", 50).available, false);
  state.discovered.push("energize");
  assert.equal(SkillTree.purchaseStatus(state, "flagrate", 50).available, true);

  state.discovered.push(
    "circulate", "fulfill", "revitalize", "discovery", "reclamation",
    "dulcification", "emanation", "transmutation",
  );
  assert.equal(SkillTree.purchaseStatus(state, "reanimate", 50).available, true);
  assert.equal(SkillTree.purchaseStatus(state, "activation", 50).available, false);
  state.discovered.push("manipulation");
  assert.equal(SkillTree.purchaseStatus(state, "activation", 50).available, true);
});

test("replacement discoveries suppress earlier effects without deleting ownership", () => {
  const state = SkillTree.createState();
  state.discovered.push("refine", "observe", "circulate", "fulfill", "reclamation", "dulcification", "emanation");

  assert.equal(SkillTree.isDiscovered(state, "refine"), true);
  assert.equal(SkillTree.isEffective(state, "refine"), false);
  assert.equal(SkillTree.replacedBy(state, "refine"), "observe");
  assert.equal(SkillTree.isEffective(state, "circulate"), false);
  assert.equal(SkillTree.isEffective(state, "reclamation"), false);
  assert.equal(SkillTree.isEffective(state, "dulcification"), false);
  assert.equal(SkillTree.isEffective(state, "emanation"), true);
});

test("Exclusion remains visible but cannot be purchased before its rule exists", () => {
  const state = SkillTree.createState();
  state.discovered.push("discovery", "reclamation");
  const status = SkillTree.purchaseStatus(state, "exclusion", 50);
  assert.equal(status.available, false);
  assert.equal(status.reason, "Rule forthcoming");
});

test("limited-use actions can be spent and restored except Reanimate itself", () => {
  const player = { skillUses: SkillTree.createUseState() };
  assert.equal(SkillTree.spendUse(player, "energize"), true);
  assert.equal(SkillTree.isSpent(player, "energize"), true);
  assert.equal(SkillTree.restoreUse(player, "energize"), true);
  assert.equal(SkillTree.isSpent(player, "energize"), false);
  assert.equal(SkillTree.restoreUse(player, "reanimate"), false);
});

test("skill costs use the balanced session economy", () => {
  const expected = {
    refine: 3, stagnate: 6, circulate: 10, observe: 15, energize: 10,
    fulfill: 10, revitalize: 15, flagrate: 21, reanimate: 21,
    discovery: 6, reclamation: 10, dulcification: 15, exclusion: 28,
    quintessence: 21, emanation: 3, transmutation: 15,
    manipulation: 21, activation: 28,
  };
  assert.deepEqual(
    Object.fromEntries(SkillTree.ORDER.map((id) => [id, SkillTree.SKILLS[id].cost])),
    expected,
  );
});
