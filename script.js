const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiContainer = document.getElementById('uiContainer');
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

resizeCanvas(); // Run once at start
// GAME STATE VARIABLES
let gameState = "title";
let currentPlayer = "black";
let currentTurn = 1;
let blackScore = 0;
let whiteScore = 0;
let roundNumber = 1;

let isFirstMove = true;
let lastPlayerToPlace = null;
let lastFormulaClaimedName = null; // Track the last claimed formula name

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

function preloadImages(images, callback) {
  const keys = Object.keys(images);
  keys.forEach((key) => {
    const img = new Image();
    img.src = images[key];
    img.onload = () => {
      loadedImages[key] = img;
      imagesLoaded++;
      if (imagesLoaded === keys.length) {
        imagesReady = true;
        callback();
      }
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
const boardspace = {};
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
      return true;
    }
  }
  lastFormulaClaimedName = null;
  return false;
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

function scoreRound(winnerColor, formulaMatched) {
  let totalPips = 0;
  for (const key in boardspace) {
    const tile = boardspace[key];
    totalPips += tile.pips;
  }

  let awardedPoints = formulaMatched ? totalPips * 2 : totalPips;

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
  let formulaMatched = false;

  if (lastTileEntry) {
    const [q, r] = lastTileEntry[0].split(',').map(Number);
    const cluster = extractCluster(q, r);
    formulaMatched = claimFormula(cluster);
  }

  // Award points now
  scoreRound(lastPlayerToPlace, formulaMatched);

  if (formulaMatched && lastFormulaClaimedName) {
    // Show a special popup before showing round end
    alert(`${lastPlayerToPlace.toUpperCase()} discovered ${lastFormulaClaimedName}! Incredible! Their points are doubled for claiming this formula.`);
  }

  roundNumber++;

  if (roundNumber > 3) {
    // Game ends after 3 rounds
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
canvas.addEventListener("click", (event) => {
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
});

// INITIAL SETUP
drawUI();
preloadImages(tileImages, () => {
  drawUI();
});
