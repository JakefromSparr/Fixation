let canvas, ctx, uiContainer, nameScreen;
let startGameBtn, generatePairBtn, shufflePairBtn;
let pairNameDisplay, pairNameSection;
let magnumOpusModal, magnumOpusBtn, closeMagnumOpusBtn;
let blackEssenceDisplay, whiteEssenceDisplay;

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  uiContainer = document.getElementById('uiContainer');
  nameScreen = document.getElementById('nameScreen');
  startGameBtn = document.getElementById('startGameBtn');
  generatePairBtn = document.getElementById('generatePairBtn');
  shufflePairBtn = document.getElementById('shufflePairBtn');
  pairNameDisplay = document.getElementById('pairNameDisplay');
  pairNameSection = document.getElementById('pairNameSection');

  const hamburger = document.getElementById('hamburger');
  const menuOverlay = document.getElementById('menuOverlay');
  const rulesModal = document.getElementById('rulesModal');
  magnumOpusModal = document.getElementById('magnumOpusModal');
  magnumOpusBtn = document.getElementById('magnumOpusBtn');
  closeMagnumOpusBtn = document.getElementById('closeMagnumOpus');
  blackEssenceDisplay = document.getElementById('blackEssenceDisplay');
  whiteEssenceDisplay = document.getElementById('whiteEssenceDisplay');
  updateEssenceDisplay();
  hamburger.addEventListener('click', () => {
    menuOverlay.classList.toggle('hidden');
  });
  document.getElementById('rulesBtn').addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
    menuOverlay.classList.add('hidden');
  });
  magnumOpusBtn.addEventListener('click', () => {
    magnumOpusModal.classList.remove('hidden');
    menuOverlay.classList.add('hidden');
    drawTechTree();
    updateEssenceDisplay();
  });
  document.getElementById('closeRules').addEventListener('click', () => {
    rulesModal.classList.add('hidden');
  });
  closeMagnumOpusBtn.addEventListener('click', () => {
    magnumOpusModal.classList.add('hidden');
  });
  magnumOpusModal.addEventListener('click', (evt) => {
    if (evt.target === magnumOpusModal) {
      magnumOpusModal.classList.add('hidden');
    }
  });
  document.getElementById('techTreeCanvas').addEventListener('click', handleTechTreeClick);
  document.getElementById('unlockNodeBtn').addEventListener('click', unlockTechTreeNode);
  document.getElementById('newGameBtn').addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    newGame();
  });
  document.getElementById('saveGameBtn').addEventListener('click', () => {
    saveGame();
    menuOverlay.classList.add('hidden');
  });
  document.getElementById('loadGameBtn').addEventListener('click', () => {
    loadGame();
    menuOverlay.classList.add('hidden');
  });

  generatePairBtn.addEventListener('click', generatePairName);
  shufflePairBtn.addEventListener('click', shufflePair);
  startGameBtn.addEventListener('click', startGameClicked);

  canvas.addEventListener('click', canvasClick);

  drawUI();
  preloadImages(tileImages, () => {
    drawUI();
  });
});

function generatePairName() {
  const black = document.getElementById('blackName').value.trim();
  const white = document.getElementById('whiteName').value.trim();

  if (!black || !white) {
    alert("Please enter both names.");
    return;
  }

  const shuffles = [
    black.slice(0, 2) + white.slice(0, 2),
    black.slice(0, 1) + white.slice(0, 3),
    white.slice(0, 2) + black.slice(0, 2),
    black.slice(0, 3) + white.slice(0, 1),
  ];

  playerPair = shuffles[currentShuffle % shuffles.length].toLowerCase();
  pairNameDisplay.textContent = playerPair;
  pairNameSection.style.display = 'block';
  startGameBtn.disabled = false;
}

function shufflePair() {
  currentShuffle++;
  generatePairName();
}

function startGameClicked() {
  const black = document.getElementById('blackName').value.trim();
  const white = document.getElementById('whiteName').value.trim();

  if (!black || !white) {
    alert("Please enter both names.");
    return;
  }

  if (!playerPair) {
    alert("Please generate your pair name first.");
    return;
  }

  const savedData = localStorage.getItem(playerPair);
  if (savedData) {
    const data = JSON.parse(savedData);
    playerProfile = data.profile || {
      names: { black, white },
      discoveredFormulas: [],
      unlockedElements: [],
      uses: {}
    };
    blackScore = data.blackScore || 0;
    whiteScore = data.whiteScore || 0;
    roundNumber = data.roundNumber || 1;
    console.log("Loaded saved profile:", data);
  } else {
    playerProfile = {
      names: { black, white },
      discoveredFormulas: [],
      unlockedElements: [],
      uses: {}
    };
    localStorage.setItem(playerPair, JSON.stringify({profile: playerProfile}));
    console.log("Created new profile:", playerProfile);
  }

  nameScreen.style.display = "none";
  canvas.style.display = "block";
  uiContainer.style.display = "block";
  resizeCanvas();
  startGame();
}
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  updateBoardOffsets();
}

window.addEventListener('resize', () => {
  resizeCanvas();
  drawHands(); // or redraw your canvas logic
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    resizeCanvas();
    drawHands();
  }, 200); // wait for layout to stabilize
});
// GAME STATE VARIABLES
let gameState = "title";
let currentPlayer = "black";
let currentTurn = 1;
let blackScore = 0;
let whiteScore = 0;
let roundNumber = 1;

// Tech tree state
let blackEssence = 0;
let whiteEssence = 0;
let blackUnlockedNodes = new Set();
let whiteUnlockedNodes = new Set();
let blackActiveAbilities = {};
let whiteActiveAbilities = {};

function updateEssenceDisplay() {
  if (!blackEssenceDisplay || !whiteEssenceDisplay) return;
  blackEssenceDisplay.textContent = blackEssence;
  whiteEssenceDisplay.textContent = whiteEssence;
}

let isFirstMove = true;
let lastPlayerToPlace = null;
let lastFormulaClaimedName = null; // Track the last claimed formula name

let playerPair = null;
let playerProfile = null;
let currentShuffle = 0;

const tileImages = {
  "black1": "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.Black1.1_adrb7w.png",
  "white1": "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648920/Fixation.White1.1_gprwia.png",
  "black2": "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.Black2.1_fqnciy.png",
  "white2": "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.White2.1._uplvln.png",
  "black3": "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648919/Fixation.Black3.1_xcwdzj.png",
  "white3": "https://res.cloudinary.com/dyoqz4zeb/image/upload/v1734648920/Fixation.White3.1._y63ltf.png"
};

const loadedImages = {};
let imagesLoaded = 0;
let imagesReady = false;

function createPlaceholderImage(key) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  const isBlack = key.includes('black');
  const pipsMatch = key.match(/(\d+)/);
  const pips = pipsMatch ? pipsMatch[1] : '';

  c.fillStyle = isBlack ? '#000' : '#fff';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = isBlack ? '#fff' : '#000';
  c.strokeRect(0, 0, 64, 64);
  c.fillStyle = isBlack ? '#fff' : '#000';
  c.font = '32px Arial';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(pips, 32, 32);
  return canvas;
}

function preloadImages(images, callback) {
  const keys = Object.keys(images);
  const done = () => {
    imagesLoaded++;
    if (imagesLoaded === keys.length) {
      imagesReady = true;
      callback();
    }
  };
  keys.forEach((key) => {
    const img = new Image();
    img.src = images[key];
    img.onload = () => {
      loadedImages[key] = img;
      done();
    };
    img.onerror = () => {
      console.warn(`Using placeholder for ${key}`);
      loadedImages[key] = createPlaceholderImage(key);
      done();
    };
  });
}

// BOARD CONSTANTS
const hexRadius = 32;
const hexWidth = 1.5 * hexRadius; 
const hexHeight = Math.sqrt(3)*hexRadius; 
let boardOffsetX = 0;
let boardOffsetY = 0;
function updateBoardOffsets() {
  boardOffsetX = canvas.width / 2;
  boardOffsetY = canvas.height / 2;
}

// Initialize board offsets after the helper is defined
// (canvas will be resized once players start the game)

const neighborDirs = [
  {q: 1, r: 0},
  {q: -1, r: 0},
  {q: 0, r: 1},
  {q: 0, r: -1},
  {q: 1, r: -1},
  {q: -1, r: 1}
];

const formulas = {
  Calcination: [
    { nodes: [{ pips: 1 }, { pips: 1 }], edges: [[0, 1]] }
  ],
  Dissolution: [
    {
      nodes: [{ pips: 2 }, { pips: 2 }, { pips: 2 }],
      edges: [[0, 1], [1, 2], [2, 0]]
    }
  ],
  // Add more formulas here
};

// Tech tree definitions
const techTree = {
  Water: {
    color: "#66ccff",
    nodes: [
      { id: "Water1", name: "Slip", tier: 1, dependencies: [], cost: 1, type: "Water", unlockedInitially: true,
        effect: { description: "Once per game, move a tile to a new position without disturbing its bonds." },
        isUsed: { black: false, white: false }
      },
      { id: "Water2", name: "Rinse", tier: 2, dependencies: ["Water1"], cost: 2, type: "Water",
        effect: { description: "Once per game, move a tile to a new position, even if it disturbs bonds (cannot isolate)." },
        isUsed: { black: false, white: false }
      },
      { id: "Water3", name: "Soak", tier: 3, dependencies: ["Water2"], cost: 3, type: "Water",
        effect: { description: "Indefinitely adds a 4-potency tile to both players' decks." },
        isPermanent: true
      }
    ]
  },
  Air: {
    color: "#ccffff",
    nodes: [
      { id: "Air1", name: "Trace", tier: 1, dependencies: [], cost: 1, type: "Air", unlockedInitially: true,
        effect: { description: "Once per game, make an empty space on the board unusable." },
        isUsed: { black: false, white: false }
      },
      { id: "Air2", name: "Cool", tier: 2, dependencies: ["Air1"], cost: 2, type: "Air",
        effect: { description: "Once per game, reshuffle your hand." },
        isUsed: { black: false, white: false }
      },
      { id: "Air3", name: "Inflate", tier: 3, dependencies: ["Air2"], cost: 3, type: "Air",
        effect: { description: "Indefinitely raise the point value of 1-pip tiles to two." },
        isPermanent: true
      }
    ]
  },
  Fire: {
    color: "#ff9966",
    nodes: [
      { id: "Fire1", name: "Simmer", tier: 1, dependencies: [], cost: 1, type: "Fire", unlockedInitially: true,
        effect: { description: "Once per game, play a tile no matter what bond it is, counted as zero points." },
        isUsed: { black: false, white: false }
      },
      { id: "Fire2", name: "Burn", tier: 2, dependencies: ["Fire1"], cost: 2, type: "Fire",
        effect: { description: "Once per game, remove a slot from opponent's hand (2 tiles max for remaining rounds)." },
        isUsed: { black: false, white: false }
      },
      { id: "Fire3", name: "Meld", tier: 3, dependencies: ["Fire2"], cost: 3, type: "Fire",
        effect: { description: "Indefinitely adds a 4-potency tile to both players' decks." },
        isPermanent: true
      }
    ]
  },
  Earth: {
    color: "#cc9966",
    nodes: [
      { id: "Earth1", name: "Pile", tier: 1, dependencies: [], cost: 1, type: "Earth", unlockedInitially: true,
        effect: { description: "Once per game, place a tile on top of an existing tile (increase potency)." },
        isUsed: { black: false, white: false }
      },
      { id: "Earth2", name: "Bury", tier: 2, dependencies: ["Earth1"], cost: 2, type: "Earth",
        effect: { description: "Once per game, place a tile on top of an existing tile (decrease potency)." },
        isUsed: { black: false, white: false }
      },
      { id: "Earth3", name: "Forge", tier: 3, dependencies: ["Earth2"], cost: 3, type: "Earth",
        effect: { description: "Indefinitely adds a 4-potency tile to both players' decks." },
        isPermanent: true
      }
    ]
  }
};

// HANDS & STACKS
let blackStack = [];
let whiteStack = [];

function resetStacks() {
  blackStack = [];
  whiteStack = [];
  for (let pips = 1; pips <= 3; pips++) {
    for (let i = 0; i < 3; i++) {
      blackStack.push({ color: "black", pips, remainingPips: pips, type: `black${pips}`, q:null, r:null });
      whiteStack.push({ color: "white", pips, remainingPips: pips, type: `white${pips}`, q:null, r:null });
    }
  }
  shuffle(blackStack);
  shuffle(whiteStack);
}

resetStacks();

let blackHand = [];
let whiteHand = [];
let selectedTile = null;
let boardspace = {};
let highlightedSpaces = [];

// HELPER FUNCTIONS
function hexToPixel(q, r) {
  const x = boardOffsetX + hexWidth * q;
  const y = boardOffsetY + hexHeight * (r + q/2);
  return { x, y };
}

function pixelToHex(x, y) {
  const X = x - boardOffsetX;
  const Y = y - boardOffsetY;
  let q = X / hexWidth;
  let r = (Y / hexHeight) - q/2;
  return hexRound(q,r);
}

function hexRound(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return {q: rx, r: rz};
}

function drawHex(x, y, color = "gray") {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i;
    const px = x + hexRadius * Math.cos(angle);
    const py = y + hexRadius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawTile(image, q, r) {
  const { x, y } = hexToPixel(q, r);
  ctx.drawImage(image, x - 32, y - 32, 64, 64);
}

function getNeighbors(q, r) {
  return neighborDirs.map(d => ({q: q + d.q, r: r + d.r}));
}

// GAME LOGIC
function bondWithNeighbors(q, r) {
  const tile = boardspace[`${q},${r}`];
  if (!tile) return;
  const neighbors = getNeighbors(q,r);
  for (let n of neighbors) {
    const neighborTile = boardspace[`${n.q},${n.r}`];
    if (neighborTile && tile.remainingPips > 0 && neighborTile.remainingPips > 0) {
      tile.remainingPips--;
      neighborTile.remainingPips--;
    }
  }
}

function checkNoMoreMoves() {
  for (const key in boardspace) {
    const tile = boardspace[key];
    if (tile.remainingPips > 0) {
      const [q, r] = key.split(',').map(Number);
      const neighbors = getNeighbors(q, r);
      for (let n of neighbors) {
        if (!boardspace[`${n.q},${n.r}`]) {
          // Potential space available
          return false;
        }
      }
    }
  }
  return true;
}

function calculateAvailableSpaces(selectedTile) {
  const availableSpaces = [];
  if (!selectedTile) return availableSpaces;

  if (isFirstMove) {
    if (!boardspace["0,0"]) {
      availableSpaces.push({q:0,r:0});
    }
    return availableSpaces;
  }

  const checkedSpots = new Set();

  for (const key in boardspace) {
    const [q, r] = key.split(',').map(Number);
    const neighbors = getNeighbors(q,r);
    for (let n of neighbors) {
      const spotKey = `${n.q},${n.r}`;
      if (!boardspace[spotKey] && !checkedSpots.has(spotKey)) {
        checkedSpots.add(spotKey);

        let spotNeighbors = getNeighbors(n.q, n.r);
        let hasNeighborWithPips = 0;
        let zeroPipNeighbor = false;

        for (let sn of spotNeighbors) {
          const ntile = boardspace[`${sn.q},${sn.r}`];
          if (ntile) {
            if (ntile.remainingPips > 0) {
              hasNeighborWithPips++;
            } else if (ntile.remainingPips === 0) {
              zeroPipNeighbor = true;
            }
          }
        }

        if (selectedTile.remainingPips > 0 
            && hasNeighborWithPips >= 1
            && hasNeighborWithPips <= selectedTile.remainingPips
            && !zeroPipNeighbor) {
          availableSpaces.push({q:n.q, r:n.r});
        }
      }
    }
  }

  return availableSpaces;
}

function drawAvailableSpaces() {
  if (!highlightedSpaces || highlightedSpaces.length === 0) return;
  ctx.save();
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 3;
  for (let space of highlightedSpaces) {
    const { x, y } = hexToPixel(space.q, space.r);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      const px = x + hexRadius * Math.cos(angle);
      const py = y + hexRadius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function initBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let rr = -3; rr <= 3; rr++) {
    for (let qq = -3; qq <= 3; qq++) {
      const { x, y } = hexToPixel(qq, rr);
      drawHex(x, y);
    }
  }
}

function drawHands() {
  initBoard();
  // Draw placed tiles
  for (const key in boardspace) {
    const tile = boardspace[key];
    const [q, r] = key.split(',').map(Number);
    drawTile(loadedImages[tile.type], q, r);
  }

  drawAvailableSpaces();

  const whiteCenterY = canvas.height/2;
  whiteHand.forEach((tile, index) => {
    const x = 50; 
    const y = whiteCenterY + (index * 80) - (whiteHand.length * 40); 
    if (tile === selectedTile) {
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 64, 64);
    }
    ctx.drawImage(loadedImages[tile.type], x, y, 64, 64);
    tile.x = x;
    tile.y = y;
    tile.width = 64;
    tile.height = 64;
  });

  const blackCenterY = canvas.height/2;
  blackHand.forEach((tile, index) => {
    const x = canvas.width - 64 - 50; 
    const y = blackCenterY + (index * 80) - (blackHand.length * 40);
    if (tile === selectedTile) {
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 64, 64);
    }
    ctx.drawImage(loadedImages[tile.type], x, y, 64, 64);
    tile.x = x;
    tile.y = y;
    tile.width = 64;
    tile.height = 64;
  });
}

// CLUSTER & FORMULA CHECKS
function extractCluster(q, r) {
  const visited = new Set();
  const cluster = [];
  const stack = [[q, r]];

  while (stack.length > 0) {
    const [cq, cr] = stack.pop();
    const key = `${cq},${cr}`;

    if (!boardspace[key] || visited.has(key)) continue;

    visited.add(key);
    const node = boardspace[key];
    node.q = cq;
    node.r = cr;
    cluster.push(node);

    for (const dir of neighborDirs) {
      const nq = cq + dir.q;
      const nr = cr + dir.r;
      stack.push([nq, nr]);
    }
  }

  return cluster;
}

function matchesFormula(cluster, configurations) {
  for (const config of configurations) {
    if (matchesCluster(cluster, config)) {
      return true; // Match found
    }
  }
  return false; // No match
}

function matchesCluster(cluster, config) {
  if (cluster.length !== config.nodes.length) return false;

  const nodeMatch = cluster.every((node, index) => {
    return node.pips === config.nodes[index].pips;
  });

  if (!nodeMatch) return false;

  const edgeMatch = config.edges.every(([start, end]) => {
    const startNode = cluster[start];
    const endNode = cluster[end];
    return startNode && endNode && areNodesConnected(startNode, endNode);
  });

  return edgeMatch;
}

function areNodesConnected(nodeA, nodeB) {
  const aNeighbors = getNeighbors(nodeA.q, nodeA.r);
  return aNeighbors.some(n => n.q === nodeB.q && n.r === nodeB.r);
}

function calculatePoints(cluster) {
  return cluster.reduce((sum, node) => sum + node.pips, 0);
}

// claimFormula now only detects formulas, no points awarded here
function claimFormula(cluster) {
  for (const [formulaName, configurations] of Object.entries(formulas)) {
    if (matchesFormula(cluster, configurations)) {
      lastFormulaClaimedName = formulaName;
      return { name: formulaName };
    }
  }
  lastFormulaClaimedName = null;
  return null;
}

// UI & GAME FLOW
function drawUI() {
  uiContainer.innerHTML = "";

  if (gameState === "title") {
    const startBtn = document.createElement('button');
    startBtn.innerText = "Start Game";
    startBtn.onclick = () => startGame();
    if (!imagesReady) {
      startBtn.disabled = true;
      const loadingMsg = document.createElement('div');
      loadingMsg.innerText = "Loading assets...";
      uiContainer.appendChild(loadingMsg);
    }
    uiContainer.appendChild(startBtn);

  } else if (gameState === "turnAnnounce") {
    const msg = document.createElement('div');
    msg.innerText = `${currentPlayer.toUpperCase()} Player Turn #${currentTurn}`;
    const nextBtn = document.createElement('button');
    nextBtn.innerText = "OK";
    nextBtn.onclick = () => beginTurn();
    uiContainer.appendChild(msg);
    uiContainer.appendChild(nextBtn);

  } else if (gameState === "roundEnd") {
    let formulaMessage = (lastFormulaClaimedName)
      ? `${lastFormulaClaimedName} Formula Claimed by ${lastPlayerToPlace.toUpperCase()}!`
      : `Formula Claimed by ${lastPlayerToPlace.toUpperCase()}!`;

    const msg = document.createElement('div');
    msg.innerText = `${formulaMessage}\nCurrent Score: Black: ${blackScore}, White: ${whiteScore}\nRound ${roundNumber-1} complete. Press OK to start Round ${roundNumber}.`;

    const nextBtn = document.createElement('button');
    nextBtn.innerText = "OK";
    nextBtn.onclick = () => {
      lastFormulaClaimedName = null; // Reset for next round
      resetForNextRound();
    };
    uiContainer.appendChild(msg);
    uiContainer.appendChild(nextBtn);

  } else if (gameState === "end") {
    const msg = document.createElement('div');
    msg.innerText = `Game Over! Black: ${blackScore} White: ${whiteScore}`;
    uiContainer.appendChild(msg);
  }
}

function startGame() {
  if (!imagesReady) {
    alert("Images are still loading. Please try again in a moment.");
    return;
  }
  currentPlayer = "black";
  currentTurn = 1;
  roundNumber = 1;
  gameState = "turnAnnounce";
  drawUI();
}

function newGame() {
  blackScore = 0;
  whiteScore = 0;
  for (const key in boardspace) {
    delete boardspace[key];
  }
  isFirstMove = true;
  selectedTile = null;
  highlightedSpaces = [];
  blackHand = [];
  whiteHand = [];
  blackEssence = 0;
  whiteEssence = 0;
  blackUnlockedNodes = new Set();
  whiteUnlockedNodes = new Set();
  blackActiveAbilities = {};
  whiteActiveAbilities = {};
  resetStacks();
  updateEssenceDisplay();
  startGame();
}

function saveGame() {
  const data = {
    profile: playerProfile,
    blackScore,
    whiteScore,
    roundNumber,
    blackEssence,
    whiteEssence,
    blackUnlockedNodes: Array.from(blackUnlockedNodes),
    whiteUnlockedNodes: Array.from(whiteUnlockedNodes),
    blackActiveAbilities,
    whiteActiveAbilities,
    blackStack,
    whiteStack,
    blackHand,
    whiteHand,
    boardspace: Object.values(boardspace)
  };
  localStorage.setItem(playerPair, JSON.stringify(data));
  alert('Game saved');
}

function loadGame() {
  const saved = localStorage.getItem(playerPair);
  if (saved) {
    const data = JSON.parse(saved);
    if (data.profile) playerProfile = data.profile;
    blackScore = data.blackScore || 0;
    whiteScore = data.whiteScore || 0;
    roundNumber = data.roundNumber || 1;
    blackEssence = data.blackEssence || 0;
    whiteEssence = data.whiteEssence || 0;
    blackUnlockedNodes = new Set(data.blackUnlockedNodes || []);
    whiteUnlockedNodes = new Set(data.whiteUnlockedNodes || []);
    blackActiveAbilities = data.blackActiveAbilities || {};
    whiteActiveAbilities = data.whiteActiveAbilities || {};
    boardspace = {};
    if (data.boardspace) {
      data.boardspace.forEach(tile => {
        boardspace[`${tile.q},${tile.r}`] = tile;
      });
    }
    blackStack = data.blackStack || [];
    whiteStack = data.whiteStack || [];
    blackHand = data.blackHand || [];
    whiteHand = data.whiteHand || [];
    applyPermanentEffects();
    updateEssenceDisplay();
    drawUI();
    alert('Game loaded');
  } else {
    alert('No saved data');
  }
}

function applyPermanentEffects() {
  // Apply effects for unlocked tier 3 nodes
  // Currently only adds 4-potency tiles if required
  const applyForPlayer = player => {
    if (player === 'black' && blackUnlockedNodes.has('Water3') && !blackActiveAbilities.Water3) {
      add4PotencyTilesToStacks('black');
      blackActiveAbilities.Water3 = true;
    }
    if (player === 'white' && whiteUnlockedNodes.has('Water3') && !whiteActiveAbilities.Water3) {
      add4PotencyTilesToStacks('white');
      whiteActiveAbilities.Water3 = true;
    }
  };
  applyForPlayer('black');
  applyForPlayer('white');
}

function scoreRound(winnerColor, formulaDetails) {
  let totalPips = 0;
  for (const key in boardspace) {
    const tile = boardspace[key];
    totalPips += tile.pips;
  }

  let awardedPoints = totalPips;
  if (formulaDetails) {
    awardedPoints *= 2;
    if (winnerColor === 'black') blackEssence += 1; else whiteEssence += 1;
    updateEssenceDisplay();
  }

  if (winnerColor === "black") {
    blackScore += awardedPoints;
  } else {
    whiteScore += awardedPoints;
  }
}

function resetForNextRound() {
  if (roundNumber > 3) {
    // All rounds done, end game
    gameState = "end";
    drawUI();
    return;
  }

  for (const key in boardspace) {
    delete boardspace[key];
  }
  isFirstMove = true;
  selectedTile = null;
  highlightedSpaces = [];
  blackHand = [];
  whiteHand = [];
  resetStacks();

  currentPlayer = (Math.random() > 0.5) ? "black" : "white";
  currentTurn = 1;
  gameState = "turnAnnounce";
  drawUI();
}

function endRound() {
  const lastTileEntry = Object.entries(boardspace).find(([key, tile]) => tile.color === lastPlayerToPlace);
  let formulaDetails = null;

  if (lastTileEntry) {
    const [q, r] = lastTileEntry[0].split(',').map(Number);
    const cluster = extractCluster(q, r);
    formulaDetails = claimFormula(cluster);
  }

  // Award points now
  scoreRound(lastPlayerToPlace, formulaDetails);

  if (formulaDetails && lastFormulaClaimedName) {
    // Show a special popup before showing round end
    alert(`${lastPlayerToPlace.toUpperCase()} discovered ${lastFormulaClaimedName}! Incredible! Their points are doubled for claiming this formula.`);
  }

  roundNumber++;

  if (roundNumber > 3) {
    // Game ends after 3 rounds
    let winner = null;
    if (blackScore > whiteScore) winner = 'black';
    else if (whiteScore > blackScore) winner = 'white';
    if (winner === 'black') blackEssence += 1;
    else if (winner === 'white') whiteEssence += 1;
    updateEssenceDisplay();
    gameState = "end";
    drawUI();
  } else {
    gameState = "roundEnd";
    drawUI();
  }
}

function beginTurn() {
  if (!isFirstMove && checkNoMoreMoves()) {
    endRound();
    return;
  }

  gameState = "gameplay";

  while (blackHand.length < 3 && blackStack.length > 0) {
    blackHand.push(blackStack.pop());
  }
  while (whiteHand.length < 3 && whiteStack.length > 0) {
    whiteHand.push(whiteStack.pop());
  }

  drawHands();
}

function nextTurn() {
  currentPlayer = (currentPlayer === "black") ? "white" : "black";
  currentTurn++;
  gameState = "turnAnnounce";
  drawUI();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// EVENT LISTENERS
function canvasClick(event) {
  if (gameState !== "gameplay") return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const activeHand = currentPlayer === "black" ? blackHand : whiteHand;
  const opponentHand = currentPlayer === "black" ? whiteHand : blackHand;

  let clickedTile = activeHand.find(tile =>
    mouseX >= tile.x && mouseX <= tile.x + tile.width &&
    mouseY >= tile.y && mouseY <= tile.y + tile.height
  );

  if (!clickedTile) {
    let oppClicked = opponentHand.find(tile =>
      mouseX >= tile.x && mouseX <= tile.x + tile.width &&
      mouseY >= tile.y && mouseY <= tile.y + tile.height
    );
    if (oppClicked) {
      // Opponent tile clicked: do nothing
      return;
    }
  }

  if (clickedTile) {
    selectedTile = (selectedTile === clickedTile) ? null : clickedTile;
    if (selectedTile) {
      highlightedSpaces = calculateAvailableSpaces(selectedTile);
    } else {
      highlightedSpaces = [];
    }
    drawHands();
  } else if (selectedTile) {
    const {q, r} = pixelToHex(mouseX, mouseY);
    let validSpot = highlightedSpaces.find(s => s.q === q && s.r === r);

    if (!validSpot) {
      return;
    }

    // Place the tile
    boardspace[`${q},${r}`] = selectedTile;
    boardspace[`${q},${r}`].q = q;
    boardspace[`${q},${r}`].r = r;

    if (currentPlayer === "black") {
      blackHand = blackHand.filter(t => t !== selectedTile);
    } else {
      whiteHand = whiteHand.filter(t => t !== selectedTile);
    }

    bondWithNeighbors(q, r);

    lastPlayerToPlace = currentPlayer;

    // Do NOT call claimFormula or award points here!

    selectedTile = null;
    highlightedSpaces = [];

    if (isFirstMove) {
      isFirstMove = false;
    }

    drawHands();
    nextTurn();
  }
}

// ---------- Tech Tree Functions ----------
let techTreeCanvas, techTreeCtx, selectedTechTreeNode;

function drawTechTree() {
  if (!techTreeCanvas) {
    techTreeCanvas = document.getElementById('techTreeCanvas');
    techTreeCtx = techTreeCanvas.getContext('2d');
  }
  techTreeCtx.clearRect(0, 0, techTreeCanvas.width, techTreeCanvas.height);
  techTreeCtx.font = '14px Arial';
  techTreeCtx.textAlign = 'center';
  techTreeCtx.textBaseline = 'middle';

  let branchIndex = 0;
  for (const branchName in techTree) {
    const branch = techTree[branchName];
    const branchStartX = 100 + branchIndex * 150;

    branch.nodes.forEach(node => {
      node.vizX = branchStartX + (node.tier - 1) * 100;
      node.vizY = 100 + (node.tier - 1) * 120;

      const unlocked = currentPlayer === 'black' ?
        blackUnlockedNodes.has(node.id) :
        whiteUnlockedNodes.has(node.id);

      techTreeCtx.fillStyle = unlocked ? branch.color : '#ddd';
      techTreeCtx.strokeStyle = '#333';
      techTreeCtx.lineWidth = 2;
      techTreeCtx.beginPath();
      techTreeCtx.arc(node.vizX, node.vizY, 25, 0, Math.PI*2);
      techTreeCtx.fill();
      techTreeCtx.stroke();

      techTreeCtx.fillStyle = '#000';
      techTreeCtx.fillText(node.name, node.vizX, node.vizY - 15);
      techTreeCtx.fillText(`(${node.cost})`, node.vizX, node.vizY + 15);
    });
    branchIndex++;
  }
  updateTechTreeInfoDisplay();
}

function handleTechTreeClick(evt) {
  const rect = techTreeCanvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  selectedTechTreeNode = null;
  for (const branchName in techTree) {
    const branch = techTree[branchName];
    for (const node of branch.nodes) {
      const dist = Math.hypot(x - node.vizX, y - node.vizY);
      if (dist < 25) {
        selectedTechTreeNode = node;
        break;
      }
    }
  }
  drawTechTree();
  if (selectedTechTreeNode) {
    techTreeCtx.strokeStyle = 'yellow';
    techTreeCtx.lineWidth = 4;
    techTreeCtx.beginPath();
    techTreeCtx.arc(selectedTechTreeNode.vizX, selectedTechTreeNode.vizY, 25, 0, Math.PI*2);
    techTreeCtx.stroke();
  }
  updateTechTreeInfoDisplay();
}

function updateTechTreeInfoDisplay() {
  const nameEl = document.getElementById('selectedNodeName');
  const descEl = document.getElementById('selectedNodeDescription');
  const unlockBtn = document.getElementById('unlockNodeBtn');
  const costSpan = document.getElementById('unlockCost');

  if (!selectedTechTreeNode) {
    nameEl.textContent = 'Select a Node';
    descEl.textContent = '';
    unlockBtn.style.display = 'none';
    return;
  }

  nameEl.textContent = selectedTechTreeNode.name;
  descEl.textContent = selectedTechTreeNode.effect.description;
  costSpan.textContent = selectedTechTreeNode.cost;

  const unlockedSet = currentPlayer === 'black' ? blackUnlockedNodes : whiteUnlockedNodes;
  const essence = currentPlayer === 'black' ? blackEssence : whiteEssence;
  const isUnlocked = unlockedSet.has(selectedTechTreeNode.id);
  const depsMet = selectedTechTreeNode.dependencies.every(d => unlockedSet.has(d));
  unlockBtn.style.display = isUnlocked ? 'none' : 'inline-block';
  if (!isUnlocked) {
    unlockBtn.disabled = !(depsMet && essence >= selectedTechTreeNode.cost);
  }
}

function unlockTechTreeNode() {
  if (!selectedTechTreeNode) return;
  const unlockedSet = currentPlayer === 'black' ? blackUnlockedNodes : whiteUnlockedNodes;
  let essenceRef = currentPlayer === 'black' ? 'blackEssence' : 'whiteEssence';
  if (unlockedSet.has(selectedTechTreeNode.id)) return;
  const depsMet = selectedTechTreeNode.dependencies.every(d => unlockedSet.has(d));
  if (!depsMet) return;
  if (window[essenceRef] < selectedTechTreeNode.cost) return;
  window[essenceRef] -= selectedTechTreeNode.cost;
  unlockedSet.add(selectedTechTreeNode.id);
  if (selectedTechTreeNode.isPermanent) {
    applyPermanentEffects();
  }
  updateEssenceDisplay();
  updateTechTreeInfoDisplay();
  drawTechTree();
}

function add4PotencyTilesToStacks(color) {
  const type = `${color}4`;
  if (!tileImages[type]) {
    tileImages[type] = tileImages[`${color}3`];
  }
  const stack = color === 'black' ? blackStack : whiteStack;
  for (let i = 0; i < 3; i++) {
    stack.push({ color, pips: 4, remainingPips: 4, type, q:null, r:null });
  }
}
