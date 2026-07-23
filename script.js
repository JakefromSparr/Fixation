(function runFixation() {
  "use strict";

  const Engine = window.FixationEngine;
  const SkillTree = window.FixationSkillTree;
  const Turns = window.FixationTurns;
  const Tiles = window.FixationTiles;
  const BoardView = window.FixationBoardView;
  const SAVE_KEY = "fixation:prototype-save";

  const ACTION_META = Object.freeze({
    contribute: { glyph: "+", name: "Contribute", detail: "Place or transmute" },
    extract: { glyph: "↥", name: "Extract", detail: "Decay 1, then draw" },
    forfeit: { glyph: "×", name: "Forfeit", detail: "Concede the round" },
    refine: { glyph: "⌄", name: "Refine", detail: "Decay one tile by 1" },
    observe: { glyph: "◉", name: "Observe", detail: "Decay hand by 2" },
    circulate: { glyph: "↟", name: "Circulate", detail: "Extract two tiles" },
    fulfill: { glyph: "⇈", name: "Fulfill", detail: "Fill every live slot" },
    stagnate: { glyph: "□", name: "Stagnate", detail: "Prevent this turn's decay" },
    energize: { glyph: "↑", name: "Energize", detail: "Add 2 to one hand tile" },
    flagrate: { glyph: "↓", name: "Flagrate", detail: "Decay rival hand by 1" },
    revitalize: { glyph: "◇", name: "Revitalize", detail: "Restore one slot" },
    reanimate: { glyph: "↶", name: "Reanimate", detail: "Restore one used action" },
    dulcification: { glyph: "△", name: "Dulcification", detail: "Add 1 to a board tile" },
    manipulation: { glyph: "↔", name: "Manipulation", detail: "Move, then Contribute" },
  });

  const elements = {};
  let state = Turns.createIdleState();
  let interaction = createInteraction();
  let boardView;
  let toastTimer = null;
  let choiceCallback = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function createInteraction() {
    return {
      pendingAction: null,
      selectedSlot: null,
      legalSpaces: [],
      boardTargets: [],
      manipulationFrom: null,
    };
  }

  function initialize() {
    cacheElements();
    boardView = BoardView.create(elements.gameCanvas);
    bindEvents();
    Tiles.preload(render);
    render();
  }

  function cacheElements() {
    const ids = [
      "menuButton", "menuBackdrop", "gameMenu", "closeMenuButton",
      "rulesButton", "skillTreeButton", "saveGameButton", "loadGameButton",
      "newGameButton", "skillsToggle", "setupScreen", "playerForm", "blackName",
      "whiteName", "openRulesFromSetup", "gameScreen", "roundBadge",
      "matchNumberDisplay", "gameNumberDisplay", "roundNumberDisplay", "blackPanel",
      "whitePanel", "blackPlayerName", "whitePlayerName", "blackRounds", "whiteRounds",
      "blackGamePoints", "whiteGamePoints", "blackBankedPoints", "whiteBankedPoints",
      "blackGames", "whiteGames", "blackMatches", "whiteMatches", "blackPool",
      "whitePool", "blackLiveSlots", "whiteLiveSlots", "blackHand", "whiteHand",
      "formulaState", "openPotencyDisplay", "formulaDiscoveryCount", "formulaCatalogCount",
      "formulaDiscoveryList", "gameCanvas", "boardEmptyState", "turnKicker",
      "turnInstruction", "turnDetail", "actionButtons", "cancelActionButton",
      "rulesDialog", "resultDialog", "resultEyebrow", "resultSigil", "resultTitle",
      "resultDescription", "resultStats", "blackResultName", "whiteResultName",
      "blackResultRounds", "whiteResultRounds", "blackResultPoints", "whiteResultPoints",
      "blackResultBank", "whiteResultBank", "blackResultGames", "whiteResultGames",
      "blackResultMatches", "whiteResultMatches", "formulaNameForm", "formulaNameInput",
      "formulaNameStatus", "observeFormulaButton", "endSessionButton",
      "resultContinueButton", "roundReviewActions", "reopenResultButton",
      "reviewContinueButton", "skillTreeDialog", "skillTreeStatus", "skillTreeColumns",
      "closeSkillTreeButton", "skipSkillPurchaseButton", "finishSkillTreeButton",
      "choiceDialog", "choiceEyebrow", "choiceTitle", "choiceDescription",
      "choiceButtons", "cancelChoiceButton", "toast",
    ];
    for (const id of ids) elements[id] = document.getElementById(id);
  }

  function bindEvents() {
    elements.playerForm.addEventListener("submit", handleStartGame);
    elements.openRulesFromSetup.addEventListener("click", openRules);
    elements.rulesButton.addEventListener("click", openRules);
    elements.skillTreeButton.addEventListener("click", () => openSkillTree(false));
    elements.menuButton.addEventListener("click", openMenu);
    elements.closeMenuButton.addEventListener("click", closeMenu);
    elements.menuBackdrop.addEventListener("click", closeMenu);
    elements.saveGameButton.addEventListener("click", saveGame);
    elements.loadGameButton.addEventListener("click", loadGame);
    elements.newGameButton.addEventListener("click", requestNewGame);
    elements.skillsToggle.addEventListener("change", toggleSkills);

    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => button.closest("dialog").close());
    });
    elements.actionButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (button) chooseAction(button.dataset.action);
    });
    elements.cancelActionButton.addEventListener("click", cancelAction);
    elements.blackHand.addEventListener("click", handleHandClick);
    elements.whiteHand.addEventListener("click", handleHandClick);
    elements.gameCanvas.addEventListener("click", handleBoardClick);
    elements.gameCanvas.addEventListener("pointermove", handleBoardPointerMove);
    elements.gameCanvas.addEventListener("pointerleave", boardView.clearHover);
    elements.resultContinueButton.addEventListener("click", continueFromResult);
    elements.reviewContinueButton.addEventListener("click", continueFromResult);
    elements.reopenResultButton.addEventListener("click", showResultDialog);
    elements.observeFormulaButton.addEventListener("click", observeFormula);
    elements.endSessionButton.addEventListener("click", endSession);
    elements.formulaNameForm.addEventListener("submit", saveFormulaName);
    elements.resultDialog.addEventListener("cancel", (event) => event.preventDefault());
    elements.skillTreeColumns.addEventListener("click", handleSkillTreeClick);
    elements.closeSkillTreeButton.addEventListener("click", closeSkillTree);
    elements.finishSkillTreeButton.addEventListener("click", finishSkillTree);
    elements.skipSkillPurchaseButton.addEventListener("click", skipSkillPurchase);
    elements.cancelChoiceButton.addEventListener("click", closeChoice);
    elements.choiceDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeChoice();
    });
    elements.choiceButtons.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-choice]");
      if (!button || !choiceCallback) return;
      const callback = choiceCallback;
      const value = button.dataset.choice;
      elements.choiceDialog.close();
      choiceCallback = null;
      callback(value);
    });
  }

  function handleStartGame(event) {
    event.preventDefault();
    const blackName = elements.blackName.value.trim();
    const whiteName = elements.whiteName.value.trim();
    if (!blackName || !whiteName) return;
    state = Turns.startGame(blackName, whiteName, {
      skillsEnabled: elements.skillsToggle.checked,
    });
    interaction = createInteraction();
    render();
  }

  function chooseAction(action) {
    if (state.phase !== "playing" || !Turns.availableActions(state).includes(action)) return;
    const player = Turns.currentPlayer(state);

    if (action === "observe") return completeAction(Turns.performObserve(state));
    if (action === "flagrate") return completeAction(Turns.performFlagrate(state));
    if (action === "stagnate") {
      const result = Turns.toggleStagnate(state);
      if (!result.ok) return showToast(result.message);
      showToast(result.primed
        ? "Stagnate armed. Your next automatic hand decay this turn is prevented."
        : "Stagnate disarmed.");
      render();
      return;
    }
    if (action === "forfeit") {
      const alternatives = Turns.availableActions(state).filter((candidate) => (
        candidate !== "forfeit" && candidate !== "stagnate"
      ));
      if (alternatives.length && !window.confirm("Forfeit this round?")) return;
      return completeAction(Turns.performForfeit(state));
    }
    if (action === "circulate" || action === "fulfill") {
      const count = action === "circulate"
        ? 2
        : Turns.emptyLiveSlotIndices(player).length;
      return chooseExtractionPotencies(count, (potencies) => {
        completeAction(action === "circulate"
          ? Turns.performCirculate(state, potencies)
          : Turns.performFulfill(state, potencies));
      });
    }
    if (action === "reanimate") {
      const targets = Turns.reanimateTargets(state);
      return openChoice({
        eyebrow: "Reanimate",
        title: "Restore which action?",
        description: "The selected once-per-game action becomes available one more time.",
        options: targets.map((id) => ({ value: id, label: SkillTree.SKILLS[id].name })),
        onChoose: (id) => completeAction(Turns.performReanimate(state, id)),
      });
    }

    interaction = createInteraction();
    interaction.pendingAction = action;
    if (action === "dulcification") interaction.boardTargets = dulcificationTargets();
    if (action === "manipulation") interaction.boardTargets = manipulationTargets();
    boardView.clearHover();
    render();
  }

  function cancelAction() {
    Turns.cancelManipulation(state);
    interaction = createInteraction();
    boardView.clearHover();
    render();
  }

  function handleHandClick(event) {
    const slotButton = event.target.closest("button[data-slot-index]");
    if (!slotButton || state.phase !== "playing") return;
    const color = slotButton.closest(".player-panel").dataset.color;
    if (color !== state.currentPlayer) return;
    const slotIndex = Number(slotButton.dataset.slotIndex);
    const player = Turns.currentPlayer(state);
    const slot = player.slots[slotIndex];

    if (interaction.pendingAction === "extract") {
      return chooseExtractionPotencies(1, (potencies) => (
        completeAction(Turns.performExtract(state, slotIndex, potencies?.[0]))
      ));
    }
    if (interaction.pendingAction === "refine") {
      return completeAction(Turns.performRefine(state, slotIndex));
    }
    if (interaction.pendingAction === "energize") {
      return completeAction(Turns.performEnergize(state, slotIndex));
    }
    if (interaction.pendingAction === "revitalize") {
      return completeAction(Turns.performRevitalize(state, slotIndex));
    }
    if (!slot.tile) return;
    if (interaction.pendingAction !== "contribute") {
      interaction = createInteraction();
      interaction.pendingAction = "contribute";
    }
    interaction.selectedSlot = interaction.selectedSlot === slotIndex ? null : slotIndex;
    interaction.legalSpaces = interaction.selectedSlot === null
      ? []
      : Turns.legalPlacementsForSlot(state, slotIndex);
    interaction.boardTargets = interaction.legalSpaces
      .filter((space) => space.mode === "transmute")
      .map((space) => Engine.keyOf(space.q, space.r));
    boardView.clearHover();
    render();
  }

  function handleBoardClick(event) {
    if (state.phase !== "playing") return;
    const { q, r } = boardView.coordinatesFromEvent(event);
    const key = Engine.keyOf(q, r);

    if (interaction.pendingAction === "dulcification") {
      if (!interaction.boardTargets.includes(key)) return;
      return completeAction(Turns.performDulcification(state, key));
    }

    if (interaction.pendingAction === "manipulation") {
      if (!interaction.manipulationFrom) {
        if (!interaction.boardTargets.includes(key)) return;
        interaction.manipulationFrom = key;
        interaction.legalSpaces = Turns.legalManipulationsForTile(state, key);
        interaction.boardTargets = [key];
        render();
        return;
      }
      const legalMove = interaction.legalSpaces.some((space) => space.q === q && space.r === r);
      if (!legalMove) return;
      const result = Turns.performManipulationMove(state, interaction.manipulationFrom, q, r);
      if (!result.ok) return showToast(result.message);
      interaction = createInteraction();
      interaction.pendingAction = "contribute";
      showToast("Formula moved. Choose a hand tile to complete the Contribution.");
      render();
      return;
    }

    if (interaction.pendingAction !== "contribute" || interaction.selectedSlot === null) return;
    const legal = interaction.legalSpaces.some((space) => space.q === q && space.r === r);
    if (!legal) return;
    completeAction(Turns.performContribute(state, interaction.selectedSlot, q, r));
  }

  function handleBoardPointerMove(event) {
    if (!interaction.legalSpaces.length) return;
    boardView.hoverFromEvent(event);
  }

  function completeAction(result) {
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    const actingPlayer = state.players[result.playerColor];
    showToast(actionMessage(result, actingPlayer));
    interaction = createInteraction();
    boardView.clearHover();
    render();
    if (result.roundEnded) showResultDialog();
  }

  function actionMessage(result, player) {
    const messages = {
      contribute: result.transmuted
        ? `${player.name} transmutes the board with potency ${result.potency}.`
        : `${player.name} contributes a potency-${result.potency} tile.`,
      extract: `${player.name} extracts a potency-${result.potencies?.[0]} tile.`,
      circulate: `${player.name} circulates two fresh tiles.`,
      fulfill: `${player.name} fulfills every empty live slot.`,
      refine: `${player.name} refines one hand tile.`,
      observe: `${player.name} observes the hand. Every active tile decays by 2.`,
      energize: `${player.name} energizes a hand tile to potency ${result.potency}.`,
      flagrate: `${player.name} uses Flagrate on the opposing hand.`,
      revitalize: `${player.name} revitalizes a collapsed slot.`,
      reanimate: `${player.name} reanimates ${SkillTree.SKILLS[result.targetSkillId]?.name}.`,
      dulcification: `${player.name} raises a board tile to potency ${result.potency}.`,
      forfeit: state.roundResult?.drawn
        ? "The open Formula produces a cat's game."
        : `${player.name} forfeits the round.`,
    };
    let message = messages[result.action] || `${player.name} completes the action.`;
    if (result.stagnated) message += " Stagnate prevents hand decay.";
    const collapsed = result.collapsedIndices?.length || 0;
    if (collapsed) message += ` ${collapsed} slot${collapsed === 1 ? "" : "s"} collapse.`;
    return message;
  }

  function chooseExtractionPotencies(count, callback) {
    if (!Turns.hasSkill(state, "activation")) {
      callback(undefined);
      return;
    }
    const choices = [];
    const maximum = Turns.maximumPotency(state);
    function chooseNext() {
      if (choices.length === count) {
        callback(choices);
        return;
      }
      openChoice({
        eyebrow: "Activation",
        title: `Choose potency ${choices.length + 1} of ${count}`,
        description: `Select any potency from 1 through ${maximum}.`,
        options: Array.from({ length: maximum }, (_, index) => ({
          value: String(index + 1),
          label: `Potency ${index + 1}`,
        })),
        onChoose: (value) => {
          choices.push(Number(value));
          chooseNext();
        },
      });
    }
    chooseNext();
  }

  function openChoice({ eyebrow, title, description, options, onChoose }) {
    elements.choiceEyebrow.textContent = eyebrow;
    elements.choiceTitle.textContent = title;
    elements.choiceDescription.textContent = description;
    elements.choiceButtons.innerHTML = options.map((option) => (
      `<button class="choice-button" type="button" data-choice="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</button>`
    )).join("");
    choiceCallback = onChoose;
    if (!elements.choiceDialog.open) elements.choiceDialog.showModal();
  }

  function closeChoice() {
    choiceCallback = null;
    if (elements.choiceDialog.open) elements.choiceDialog.close();
  }

  function showResultDialog() {
    const result = state.roundResult;
    const winner = result.winnerColor ? state.players[result.winnerColor] : null;
    const forfeiting = state.players[result.forfeitingColor];

    if (result.sessionComplete) {
      elements.resultEyebrow.textContent = "Session complete";
      elements.resultTitle.textContent = `${winner.name} wins the session`;
      elements.resultDescription.textContent = `${winner.name} claims a second match and completes the session.`;
    } else if (result.matchComplete) {
      elements.resultEyebrow.textContent = "Match complete";
      elements.resultTitle.textContent = `${winner.name} wins the match`;
      elements.resultDescription.textContent = `${winner.name} claims a second game and wins match ${state.match}.`;
    } else if (result.gameComplete) {
      elements.resultEyebrow.textContent = "Game complete";
      elements.resultTitle.textContent = `${winner.name} wins the game`;
      elements.resultDescription.textContent = `${winner.name} banks ${result.bankedPoints} point${result.bankedPoints === 1 ? "" : "s"} from this round and may purchase one shared Discovery. ${result.discardedPoints} unsecured opposing point${result.discardedPoints === 1 ? "" : "s"} are lost.`;
    } else if (result.drawn) {
      elements.resultEyebrow.textContent = "Cat's game";
      elements.resultTitle.textContent = "The Formula remains open";
      elements.resultDescription.textContent = `${forfeiting.name} has no legal action, but Emanation rejects an unfulfilled Formula. The round is replayed with no points or round win.`;
    } else {
      const formulaName = result.formulaRecord?.name
        || result.formula?.name
        || (result.fulfilled ? "Unnamed Formula" : "Unfulfilled Formula");
      elements.resultEyebrow.textContent = result.fulfilled ? "Formula fulfilled" : "Formula claimed";
      elements.resultTitle.textContent = formulaName;
      elements.resultDescription.textContent = `${forfeiting.name} forfeits. ${winner.name} claims round ${state.round} and scores ${result.formulaPoints} point${result.formulaPoints === 1 ? "" : "s"}.`;
    }

    elements.resultStats.innerHTML = [
      [result.tileCount, "Tiles"],
      [result.formulaPoints, "Formula points"],
      [result.turns, "Turns"],
    ].map(([value, label]) => (
      `<div><strong>${value}</strong><span>${label}</span></div>`
    )).join("");
    renderResultScoreboard();
    const nameable = Boolean(result.formulaRecord?.fulfilled);
    elements.formulaNameForm.hidden = !nameable;
    elements.observeFormulaButton.hidden = result.tileCount === 0;
    elements.endSessionButton.hidden = !result.gameComplete || result.sessionComplete;
    elements.formulaNameInput.value = result.formulaRecord?.name || "";
    elements.formulaNameStatus.textContent = result.formulaRecord?.catalogName
      ? `Cataloged as ${result.formulaRecord.catalogName}.`
      : nameable ? "This fulfilled structure may be named." : "";
    const label = continuationLabel(result);
    elements.resultContinueButton.textContent = label;
    elements.reviewContinueButton.textContent = label;
    if (!elements.resultDialog.open) elements.resultDialog.showModal();
  }

  function renderResultScoreboard() {
    for (const color of ["black", "white"]) {
      const player = state.players[color];
      const prefix = color === "black" ? "black" : "white";
      elements[`${prefix}ResultName`].textContent = player.name;
      elements[`${prefix}ResultRounds`].textContent = player.rounds;
      elements[`${prefix}ResultPoints`].textContent = player.gamePoints;
      elements[`${prefix}ResultBank`].textContent = player.bankedPoints;
      elements[`${prefix}ResultGames`].textContent = player.games;
      elements[`${prefix}ResultMatches`].textContent = player.matches;
    }
  }

  function saveFormulaName(event) {
    event.preventDefault();
    const result = Turns.nameCurrentFormula(state, elements.formulaNameInput.value);
    if (!result.ok) {
      elements.formulaNameStatus.textContent = result.message;
      return;
    }
    elements.formulaNameInput.value = result.formulaRecord.name;
    elements.formulaNameStatus.textContent = result.formulaRecord.catalogName
      ? `Nickname saved. Cataloged as ${result.formulaRecord.catalogName}.`
      : "Name saved for this session.";
    if (!state.roundResult.gameComplete) elements.resultTitle.textContent = result.formulaRecord.name;
    showToast(`${result.formulaRecord.name} recorded.`);
  }

  function observeFormula() {
    elements.resultDialog.close();
    render();
  }

  function endSession() {
    if (!window.confirm("End this session and return to the title screen?")) return;
    if (elements.resultDialog.open) elements.resultDialog.close();
    returnToSetup();
  }

  function continuationLabel(result) {
    if (result.sessionComplete) return "Return to title";
    if (result.gameComplete && state.pendingPurchase && !state.pendingPurchase.resolved) {
      return "Choose a Discovery";
    }
    if (result.matchComplete) return "Begin the next match";
    if (result.gameComplete) return "Begin the next game";
    if (result.drawn) return "Replay the round";
    return "Begin the next round";
  }

  function continueFromResult() {
    if (state.roundResult?.gameComplete && state.pendingPurchase && !state.pendingPurchase.resolved) {
      if (elements.resultDialog.open) elements.resultDialog.close();
      openSkillTree(true);
      return;
    }
    finalizeContinuation();
  }

  function finalizeContinuation() {
    const sessionComplete = state.roundResult?.sessionComplete;
    if (elements.resultDialog.open) elements.resultDialog.close();
    if (elements.skillTreeDialog.open) elements.skillTreeDialog.close();
    const next = Turns.continueFromResult(state);
    if (next?.ok === false) {
      showToast(next.message);
      showResultDialog();
      return;
    }
    state = next;
    interaction = createInteraction();
    if (sessionComplete) {
      elements.blackName.value = "";
      elements.whiteName.value = "";
      render();
      elements.blackName.focus();
      return;
    }
    render();
  }

  function openSkillTree(purchaseRequired) {
    closeMenu();
    renderSkillTree();
    elements.skipSkillPurchaseButton.hidden = !purchaseRequired
      || !state.pendingPurchase
      || state.pendingPurchase.resolved;
    if (!elements.skillTreeDialog.open) elements.skillTreeDialog.showModal();
  }

  function renderSkillTree() {
    const pending = state.pendingPurchase;
    const buyer = pending ? state.players[pending.buyerColor] : null;
    if (pending && !pending.resolved) {
      elements.skillTreeStatus.textContent = `${buyer.name} has ${buyer.bankedPoints} banked points and may add one shared Discovery.`;
      elements.finishSkillTreeButton.textContent = "Return to summary";
    } else if (pending?.resolved) {
      const purchased = pending.purchasedSkillId
        ? SkillTree.SKILLS[pending.purchasedSkillId].name
        : "No Discovery";
      elements.skillTreeStatus.textContent = `${purchased} selected. Banked points and every discovered rule carry into the next game.`;
      elements.finishSkillTreeButton.textContent = continuationLabel(state.roundResult);
    } else {
      elements.skillTreeStatus.textContent = `${state.skills.discovered.length} shared Discover${state.skills.discovered.length === 1 ? "y" : "ies"} active in this session.`;
      elements.finishSkillTreeButton.textContent = "Close";
    }
    elements.skipSkillPurchaseButton.hidden = !pending || pending.resolved;

    elements.skillTreeColumns.innerHTML = ["hand", "formula"].map((domain) => {
      const title = domain === "hand" ? "Hand" : "Formula";
      const domainIds = SkillTree.ORDER.filter((id) => SkillTree.SKILLS[id].domain === domain);
      const tiers = [...new Set(domainIds.map((id) => SkillTree.SKILLS[id].tier))];
      const cards = tiers.map((tier) => (
        `<div class="skill-tier" data-tier="${tier}">${domainIds.filter((id) => SkillTree.SKILLS[id].tier === tier).map((id) => skillCard(id, buyer, pending)).join("")}</div>`
      )).join("");
      return `<section class="skill-domain"><div class="skill-domain-heading"><span>${title}</span><small>${domain === "hand" ? "Shape decay and extraction" : "Shape scoring and the board"}</small></div><div class="skill-list">${cards}</div></section>`;
    }).join("");
  }

  function skillCard(id, buyer, pending) {
    const skill = SkillTree.SKILLS[id];
    const discovered = SkillTree.isDiscovered(state.skills, id);
    const replacedBy = SkillTree.replacedBy(state.skills, id);
    const bank = buyer?.bankedPoints ?? 0;
    const status = SkillTree.purchaseStatus(state.skills, id, bank);
    const purchasing = Boolean(pending && !pending.resolved);
    let stateLabel = status.reason;
    if (discovered && replacedBy) stateLabel = `Integrated into ${SkillTree.SKILLS[replacedBy].name}`;
    const classes = ["skill-card"];
    if (discovered) classes.push("discovered");
    if (replacedBy) classes.push("replaced");
    if (status.available && purchasing) classes.push("available");
    const requirements = skill.requiresAll.length
      ? skill.requiresAll.map((required) => SkillTree.SKILLS[required].name).join(" + ")
      : "Root Discovery";
    const control = discovered
      ? '<span class="skill-state">Discovered</span>'
      : purchasing && status.available
        ? `<button type="button" data-purchase-skill="${id}">Discover for ${skill.cost}</button>`
        : `<span class="skill-state">${escapeHtml(stateLabel)}</span>`;
    return `<article class="${classes.join(" ")}" data-skill-id="${id}"><div class="skill-card-heading"><strong>${skill.name}</strong><b>${skill.cost}</b></div><p>${skill.description}</p><small>${requirements} · ${skill.use}</small>${control}</article>`;
  }

  function handleSkillTreeClick(event) {
    const button = event.target.closest("button[data-purchase-skill]");
    if (!button) return;
    const result = Turns.purchaseSkill(state, button.dataset.purchaseSkill);
    if (!result.ok) return showToast(result.message);
    showToast(`${result.skill.name} is now available to both players.`);
    render();
    renderResultScoreboard();
    renderSkillTree();
  }

  function skipSkillPurchase() {
    const result = Turns.skipSkillPurchase(state);
    if (!result.ok) return showToast(result.message);
    showToast("Points retained. No new Discovery added.");
    render();
    renderSkillTree();
  }

  function finishSkillTree() {
    if (state.pendingPurchase?.resolved) {
      finalizeContinuation();
      return;
    }
    closeSkillTree();
  }

  function closeSkillTree() {
    if (elements.skillTreeDialog.open) elements.skillTreeDialog.close();
    if (state.pendingPurchase && !state.pendingPurchase.resolved && state.roundResult) {
      showResultDialog();
    }
  }

  function render() {
    const playing = state.phase !== "setup";
    elements.setupScreen.hidden = playing;
    elements.gameScreen.hidden = !playing;
    elements.roundBadge.hidden = !playing;
    elements.skillsToggle.checked = state.skills?.enabled !== false;
    elements.skillsToggle.disabled = state.phase === "playing";
    if (!playing) return;

    elements.roundNumberDisplay.textContent = state.round;
    elements.gameNumberDisplay.textContent = state.game;
    elements.matchNumberDisplay.textContent = state.match;
    for (const color of ["black", "white"]) {
      const prefix = color;
      const player = state.players[color];
      elements[`${prefix}PlayerName`].textContent = player.name;
      elements[`${prefix}Rounds`].textContent = player.rounds;
      elements[`${prefix}GamePoints`].textContent = player.gamePoints;
      elements[`${prefix}BankedPoints`].textContent = player.bankedPoints;
      elements[`${prefix}Games`].textContent = player.games;
      elements[`${prefix}Matches`].textContent = player.matches;
      elements[`${prefix}Pool`].textContent = player.pool;
      elements[`${prefix}LiveSlots`].textContent = Turns.liveSlotCount(player);
      elements[`${prefix}Panel`].classList.toggle(
        "active-player",
        state.currentPlayer === color && state.phase === "playing",
      );
      renderHand(color);
    }
    renderFormulaStatus();
    renderFormulaDiscoveries();
    renderTurnConsole();
    elements.boardEmptyState.hidden = Engine.occupiedTiles(state.board).length > 0;
    boardView.render(state.board, interaction.legalSpaces, interaction.boardTargets);
  }

  function renderHand(color) {
    const player = state.players[color];
    const container = color === "black" ? elements.blackHand : elements.whiteHand;
    const isCurrent = color === state.currentPlayer && state.phase === "playing";
    container.innerHTML = player.slots.map((slot, index) => {
      const selected = isCurrent && interaction.pendingAction === "contribute"
        && interaction.selectedSlot === index;
      const targetable = isCurrent && isTargetableSlot(slot, index);
      const classes = ["hand-slot"];
      if (selected) classes.push("selected");
      if (targetable) classes.push("targetable");
      if (slot.status === "collapsed") classes.push("collapsed");
      let content;
      if (slot.status === "collapsed") {
        content = '<div class="mini-tile"><strong>×</strong></div><span class="slot-copy"><strong>Collapsed</strong><small>This slot cannot hold a tile.</small></span>';
      } else if (slot.tile) {
        content = `<div class="mini-tile has-art">${Tiles.handArtwork(slot.tile)}</div><span class="slot-copy"><strong>Potency ${slot.tile.potency}</strong><small>${targetable || selected ? "Select this tile" : "Active tile"}</small></span>`;
      } else {
        content = `<div class="mini-tile"><strong>·</strong></div><span class="slot-copy"><strong>Empty slot</strong><small>${targetable ? "Select this slot" : "Available for extraction"}</small></span>`;
      }
      const disabled = !isCurrent || !slotIsClickable(slot, index);
      return `<button class="${classes.join(" ")}" type="button" data-slot-index="${index}" ${disabled ? "disabled" : ""}><span class="slot-index">Slot ${index + 1}</span>${content}</button>`;
    }).join("");
  }

  function isTargetableSlot(slot) {
    if (interaction.pendingAction === "extract") return slot.status === "live" && !slot.tile;
    if (interaction.pendingAction === "revitalize") return slot.status === "collapsed";
    if (interaction.pendingAction === "refine") return Boolean(slot.tile);
    if (interaction.pendingAction === "energize") {
      return Boolean(slot.tile && slot.tile.potency < Turns.maximumPotency(state));
    }
    return false;
  }

  function slotIsClickable(slot) {
    if (["extract", "revitalize", "refine", "energize"].includes(interaction.pendingAction)) {
      return isTargetableSlot(slot);
    }
    if (["dulcification", "manipulation"].includes(interaction.pendingAction)) return false;
    return Boolean(slot.tile && slot.status === "live");
  }

  function renderFormulaStatus() {
    const boardTiles = Engine.occupiedTiles(state.board);
    const open = Engine.openPotency(state.board);
    elements.openPotencyDisplay.textContent = open;
    if (boardTiles.length === 0) elements.formulaState.textContent = "Unformed";
    else if (Engine.isFormulaComplete(state.board)) elements.formulaState.textContent = "Fulfilled";
    else if (!state.lastMove) elements.formulaState.textContent = "Unstable";
    else {
      const delta = state.lastMove.newOpenPotency - state.lastMove.oldOpenPotency;
      elements.formulaState.textContent = delta > 0
        ? "Expanding"
        : delta < 0 ? "Collapsing" : "In equilibrium";
    }
  }

  function renderFormulaDiscoveries() {
    const catalogNames = new Set(Engine.BASE_FORMULAS.map((formula) => formula.name));
    const discovered = new Set(
      (state.discoveredFormulas || []).filter((name) => catalogNames.has(name)),
    );
    elements.formulaDiscoveryCount.textContent = discovered.size;
    elements.formulaCatalogCount.textContent = Engine.BASE_FORMULAS.length;
    elements.formulaDiscoveryList.innerHTML = Engine.BASE_FORMULAS.map((formula) => (
      `<span class="${discovered.has(formula.name) ? "discovered" : "undiscovered"}">${formula.name}</span>`
    )).join("");
  }

  function renderTurnConsole() {
    const player = Turns.currentPlayer(state);
    const reviewing = state.phase === "round-end";
    elements.actionButtons.hidden = reviewing;
    elements.roundReviewActions.hidden = !reviewing;
    if (reviewing) {
      const result = state.roundResult;
      const formulaName = result.formulaRecord?.name
        || result.formula?.name
        || (result.drawn ? "Open Formula" : "Unfulfilled Formula");
      elements.turnKicker.textContent = result.drawn
        ? `Round ${state.round} drawn`
        : `Round ${state.round} complete`;
      elements.turnInstruction.textContent = result.drawn
        ? "Emanation produces a cat's game."
        : `Observing ${formulaName}`;
      elements.turnDetail.textContent = result.drawn
        ? "No points or round win were awarded."
        : `The board is frozen. This Formula is worth ${result.formulaPoints} points.`;
      elements.cancelActionButton.hidden = true;
      return;
    }

    const actions = Turns.availableActions(state);
    elements.turnKicker.textContent = `${player.name}'s turn · Turn ${state.turn}`;
    renderActionButtons(actions, player);
    elements.cancelActionButton.hidden = !interaction.pendingAction;
    if (interaction.pendingAction === "contribute") {
      elements.turnInstruction.textContent = interaction.selectedSlot === null
        ? "Choose a tile from your hand."
        : "Choose a glowing position on the Formula.";
      elements.turnDetail.textContent = state.pendingManipulation
        ? "The movement is committed only when this Contribution is completed."
        : "Its current potency will lock when placed.";
    } else if (interaction.pendingAction === "extract") {
      elements.turnInstruction.textContent = "Choose an empty live slot.";
      elements.turnDetail.textContent = "Your active hand decays by 1 before the fresh tile enters.";
    } else if (interaction.pendingAction === "refine") {
      elements.turnInstruction.textContent = "Choose a hand tile to Refine.";
      elements.turnDetail.textContent = "The selected tile decays by 1.";
    } else if (interaction.pendingAction === "energize") {
      elements.turnInstruction.textContent = "Choose a hand tile to Energize.";
      elements.turnDetail.textContent = "The selected tile gains 2 potency, up to the current maximum.";
    } else if (interaction.pendingAction === "revitalize") {
      elements.turnInstruction.textContent = "Choose a collapsed slot.";
      elements.turnDetail.textContent = "It returns as an empty live slot.";
    } else if (interaction.pendingAction === "dulcification") {
      elements.turnInstruction.textContent = "Choose a highlighted board tile.";
      elements.turnDetail.textContent = "It gains 1 locked potency and 1 open potency.";
    } else if (interaction.pendingAction === "manipulation") {
      elements.turnInstruction.textContent = interaction.manipulationFrom
        ? "Choose a glowing destination."
        : "Choose a movable board tile.";
      elements.turnDetail.textContent = "The Formula must remain connected, then you must Contribute.";
    } else if (actions.length === 1 && actions[0] === "forfeit") {
      elements.turnInstruction.textContent = "No legal action remains.";
      elements.turnDetail.textContent = "Forfeit the round.";
    } else {
      elements.turnInstruction.textContent = "Choose one action.";
      elements.turnDetail.textContent = player.stagnatePrimed
        ? "Stagnate is armed. Your next automatic hand decay this turn is prevented."
        : "Contribute, Extract, use a shared Discovery, or Forfeit.";
    }
  }

  function renderActionButtons(actions, player) {
    elements.actionButtons.innerHTML = actions.map((action) => {
      const meta = ACTION_META[action];
      const classes = [];
      if (interaction.pendingAction === action || (action === "stagnate" && player.stagnatePrimed)) {
        classes.push("selected-action");
      }
      if (action === "forfeit") classes.push("forfeit-action");
      return `<button class="${classes.join(" ")}" type="button" data-action="${action}"><span class="action-glyph">${meta.glyph}</span><span><strong>${meta.name}</strong><small>${meta.detail}</small></span></button>`;
    }).join("");
  }

  function dulcificationTargets() {
    const maximum = Turns.maximumPotency(state);
    return Object.entries(state.board)
      .filter(([, tile]) => tile.potency < maximum)
      .map(([key]) => key);
  }

  function manipulationTargets() {
    return Object.keys(state.board)
      .filter((key) => Turns.legalManipulationsForTile(state, key).length > 0);
  }

  function openMenu() {
    elements.menuBackdrop.hidden = false;
    elements.gameMenu.classList.add("open");
    elements.gameMenu.setAttribute("aria-hidden", "false");
    elements.menuButton.setAttribute("aria-expanded", "true");
  }

  function toggleSkills() {
    const result = Turns.setSkillsEnabled(state, elements.skillsToggle.checked);
    if (!result.ok) {
      elements.skillsToggle.checked = state.skills.enabled;
      showToast(result.message);
      return;
    }
    showToast(`Skills ${result.enabled ? "enabled" : "disabled"} for the next game.`);
    render();
  }

  function closeMenu() {
    elements.gameMenu.classList.remove("open");
    elements.gameMenu.setAttribute("aria-hidden", "true");
    elements.menuButton.setAttribute("aria-expanded", "false");
    window.setTimeout(() => { elements.menuBackdrop.hidden = true; }, 180);
  }

  function openRules() {
    closeMenu();
    if (!elements.rulesDialog.open) elements.rulesDialog.showModal();
  }

  function saveGame() {
    if (state.phase === "setup") {
      showToast("Start a game before saving.");
      closeMenu();
      return;
    }
    if (state.pendingManipulation) {
      Turns.cancelManipulation(state);
      interaction = createInteraction();
      render();
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state }));
    closeMenu();
    showToast("Session saved on this device.");
  }

  function loadGame() {
    const saved = localStorage.getItem(SAVE_KEY);
    closeMenu();
    if (!saved) return showToast("No saved session was found.");
    try {
      const parsed = JSON.parse(saved);
      state = Turns.normalizeLoadedState(parsed.state);
      interaction = createInteraction();
      render();
      if (state.phase === "round-end" && state.roundResult) showResultDialog();
      showToast("Saved session loaded.");
    } catch (error) {
      console.error(error);
      showToast("That save could not be loaded.");
    }
  }

  function requestNewGame() {
    closeMenu();
    if (state.phase !== "setup"
      && !window.confirm("End this session and return to the title screen?")) return;
    returnToSetup();
  }

  function returnToSetup() {
    state = Turns.createIdleState();
    interaction = createInteraction();
    elements.blackName.value = "";
    elements.whiteName.value = "";
    render();
    elements.blackName.focus();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2800);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
