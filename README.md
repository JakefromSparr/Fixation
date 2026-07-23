# Fixation

Fixation is a two-player abstract strategy game by Sparr Games. Players build one unstable Formula on a hex grid while the tiles in their hands decay toward collapse.

## Current rules

- Each player has a pool of 9 tiles and 3 hand slots.
- Fresh tiles normally enter at potency 3. Elevation raises them to 4 and Quintessence raises them to 5.
- Black begins round one. The starting player alternates in later rounds.
- The base actions are Contribute, Extract, and Forfeit.
- A round ends only when a player Forfeits. The opponent claims the Formula.
- Completing every bond or collapsing every hand slot does not automatically end the round.
- Only fully bonded tiles score by default. Open tiles score 0.
- Only a completely fulfilled Formula can receive a cataloged or player-created name.
- A game is best of 3 rounds, a match is best of 3 games, and a session is best of 3 matches.
- Formula points remain provisional until a player wins the game, unless Discovery protects the points immediately.
- The game winner may buy any number of affordable shared skills between games or retain the points.

### Base actions

- **Contribute:** Place a tile. Its potency locks and the active hand decays by 1.
- **Extract:** Decay every active tile in that hand by 1, then move a fresh tile from the pool into an empty live slot.
- **Forfeit:** Concede the round. If no other action is legal, Forfeit is the only available base action.

A hand tile that reaches potency 0 is lost and collapses its slot. A player with three collapsed slots must Forfeit unless a discovered skill provides another legal action.

### Bonding

The first tile enters the center. Every later placement must touch at least one tile with open potency, cannot touch a fully bonded tile, and cannot touch more open neighbors than its own potency. It bonds immediately with every eligible neighbor.

The open-potency change for a placement is:

`U(new) = U(old) + p - 2k`

where `p` is the placed element's potency and `k` is the number of bonds it forms.

## Shared skill tree

`skilltree.js` is the declarative source for names, costs, prerequisites, replacements, descriptions, and use limits. Discovery is the shared root. Purchased skills apply to both players for the rest of the session.

### Hand branch

- Refine
  - Stagnate
    - Observe
    - Energize
    - Flagrate, which requires Observe and Energize
  - Circulate
    - Fulfill
    - Revitalize
    - Reanimate, which requires Fulfill and Revitalize
  - Catalysis
  - Fixation

### Formula branch

- Discovery
  - Elevation
    - Acerbation
      - Reclamation
    - Dulcification
      - Quintessence
  - Emanation, which integrates Acerbation, Reclamation, Dulcification, and Quintessence
    - Transmutation
    - Manipulation
    - Activation, which requires Transmutation and Manipulation

Emanation removes voluntary Forfeit while another legal action exists. If an exhausted player Forfeits with any open potency remaining, the result is a cat's game. No points or round win are awarded, and the round is replayed.

## Named Formulas

The current catalog contains Calcination, Dissolution, Separation, Conjunction, and Fermentation. Generic derivatives have been removed. The discovery panel keeps unrevealed entries grey until the corresponding fulfilled Formula is claimed.

## Run locally

Open `index.html` directly in a modern browser, or serve the folder with any static web server.

Run the rules and interface tests with:

```sh
npm test
```

## Code map

- `engine.js` owns hex geometry, placement legality, bonding, scoring, Formula recognition, Transmutation, and Manipulation.
- `skilltree.js` owns the shared skill graph and purchase metadata.
- `progression.js` owns provisional points, secured points, and the game, match, and session hierarchy.
- `turns.js` owns game state, action effects, hand decay, Forfeit, purchase cadence, and round flow.
- `tiles.js` draws the procedural black-and-white tile family from potency 1 through 5.
- `board-view.js` owns canvas sizing, coordinates, targeting, and board drawing.
- `script.js` connects the interface to those modules and handles menus, dialogs, and save/load.

The engine remains authoritative. Editing prices or prerequisites in `skilltree.js` is safe. Adding a new mechanical effect still requires a handler and tests in the engine or turn layer.
