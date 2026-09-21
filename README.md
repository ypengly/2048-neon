# 2048 NEON 🎮

> **Merge. Think. Conquer.** — A premium, futuristic take on the classic 2048 puzzle game, built with vanilla JavaScript, HTML, and CSS.

![Version](https://img.shields.io/badge/version-1.0.0-45e8d6?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-8b6bff?style=flat-square)
![No Dependencies](https://img.shields.io/badge/dependencies-none-ffb454?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/vanilla-JS-eef1fb?style=flat-square)

---

## ✨ Overview

**2048 NEON** is a fully self-contained, dependency-free reimagining of the beloved 2048 puzzle game. Slide tiles across a neon-lit grid, merge matching numbers, and race to reach the legendary **2048** tile — all wrapped in a sleek, animated, glassmorphic interface.

No build tools. No frameworks. No external assets. Just open the HTML file and play.

---

## 🎯 Features

### Core Gameplay
- **Classic 2048 mechanics** — Slide tiles in four directions; matching numbers merge into their sum.
- **Win & keep playing** — Reach 2048 to win, then continue chasing higher scores.
- **Undo support** — Rewind a single move when you make a mistake.
- **Smart game-over detection** — Detects when no moves remain and ends the game gracefully.

### Premium Presentation
- **Neon glassmorphic UI** — Frosted-glass panels, soft glows, and a gradient-accented dark theme.
- **Animated background scene** — Drifting cyan and violet blobs with a subtle grid overlay.
- **Value-based tile palette** — Tiles shift from cool blues to hot neon gradients as values climb, with a pulsing glow on the 2048 tile.
- **Smooth tile animations** — Slide, spawn, and merge animations with a satisfying pop.
- **Score float animation** — A floating `+N` indicator whenever you earn points.
- **Confetti celebration** — A burst of confetti when you reach 2048.

### Experience & Accessibility
- **Light / dark theme toggle** — Persisted across sessions.
- **Sound effects** — Procedurally generated via the Web Audio API (no audio files). Toggleable.
- **Full keyboard support** — Arrow keys and WASD.
- **Touch / swipe support** — Fully playable on mobile with `touch-action: none`.
- **Screen reader announcements** — Live region announces moves, merges, wins, and game overs.
- **Reduced-motion support** — Respects `prefers-reduced-motion`.
- **Responsive layout** — Scales from small phones to desktop.

### Persistence & Stats
- **Auto-save** — Your board, score, moves, theme, and sound preference are saved to `localStorage` and restored on reload.
- **Statistics panel** — Tracks best score, best tile, total moves, games played, games won, and longest game duration.

---

## 🚀 Getting Started

### Play Instantly

1. **Download** or clone this repository.
2. Ensure the three files sit in the same folder:
   ```
   ├── index.html
   ├── style.css
   └── script.js
   ```
3. **Open `index.html`** in any modern browser.

That's it. No install, no build step, no server required.

### Optional: Local Server

If you prefer serving it (e.g., for testing on other devices on your network):

```bash
# Python 3
python -m http.server 8000

# or Node.js (with npx)
npx serve .
```

Then visit `http://localhost:8000`.

---

## 🕹️ How to Play

1. Use the **arrow keys**, **WASD**, or **swipe** to slide all tiles on the board.
2. When **two tiles with the same number collide**, they merge into one tile with double the value.
3. A new tile (**2** or **4**) spawns after every valid move.
4. Keep merging — **4 → 8 → 16 → ... → 2048**.
5. Reach **2048** to win. Keep playing for a higher score!

> **Tip:** Plan two moves ahead. Keep your highest tile in a corner and build a "snake" pattern to avoid trapping smaller tiles.

---

## 🎛️ Controls

| Action | Input |
| --- | --- |
| Move Up | `↑` or `W` |
| Move Down | `↓` or `S` |
| Move Left | `←` or `A` |
| Move Right | `→` or `D` |
| Swipe (mobile) | Drag on the board |
| New Game | **New Game** button |
| Undo Last Move | **Undo** button |
| View Stats | **Stats** button |
| Toggle Theme | 🌙 / ☀️ icon (top-right) |
| Toggle Sound | 🔊 / 🔇 icon (top-right) |

---

## 🧠 How It Works

### Architecture

The game is split into three clean, self-contained files:

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic markup, modals, ARIA live regions, accessible controls. |
| `style.css` | Design tokens (CSS custom properties), layout, animations, theming. |
| `script.js` | Game engine, rendering, input handling, audio, persistence, UI wiring. |

### Key Technical Details

- **IIFE module pattern** — `script.js` is wrapped in an immediately-invoked function expression to keep the global scope clean.
- **Tile identity tracking** — Each tile has a unique `id`, allowing DOM elements to be reused across moves for smooth CSS transform-based animations.
- **Responsive geometry** — Cell size and gap are measured at runtime from `--board-gap` and the tile layer's width, so the board scales fluidly.
- **Web Audio API** — All sound effects are synthesized on the fly (no `.mp3`/`.wav` files). The audio context unlocks on first user interaction to comply with autoplay policies.
- **Full state persistence** — Board, score, moves, win/keep-playing flags, theme, and sound preference are serialized to `localStorage` under versioned keys (`2048neon.save.v1`, `2048neon.stats.v1`).
- **CSS custom properties** — The entire color system, radii, easing curves, and animation durations are tokenized in `:root` and overridden under `[data-theme="light"]`.

### Browser Support

Works in all modern browsers that support:
- ES6+ (arrow functions, `Map`, `Set`, template literals)
- CSS Custom Properties
- Web Audio API (sound is gracefully skipped if unavailable)
- `localStorage` (game still works if unavailable — just no saving)

---

## 📁 Project Structure

```
2048-neon/
├── index.html      # Markup, modals, accessibility scaffolding
├── style.css       # Design system, layout, animations, theming
├── script.js       # Game engine + UI logic (vanilla JS, ~600 LOC)
└── README.md       # You are here
```

---

## 🎨 Customization

Want to make it your own? Everything is tokenized.

### Change the Color Palette

Edit the CSS custom properties in `style.css`:

```css
:root {
  --c-cyan: #45e8d6;
  --c-violet: #8b6bff;
  --c-amber: #ffb454;
  --c-danger: #ff6b6b;
  /* ... */
}
```

### Change the Board Size

```css
:root {
  --board-size: min(560px, 92vw);  /* board width/height */
  --board-gap: 14px;                /* gap between tiles */
}
```

### Adjust Animation Speed

```css
:root {
  --dur-fast: 90ms;
  --dur-med: 160ms;   /* must roughly match MOVE_MS in script.js */
}
```

> ⚠️ If you change `--dur-med`, also update `MOVE_MS` in `script.js` so logic and animation stay in sync.

### Change the Win Condition

In `script.js`:

```js
const WIN_VALUE = 2048;  // try 4096 for a harder challenge
```

---

## ♿ Accessibility

2048 NEON was built with accessibility in mind:

- **Semantic HTML** — Proper `<header>`, `<main>`, `<footer>`, `<section>`, and `<button>` elements.
- **ARIA attributes** — `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-pressed`, `aria-live`, and `aria-label` where appropriate.
- **Screen reader live region** — `#sr-announcer` (`.sr-only`) announces moves, merges, wins, and game overs.
- **Keyboard-first** — All controls are reachable and operable via keyboard.
- **Focus indicators** — Custom `:focus-visible` outlines on interactive elements.
- **Reduced motion** — Animations are effectively disabled under `prefers-reduced-motion: reduce`.
- **Color contrast** — Text and tile colors are chosen for readability in both themes.

---

## 🔒 Privacy & Data

2048 NEON is **100% client-side**:

- No analytics.
- No tracking.
- No network requests except for the optional Google Fonts stylesheet (`Space Grotesk` and `Inter`).
- All game data lives in your browser's `localStorage`.

To wipe saved data, clear your browser's site data for the page.

---

## 🛠️ Development

There's no build process — just edit the files and refresh.

### Quick Local Workflow

```bash
# Clone
git clone https://github.com/your-username/2048-neon.git
cd 2048-neon

# Serve locally (optional)
python -m http.server 8000
# or
npx serve .
```

### Linting (optional)

If you want to keep the code tidy:

```bash
npx eslint script.js
npx stylelint style.css
```

(No config is included — bring your own or extend a popular preset.)

---

## 🗺️ Roadmap

Ideas for future iterations:

- [ ] Difficulty presets (5×5, 6×6 grids)
- [ ] Multiple undos (history stack)
- [ ] Daily challenge mode (seeded boards)
- [ ] Leaderboard via `localStorage` per-device
- [ ] AI auto-solver / hint system
- [ ] PWA support (offline install, manifest, service worker)
- [ ] Custom tile skins / themes
- [ ] Localization (i18n)

Contributions welcome!

---

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/amazing-idea`.
3. Commit your changes: `git commit -m 'Add amazing idea'`.
4. Push to the branch: `git push origin feature/amazing-idea`.
5. Open a Pull Request.

Please keep the code vanilla — no frameworks, no build tools, no external runtime dependencies.

---

## 📜 License

Released under the **MIT License**. See [`LICENSE`](LICENSE) for details.

You're free to use, modify, and distribute this project — attribution appreciated but not required.

---

## 🙏 Acknowledgements

- Inspired by **Gabriele Cirulli's** original [2048](https://github.com/gabrielecirulli/2048) (MIT).
- Typography by **Space Grotesk** and **Inter**, served via [Google Fonts](https://fonts.google.com/).
- All sound effects synthesized with the **Web Audio API** — no audio files used.

---

## 💬 A Final Note

> *"Merge. Think. Conquer."*

2048 NEON is meant to be a small, polished, joyful thing — a game you can open in a tab and lose ten minutes to. If it brings you a moment of focus or a spark of satisfaction when that 2048 tile finally lands, it's done its job.

Enjoy the glow. ✨

---

<p align="center">
  <strong>2048 NEON</strong> — an independent puzzle experience.
</p>
