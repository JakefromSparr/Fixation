(function initFixationBoardView(root, factory) {
  const api = factory(root.FixationEngine, root.FixationTiles);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FixationBoardView = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createBoardApi(Engine, Tiles) {
  "use strict";

  const HEX_RADIUS = 36;

  function create(canvas) {
    const context = canvas.getContext("2d");
    const resizeTarget = canvas.parentElement || canvas;
    let logicalWidth = 0;
    let logicalHeight = 0;
    let offsetX = 0;
    let offsetY = 0;
    let board = {};
    let legalSpaces = [];
    let targetKeys = [];
    let hoveredSpace = null;

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(resizeTarget);

    function render(nextBoard, nextLegalSpaces = [], nextTargetKeys = []) {
      board = nextBoard;
      legalSpaces = nextLegalSpaces;
      targetKeys = nextTargetKeys;
      resize();
    }

    function resize() {
      const rect = resizeTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      logicalWidth = rect.width;
      logicalHeight = rect.height;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateOffset();
      draw();
    }

    function updateOffset() {
      const coordinates = [
        ...Engine.occupiedTiles(board).map(({ q, r }) => ({ q, r })),
        ...legalSpaces,
      ];
      if (coordinates.length === 0) {
        offsetX = logicalWidth / 2;
        offsetY = logicalHeight / 2;
        return;
      }

      const raw = coordinates.map(({ q, r }) => axialToRawPixel(q, r));
      const minX = Math.min(...raw.map((point) => point.x));
      const maxX = Math.max(...raw.map((point) => point.x));
      const minY = Math.min(...raw.map((point) => point.y));
      const maxY = Math.max(...raw.map((point) => point.y));
      offsetX = logicalWidth / 2 - (minX + maxX) / 2;
      offsetY = logicalHeight / 2 - (minY + maxY) / 2;
    }

    function axialToRawPixel(q, r) {
      return {
        x: 1.5 * HEX_RADIUS * q,
        y: Math.sqrt(3) * HEX_RADIUS * (r + q / 2),
      };
    }

    function hexToPixel(q, r) {
      const raw = axialToRawPixel(q, r);
      return { x: offsetX + raw.x, y: offsetY + raw.y };
    }

    function draw() {
      if (!logicalWidth) return;
      context.clearRect(0, 0, logicalWidth, logicalHeight);
      drawGrid();
      drawBonds();
      for (const tile of Engine.occupiedTiles(board)) drawTile(tile);
      drawLegalSpaces();
      drawTargets();
    }

    function drawGrid() {
      context.save();
      context.strokeStyle = "rgba(202, 167, 99, 0.055)";
      context.lineWidth = 1;
      for (let q = -7; q <= 7; q += 1) {
        for (let r = -7; r <= 7; r += 1) {
          const { x, y } = hexToPixel(q, r);
          if (x < -HEX_RADIUS || x > logicalWidth + HEX_RADIUS
            || y < -HEX_RADIUS || y > logicalHeight + HEX_RADIUS) continue;
          traceHex(x, y, HEX_RADIUS - 2);
          context.stroke();
        }
      }
      context.restore();
    }

    function drawBonds() {
      context.save();
      context.strokeStyle = "rgba(202, 167, 99, 0.36)";
      context.lineWidth = 7;
      context.lineCap = "round";
      for (const tile of Engine.occupiedTiles(board)) {
        const start = hexToPixel(tile.q, tile.r);
        for (const coordinate of Engine.neighborsOf(tile.q, tile.r)) {
          const neighbor = board[Engine.keyOf(coordinate.q, coordinate.r)];
          if (!neighbor || tile.id >= neighbor.id) continue;
          const end = hexToPixel(neighbor.q, neighbor.r);
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        }
      }
      context.restore();
    }

    function drawLegalSpaces() {
      for (const space of legalSpaces) {
        const { x, y } = hexToPixel(space.q, space.r);
        const hovered = hoveredSpace
          && hoveredSpace.q === space.q
          && hoveredSpace.r === space.r;
        context.save();
        context.fillStyle = hovered
          ? "rgba(239, 215, 154, 0.2)"
          : "rgba(202, 167, 99, 0.08)";
        context.strokeStyle = hovered ? "#efd79a" : "rgba(202, 167, 99, 0.72)";
        context.lineWidth = hovered ? 3 : 2;
        context.setLineDash([5, 5]);
        traceHex(x, y, HEX_RADIUS - 3);
        context.fill();
        context.stroke();
        context.restore();
      }
    }

    function drawTile(tile) {
      const { x, y } = hexToPixel(tile.q, tile.r);

      context.save();
      context.shadowColor = "rgba(0,0,0,0.48)";
      context.shadowBlur = 13;
      context.shadowOffsetY = 5;
      if (tile.underTiles?.length) {
        context.save();
        context.translate(-4, 5);
        context.globalAlpha = 0.58;
        Tiles.drawArtwork(
          context,
          tile.underTiles[tile.underTiles.length - 1],
          x,
          y,
          HEX_RADIUS * 2,
        );
        context.restore();
      }
      Tiles.drawArtwork(context, tile, x, y, HEX_RADIUS * 2);
      context.restore();

      if (tile.remainingPotency !== tile.potency) drawRemainingBadge(tile, x, y);
    }

    function drawTargets() {
      for (const key of targetKeys) {
        const tile = board[key];
        if (!tile) continue;
        const { x, y } = hexToPixel(tile.q, tile.r);
        context.save();
        context.strokeStyle = "#efd79a";
        context.lineWidth = 3;
        context.setLineDash([4, 4]);
        traceHex(x, y, HEX_RADIUS + 2);
        context.stroke();
        context.restore();
      }
    }

    function drawRemainingBadge(tile, x, y) {
      const badgeX = x + 28;
      const badgeY = y + 24;
      context.save();
      context.beginPath();
      context.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
      context.fillStyle = tile.color === "black" ? "#11100f" : "#eee7db";
      context.fill();
      context.strokeStyle = "#d6b66f";
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = tile.color === "black" ? "#f6efe2" : "#171512";
      context.font = "bold 9px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(tile.remainingPotency), badgeX, badgeY + 0.5);
      context.restore();
    }

    function traceHex(x, y, radius) {
      context.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index;
        const pointX = x + radius * Math.cos(angle);
        const pointY = y + radius * Math.sin(angle);
        if (index === 0) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
      }
      context.closePath();
    }

    function coordinatesFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - offsetX;
      const y = event.clientY - rect.top - offsetY;
      const q = (2 / 3 * x) / HEX_RADIUS;
      const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / HEX_RADIUS;
      return roundAxial(q, r);
    }

    function roundAxial(q, r) {
      const x = q;
      const z = r;
      const y = -x - z;
      let roundedX = Math.round(x);
      let roundedY = Math.round(y);
      let roundedZ = Math.round(z);
      const xDifference = Math.abs(roundedX - x);
      const yDifference = Math.abs(roundedY - y);
      const zDifference = Math.abs(roundedZ - z);

      if (xDifference > yDifference && xDifference > zDifference) {
        roundedX = -roundedY - roundedZ;
      } else if (yDifference > zDifference) {
        roundedY = -roundedX - roundedZ;
      } else {
        roundedZ = -roundedX - roundedY;
      }
      return { q: roundedX, r: roundedZ };
    }

    function hoverFromEvent(event) {
      const { q, r } = coordinatesFromEvent(event);
      const nextHover = legalSpaces.find((space) => space.q === q && space.r === r) || null;
      if (nextHover?.q === hoveredSpace?.q && nextHover?.r === hoveredSpace?.r) {
        return nextHover;
      }
      hoveredSpace = nextHover;
      canvas.style.cursor = nextHover ? "pointer" : "default";
      draw();
      return nextHover;
    }

    function clearHover() {
      hoveredSpace = null;
      canvas.style.cursor = "default";
      draw();
    }

    function destroy() {
      resizeObserver.disconnect();
    }

    return Object.freeze({
      clearHover,
      coordinatesFromEvent,
      destroy,
      draw,
      hoverFromEvent,
      render,
      resize,
    });
  }

  return Object.freeze({ create });
});
