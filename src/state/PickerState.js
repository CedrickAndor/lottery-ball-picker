/**
 * Lottery Ball Team Picker State
 * Every ball/team added gets a unique, vibrant color from an expanded palette.
 */

export const LOTTO_PALETTES = [
  { name: 'sapphire', ring: '#2563eb', fill: '#eff6ff', text: '#1e40af' },   // Sapphire Blue
  { name: 'crimson',  ring: '#dc2626', fill: '#fef2f2', text: '#991b1b' },   // Crimson Red
  { name: 'emerald',  ring: '#16a34a', fill: '#f0fdf4', text: '#166534' },   // Emerald Green
  { name: 'amber',    ring: '#d97706', fill: '#fffbeb', text: '#92400e' },   // Amber Gold
  { name: 'purple',   ring: '#9333ea', fill: '#faf5ff', text: '#6b21a8' },   // Royal Purple
  { name: 'cyan',     ring: '#0891b2', fill: '#ecfeff', text: '#155e75' },   // Electric Cyan
  { name: 'orange',   ring: '#ea580c', fill: '#fff7ed', text: '#9a3412' },   // Blaze Orange
  { name: 'magenta',  ring: '#db2777', fill: '#fdf2f8', text: '#9d174d' },   // Hot Magenta
  { name: 'lime',     ring: '#65a30d', fill: '#f7fee7', text: '#3f6212' },   // Lime Green
  { name: 'indigo',   ring: '#4f46e5', fill: '#eef2ff', text: '#3730a3' },   // Deep Indigo
  { name: 'teal',     ring: '#0d9488', fill: '#f0fdfa', text: '#115e59' },   // Ocean Teal
  { name: 'coral',    ring: '#f43f5e', fill: '#fff1f2', text: '#9f1239' },   // Coral Pink
  { name: 'violet',   ring: '#7c3aed', fill: '#f5f3ff', text: '#5b21b6' },   // Deep Violet
  { name: 'yellow',   ring: '#ca8a04', fill: '#fefce8', text: '#854d0e' },   // Golden Yellow
  { name: 'ruby',     ring: '#be123c', fill: '#fff1f2', text: '#881337' },   // Dark Ruby
  { name: 'sky',      ring: '#0284c7', fill: '#f0f9ff', text: '#075985' }    // Sky Blue
];

class TeamPickerState {
  constructor() {
    this.teams = []; // Active teams: [{ id, name, palette }]
    this.drawnWinners = []; // Removed / drawn teams: [{ id, name, palette, timestamp, drawIndex }]
    this.colorIndex = 0; // Increments with every team added so every ball has a different color

    this.settings = {
      soundFx: true,
      soundVolume: 0.7,
      theme: 'theme-cyan'
    };

    this.listeners = new Set();
  }

  init() {
    this.loadFromStorage();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('lottery_team_picker_state_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.teams)) this.teams = parsed.teams;
        if (Array.isArray(parsed.drawnWinners)) this.drawnWinners = parsed.drawnWinners;
        if (typeof parsed.colorIndex === 'number') this.colorIndex = parsed.colorIndex;
        if (parsed.settings) this.settings = { ...this.settings, ...parsed.settings };
      }
    } catch (e) {
      console.warn('Could not read state from storage', e);
    }
  }

  saveToStorage() {
    try {
      const stateToSave = {
        teams: this.teams,
        drawnWinners: this.drawnWinners,
        colorIndex: this.colorIndex,
        settings: this.settings
      };
      localStorage.setItem('lottery_team_picker_state_v3', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Could not save state to storage', e);
    }
  }

  // Get next unique color from palette
  getNextPalette() {
    const palette = LOTTO_PALETTES[this.colorIndex % LOTTO_PALETTES.length];
    this.colorIndex++;
    return palette;
  }

  addTeam(rawName) {
    const name = rawName.trim().toUpperCase();
    if (!name) return null;

    const palette = this.getNextPalette();
    const team = {
      id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: name,
      palette: palette
    };

    this.teams.push(team);
    this.saveToStorage();
    this.notify('team_added', team);
    return team;
  }

  bulkAddTeams(namesArray) {
    const added = [];
    namesArray.forEach(raw => {
      const name = raw.trim().toUpperCase();
      if (name) {
        const palette = this.getNextPalette();
        const team = {
          id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: name,
          palette: palette
        };
        this.teams.push(team);
        added.push(team);
      }
    });

    if (added.length > 0) {
      this.saveToStorage();
      this.notify('teams_bulk_added', added);
    }
    return added;
  }

  removeTeam(id) {
    const idx = this.teams.findIndex(t => t.id === id);
    if (idx !== -1) {
      const removed = this.teams.splice(idx, 1)[0];
      this.saveToStorage();
      this.notify('team_removed', removed);
      return removed;
    }
    return null;
  }

  pickAndRemoveWinner(winnerId) {
  if (this.teams.length === 0) return null;

  // Remove the exact team that was visually selected by the draw animation
  const winnerIndex = this.teams.findIndex(team => team.id === winnerId);

  if (winnerIndex === -1) return null;

  const winnerTeam = this.teams.splice(winnerIndex, 1)[0];

  const record = {
    id: winnerTeam.id,
    name: winnerTeam.name,
    palette: winnerTeam.palette,
    drawIndex: this.drawnWinners.length + 1,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  };

  // Add winners in draw order: 1st, 2nd, 3rd, 4th...
  this.drawnWinners.push(record);

  this.saveToStorage();
  this.notify('winner_drawn', record);
  return record;
}

  clearAll() {
    this.teams = [];
    this.drawnWinners = [];
    this.colorIndex = 0;
    this.saveToStorage();
    this.notify('cleared_all', null);
  }
}

export const pickerState = new TeamPickerState();
