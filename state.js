// Game state and fate deck management

const State = (() => {
  // --- Stubs for Game Data ---
  const divinationDeck = [
    { type: 'DIV', text: "A choice made in haste will ripple outwards." },
    { type: 'DIV', text: "Doubt is a shadow that you cast yourself." },
    { type: 'DIV', text: "The path of least resistance leads to the steepest fall." }
  ];

  // NEW: A deck for Dynamics cards
  const dynamicsDeck = [
    { type: 'DYN', text: "Whispers of Doubt: The next 'Wrong' answer costs an extra Thread." },
    { type: 'DYN', text: "Sudden Clarity: The first 'Revelatory' answer this round awards bonus points." },
    { type: 'DYN', text: "Shared Burden: If the Thread frays, all players feel the chill." }
  ];

  // NEW: The combined Fate Deck
  const fateDeck = [...divinationDeck, ...dynamicsDeck];

  let questionDeck = [];

  // --- Game State ---
  let gameState = {
    roundNumber: 0,
    roundScore: 0,
    roundsToWin: 3,
    roundsWon: 0,
    score: 0,
    lives: 3,
    thread: 0,
    currentQuestion: null,
    notWrongCount: 0,
    pendingFateCard: null, // Card drawn but not yet active
    activeFateCard: null   // Card currently affecting the round
  };

  // MODIFIED: Renamed and updated to handle the pending card
  const drawFateCard = () => {
    // Prevent drawing if a card is already pending
    if (gameState.pendingFateCard) return null;

    const drawn = fateDeck[Math.floor(Math.random() * fateDeck.length)];
    gameState.pendingFateCard = drawn; // Store the card as pending
    return drawn;
  };

  // MODIFIED: Activates the pending card at the start of a new round
  const startNewRound = () => {
    gameState.roundNumber++;
    gameState.roundScore = 0;
    const remainingWins = gameState.roundsToWin - gameState.roundsWon;
    gameState.thread = remainingWins + 1;
    gameState.notWrongCount = 0;

    // Activate the pending card
    gameState.activeFateCard = gameState.pendingFateCard;
    gameState.pendingFateCard = null; // Clear the pending slot
  };

  // MODIFIED: Clears the active card at the end of a round
  const endRound = (won = false) => {
    if (won) {
      gameState.roundsWon++;
      gameState.score += gameState.roundScore;
    } else {
      gameState.lives--;
    }
    gameState.roundScore = 0;
    gameState.activeFateCard = null; // Card's effect ends with the round
  };

  return {
    gameState,
    drawFateCard,
    startNewRound,
    endRound
  };
})();

