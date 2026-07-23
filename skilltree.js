(function initFixationSkillTree(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationSkillTree = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createSkillTree() {
  "use strict";

  const SKILLS = Object.freeze({
    discovery: skill({
      id: "discovery",
      domain: "formula",
      name: "Discovery",
      cost: 3,
      tier: 1,
      description: "The first completion of each named Formula scores double and banks immediately.",
      use: "Shared root",
      kind: "passive",
    }),
    refine: skill({
      id: "refine",
      domain: "hand",
      name: "Refine",
      cost: 3,
      tier: 2,
      requiresAll: ["discovery"],
      description: "Decay one chosen hand tile by 1, then apply normal end-turn decay.",
      use: "Repeatable",
    }),
    stagnate: skill({
      id: "stagnate",
      domain: "hand",
      name: "Stagnate",
      cost: 6,
      tier: 3,
      requiresAll: ["refine"],
      description: "Prevent the normal end-turn decay caused by one action.",
      use: "Once per player per game",
      useLimit: 1,
      kind: "modifier",
    }),
    circulate: skill({
      id: "circulate",
      domain: "hand",
      name: "Circulate",
      cost: 10,
      tier: 3,
      requiresAll: ["refine"],
      description: "Extract two tiles, then decay the entire hand by 1.",
      use: "Repeatable",
    }),
    observe: skill({
      id: "observe",
      domain: "hand",
      name: "Observe",
      cost: 15,
      tier: 4,
      requiresAll: ["stagnate"],
      description: "Decay every active tile in your hand by 2, then apply normal end-turn decay.",
      use: "Repeatable",
    }),
    energize: skill({
      id: "energize",
      domain: "hand",
      name: "Energize",
      cost: 10,
      tier: 4,
      requiresAll: ["stagnate"],
      description: "Add 2 potency to one hand tile, to a maximum of 4 or 5 with Quintessence.",
      use: "Once per player per game",
      useLimit: 1,
    }),
    fulfill: skill({
      id: "fulfill",
      domain: "hand",
      name: "Fulfill",
      cost: 10,
      tier: 4,
      requiresAll: ["circulate"],
      description: "Apply normal decay, then fill every empty live slot with fresh tiles.",
      use: "Repeatable",
    }),
    revitalize: skill({
      id: "revitalize",
      domain: "hand",
      name: "Revitalize",
      cost: 15,
      tier: 4,
      requiresAll: ["circulate"],
      description: "Restore one collapsed slot as an empty live slot.",
      use: "Once per player per game",
      useLimit: 1,
    }),
    flagrate: skill({
      id: "flagrate",
      domain: "hand",
      name: "Flagrate",
      cost: 21,
      tier: 5,
      requiresAll: ["observe", "energize"],
      description: "Decay every active tile in the opponent's hand by 1.",
      use: "Once per player per game",
      useLimit: 1,
    }),
    reanimate: skill({
      id: "reanimate",
      domain: "hand",
      name: "Reanimate",
      cost: 21,
      tier: 5,
      requiresAll: ["fulfill", "revitalize"],
      description: "Permanently burn one pool tile to restore an expended single-use action. Cannot target itself.",
      use: "Repeatable while pool tiles remain",
    }),
    catalysis: skill({
      id: "catalysis",
      domain: "hand",
      name: "Catalysis",
      cost: 15,
      tier: 3,
      requiresAll: ["refine"],
      description: "Permanently burn one pool tile to take two different actions this turn.",
      use: "Once per player per game",
      useLimit: 1,
    }),
    fixation: skill({
      id: "fixation",
      domain: "hand",
      name: "Fixation",
      cost: 42,
      tier: 7,
      requiresAll: ["flagrate", "reanimate"],
      description: "Your hand no longer decays at the end of actions.",
      use: "Passive",
      kind: "passive",
    }),
    elevation: skill({
      id: "elevation",
      domain: "formula",
      name: "Elevation",
      cost: 6,
      tier: 2,
      requiresAll: ["discovery"],
      description: "Freshly extracted tiles enter at potency 4.",
      use: "Passive",
      kind: "passive",
    }),
    acerbation: skill({
      id: "acerbation",
      domain: "formula",
      name: "Acerbation",
      cost: 10,
      tier: 3,
      requiresAll: ["elevation"],
      description: "Remove 1 open potency from one board tile.",
      use: "Once per player per game",
      useLimit: 1,
    }),
    dulcification: skill({
      id: "dulcification",
      domain: "formula",
      name: "Dulcification",
      cost: 15,
      tier: 3,
      requiresAll: ["elevation"],
      description: "Add 1 potency and 1 open potency to one board tile.",
      use: "Once per player per game",
      useLimit: 1,
    }),
    reclamation: skill({
      id: "reclamation",
      domain: "formula",
      name: "Reclamation",
      cost: 28,
      tier: 4,
      requiresAll: ["acerbation"],
      description: "Open tiles score their locked potency when a Formula is claimed.",
      use: "Passive",
      kind: "passive",
    }),
    quintessence: skill({
      id: "quintessence",
      domain: "formula",
      name: "Quintessence",
      cost: 21,
      tier: 4,
      requiresAll: ["elevation", "dulcification"],
      description: "Freshly extracted tiles enter at potency 5.",
      use: "Passive",
      kind: "passive",
    }),
    emanation: skill({
      id: "emanation",
      domain: "formula",
      name: "Emanation",
      cost: 3,
      tier: 5,
      requiresAll: ["reclamation", "quintessence"],
      replaces: ["acerbation", "reclamation", "dulcification", "quintessence"],
      description: "Only a fully fulfilled Formula can be claimed. An open Formula creates a cat's game.",
      use: "Passive",
      kind: "passive",
    }),
    transmutation: skill({
      id: "transmutation",
      domain: "formula",
      name: "Transmutation",
      cost: 15,
      tier: 6,
      requiresAll: ["emanation"],
      description: "Contribute onto a board tile with a hand tile exactly 1 potency higher or lower.",
      use: "Contribute option",
      kind: "passive",
    }),
    manipulation: skill({
      id: "manipulation",
      domain: "formula",
      name: "Manipulation",
      cost: 21,
      tier: 6,
      requiresAll: ["emanation"],
      description: "Move one board tile without disconnecting the Formula, then Contribute.",
      use: "Contribute option",
    }),
    activation: skill({
      id: "activation",
      domain: "formula",
      name: "Activation",
      cost: 28,
      tier: 7,
      requiresAll: ["transmutation", "manipulation"],
      description: "Choose the potency of every tile you extract, up to the current maximum.",
      use: "Passive",
      kind: "passive",
    }),
  });

  const ORDER = Object.freeze([
    "discovery", "refine", "elevation", "stagnate", "circulate", "catalysis",
    "acerbation", "dulcification", "observe", "energize", "fulfill",
    "revitalize", "reclamation", "quintessence", "flagrate", "reanimate",
    "emanation", "fixation",
    "transmutation", "manipulation", "activation",
  ]);

  function skill(definition) {
    return Object.freeze({
      requiresAll: Object.freeze([]),
      replaces: Object.freeze([]),
      useLimit: null,
      implemented: true,
      kind: "action",
      tier: 1,
      ...definition,
      requiresAll: Object.freeze([...(definition.requiresAll || [])]),
      replaces: Object.freeze([...(definition.replaces || [])]),
    });
  }

  function createState(enabled = true) {
    return {
      enabled: enabled !== false,
      discovered: [],
      purchaseHistory: [],
    };
  }

  function normalizeState(value, legacyEnabled = true) {
    const state = value && typeof value === "object" ? value : createState(legacyEnabled);
    state.enabled = state.enabled !== false;
    state.discovered = Array.isArray(state.discovered)
      ? [...new Set(state.discovered.filter((id) => SKILLS[id]))]
      : [];
    state.purchaseHistory = Array.isArray(state.purchaseHistory) ? state.purchaseHistory : [];
    return state;
  }

  function isDiscovered(skillState, id) {
    return Boolean(SKILLS[id] && skillState?.discovered?.includes(id));
  }

  function replacedBy(skillState, id) {
    return ORDER.find((candidateId) => (
      isDiscovered(skillState, candidateId)
      && SKILLS[candidateId].replaces.includes(id)
    )) || null;
  }

  function isEffective(skillState, id) {
    return Boolean(
      skillState?.enabled
      && isDiscovered(skillState, id)
      && !replacedBy(skillState, id),
    );
  }

  function requirementsMet(skillState, definition) {
    return definition.requiresAll.every((id) => isDiscovered(skillState, id));
  }

  function purchaseStatus(skillState, id, bankedPoints = Infinity) {
    const definition = SKILLS[id];
    if (!definition) return { available: false, reason: "Unknown discovery." };
    if (isDiscovered(skillState, id)) return { available: false, reason: "Discovered" };
    if (!definition.implemented) return { available: false, reason: "Rule forthcoming" };
    const missing = definition.requiresAll.filter((required) => !isDiscovered(skillState, required));
    if (missing.length) {
      return {
        available: false,
        reason: `Requires ${missing.map((required) => SKILLS[required].name).join(" + ")}`,
      };
    }
    if (bankedPoints < definition.cost) {
      return { available: false, reason: `Needs ${definition.cost - bankedPoints} more` };
    }
    return { available: true, reason: "Available" };
  }

  function availablePurchases(skillState, bankedPoints = Infinity) {
    return ORDER.filter((id) => purchaseStatus(skillState, id, bankedPoints).available);
  }

  function purchase(skillState, id, buyer, context = {}) {
    const status = purchaseStatus(skillState, id, buyer?.bankedPoints ?? 0);
    if (!status.available) return { ok: false, message: status.reason };
    const definition = SKILLS[id];
    buyer.bankedPoints -= definition.cost;
    skillState.discovered.push(id);
    const record = {
      skillId: id,
      purchasedBy: buyer.color,
      cost: definition.cost,
      match: context.match || 1,
      game: context.game || 1,
    };
    skillState.purchaseHistory.push(record);
    return { ok: true, skill: definition, record };
  }

  function createUseState() {
    return Object.fromEntries(
      ORDER.filter((id) => SKILLS[id].useLimit).map((id) => [id, 0]),
    );
  }

  function normalizeUses(uses) {
    return { ...createUseState(), ...(uses || {}) };
  }

  function isSpent(player, id) {
    const limit = SKILLS[id]?.useLimit;
    return Boolean(limit && (player.skillUses?.[id] || 0) >= limit);
  }

  function spendUse(player, id) {
    const limit = SKILLS[id]?.useLimit;
    if (!limit) return true;
    player.skillUses = normalizeUses(player.skillUses);
    if (isSpent(player, id)) return false;
    player.skillUses[id] += 1;
    return true;
  }

  function restoreUse(player, id) {
    if (!SKILLS[id]?.useLimit || id === "reanimate") return false;
    player.skillUses = normalizeUses(player.skillUses);
    if ((player.skillUses[id] || 0) < 1) return false;
    player.skillUses[id] -= 1;
    return true;
  }

  return Object.freeze({
    ORDER,
    SKILLS,
    availablePurchases,
    createState,
    createUseState,
    isDiscovered,
    isEffective,
    isSpent,
    normalizeState,
    normalizeUses,
    purchase,
    purchaseStatus,
    replacedBy,
    requirementsMet,
    restoreUse,
    spendUse,
  });
});
