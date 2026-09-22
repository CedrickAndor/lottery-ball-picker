import { createIcons, icons } from 'lucide';
import confetti from 'canvas-confetti';
import { soundEngine } from './audio/soundEngine.js';
import { pickerState } from './state/PickerState.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { BallManager } from './scene/BallManager.js';
import { LotteryMachine } from './scene/LotteryMachine.js';

class TeamPickerApp {
  constructor() {
    this.canvasMount = document.getElementById('canvasMount');
    this.machine = null;
    this.physics = null;
    this.ballManager = null;
    this.clock = { lastTime: performance.now() };

    this.isDrawing = false;
    this.wasMixingBeforeDraw = false;
    this.scoopedBallEntry = null;
    this.currentWinnerRecord = null;
    this.digitalCycleInterval = null;
    this.scoopCatchTransition = null;

    this.init();
  }

  init() {
    // 1. Initialize State
    pickerState.init();

    // 2. Initialize 3D Scene & Physics
    this.physics = new PhysicsWorld();
    this.machine = new LotteryMachine(this.canvasMount);
    this.ballManager = new BallManager(this.machine.scene, this.physics);

    // Initial load of any existing teams in storage (without drop animation)
    pickerState.teams.forEach(team => {
      this.ballManager.spawnBall(team, false);
    });

    // 3. UI Binding
    createIcons({ icons });
    this.bindUIEvents();
    this.bindKeyboardShortcuts();
    this.updateStatsAndLists();

    // 4. Subscribe to State Changes
    pickerState.subscribe((event, data) => {
      this.handleStateEvent(event, data);
    });

    // 5. Start Animation Loop
    this.animate();
  }

  handleStateEvent(event, data) {
    if (event === 'team_added') {
      this.ballManager.spawnBall(data, true);
      soundEngine.playBallClack(2.5);
      this.updateStatsAndLists();
    } else if (event === 'teams_bulk_added') {
      data.forEach((team, idx) => {
        setTimeout(() => {
          this.ballManager.spawnBall(team, true);
          soundEngine.playBallClack(2.0);
        }, idx * 80);
      });
      this.updateStatsAndLists();
    } else if (event === 'team_removed') {
      this.ballManager.removeBall(data.id);
      this.updateStatsAndLists();
    } else if (event === 'winner_drawn') {
      this.updateStatsAndLists();
    } else if (event === 'cleared_all') {
      this.ballManager.removeAll();
      this.updateStatsAndLists();
    }
  }

  updateStatsAndLists() {
    const totalTeams = pickerState.teams.length;
    const totalWinners = pickerState.drawnWinners.length;

    // Status badges
    const statusCountEl = document.getElementById('centerStatusCount');
    const teamListCountEl = document.getElementById('teamListCount');
    const winnersCountEl = document.getElementById('winnersListCount');
    const drawnBadgeEl = document.getElementById('drawnCountBadge');
    const drawBtn = document.getElementById('drawBallBtn');

    if (statusCountEl) statusCountEl.textContent = `${totalTeams} TEAMS IN MACHINE`;
    if (teamListCountEl) teamListCountEl.textContent = String(totalTeams);
    if (winnersCountEl) winnersCountEl.textContent = String(totalWinners);
    if (drawnBadgeEl) drawnBadgeEl.textContent = String(totalWinners);

    if (drawBtn) {
      drawBtn.disabled = totalTeams === 0;
    }

    // Render Active Teams List
    this.renderActiveTeams();

    // Render Drawn Winners List
    this.renderWinnersList();
  }

  renderActiveTeams() {
    const container = document.getElementById('activeTeamsList');
    if (!container) return;

    if (pickerState.teams.length === 0) {
      container.innerHTML = `
        <div class="empty-teams-prompt">
          <i data-lucide="inbox"></i>
          <p>Machine is currently empty.<br>Type team name (e.g. A1, A2) below to drop a ball in!</p>
        </div>
      `;
      createIcons({ icons });
      return;
    }

    container.innerHTML = pickerState.teams.map(t => `
      <div class="team-list-item">
        <div class="team-item-info">
          <div class="lotto-badge-circle" style="--badge-color: ${t.palette.ring}">
            ${t.name}
          </div>
          <span class="team-item-name" title="${t.name}">Team ${t.name}</span>
        </div>
        <button class="team-item-delete" data-remove-id="${t.id}" title="Remove team">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `).join('');

    createIcons({ icons });

    container.querySelectorAll('[data-remove-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-id');
        pickerState.removeTeam(id);
        soundEngine.playClick();
      });
    });
  }

  renderWinnersList() {
    const container = document.getElementById('drawnWinnersList');
    const modalTbody = document.getElementById('winnersTableBody');

    // Mini sidebar list
    if (container) {
      if (pickerState.drawnWinners.length === 0) {
        container.innerHTML = `
          <div class="empty-teams-prompt">
            <i data-lucide="clock"></i>
            <p>No teams drawn yet.<br>Click [DRAW WINNER] to pick.</p>
          </div>
        `;
        createIcons({ icons });
      } else {
        container.innerHTML = pickerState.drawnWinners.map(w => `
          <div class="team-list-item">
            <div class="team-item-info">
              <div class="lotto-badge-circle" style="--badge-color: ${w.palette.ring}">
                ${w.name}
              </div>
              <span class="team-item-name">Team ${w.name}</span>
            </div>
            <span style="font-family:var(--font-tech); font-size:0.68rem; color:var(--text-muted)">#${w.drawIndex}</span>
          </div>
        `).join('');
      }
    }

    // Modal table (no return column)
    if (modalTbody) {
      modalTbody.innerHTML = pickerState.drawnWinners.map(w => `
        <tr>
          <td><strong>#${w.drawIndex}</strong></td>
          <td>
            <div class="lotto-badge-circle" style="--badge-color: ${w.palette.ring};">
              ${w.name}
            </div>
          </td>
          <td><strong>Team ${w.name}</strong></td>
          <td>${w.timestamp}</td>
        </tr>
      `).join('');
    }
  }

  bindUIEvents() {
    // 1. Add Team Form
    const addForm = document.getElementById('addTeamForm');
    const nameInput = document.getElementById('teamNameInput');

    addForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = nameInput?.value;
      if (val && val.trim()) {
        pickerState.addTeam(val);
        nameInput.value = '';
        nameInput.focus();
      }
    });

    // 2. Draw Winner Button
    document.getElementById('drawBallBtn')?.addEventListener('click', () => {
      this.triggerDraw();
    });

    // 3. Agitate / Mix Toggle
    document.getElementById('agitateToggleBtn')?.addEventListener('click', () => {
      this.toggleAgitation();
    });

    // 4. Bulk Add Dialog
    const bulkDialog = document.getElementById('bulkAddDialog');
    document.getElementById('openBulkAddBtn')?.addEventListener('click', () => {
      soundEngine.playClick();
      bulkDialog?.showModal();
    });

    document.getElementById('closeBulkAddBtn')?.addEventListener('click', () => bulkDialog?.close());
    document.getElementById('cancelBulkAddBtn')?.addEventListener('click', () => bulkDialog?.close());

    document.getElementById('loadSampleTeamsBtn')?.addEventListener('click', () => {
      const textarea = document.getElementById('bulkNamesTextarea');
      if (textarea) {
        textarea.value = [
          'A1', 'A2', 'A3', 'A4',
          'B1', 'B2', 'B3', 'B4',
          'C1', 'C2', 'C3', 'C4'
        ].join('\n');
      }
      soundEngine.playClick();
    });

    document.getElementById('confirmBulkAddBtn')?.addEventListener('click', () => {
      const textarea = document.getElementById('bulkNamesTextarea');
      if (textarea && textarea.value) {
        const names = textarea.value.split('\n').filter(s => s.trim().length > 0);
        pickerState.bulkAddTeams(names);
        textarea.value = '';
      }
      bulkDialog?.close();
      soundEngine.playClick();
    });

    // 5. Winners History Modal
    const winnersDialog = document.getElementById('winnersModalDialog');
    document.getElementById('winnersListBtn')?.addEventListener('click', () => {
      soundEngine.playClick();
      winnersDialog?.showModal();
    });

    document.getElementById('closeWinnersModalBtn')?.addEventListener('click', () => winnersDialog?.close());
    document.getElementById('doneWinnersModalBtn')?.addEventListener('click', () => winnersDialog?.close());

    document.getElementById('clearWinnersOnlyBtn')?.addEventListener('click', () => {
      if (confirm('Clear drawn winners history?')) {
        pickerState.drawnWinners = [];
        pickerState.saveToStorage();
        this.updateStatsAndLists();
        soundEngine.playClick();
      }
    });

    // 6. Copy Winners list
    document.getElementById('copyWinnersBtn')?.addEventListener('click', () => {
      if (pickerState.drawnWinners.length === 0) {
        alert('No winners drawn yet.');
        return;
      }
      const text = pickerState.drawnWinners.map(w => `#${w.drawIndex}: Team ${w.name} (${w.timestamp})`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        soundEngine.playClick();
        alert('Winners list copied to clipboard!');
      });
    });

    // 7. Clear / Reset All
    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
      if (confirm('Reset machine and remove all teams?')) {
        pickerState.clearAll();
        soundEngine.playClick();
      }
    });

    // 8. Sound Toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    const soundIcon = document.getElementById('soundIcon');
    soundBtn?.addEventListener('click', () => {
      const nextState = !pickerState.settings.soundFx;
      pickerState.settings.soundFx = nextState;
      soundEngine.setEnabled(nextState);
      soundBtn.classList.toggle('active', nextState);
      if (soundIcon) {
        soundIcon.setAttribute('data-lucide', nextState ? 'volume-2' : 'volume-x');
        createIcons({ icons });
      }
      pickerState.saveToStorage();
      if (nextState) soundEngine.playClick();
    });

    // 9. Fullscreen Toggle
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });

    // 10. Winner Overlay Actions (Single Accept / Next Draw button)
    document.getElementById('winnerNextDrawBtn')?.addEventListener('click', () => {
      this.closeWinnerOverlay();
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) {
          this.toggleAgitation();
        } else {
          this.triggerDraw();
        }
      } else if (e.code === 'KeyM') {
        document.getElementById('soundToggleBtn')?.click();
      } else if (e.code === 'KeyF') {
        document.getElementById('fullscreenBtn')?.click();
      }
    });
  }

  toggleAgitation() {
    const isNowAgitating = !this.physics.isAgitating;
    this.physics.setAgitating(isNowAgitating, 1.0);

    const btn = document.getElementById('agitateToggleBtn');
    const txt = document.getElementById('agitateBtnText');
    const led = document.getElementById('agitateLedIndicator');

    if (isNowAgitating) {
      soundEngine.startBlower();
      if (btn) btn.classList.add('active');
      if (txt) txt.textContent = 'Stop';
      if (led) {
        led.textContent = 'MIXING';
        led.className = 'status-indicator mixing';
      }
    } else {
      soundEngine.stopBlower();
      if (btn) btn.classList.remove('active');
      if (txt) txt.textContent = 'Mix';
      if (led) {
        led.textContent = 'READY';
        led.className = 'status-indicator';
      }
    }
  }

  // Draw Random Winning Team
  triggerDraw() {
    if (this.isDrawing) return;
    if (pickerState.teams.length === 0) {
      alert('Machine is empty! Please add teams first.');
      return;
    }

    this.isDrawing = true;
    this.wasMixingBeforeDraw = this.physics.isAgitating;

    const drawBtn = document.getElementById('drawBallBtn');
    if (drawBtn) drawBtn.disabled = true;

    // Pick random winner from available teams
    const randIdx = Math.floor(Math.random() * pickerState.teams.length);
    const chosenTeam = pickerState.teams[randIdx];
    const ballMeshEntry = this.ballManager.getBall(chosenTeam.id);

    // 1. Ramp up agitation and sound
    this.physics.setAgitating(true, 1.35);
    soundEngine.startBlower();
    soundEngine.playSuspenseRise(2.5);
    soundEngine.playServoMotor(2.2);

    const statusLed = document.getElementById('agitateLedIndicator');
    if (statusLed) {
      statusLed.textContent = 'DRAWING';
      statusLed.className = 'status-indicator mixing';
    }

    // 2. Start digital display cycling through active team codes
    this.startDigitalCycling();

    // 3. Mechanical wire scoop dips down into center dish and scoops the ball
    this.machine.triggerScoopAnimation(
      // Peak lower: scoop captures target ball in the center
      () => {
  if (ballMeshEntry) {
    const bodyEntry = ballMeshEntry.bodyEntry;

    this.scoopedBallEntry = ballMeshEntry;
    this.physics.scoopedBall = ballMeshEntry;

    // Smoothly guide the selected ball into the scoop instead of snapping it there.
    this.scoopCatchTransition = {
      startTime: performance.now(),
      duration: 300,
      from: {
        x: bodyEntry.x,
        y: bodyEntry.y,
        z: bodyEntry.z
      }
    };

    bodyEntry.vx = 0;
    bodyEntry.vy = 0;
    bodyEntry.vz = 0;
  }
},
      // Lift complete: ball presented under top LED counter
      () => {
        this.finishDraw(chosenTeam);
      }
    );
  }

  startDigitalCycling() {
    const counterEl = document.getElementById('digitalCounter');
    const teamPool = pickerState.teams.map(t => t.name);
    let cycleCount = 0;

    clearInterval(this.digitalCycleInterval);
    this.digitalCycleInterval = setInterval(() => {
      cycleCount++;
      let sampleCode = '';
      if (teamPool.length > 0) {
        sampleCode = teamPool[Math.floor(Math.random() * teamPool.length)];
      } else {
        const letters = ['A', 'B', 'C', 'D'];
        sampleCode = letters[Math.floor(Math.random() * letters.length)] + (Math.floor(Math.random() * 9) + 1);
      }

      if (counterEl) counterEl.textContent = sampleCode;
      this.machine.updateLEDDisplay(sampleCode);

      if (cycleCount % 2 === 0) {
        soundEngine.playDigitTick();
      }
    }, 60);
  }

  finishDraw(winnerTeam) {
    clearInterval(this.digitalCycleInterval);

    // Restore previous mixing state
    if (!this.wasMixingBeforeDraw) {
      this.physics.setAgitating(false, 0.0);
      soundEngine.stopBlower();
    } else {
      this.physics.setAgitating(true, 1.0);
    }

    // Lock display onto winning team code (e.g. A1)
    const winVal = winnerTeam.name;
    const counterEl = document.getElementById('digitalCounter');
    if (counterEl) counterEl.textContent = winVal;
    this.machine.updateLEDDisplay(winVal);

    const statusLed = document.getElementById('agitateLedIndicator');
    if (statusLed) {
      statusLed.textContent = 'WINNER';
      statusLed.className = 'status-indicator drawn';
    }

    // Victory sound and confetti
    soundEngine.playJackpotChime();
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#00f0ff', '#ffd700', '#f43f5e', '#ffffff', '#10b981', '#a855f7']
    });

    // Remove team from machine & record in history
    const record = pickerState.pickAndRemoveWinner(winnerTeam.id);
    this.currentWinnerRecord = record;

    // Show winner spotlight overlay
    this.showWinnerOverlay(record);

    this.isDrawing = false;
    const drawBtn = document.getElementById('drawBallBtn');
    if (drawBtn) drawBtn.disabled = pickerState.teams.length === 0;
  }

  showWinnerOverlay(record) {
    const overlay = document.getElementById('winnerOverlay');
    const numEl = document.getElementById('winnerBallNumber');
    const nameEl = document.getElementById('winnerNameDisplay');
    const ringEl = document.getElementById('winnerBallRing');

    if (!overlay) return;

    if (numEl) numEl.textContent = record.name;
    if (nameEl) nameEl.textContent = `Team ${record.name}`;
    if (ringEl) {
      ringEl.style.setProperty('--ball-ring-color', record.palette.ring);
      ringEl.style.setProperty('--ball-fill-color', record.palette.fill);
    }

    overlay.removeAttribute('hidden');
  }

  closeWinnerOverlay() {
    const overlay = document.getElementById('winnerOverlay');
    if (overlay) overlay.setAttribute('hidden', 'true');

    // Remove scooped ball from 3D machine
    if (this.scoopedBallEntry) {
      this.ballManager.removeBall(this.scoopedBallEntry.data.id);
      this.physics.scoopedBall = null;
      this.scoopedBallEntry = null;
    }

    // Reset machine LED display
    const counterEl = document.getElementById('digitalCounter');
    if (counterEl) counterEl.textContent = '--';
    this.machine.updateLEDDisplay('--');

    const statusLed = document.getElementById('agitateLedIndicator');
    if (statusLed) {
      statusLed.textContent = this.physics.isAgitating ? 'MIXING' : 'READY';
      statusLed.className = this.physics.isAgitating ? 'status-indicator mixing' : 'status-indicator';
    }

    this.updateStatsAndLists();
  }

  // Animation Loop - Zero GC, locked 60+ FPS
  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = (now - this.clock.lastTime) / 1000;
    this.clock.lastTime = now;

    // Step physics
    this.physics.step(dt);

    // If ball is captured in the wire basket scoop, anchor its position right inside the basket
    // Smoothly guide the captured ball into the center of the scoop, then keep it anchored.
if (this.scoopedBallEntry) {
  const bodyEntry = this.scoopedBallEntry.bodyEntry;
  const basketY = this.machine.basketGroup.position.y;

  if (this.scoopCatchTransition) {
    const elapsed = performance.now() - this.scoopCatchTransition.startTime;
    const t = Math.min(1, elapsed / this.scoopCatchTransition.duration);

    // Ease-out cubic: quick start, gentle settle into the scoop.
    const ease = 1 - Math.pow(1 - t, 3);
    const from = this.scoopCatchTransition.from;

    bodyEntry.x = from.x + (0 - from.x) * ease;
    bodyEntry.y = from.y + ((basketY - 0.12) - from.y) * ease;
    bodyEntry.z = from.z + (0 - from.z) * ease;

    if (t >= 1) {
      this.scoopCatchTransition = null;
    }
  } else {
    bodyEntry.x = 0;
    bodyEntry.y = basketY - 0.12;
    bodyEntry.z = 0;
  }

  bodyEntry.vx = 0;
  bodyEntry.vy = 0;
  bodyEntry.vz = 0;
}

    // Sync 3D ball meshes
    this.ballManager.update();

    // Render Three.js scene
    this.machine.update(dt);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TeamPickerApp();
});
