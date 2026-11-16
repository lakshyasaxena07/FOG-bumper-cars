// Keyboard trigger node: key presses -> ride.start / ride.end events.
// It knows nothing about cameras. A future PCB trigger publishes the same two events.
import { getLogger } from '../services/logger';
import { EVENTS, type EventBus } from '../shared/events';
import type { Notice, TriggerState } from '../shared/types';

const log = getLogger('trigger');

export interface KeyboardTriggerOptions {
  /** Called after every accepted/rejected press with the resulting TriggerState. */
  onTriggerState?: (state: TriggerState) => void;
}

export class KeyboardTrigger {
  private active = false;
  private lastPress = new Map<string, number>();
  private onTriggerState?: (state: TriggerState) => void;

  constructor(private bus: EventBus, private debounceSeconds = 0.5, opts: KeyboardTriggerOptions = {}) {
    this.onTriggerState = opts.onTriggerState;
    // Also fires on auto-stop (time limit) or a failed start.
    bus.subscribe(EVENTS.RIDE_FINISHED, () => {
      this.active = false;
    });
  }

  private say(level: Notice['level'], text: string) {
    if (level === 'info') log.info(text);
    else log.warn(text);
    return this.bus.publish(EVENTS.NOTICE, { level, text });
  }

  private emitTriggerState(lastKey: string, lastAccepted: boolean, lastReason: string): void {
    if (!this.onTriggerState) return;
    this.onTriggerState({ source: 'keyboard', lastKey, lastAccepted, lastReason });
  }

  /** Handles one key. Resolves false when the user asked to quit. */
  async handleKey(key: string): Promise<boolean> {
    if (!['s', 'e', 'q'].includes(key)) return true;
    const now = performance.now();
    if (now - (this.lastPress.get(key) ?? -Infinity) < this.debounceSeconds * 1000) {
      await this.say('info', `Duplicate '${key.toUpperCase()}' press ignored`);
      this.emitTriggerState(key, false, 'debounced');
      return true;
    }
    this.lastPress.set(key, now);

    if (key === 's') {
      if (this.active) {
        await this.say('warning', 'A ride is already active - press E to end it');
        this.emitTriggerState(key, false, 'ride already active');
      } else {
        this.active = true; // set before publishing so a second press can never slip through
        await this.say('info', 'Starting ride...');
        await this.bus.publish(EVENTS.RIDE_START, { source: 'keyboard' });
        this.emitTriggerState(key, true, 'ride start published');
      }
      return true;
    }
    if (this.active) {
      await this.say('info', 'Ending ride...');
      await this.bus.publish(EVENTS.RIDE_END, { reason: key === 'q' ? 'quit' : 'trigger' });
      this.emitTriggerState(key, true, key === 'q' ? 'quit' : 'trigger');
    } else if (key === 'e') {
      await this.say('info', 'No active ride to end');
      this.emitTriggerState(key, false, 'no active ride');
    }
    if (key === 'q') {
      log.info('Exiting...');
      if (!this.active) this.emitTriggerState(key, true, 'quit');
      return false;
    }
    return true;
  }
}
