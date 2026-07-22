(function runFixation() {
  "use strict";

  const Engine = window.FixationEngine;
  const Turns = window.FixationTurns;
  const Tiles = window.FixationTiles;
  const BoardView = window.FixationBoardView;
  const SAVE_KEY = "fixation:prototype-save";

  const elements = {};
  let state = Turns.createIdleState();
  let interaction = createInteraction();
  let boardView;
  let toastTimer = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function createInteraction() {
    return {
      pendingAction: null,
      selectedSlot: null,
      legalSpaces: [],
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
      "rulesButton", "saveGameButton", "loadGameButton", "newGameButton",
      "setupScreen", "playerForm", "blackName", "whiteName", "openRulesFromSetup",
      "gameScreen", "roundBadge", "roundNumberDisplay", "blackPanel", "whitePanel",
      "blackPlayerName", "whitePlayerName", "blackRounds", "whiteRounds",
      "blackPool", "whitePool", "blackLiveSlots", "whiteLiveSlots",
      "blackHand", "whiteHand", "formulaState", "openPotencyDisplay",
      "gameCanvas", "boardEmptyState", "turnKicker", "turnInstruction", "turnDetail",
      "actionButtons", "contributeButton", "extractButton", "observeButton",
      "cancelActionButton", "rulesDialog", "resultDialog", "resultEyebrow",
      "resultSigil", "resultTitle", "resultDescription", "resultStats",
      "resultContinueButton", "toast",
    ];

    for (const id of ids) elements[id] = document.getElementById(id);
  }

  function bindEvents() {
    elements.playerForm.addEventListener("submit", handleStartGame);
    elements.openRulesFromSetup.addEventListener("click", openRules);
    elements.rulesButton.addEventListener("click", openRules);
    elements.menuButton.addEventListener("click", openMenu);
    elements.closeMenuButton.addEventListener("click", closeMenu);
    elements.menuBackdrop.addEventListener("click", closeMenu);
    elements.saveGameButton.addEventListener("click", saveGame);
    elements.loadGameButton.addEventListener("click", loadGame);
    elements.newGameButton.addEventListener("click", requestNewGame);

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
    elements.resultDialog.addEventListener("cancel", (event) => event.preventDefault());
  }

  function handleStartGame(event) {
    event.preventDefault();
    const blackName = elements.blackName.value.trim();
    const whiteName = elements.whiteName.value.trim();
    if (!blackName || !whiteName) return;

    state = Turns.startGame(blackName, whiteName);
    interaction = createInteraction();
    render();
  }

  function chooseAction(action) {
    if (state.phase !== "playing") return;
    const player = Turns.currentPlayer(state);

    if (action === "observe") {
      completeAction(Turns.performObserve(state));
      return;
    }

    if (action === "extract" && !Turns.canExtract(player)) return;
    if (action === "contribute" && !Turns.canContribute(state, player)) return;

    interaction.pendingAction = interaction.pendingAction === action ? null : action;
    interaction.selectedSlot = null;
    interaction.legalSpaces = [];
    boardView.clearHover();
    render();
  }

  function cancelAction() {
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
      completeAction(Turns.performExtract(state, slotIndex));
      return;
    }

    if (!slot.tile) return;
    if (interaction.pendingAction !== "contribute") {
      interaction.pendingAction = "contribute";
    }

    interaction.selectedSlot = interaction.selectedSlot === slotIndex ? null : slotIndex;
    interaction.legalSpaces = interaction.selectedSlot === null
      ? []
      : Turns.legalPlacementsForSlot(state, slotIndex);
    boardView.clearHover();
    render();
  }

  function handleBoardClick(event) {
    if (state.phase !== "playing" || interaction.pendingAction !== "contribute") return;
    if (interaction.selectedSlot === null) return;

    const { q, r } = boardView.coordinatesFromEvent(event);
    const legal = interaction.legalSpaces.some((space) => space.q === q && space.r === r);
    if (!legal) return;

    completeAction(Turns.performContribute(state, interaction.selectedSlot, q, r));
  }

  function handleBoardPointerMove(event) {
    if (interaction.pendingAction !== "contribute" || interaction.selectedSlot === null) return;
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
    let message;
    if (result.action === "observe") {
      message = `${player.name} observes. Every active element decays by 2.`;
    } else if (result.action === "extract") {
      message = `${player.name} extracts a fresh potency-4 element.`;
    } else {
      message = `${player.name} contributes a potency-${result.potency} element.`;
    }

    const collapsed = result.collapsedIndices.length;
    if (collapsed === 0) return message;
    const slots = collapsed === 1 ? "slot collapses" : "slots collapse";
    return `${message} ${collapsed} ${slots}.`;
  }

  function showResultDialog() {
    const result = state.roundResult;
    const winner = state.players[result.winnerColor];
    const loser = state.players[Turns.opponentColor(result.winnerColor)];

    if (result.matchComplete) {
      elements.resultEyebrow.textContent = "Duel complete";
      elements.resultTitle.textContent = `${winner.name} wins the duel`;
      elements.resultDescription.textContent = result.reason === "formula"
        ? `${winner.name} completes the deciding Formula and claims a second round.`
        : `${loser.name}'s final hand slot collapses. ${winner.name} claims the deciding round.`;
      elements.resultContinueButton.textContent = "Return to title";
    } else if (result.reason === "formula") {
      elements.resultEyebrow.textContent = "Formula complete";
      elements.resultTitle.textContent = result.formula?.name || "Unnamed Formula";
      elements.resultDescription.textContent = result.formula?.description
        || `${winner.name} places the final possible element and claims round ${state.round}.`;
      elements.resultContinueButton.textContent = "Begin the next round";
    } else {
      elements.resultEyebrow.textContent = "Hand collapsed";
      elements.resultTitle.textContent = `${winner.name} claims the round`;
      elements.resultDescription.textContent = `${loser.name}'s third slot collapses under decay.`;
      elements.resultContinueButton.textContent = "Begin the next round";
    }

    elements.resultStats.innerHTML = [
      [result.tileCount, "Elements"],
      [result.value, "Total potency"],
      [result.turns, "Turns"],
    ].map(([value, label]) => (
      `<div><strong>${value}</strong><span>${label}</span></div>`
    )).join("");

    if (!elements.resultDialog.open) elements.resultDialog.showModal();
  }

  function continueFromResult() {
    const matchComplete = state.roundResult?.matchComplete;
    elements.resultDialog.close();
    state = Turns.continueFromResult(state);
    interaction = createInteraction();

    if (matchComplete) {
      elements.blackName.value = "";
      elements.whiteName.value = "";
      render();
      elements.blackName.focus();
      return;
    }

    render();
  }

  function render() {
    const playing = state.phase !== "setup";
    elements.setupScreen.hidden = playing;
    elements.gameScreen.hidden = !playing;
    elements.roundBadge.hidden = !playing;
    if (!playing) return;

    elements.roundNumberDisplay.textContent = state.round;
    elements.blackPlayerName.textContent = state.players.black.name;
    elements.whitePlayerName.textContent = state.players.white.name;
    elements.blackRounds.textContent = state.players.black.rounds;
    elements.whiteRounds.textContent = state.players.white.rounds;
    elements.blackPool.textContent = state.players.black.pool;
    elements.whitePool.textContent = state.players.white.pool;
    elements.blackLiveSlots.textContent = Turns.liveSlotCount(state.players.black);
    elements.whiteLiveSlots.textContent = Turns.liveSlotCount(state.players.white);

    elements.blackPanel.classList.toggle(
      "active-player",
      state.currentPlayer === "black" && state.phase === "playing",
    );
    elements.whitePanel.classList.toggle(
      "active-player",
      state.currentPlayer === "white" && state.phase === "playing",
    );

    renderHand("black");
    renderHand("white");
    renderFormulaStatus();
    renderTurnConsole();
    elements.boardEmptyState.hidden = Engine.occupiedTiles(state.board).length > 0;
    boardView.render(state.board, interaction.legalSpaces);
  }

  function renderHand(color) {
    const player = state.players[color];
    const container = color === "black" ? elements.blackHand : elements.whiteHand;
    const isCurrent = color === state.currentPlayer && state.phase === "playing";

    container.innerHTML = player.slots.map((slot, index) => {
      const selected = isCurrent
        && interaction.pendingAction === "contribute"
        && interaction.selectedSlot === index;
      const targetable = isCurrent
        && interaction.pendingAction === "extract"
        && slot.status === "live"
        && !slot.tile;
      const classes = ["hand-slot"];
      if (selected) classes.push("selected");
      if (targetable) classes.push("targetable");
      if (slot.status === "collapsed") classes.push("collapsed");

      let content;
      if (slot.status === "collapsed") {
        content = '<div class="mini-tile"><strong>×</strong></div><span class="slot-copy"><strong>Collapsed</strong><small>This slot is permanently lost.</small></span>';
      } else if (slot.tile) {
        const artClass = Tiles.imageFor(slot.tile) ? " has-art" : "";
        content = `<div class="mini-tile${artClass}">${Tiles.handArtwork(slot.tile)}</div><span class="slot-copy"><strong>Potency ${slot.tile.potency}</strong><small>${isCurrent ? "Select to contribute" : "Active element"}</small></span>`;
      } else {
        content = `<div class="mini-tile"><strong>·</strong></div><span class="slot-copy"><strong>Empty slot</strong><small>${targetable ? "Extract here" : "Available for extraction"}</small></span>`;
      }

      const disabled = !isCurrent
        || slot.status === "collapsed"
        || (interaction.pendingAction === "extract" ? Boolean(slot.tile) : !slot.tile);
      return `<button class="${classes.join(" ")}" type="button" data-slot-index="${index}" ${disabled ? "disabled" : ""}><span class="slot-index">Slot ${index + 1}</span>${content}</button>`;
    }).join("");
  }

  function renderFormulaStatus() {
    const boardTiles = Engine.occupiedTiles(state.board);
    const open = Engine.openPotency(state.board);
    elements.openPotencyDisplay.textContent = open;

    if (boardTiles.length === 0) {
      elements.formulaState.textContent = "Unformed";
    } else if (Engine.isFormulaComplete(state.board)) {
      elements.formulaState.textContent = "Complete";
    } else if (!state.lastMove) {
      elements.formulaState.textContent = "Unstable";
    } else {
      const delta = state.lastMove.newOpenPotency - state.lastMove.oldOpenPotency;
      elements.formulaState.textContent = delta > 0
        ? "Expanding"
        : delta < 0 ? "Collapsing" : "In equilibrium";
    }
  }

  function renderTurnConsole() {
    const player = Turns.currentPlayer(state);
    elements.turnKicker.textContent = `${player.name}'s turn · Turn ${state.turn}`;
    elements.contributeButton.disabled = state.phase !== "playing"
      || !Turns.canContribute(state, player);
    elements.extractButton.disabled = state.phase !== "playing"
      || !Turns.canExtract(player);
    elements.observeButton.disabled = state.phase !== "playing"
      || !Turns.hasActiveTile(player);

    for (const button of elements.actionButtons.querySelectorAll("button[data-action]")) {
      button.classList.toggle(
        "selected-action",
        button.dataset.action === interaction.pendingAction,
      );
    }
    elements.cancelActionButton.hidden = !interaction.pendingAction;

    if (interaction.pendingAction === "contribute") {
      elements.turnInstruction.textContent = interaction.selectedSlot === null
        ? "Choose an element from your hand."
        : "Choose a glowing space on the Formula.";
      elements.turnDetail.textContent = interaction.selectedSlot === null
        ? "Its current potency will lock when placed."
        : `${interaction.legalSpaces.length} legal placement${interaction.legalSpaces.length === 1 ? "" : "s"}. Other active elements will decay by 1.`;
    } else if (interaction.pendingAction === "extract") {
      elements.turnInstruction.textContent = "Choose an empty live slot.";
      elements.turnDetail.textContent = "Your active hand decays by 1 before the fresh potency-4 element enters.";
    } else if (!Turns.canContribute(state, player)
      && !Turns.canExtract(player)
      && !Turns.hasActiveTile(player)) {
      elements.turnInstruction.textContent = "No available action.";
      elements.turnDetail.textContent = "The current prototype needs an exhaustion ruling for this edge case.";
    } else {
      elements.turnInstruction.textContent = "Choose one action.";
      elements.turnDetail.textContent = "Contribute to the Formula, extract a fresh element, or observe your hand decay.";
    }
  }

  function openMenu() {
    elements.menuBackdrop.hidden = false;
    elements.gameMenu.classList.add("open");
    elements.gameMenu.setAttribute("aria-hidden", "false");
    elements.menuButton.setAttribute("aria-expanded", "true");
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
      showToast("Start a duel before saving.");
      closeMenu();
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ state }));
    closeMenu();
    showToast("Duel saved on this device.");
  }

  function loadGame() {
    const saved = localStorage.getItem(SAVE_KEY);
    closeMenu();
    if (!saved) {
      showToast("No saved duel was found.");
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      state = Turns.normalizeLoadedState(parsed.state);
      interaction = createInteraction();
      render();
      if (state.phase === "round-end" && state.roundResult) showResultDialog();
      showToast("Saved duel loaded.");
    } catch (error) {
      console.error(error);
      showToast("That save could not be loaded.");
    }
  }

  function requestNewGame() {
    closeMenu();
    if (state.phase !== "setup"
      && !window.confirm("End this duel and return to the title screen?")) return;
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
    }, 2600);
  }
})();
