const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const style = fs.readFileSync(path.join(root, "style.css"), "utf8");

test("every cached interface element exists exactly once", () => {
  const cache = script.match(/const ids = \[(.*?)\];/s)?.[1] || "";
  const cachedIds = [...cache.matchAll(/"([A-Za-z][A-Za-z0-9]+)"/g)]
    .map((match) => match[1]);

  assert.ok(cachedIds.length > 0);
  for (const id of cachedIds) {
    const occurrences = html.match(new RegExp(`id=["']${id}["']`, "g")) || [];
    assert.equal(occurrences.length, 1, `${id} should exist exactly once`);
  }
});

test("browser modules load in dependency order", () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((match) => match[1]);

  assert.deepEqual(scripts, [
    "engine.js",
    "skilltree.js",
    "progression.js",
    "turns.js",
    "tiles.js",
    "board-view.js",
    "script.js",
  ]);
});

test("the base interface exposes Forfeit and keeps Observe in the skill tree", () => {
  assert.match(html, /<strong>Forfeit<\/strong>/);
  assert.doesNotMatch(html, /id="observeButton"/);
  const skillTree = fs.readFileSync(path.join(root, "skilltree.js"), "utf8");
  assert.match(skillTree, /name: "Observe"/);
});

test("the canvas cannot feed its intrinsic size back into the board layout", () => {
  const canvasRule = style.match(/#gameCanvas\s*\{([^}]*)\}/s)?.[1] || "";
  const boardRule = style.match(/\.board-frame\s*\{([^}]*)\}/s)?.[1] || "";
  const laboratoryRules = [...style.matchAll(/\.laboratory\s*\{([^}]*)\}/gs)]
    .map((match) => match[1])
    .join("\n");
  const boardView = fs.readFileSync(path.join(root, "board-view.js"), "utf8");

  assert.match(canvasRule, /position:\s*absolute/);
  assert.match(canvasRule, /inset:\s*0/);
  assert.match(canvasRule, /min-height:\s*0/);
  assert.match(boardRule, /min-height:\s*0/);
  assert.match(boardRule, /overflow:\s*hidden/);
  assert.match(laboratoryRules, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(laboratoryRules, /min-height:\s*0/);
  assert.match(boardView, /const resizeTarget = canvas\.parentElement \|\| canvas/);
  assert.match(boardView, /resizeObserver\.observe\(resizeTarget\)/);
  assert.doesNotMatch(boardView, /resizeObserver\.observe\(canvas\)/);
});
