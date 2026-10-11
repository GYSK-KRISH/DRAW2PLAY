/**
 * Procedural Web Audio API sound synthesizer for Draw2Play AI.
 * Generates lightweight, retro arcade sound effects on-the-fly without external audio assets.
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private volume = 0.5;
  private lastSoundTimes: Record<string, number> = {};

  constructor() {
    // Restore mute preference from localStorage if available
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedMute = window.localStorage.getItem('draw2play_audio_muted');
        if (storedMute !== null) {
          this.isMuted = storedMute === 'true';
        }
        const storedVol = window.localStorage.getItem('draw2play_audio_volume');
        if (storedVol !== null) {
          const parsedVol = parseFloat(storedVol);
          if (!isNaN(parsedVol) && parsedVol >= 0 && parsedVol <= 1) {
            this.volume = parsedVol;
          }
        }
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Ensure AudioContext is initialized and unlocked after a user gesture.
   */
  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      try {
        this.ctx = new AudioContextClass();
      } catch (err) {
        console.warn('[AudioService] Failed to initialize AudioContext:', err);
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Throttles identical sounds to prevent ear fatigue and audio clipping
   */
  private shouldThrottle(soundId: string, minIntervalMs: number): boolean {
    const now = Date.now();
    const last = this.lastSoundTimes[soundId] || 0;
    if (now - last < minIntervalMs) {
      return true;
    }
    this.lastSoundTimes[soundId] = now;
    return false;
  }

  /**
   * Toggle mute
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('draw2play_audio_muted', String(this.isMuted));
      }
    } catch {
      // Ignore
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('draw2play_audio_volume', String(this.volume));
      }
    } catch {
      // Ignore
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * 1. Player Jump: Smooth rising pitch sweep
   */
  public playJump(): void {
    if (this.isMuted || this.shouldThrottle('jump', 80)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.12);

      gain.gain.setValueAtTime(this.volume * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn('[AudioService] playJump error:', e);
    }
  }

  /**
   * 2. Trampoline Bounce: Funky boing frequency modulation
   */
  public playBounce(): void {
    if (this.isMuted || this.shouldThrottle('bounce', 100)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);

      gain.gain.setValueAtTime(this.volume * 0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('[AudioService] playBounce error:', e);
    }
  }

  /**
   * 3. Coin Collection: Sparkly bright two-tone arpeggio (B5 -> E6)
   */
  public playCoin(): void {
    if (this.isMuted || this.shouldThrottle('coin', 60)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: B5 (987.77 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(this.volume * 0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Note 2: E6 (1318.51 Hz) slightly delayed
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.51, now + 0.05);
      gain2.gain.setValueAtTime(this.volume * 0.5, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.2);
    } catch (e) {
      console.warn('[AudioService] playCoin error:', e);
    }
  }

  /**
   * 4. Hazard Collision: Low crunchy buzz/thud
   */
  public playHazard(): void {
    if (this.isMuted || this.shouldThrottle('hazard', 300)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.26);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.26);

      gain.gain.setValueAtTime(this.volume * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('[AudioService] playHazard error:', e);
    }
  }

  /**
   * 5. Victory Fanfare: Triumphant 4-note ascending chord (C5 - E5 - G5 - C6)
   */
  public playVictory(): void {
    if (this.isMuted || this.shouldThrottle('victory', 1000)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const noteDelay = 0.12;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * noteDelay;
        const dur = idx === notes.length - 1 ? 0.45 : 0.22;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.volume * 0.5, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur + 0.05);
      });
    } catch (e) {
      console.warn('[AudioService] playVictory error:', e);
    }
  }

  /**
   * 6. UI Button Interaction: Crisp subtle micro-click
   */
  public playClick(): void {
    if (this.isMuted || this.shouldThrottle('click', 50)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.03);

      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Safe no-op
    }
  }

  /**
   * 7. Sandbox Block Mined: Crisp crunchy block break impact
   */
  public playMine(): void {
    if (this.isMuted || this.shouldThrottle('mine', 80)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.12);

      gain.gain.setValueAtTime(this.volume * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Safe no-op
    }
  }

  /**
   * 8. Sandbox Block Placed: Sturdy construction thud
   */
  public playPlace(): void {
    if (this.isMuted || this.shouldThrottle('place', 80)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // Safe no-op
    }
  }

  /**
   * 9. Draw-to-Craft Action: Harmonic sparkling crafting chime
   */
  public playCraft(): void {
    if (this.isMuted || this.shouldThrottle('craft', 300)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [440, 659.25, 880]; // A4, E5, A5
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.volume * 0.4, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {
      // Safe no-op
    }
  }
}

export const audioService = new AudioService();
