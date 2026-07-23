const test = require("node:test");
const assert = require("node:assert/strict");
const Progression = require("../progression.js");

function player(name, color) {
  return { name, color, ...Progression.createPlayerProgress() };
}

function state() {
  return {
    match: 1,
    game: 1,
    round: 1,
    players: {
      black: player("Ada", "black"),
      white: player("Bryn", "white"),
    },
  };
}

test("Formula points remain provisional until a player wins the game", () => {
  const duel = state();
  const first = Progression.recordRound(duel, "black", "forfeit", { value: 6 });
  assert.equal(first.formulaPoints, 6);
  assert.equal(duel.players.black.gamePoints, 6);
  assert.equal(duel.players.black.bankedPoints, 0);
  assert.equal(first.gameComplete, false);

  Progression.recordRound(duel, "white", "forfeit", { value: 8 });
  assert.equal(duel.players.white.gamePoints, 8);
});

test("the game winner banks only unsecured points not already protected by Discovery", () => {
  const duel = state();
  Progression.recordRound(duel, "black", "forfeit", { value: 6, secure: true });
  Progression.recordRound(duel, "white", "forfeit", { value: 8 });
  const deciding = Progression.recordRound(duel, "black", "forfeit", { value: 10 });

  assert.equal(duel.players.black.bankedPoints, 16);
  assert.equal(deciding.bankedPoints, 10);
  assert.equal(deciding.discardedPoints, 8);
  assert.equal(duel.players.white.bankedPoints, 0);
});

test("Discovery-protected points survive a game loss", () => {
  const duel = state();
  Progression.recordRound(duel, "black", "forfeit", { value: 4, secure: true });
  Progression.recordRound(duel, "white", "forfeit", { value: 5 });
  const result = Progression.recordRound(duel, "white", "forfeit", { value: 5 });

  assert.equal(result.gameComplete, true);
  assert.equal(result.discardedPoints, 0);
  assert.equal(duel.players.black.bankedPoints, 4);
  assert.equal(duel.players.white.bankedPoints, 10);
});

test("a cat's game awards no round, points, or progress", () => {
  const duel = state();
  const result = Progression.recordRound(duel, null, "cats-game", { value: 20 });

  assert.equal(result.drawn, true);
  assert.equal(duel.players.black.rounds, 0);
  assert.equal(duel.players.white.rounds, 0);
  assert.equal(Progression.advance(duel, result), "replay-round");
  assert.equal(duel.round, 1);
});

test("two games win a match and two matches win a session", () => {
  const duel = state();

  Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  const firstGame = Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  assert.equal(Progression.advance(duel, firstGame), "next-game");

  Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  const firstMatch = Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  assert.equal(firstMatch.matchComplete, true);
  assert.equal(Progression.advance(duel, firstMatch), "next-match");

  Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  const thirdGame = Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  assert.equal(Progression.advance(duel, thirdGame), "next-game");

  Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  const session = Progression.recordRound(duel, "black", "forfeit", { value: 2 });
  assert.equal(session.sessionComplete, true);
  assert.equal(duel.players.black.matches, 2);
});
