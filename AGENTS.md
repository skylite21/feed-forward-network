# Repository Guidelines

## Project Structure & Module Organization
The project is a single-page vanilla web app; all markup, styles, and logic live in `index.html`. The script builds the interactive feed-forward network directly in the DOM, so edits should preserve the data arrays (layer definitions, neurons, and weights) near the rendering functions to keep behavior obvious. If you split code across files, place reusable modules under a new `assets/` or `scripts/` folder and import them with relative paths so the static server can resolve them without bundling. Keep any future test fixtures in a top-level `tests/` directory to avoid mixing them with production UI code.

## Build, Test, and Development Commands
- `xdg-open index.html` opens the static page locally for a quick visual smoke test.
- `python3 -m http.server 5173` (run from the repo root) serves the page with CORS-friendly headers at `http://localhost:5173`, which is required for inspecting network requests via DevTools.
- `npx prettier --check index.html` verifies formatting before committing; run `--write` to auto-fix spacing if needed.

## Coding Style & Naming Conventions
Use two-space indentation throughout HTML, CSS, and JavaScript to match the existing file. Favor `const` for DOM references (`networkEl`, `layersWrapper`) and camelCase for functions like `buildConnections`. Keep CSS utility classes hyphenated (`neuron-panel`, `network-wrapper`). When adding logic, prefer small pure functions (e.g., `computeActivation`) and document non-obvious math with inline comments rather than block prose. Avoid embedding external fonts or frameworks unless they are self-hosted assets dropped next to `index.html`.

## Testing Guidelines
There is no automated test suite yet, so rely on manual steady-state checks: load the page via the local server, adjust weights with the +/- controls, hover neurons to verify expression panels, and ensure console logs stay clean. When adding numerical routines, provide deterministic helper functions so future unit tests under `tests/` can import them directly. Any new UI element should be manually exercised across Firefox and Chromium-based browsers to confirm SVG positioning behaves the same.

## Commit & Pull Request Guidelines
History currently uses concise, imperative messages (`initial commit`). Continue that pattern: a single-line subject under 50 characters, optionally followed by wrapped detail lines at 72 characters. Reference issue IDs in the body when applicable. For pull requests, include: purpose, before/after screenshots for UI tweaks, steps to reproduce bugs, and explicit testing notes (e.g., “python http.server + Chrome 122”). Keep PRs focused; split large UI refactors from algorithm changes so reviewers can reason about each concern independently.

## GitHub Pages Publishing
- The public site is hosted from the `gh-pages` branch. The root of that branch contains the same `index.html`, so no `/docs` folder is required.
- After committing to `master`, update the Pages branch with `git checkout gh-pages && git merge master && git push github gh-pages`. Alternatively, recreate it from master via `git push github master:gh-pages`.
- Ensure the GitHub remote is set to `git@github.com:skylite21/feed-forward-network.git`, and keep `gh-pages` configured as the Pages source (already set in repository settings).
- If the repo is cloned fresh, run `git remote add github git@github.com:skylite21/feed-forward-network.git` (if missing), then push both `master` and `gh-pages`.
- Verify deployment on https://skylite21.github.io/feed-forward-network/ once GitHub Pages finishes building (typically under one minute).***
