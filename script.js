/* ============================================================
   2048 NEON — script.js
   Vanilla JS game engine: grid logic, rendering, controls,
   persistence, audio and UI wiring.
   ============================================================ */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Constants
  --------------------------------------------------------- */
  const SIZE = 4;
  const WIN_VALUE = 2048;
  const MOVE_MS = 160;      // must roughly match CSS --dur-med
  const SPAWN_DELAY = MOVE_MS + 10;
  const SAVE_KEY = '2048neon.save.v1';
  const STATS_KEY = '2048neon.stats.v1';

  const DIRS = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  /* ---------------------------------------------------------
     DOM references
  --------------------------------------------------------- */
  const el = {
    board: document.getElementById('board'),
    boardGrid: document.getElementById('board-grid'),
    tileLayer: document.getElementById('tile-layer'),
    boardStatus: document.getElementById('board-status'),
    scoreValue: document.getElementById('score-value'),
    bestValue: document.getElementById('best-value'),
    movesValue: document.getElementById('moves-value'),
    scorePop: document.getElementById('score-pop'),
    newGameBtn: document.getElementById('new-game-btn'),
    undoBtn: document.getElementById('undo-btn'),
    statsBtn: document.getElementById('stats-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    soundToggle: document.getElementById('sound-toggle'),
    howtoBtn: document.getElementById('howto-btn'),
    srAnnouncer: document.getElementById('sr-announcer'),

    winModal: document.getElementById('win-modal'),
    winScore: document.getElementById('win-score'),
    winMoves: document.getElementById('win-moves'),
    winConfetti: document.getElementById('win-confetti'),
    keepPlayingBtn: document.getElementById('keep-playing-btn'),
    winNewGameBtn: document.getElementById('win-newgame-btn'),

    gameoverModal: document.getElementById('gameover-modal'),
    overScore: document.getElementById('over-score'),
    overBest: document.getElementById('over-best'),
    overNewGameBtn: document.getElementById('over-newgame-btn'),

    confirmModal: document.getElementById('confirm-modal'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
    confirmOkBtn: document.getElementById('confirm-ok-btn'),

    statsModal: document.getElementById('stats-modal'),
    statsCloseBtn: document.getElementById('stats-close-btn'),
    statBest: document.getElementById('stat-best'),
    statBestTile: document.getElementById('stat-best-tile'),
    statTotalMoves: document.getElementById('stat-total-moves'),
    statGamesPlayed: document.getElementById('stat-games-played'),
    statGamesWon: document.getElementById('stat-games-won'),
    statLongest: document.getElementById('stat-longest'),

    howtoModal: document.getElementById('howto-modal'),
    howtoCloseBtn: document.getElementById('howto-close-btn')
  };

  /* ---------------------------------------------------------
     Audio module — Web Audio API, no external files
  --------------------------------------------------------- */
  const Audio2048 = (() => {
    let ctx = null;
    let enabled = true;

    function ensureCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone({ freq = 440, dur = 0.09, type = 'sine', gain = 0.06, sweep = 0, delay = 0 }) {
      if (!enabled) return;
      const c = ensureCtx();
      if (!c) return;
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const amp = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (sweep) osc.frequency.linearRampToValueAtTime(freq + sweep, t0 + dur);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.linearRampToValueAtTime(gain, t0 + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(amp).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    return {
      setEnabled(v) { enabled = v; },
      isEnabled() { return enabled; },
      unlock() { ensureCtx(); },
      move() { tone({ freq: 260, dur: 0.06, type: 'sine', gain: 0.035 }); },
      merge(value) {
        const pitch = 300 + Math.min(Math.log2(value) * 40, 500);
        tone({ freq: pitch, dur: 0.12, type: 'triangle', gain: 0.07, sweep: 60 });
      },
      bigMerge(value) {
        tone({ freq: 340, dur: 0.16, type: 'triangle', gain: 0.08, sweep: 220 });
        tone({ freq: 520, dur: 0.2, type: 'sine', gain: 0.05, sweep: 160, delay: 0.05 });
      },
      click() { tone({ freq: 520, dur: 0.045, type: 'square', gain: 0.03 }); },
      win() {
        [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.065, delay: i * 0.09 }));
      },
      gameOver() {
        [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.26, type: 'sine', gain: 0.06, delay: i * 0.11 }));
      }
    };
  })();

  /* ---------------------------------------------------------
     Storage module
  --------------------------------------------------------- */
  const Storage = {
    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    save(data) {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
    },
    clear() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
    },
    loadStats() {
      try {
        const raw = localStorage.getItem(STATS_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    saveStats(stats) {
      try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* noop */ }
    }
  };

  function defaultStats() {
    return {
      bestScore: 0,
      bestTile: 0,
      totalMoves: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      longestGameSeconds: 0
    };
  }

  let stats = Object.assign(defaultStats(), Storage.loadStats() || {});

  /* ---------------------------------------------------------
     Game state
  --------------------------------------------------------- */
  let tileIdSeq = 1;

  const state = {
    grid: createEmptyGrid(),   // grid[r][c] = tile object | null
    score: 0,
    moves: 0,
    won: false,
    keepPlaying: false,
    over: false,
    startedAt: Date.now(),
    undoAvailable: false,
    animating: false
  };

  let undoSnapshot = null;

  function createEmptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }

  function makeTile(r, c, value) {
    return { id: tileIdSeq++, r, c, value, merged: false, isNew: false, justMerged: false, removed: false };
  }

  function cloneGridValues(grid) {
    return grid.map(row => row.map(t => (t ? t.value : null)));
  }

  /* ---------------------------------------------------------
     Board geometry (responsive)
  --------------------------------------------------------- */
  let geo = { cell: 0, gap: 14 };

  function measureBoard() {
    const cs = getComputedStyle(document.documentElement);
    const gapPx = parseFloat(cs.getPropertyValue('--board-gap')) || 14;
    const inner = el.tileLayer.clientWidth;
    const cell = (inner - gapPx * (SIZE - 1)) / SIZE;
    geo = { cell, gap: gapPx };
  }

  function cellTransform(r, c) {
    const x = c * (geo.cell + geo.gap);
    const y = r * (geo.cell + geo.gap);
    return `translate(${x}px, ${y}px)`;
  }

  function fontSizeFor(value) {
    const digits = String(value).length;
    let scale = 0.4;
    if (digits === 3) scale = 0.34;
    else if (digits === 4) scale = 0.27;
    else if (digits > 4) scale = 0.22;
    return Math.max(14, geo.cell * scale);
  }

  /* ---------------------------------------------------------
     Board grid cells (background) — built dynamically
  --------------------------------------------------------- */
  function buildBackgroundCells() {
    el.boardGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      frag.appendChild(cell);
    }
    el.boardGrid.appendChild(frag);
  }

  /* ---------------------------------------------------------
     Rendering
  --------------------------------------------------------- */
  const tileEls = new Map(); // id -> DOM element

  function renderAll(animateSpawn) {
    measureBoard();
    const seen = new Set();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const tile = state.grid[r][c];
        if (!tile) continue;
        seen.add(tile.id);
        let node = tileEls.get(tile.id);
        if (!node) {
          node = document.createElement('div');
          node.className = 'tile';
          node.innerHTML = '<div class="tile-inner"><span class="tile-value"></span></div>';
          el.tileLayer.appendChild(node);
          tileEls.set(tile.id, node);
          if (animateSpawn) node.classList.add('tile-spawn');
        }
        const displayValue = tile.value >= 8192 ? 'huge' : String(tile.value);
        node.dataset.v = tile.value > 4096 ? '4096' : String(tile.value);
        node.style.width = geo.cell + 'px';
        node.style.height = geo.cell + 'px';
        node.style.transform = cellTransform(r, c);
        const valueSpan = node.querySelector('.tile-value');
        valueSpan.textContent = tile.value >= 8192 ? tile.value.toLocaleString() : tile.value;
        valueSpan.style.setProperty('--tile-font', fontSizeFor(tile.value) + 'px');
        node.style.setProperty('--tile-font', fontSizeFor(tile.value) + 'px');

        if (tile.justMerged) {
          node.classList.add('tile-merged');
          node.classList.remove('tile-spawn');
        }
      }
    }

    // remove stale DOM nodes
    for (const [id, node] of tileEls) {
      if (!seen.has(id)) {
        node.remove();
        tileEls.delete(id);
      }
    }
  }

  function clearAnimationFlags() {
    forEachTile(t => { t.justMerged = false; t.isNew = false; });
    for (const node of tileEls.values()) {
      node.classList.remove('tile-spawn', 'tile-merged');
    }
  }

  function forEachTile(fn) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (state.grid[r][c]) fn(state.grid[r][c]);
      }
    }
  }

  /* ---------------------------------------------------------
     Core mechanics
  --------------------------------------------------------- */
  function withinBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function buildTraversal(vector) {
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 2, 3];
    if (vector.x === 1) xs.reverse();
    if (vector.y === 1) ys.reverse();
    return { xs, ys };
  }

  function findFarthest(r, c, vector) {
    let prevR = r, prevC = c;
    let nr = r + vector.y, nc = c + vector.x;
    while (withinBounds(nr, nc) && !state.grid[nr][nc]) {
      prevR = nr; prevC = nc;
      nr += vector.y; nc += vector.x;
    }
    return { farthest: { r: prevR, c: prevC }, next: { r: nr, c: nc } };
  }

  function hasMovesAvailable() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!state.grid[r][c]) return true;
      }
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = state.grid[r][c].value;
        if (c < SIZE - 1 && state.grid[r][c + 1] && state.grid[r][c + 1].value === v) return true;
        if (r < SIZE - 1 && state.grid[r + 1][c] && state.grid[r + 1][c].value === v) return true;
      }
    }
    return false;
  }

  function addRandomTile() {
    const empties = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!state.grid[r][c]) empties.push({ r, c });
    if (empties.length === 0) return null;
    const spot = empties[Math.floor(Math.random() * empties.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = makeTile(spot.r, spot.c, value);
    tile.isNew = true;
    state.grid[spot.r][spot.c] = tile;
    return tile;
  }

  /**
   * Attempts a move in the given direction.
   * Returns { moved, mergeGains: [values merged this turn] }
   */
  function move(direction) {
    if (state.animating || state.over) return { moved: false };
    const vector = DIRS[direction];
    const { xs, ys } = buildTraversal(vector);

    forEachTile(t => { t.merged = false; t.justMerged = false; });

    let moved = false;
    const mergeGains = [];
    const toRemove = [];

    for (const c of xs) {
      for (const r of ys) {
        const tile = state.grid[r][c];
        if (!tile) continue;

        const { farthest, next } = findFarthest(r, c, vector);
        const nextTile = withinBounds(next.r, next.c) ? state.grid[next.r][next.c] : null;

        if (nextTile && nextTile.value === tile.value && !nextTile.merged && !tile.merged) {
          // merge tile -> nextTile
          state.grid[r][c] = null;
          tile.r = next.r; tile.c = next.c; // slide toward target for animation purposes
          nextTile.value *= 2;
          nextTile.merged = true;
          nextTile.justMerged = true;
          mergeGains.push(nextTile.value);
          toRemove.push(tile);
          moved = true;
        } else if (farthest.r !== r || farthest.c !== c) {
          state.grid[r][c] = null;
          tile.r = farthest.r; tile.c = farthest.c;
          state.grid[farthest.r][farthest.c] = tile;
          moved = true;
        }
      }
    }

    return { moved, mergeGains, toRemove };
  }

  function performMove(direction) {
    if (state.animating || state.over) return;

    undoSnapshot = {
      grid: cloneGridValues(state.grid),
      score: state.score,
      moves: state.moves
    };

    const result = move(direction);
    if (!result.moved) return;

    state.animating = true;
    Audio2048.move();

    // Render the slide/merge phase (source tiles already repositioned to target cell)
    renderAll(false);

    // Announce + score
    let gained = 0;
    result.mergeGains.forEach(v => { gained += v; });
    if (gained > 0) {
      state.score += gained;
      floatScore(gained);
      const hasBig = result.mergeGains.some(v => v >= 128);
      if (hasBig) Audio2048.bigMerge(Math.max(...result.mergeGains));
      else result.mergeGains.forEach(v => Audio2048.merge(v));
    }

    state.moves += 1;
    stats.totalMoves += 1;

    setTimeout(() => {
      // remove tiles that merged away
      result.toRemove.forEach(t => {
        const node = tileEls.get(t.id);
        if (node) { node.remove(); tileEls.delete(t.id); }
      });
      clearAnimationFlags();

      const spawned = addRandomTile();
      updateHUD();
      renderAll(true);
      state.undoAvailable = true;
      el.undoBtn.disabled = false;
      state.animating = false;

      announce(spawned ? `Moved ${direction}. ${gained > 0 ? 'Merged for ' + gained + ' points.' : ''}` : `Moved ${direction}.`);

      checkWin();
      checkGameOver();
      persist();
    }, MOVE_MS);
  }

  /* ---------------------------------------------------------
     Win / Game over
  --------------------------------------------------------- */
  function checkWin() {
    if (state.won || state.keepPlaying) return;
    let reached = false;
    forEachTile(t => { if (t.value >= WIN_VALUE) reached = true; });
    if (reached) {
      state.won = true;
      stats.gamesWon += 1;
      Audio2048.win();
      showWinModal();
    }
  }

  function checkGameOver() {
    if (state.over) return;
    if (!hasMovesAvailable()) {
      state.over = true;
      Audio2048.gameOver();
      recordGameEnd();
      el.board.classList.add('shake');
      setTimeout(() => {
        el.board.classList.remove('shake');
        showGameOverModal();
      }, 320);
    }
  }

  function recordGameEnd() {
    const elapsed = Math.round((Date.now() - state.startedAt) / 1000);
    stats.longestGameSeconds = Math.max(stats.longestGameSeconds, elapsed);
    stats.gamesPlayed += 1;
    let bestTileNow = 0;
    forEachTile(t => { bestTileNow = Math.max(bestTileNow, t.value); });
    stats.bestTile = Math.max(stats.bestTile, bestTileNow);
    Storage.saveStats(stats);
  }

  /* ---------------------------------------------------------
     HUD
  --------------------------------------------------------- */
  function updateHUD() {
    el.scoreValue.textContent = formatNum(state.score);
    el.movesValue.textContent = formatNum(state.moves);
    if (state.score > stats.bestScore) stats.bestScore = state.score;
    el.bestValue.textContent = formatNum(stats.bestScore);
  }

  function formatNum(n) { return n.toLocaleString('en-US'); }

  function floatScore(amount) {
    el.scorePop.textContent = '+' + formatNum(amount);
    el.scorePop.classList.remove('pop-animate');
    // force reflow to restart animation
    void el.scorePop.offsetWidth;
    el.scorePop.classList.add('pop-animate');
  }

  function announce(msg) {
    el.srAnnouncer.textContent = msg;
  }

  /* ---------------------------------------------------------
     Persistence (full round trip)
  --------------------------------------------------------- */
  function persist() {
    const data = {
      bestScore: stats.bestScore,
      currentBoard: cloneGridValues(state.grid),
      currentScore: state.score,
      moveCount: state.moves,
      theme: document.body.getAttribute('data-theme') || 'dark',
      soundEnabled: Audio2048.isEnabled(),
      gameState: {
        won: state.won,
        keepPlaying: state.keepPlaying,
        over: state.over,
        startedAt: state.startedAt
      }
    };
    Storage.save(data);
    Storage.saveStats(stats);
  }

  function restoreFromSave() {
    const data = Storage.load();
    if (!data || !data.currentBoard) return false;

    tileIdSeq = 1;
    state.grid = createEmptyGrid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = data.currentBoard[r][c];
        if (v) state.grid[r][c] = makeTile(r, c, v);
      }
    }
    state.score = data.currentScore || 0;
    state.moves = data.moveCount || 0;
    stats.bestScore = Math.max(stats.bestScore, data.bestScore || 0);
    const gs = data.gameState || {};
    state.won = !!gs.won;
    state.keepPlaying = !!gs.keepPlaying;
    state.over = !!gs.over;
    state.startedAt = gs.startedAt || Date.now();

    if (typeof data.soundEnabled === 'boolean') {
      Audio2048.setEnabled(data.soundEnabled);
      syncSoundButton();
    }
    if (data.theme) setTheme(data.theme, false);

    return true;
  }

  /* ---------------------------------------------------------
     New game / Undo
  --------------------------------------------------------- */
  function startNewGame() {
    tileIdSeq = 1;
    state.grid = createEmptyGrid();
    state.score = 0;
    state.moves = 0;
    state.won = false;
    state.keepPlaying = false;
    state.over = false;
    state.startedAt = Date.now();
    state.undoAvailable = false;
    undoSnapshot = null;
    el.undoBtn.disabled = true;

    tileEls.forEach(node => node.remove());
    tileEls.clear();

    addRandomTile();
    addRandomTile();

    updateHUD();
    renderAll(true);
    announce('New game started.');
    persist();
  }

  function undoMove() {
    if (!undoSnapshot || state.animating) return;
    tileIdSeq = 1;
    const grid = createEmptyGrid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = undoSnapshot.grid[r][c];
        if (v) grid[r][c] = makeTile(r, c, v);
      }
    }
    state.grid = grid;
    state.score = undoSnapshot.score;
    state.moves = undoSnapshot.moves;
    undoSnapshot = null;
    state.undoAvailable = false;
    el.undoBtn.disabled = true;

    tileEls.forEach(node => node.remove());
    tileEls.clear();

    updateHUD();
    renderAll(false);
    Audio2048.click();
    announce('Move undone.');
    persist();
  }

  /* ---------------------------------------------------------
     Modals
  --------------------------------------------------------- */
  function openModal(modalEl) {
    modalEl.hidden = false;
  }
  function closeModal(modalEl) {
    modalEl.hidden = true;
  }

  function showWinModal() {
    el.winScore.textContent = formatNum(state.score);
    el.winMoves.textContent = formatNum(state.moves);
    spawnConfetti();
    openModal(el.winModal);
    announce('You reached 2048! Victory.');
  }

  function spawnConfetti() {
    el.winConfetti.innerHTML = '';
    const colors = ['#45e8d6', '#8b6bff', '#ffb454', '#ff6b6b'];
    for (let i = 0; i < 26; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti-bit';
      bit.style.left = Math.random() * 100 + '%';
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = (Math.random() * 0.4) + 's';
      bit.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.winConfetti.appendChild(bit);
    }
  }

  function showGameOverModal() {
    el.overScore.textContent = formatNum(state.score);
    el.overBest.textContent = formatNum(stats.bestScore);
    openModal(el.gameoverModal);
    announce('Game over. No more moves remain.');
  }

  function showStatsModal() {
    el.statBest.textContent = formatNum(stats.bestScore);
    el.statBestTile.textContent = formatNum(stats.bestTile);
    el.statTotalMoves.textContent = formatNum(stats.totalMoves);
    el.statGamesPlayed.textContent = formatNum(stats.gamesPlayed);
    el.statGamesWon.textContent = formatNum(stats.gamesWon);
    el.statLongest.textContent = formatDuration(stats.longestGameSeconds);
    openModal(el.statsModal);
  }

  function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /* ---------------------------------------------------------
     Theme & Sound toggles
  --------------------------------------------------------- */
  function setTheme(theme, save = true) {
    document.body.setAttribute('data-theme', theme);
    el.themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    if (save) persist();
  }

  function toggleTheme() {
    const current = document.body.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    Audio2048.click();
  }

  function syncSoundButton() {
    const on = Audio2048.isEnabled();
    document.body.classList.toggle('sound-off', !on);
    el.soundToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function toggleSound() {
    Audio2048.unlock();
    Audio2048.setEnabled(!Audio2048.isEnabled());
    syncSoundButton();
    if (Audio2048.isEnabled()) Audio2048.click();
    persist();
  }

  /* ---------------------------------------------------------
     Controls — keyboard
  --------------------------------------------------------- */
  const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  function handleKeyboard(e) {
    if (!el.confirmModal.hidden || !el.statsModal.hidden || !el.howtoModal.hidden) return;
    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    if (!el.winModal.hidden || !el.gameoverModal.hidden) return;
    performMove(dir);
  }

  /* ---------------------------------------------------------
     Controls — touch / swipe
  --------------------------------------------------------- */
  let touchStartX = 0, touchStartY = 0, touchActive = false;
  const MIN_SWIPE = 24;

  function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchActive = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e) {
    if (touchActive) e.preventDefault(); // prevent accidental scrolling
  }

  function handleTouchEnd(e) {
    if (!touchActive) return;
    touchActive = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (Math.max(absX, absY) < MIN_SWIPE) return;

    let dir;
    if (absX > absY) dir = dx > 0 ? 'right' : 'left';
    else dir = dy > 0 ? 'down' : 'up';
    performMove(dir);
  }

  /* ---------------------------------------------------------
     Wire up UI
  --------------------------------------------------------- */
  function initEvents() {
    document.addEventListener('keydown', handleKeyboard);

    el.board.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.board.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.board.addEventListener('touchend', handleTouchEnd, { passive: true });

    el.newGameBtn.addEventListener('click', () => {
      Audio2048.click();
      openModal(el.confirmModal);
    });
    el.confirmCancelBtn.addEventListener('click', () => { Audio2048.click(); closeModal(el.confirmModal); });
    el.confirmOkBtn.addEventListener('click', () => {
      Audio2048.click();
      closeModal(el.confirmModal);
      startNewGame();
    });

    el.undoBtn.addEventListener('click', undoMove);
    el.statsBtn.addEventListener('click', () => { Audio2048.click(); showStatsModal(); });
    el.statsCloseBtn.addEventListener('click', () => { Audio2048.click(); closeModal(el.statsModal); });

    el.howtoBtn.addEventListener('click', () => { Audio2048.click(); openModal(el.howtoModal); });
    el.howtoCloseBtn.addEventListener('click', () => { Audio2048.click(); closeModal(el.howtoModal); });

    el.themeToggle.addEventListener('click', toggleTheme);
    el.soundToggle.addEventListener('click', toggleSound);

    el.keepPlayingBtn.addEventListener('click', () => {
      state.keepPlaying = true;
      closeModal(el.winModal);
      persist();
    });
    el.winNewGameBtn.addEventListener('click', () => {
      closeModal(el.winModal);
      startNewGame();
    });
    el.overNewGameBtn.addEventListener('click', () => {
      closeModal(el.gameoverModal);
      startNewGame();
    });

    [el.confirmModal, el.statsModal, el.howtoModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => renderAll(false), 100);
    });

    // Unlock audio context on first interaction (autoplay policies)
    const unlock = () => { Audio2048.unlock(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  function init() {
    buildBackgroundCells();
    initEvents();

    const restored = restoreFromSave();
    syncSoundButton();

    if (restored && !state.over) {
      updateHUD();
      renderAll(false);
      announce('Game restored.');
    } else {
      startNewGame();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
