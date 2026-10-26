/* One transaction owns ignition, effects and the camera until it returns. */
(function (root) {
  'use strict';
  const KEY = 'luts:cracker-trials:v1';
  const STATES = ['READY', 'IGNITING', 'ASCENDING', 'BURSTING', 'FADING', 'RETURNING'];
  const REPLAY_COST = 50, FINISH_POINTS = 10;
  class LaunchController {
    constructor({ storage, premium, prepare, ignite, changed, blocked, failed, locks, beforeLaunch }) {
      Object.assign(this, { storage, premium, prepare, ignite, changed, blocked, failed, locks, beforeLaunch });
      this.state = 'READY';
      this.generation = 0;
      this.sequence = null;
    }
    read() {
      const raw = this.storage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : { version: 1, used: {} };
      if (!data || data.version !== 1 || !data.used || typeof data.used !== 'object' || Array.isArray(data.used)) throw Error('Trial data unavailable');
      data.points = Number.isSafeInteger(data.points) && data.points >= 0 ? data.points : 0;
      data.score = Number.isSafeInteger(data.score) && data.score >= 0 ? data.score : 0;
      data.receipts = data.receipts && typeof data.receipts === 'object' && !Array.isArray(data.receipts) ? data.receipts : {};
      return data;
    }
    balance() {
      try { const data = this.read(); return { points: data.points, score: data.score }; }
      catch (_) { return { points: 0, score: 0 }; }
    }
    transaction(fn) { return this.locks ? this.locks.request(KEY, fn) : Promise.resolve().then(fn); }
    async grantReceipt(receipt) {
      const amount = receipt && receipt.verified === true && ({ ad: 150, referral: 100 })[receipt.kind];
      if (!amount || typeof receipt.id !== 'string' || !/^[a-zA-Z0-9:_-]{8,160}$/.test(receipt.id)) throw Error('Reward was not confirmed');
      return this.transaction(() => {
        const data = this.read(), id = `reward:${receipt.kind}:${receipt.id}`;
        if (Object.prototype.hasOwnProperty.call(data.receipts, id)) return 0;
        data.points += amount; data.receipts[id] = Date.now();
        this.storage.setItem(KEY, JSON.stringify(data)); this.changed(this);
        return amount;
      });
    }
    async complete() {
      const seq = this.sequence;
      if (!seq || seq.completing || this.state !== 'RETURNING') return 0;
      seq.completing = true;
      return this.transaction(() => {
        if (this.sequence !== seq) return 0;
        const data = this.read(), id = `finish:${seq.runId}`;
        if (Object.prototype.hasOwnProperty.call(data.receipts, id)) return 0;
        data.points += FINISH_POINTS; data.score += FINISH_POINTS;
        data.receipts[id] = Date.now();
        this.storage.setItem(KEY, JSON.stringify(data)); this.changed(this);
        return FINISH_POINTS;
      });
    }
    used(id) {
      try { return Object.prototype.hasOwnProperty.call(this.read().used, id); }
      catch (_) { return true; }
    }
    setState(state) {
      if (!STATES.includes(state)) throw Error('Unknown launch state');
      this.state = state;
      this.changed(this);
    }
    async request(selection) {
      if (this.state !== 'READY') return false;
      const ticket = ++this.generation;
      this.setState('IGNITING');
      // A video ad at a natural break plays before the cracker is lit; it can never block or fail the launch.
      if (this.beforeLaunch) {
        try { await this.beforeLaunch(selection); } catch (_) { /* play on */ }
        if (ticket !== this.generation) return false;
      }
      const start = () => {
        if (ticket !== this.generation) return false;
        const paid = this.premium();
        const data = paid ? null : this.read();
        const replay = !paid && Object.prototype.hasOwnProperty.call(data.used, selection.id);
        if (replay && data.points < REPLAY_COST) {
          this.reset(); this.blocked(selection); return false;
        }
        // Preparation must allocate/validate everything without starting effects.
        const prepared = this.prepare(selection);
        if (!prepared) throw Error('Could not prepare launch');
        prepared.runId = `${Date.now()}:${ticket}:${Math.random().toString(36).slice(2)}`;
        const snapshot = paid ? null : JSON.stringify(data);
        if (!paid) {
          if (replay) data.points -= REPLAY_COST;
          else data.used[selection.id] = { ignitedAt: Date.now() };
          this.storage.setItem(KEY, JSON.stringify(data));
        }
        this.sequence = prepared;
        try { this.ignite(prepared); }
        catch (error) {
          this.sequence = null;
          if (!paid) this.storage.setItem(KEY, snapshot);
          throw error;
        }
        this.changed(this);
        return true;
      };
      try {
        // Web Locks serializes the read/commit across tabs when supported.
        return this.locks ? await this.locks.request(KEY, start) : start();
      } catch (error) {
        if (ticket === this.generation) { this.reset(); this.failed(error); }
        return false;
      }
    }
    reset() {
      ++this.generation;
      this.sequence = null;
      this.setState('READY');
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { LaunchController, KEY, REPLAY_COST, FINISH_POINTS };
  else root.LUTSLaunchController = LaunchController;
})(typeof window === 'undefined' ? globalThis : window);
