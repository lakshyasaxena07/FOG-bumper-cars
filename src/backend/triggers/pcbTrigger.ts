// PCB TRIGGER STUB — hardware not implemented in Phase 1.
// When serial/GPIO input is wired: instantiate this class instead of (or alongside) KeyboardTrigger.
// It must publish EVENTS.RIDE_START and EVENTS.RIDE_END on the shared EventBus, nothing else.
export class PcbTrigger {
  // TODO Phase 2: wire SerialPort / GPIO here.
  // constructor(private bus: EventBus, private debounceSeconds = 0.5) {}
  // start(): void { /* open port, attach listeners */ }
  // stop(): void { /* close port */ }
}
