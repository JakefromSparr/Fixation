(function initFixationProgression(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationProgression = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createProgression() {
  "use strict";

  const RULES = Object.freeze({
    roundsToWinGame: 2,
    gamesToWinMatch: 2,
    matchesToWinSession: 2,
    maximumRounds: 3,
    maximumGames: 3,
    maximumMatches: 3,
  });

  function createPlayerProgress() {
    return {
      rounds: 0,
      games: 0,
      matches: 0,
      gamePoints: 0,
      securedGamePoints: 0,
      bankedPoints: 0,
      skillUses: {},
      stagnatePrimed: false,
    };
  }

  function recordRound(state, winnerColor, reason, formulaDetails = {}) {
    if (!winnerColor || reason === "cats-game") return recordDraw();

    const winner = state.players[winnerColor];
    const loserColor = opponentColor(winnerColor);
    const loser = state.players[loserColor];
    const formulaPoints = Number(formulaDetails.value) || 0;
    const securedPoints = formulaDetails.secure === true ? formulaPoints : 0;

    winner.rounds += 1;
    winner.gamePoints += formulaPoints;
    if (securedPoints) {
      winner.securedGamePoints += securedPoints;
      winner.bankedPoints += securedPoints;
    }

    const gameComplete = winner.rounds >= RULES.roundsToWinGame;
    let matchComplete = false;
    let sessionComplete = false;
    let bankedPoints = securedPoints;
    let discardedPoints = 0;

    if (gameComplete) {
      winner.games += 1;
      const unsecuredWinnerPoints = Math.max(
        0,
        winner.gamePoints - winner.securedGamePoints,
      );
      const unsecuredLoserPoints = Math.max(
        0,
        loser.gamePoints - loser.securedGamePoints,
      );
      winner.bankedPoints += unsecuredWinnerPoints;
      bankedPoints += unsecuredWinnerPoints;
      discardedPoints = unsecuredLoserPoints;

      matchComplete = winner.games >= RULES.gamesToWinMatch;
      if (matchComplete) {
        winner.matches += 1;
        sessionComplete = winner.matches >= RULES.matchesToWinSession;
      }
    }

    return {
      formulaPoints,
      securedPoints,
      gameComplete,
      matchComplete,
      sessionComplete,
      bankedPoints,
      discardedPoints,
      winnerColor,
      loserColor,
      drawn: false,
    };
  }

  function recordDraw() {
    return {
      formulaPoints: 0,
      securedPoints: 0,
      gameComplete: false,
      matchComplete: false,
      sessionComplete: false,
      bankedPoints: 0,
      discardedPoints: 0,
      winnerColor: null,
      loserColor: null,
      drawn: true,
    };
  }

  function advance(state, result) {
    if (result.sessionComplete) return "session-complete";

    if (result.matchComplete) {
      state.match += 1;
      state.game = 1;
      resetGames(state);
      resetRoundsAndGamePoints(state);
      return "next-match";
    }

    if (result.gameComplete) {
      state.game += 1;
      resetRoundsAndGamePoints(state);
      return "next-game";
    }

    if (result.drawn) return "replay-round";
    state.round += 1;
    return "next-round";
  }

  function resetRoundsAndGamePoints(state) {
    state.round = 1;
    for (const player of Object.values(state.players)) {
      player.rounds = 0;
      player.gamePoints = 0;
      player.securedGamePoints = 0;
    }
  }

  function resetGames(state) {
    for (const player of Object.values(state.players)) {
      player.games = 0;
    }
  }

  function ensurePlayerProgress(player) {
    const defaults = createPlayerProgress();
    for (const [key, value] of Object.entries(defaults)) {
      if (player[key] === undefined) {
        player[key] = value && typeof value === "object" ? { ...value } : value;
      }
    }
    return player;
  }

  function opponentColor(color) {
    return color === "black" ? "white" : "black";
  }

  return Object.freeze({
    RULES,
    advance,
    createPlayerProgress,
    ensurePlayerProgress,
    recordDraw,
    recordRound,
  });
});
