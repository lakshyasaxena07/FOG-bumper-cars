// Keyboard trigger node: key presses -> ride.start / ride.end events.
// It knows nothing about cameras. A future PCB trigger publishes the same two events.
import { getLogger } from '../services/logger';
import { EVENTS, type EventBus } from '../shared/events';
import type { Notice } from '../shared/types';

const log = getLogger('trigger');

export class KeyboardTrigger {
  private active = false;
  private lastPress = new Map<string, number>();

  constructor(private bus: EventBus, private debounceSeconds = 0.5) {
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

  /** Handles one key. Resolves false when the user asked to quit. */
  async handleKey(key: string): Promise<boolean> {
    if (!['s', 'e', 'q'].includes(key)) return true;
    const now = performance.now();
    if (now - (this.lastPress.get(key) ?? -Infinity) < this.debounceSeconds * 1000) {
      await this.say('info', `Duplicate '${key.toUpperCase()}' press ignored`);
      return true;
    }
    this.lastPress.set(key, now);

    if (key === 's') {
      if (this.active) await this.say('warning', 'A ride is already active - press E to end it');
      else {
        this.active = true; // set before publishing so a second press can never slip through
        await this.say('info', 'Starting ride...');
        await this.bus.publish(EVENTS.RIDE_START, { source: 'keyboard' });
      }
      return true;
    }
    if (this.active) {
      await this.say('info', 'Ending ride...');
      await this.bus.publish(EVENTS.RIDE_END, { reason: key === 'q' ? 'quit' : 'trigger' });
    } else if (key === 'e') {
      await this.say('info', 'No active ride to end');
    }
    if (key === 'q') {
      log.info('Exiting...');
      return false;
    }
    return true;
  }
}
