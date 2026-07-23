const test = require("node:test");
const assert = require("node:assert/strict");
const SkillTree = require("../skilltree.js");

function buyer(points = 50) {
  return { color: "black", bankedPoints: points };
}

test("Discovery is the shared root and opens both early branches", () => {
  const state = SkillTree.createState();
  assert.deepEqual(SkillTree.availablePurchases(state, 50), ["discovery"]);

  const black = buyer();
  assert.equal(SkillTree.purchase(state, "discovery", black).ok, true);
  assert.deepEqual(
    SkillTree.availablePurchases(state, 50),
    ["refine", "elevation"],
  );
});

test("joint requirements gate Flagrate, Reanimate, Emanation, and Activation", () => {
  const state = SkillTree.createState();
  state.discovered.push("refine", "stagnate", "observe");
  assert.equal(SkillTree.purchaseStatus(state, "flagrate", 50).available, false);
  state.discovered.push("energize");
  assert.equal(SkillTree.purchaseStatus(state, "flagrate", 50).available, true);

  state.discovered.push(
    "circulate", "fulfill", "revitalize", "discovery", "elevation",
    "acerbation", "reclamation", "dulcification", "quintessence",
    "emanation", "transmutation",
  );
  assert.equal(SkillTree.purchaseStatus(state, "reanimate", 50).available, true);
  assert.equal(SkillTree.purchaseStatus(state, "activation", 50).available, false);
  state.discovered.push("manipulation");
  assert.equal(SkillTree.purchaseStatus(state, "activation", 50).available, true);
});

test("only Emanation suppresses earlier effects without deleting ownership", () => {
  const state = SkillTree.createState();
  state.discovered.push("refine", "observe", "circulate", "fulfill", "reclamation", "dulcification", "emanation");

  assert.equal(SkillTree.isDiscovered(state, "refine"), true);
  state.discovered.push("acerbation", "quintessence");
  assert.equal(SkillTree.isEffective(state, "refine"), true);
  assert.equal(SkillTree.replacedBy(state, "refine"), null);
  assert.equal(SkillTree.isEffective(state, "circulate"), true);
  assert.equal(SkillTree.isEffective(state, "reclamation"), false);
  assert.equal(SkillTree.isEffective(state, "dulcification"), false);
  assert.equal(SkillTree.isEffective(state, "acerbation"), false);
  assert.equal(SkillTree.isEffective(state, "quintessence"), false);
  assert.equal(SkillTree.isEffective(state, "emanation"), true);
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
    discovery: 3, refine: 3, elevation: 6, stagnate: 6, circulate: 10,
    catalysis: 15, acerbation: 10, observe: 15, energize: 10,
    fulfill: 10, revitalize: 15, flagrate: 21, reanimate: 21,
    reclamation: 28, dulcification: 15, fixation: 42,
    quintessence: 21, emanation: 3, transmutation: 15,
    manipulation: 21, activation: 28,
  };
  assert.deepEqual(
    Object.fromEntries(SkillTree.ORDER.map((id) => [id, SkillTree.SKILLS[id].cost])),
    expected,
  );
});
