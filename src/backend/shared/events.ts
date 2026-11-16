// Tiny async publish/subscribe bus connecting the nodes (services).
import { getLogger } from '../services/logger';

const log = getLogger('bus');

export const EVENTS = {
  // requests: published by triggers (keyboard now, PCB later)
  RIDE_START: 'ride.start',
  RIDE_END: 'ride.end',
  // notifications: published by the recorder
  RIDE_STARTED: 'ride.started',
  RIDE_FINISHED: 'ride.finished',
  // UI feed
  STATE_CHANGED: 'state.changed',
  NOTICE: 'app.notice',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (data: any) => unknown;

export class EventBus {
  private handlers = new Map<string, Handler[]>();

  subscribe(topic: string, handler: Handler) {
    this.handlers.set(topic, [...(this.handlers.get(topic) ?? []), handler]);
  }

  /** Resolves after every handler finished. A failing handler never breaks the others. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async publish(topic: string, data: any = {}) {
    await Promise.all(
      (this.handlers.get(topic) ?? []).map(async (handler) => {
        try {
          await handler(data);
        } catch (err) {
          log.error(`Handler failed for '${topic}'`, err);
        }
      }),
    );
  }
}
