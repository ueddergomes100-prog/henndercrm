const DEFAULT_LABEL = "Carregando";
/** @type {(label: string, timeoutMs: number) => void} */
const NOOP_TIMEOUT = () => {};

/**
 * Coordinates concurrent loading operations without depending on React.
 * Timers are injectable so the behavior can be tested independently.
 */
export class LoadingCoordinator {
  #operations = new Map();
  #nextId = 1;
  #visible = false;
  #shownAt = 0;
  #showTimer = null;
  #hideTimer = null;
  #onChange;
  #onTimeout;
  #showDelayMs;
  #minimumVisibleMs;
  #defaultTimeoutMs;
  #now;
  #setTimer;
  #clearTimer;

  constructor({
    onChange,
    onTimeout = NOOP_TIMEOUT,
    showDelayMs = 150,
    minimumVisibleMs = 380,
    defaultTimeoutMs = 30000,
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (timer) => clearTimeout(timer),
  }) {
    this.#onChange = onChange;
    this.#onTimeout = onTimeout;
    this.#showDelayMs = showDelayMs;
    this.#minimumVisibleMs = minimumVisibleMs;
    this.#defaultTimeoutMs = defaultTimeoutMs;
    this.#now = now;
    this.#setTimer = setTimer;
    this.#clearTimer = clearTimer;
  }

  begin(options = {}) {
    const normalizedOptions = typeof options === "string" ? { label: options } : options;
    const id = this.#nextId++;
    const timeoutMs = normalizedOptions.timeoutMs ?? this.#defaultTimeoutMs;
    const operation = {
      label: normalizedOptions.label?.trim() || DEFAULT_LABEL,
      timeoutTimer: null,
    };

    if (timeoutMs > 0) {
      operation.timeoutTimer = this.#setTimer(() => {
        if (!this.#operations.has(id)) return;
        this.#onTimeout(operation.label, timeoutMs);
        this.#finish(id);
      }, timeoutMs);
    }

    this.#operations.set(id, operation);
    this.#startVisibilityCycle();

    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.#finish(id);
    };
  }

  getState() {
    return {
      visible: this.#visible,
      activeCount: this.#operations.size,
      label: this.#latestLabel(),
    };
  }

  dispose() {
    this.#clearScheduledTimer("show");
    this.#clearScheduledTimer("hide");
    for (const operation of this.#operations.values()) {
      if (operation.timeoutTimer !== null) this.#clearTimer(operation.timeoutTimer);
    }
    this.#operations.clear();
    this.#visible = false;
  }

  #startVisibilityCycle() {
    this.#clearScheduledTimer("hide");

    if (this.#visible) {
      this.#emit();
      return;
    }

    if (this.#showTimer === null) {
      this.#showTimer = this.#setTimer(() => {
        this.#showTimer = null;
        if (this.#operations.size === 0) return;
        this.#visible = true;
        this.#shownAt = this.#now();
        this.#emit();
      }, this.#showDelayMs);
    }

    this.#emit();
  }

  #finish(id) {
    const operation = this.#operations.get(id);
    if (!operation) return;
    if (operation.timeoutTimer !== null) this.#clearTimer(operation.timeoutTimer);
    this.#operations.delete(id);

    if (this.#operations.size > 0) {
      this.#emit();
      return;
    }

    this.#clearScheduledTimer("show");
    if (!this.#visible) {
      this.#emit();
      return;
    }

    const elapsed = this.#now() - this.#shownAt;
    const remaining = Math.max(0, this.#minimumVisibleMs - elapsed);
    this.#hideTimer = this.#setTimer(() => {
      this.#hideTimer = null;
      if (this.#operations.size > 0) return;
      this.#visible = false;
      this.#emit();
    }, remaining);
  }

  #latestLabel() {
    let label = DEFAULT_LABEL;
    for (const operation of this.#operations.values()) label = operation.label;
    return label;
  }

  #emit() {
    this.#onChange(this.getState());
  }

  #clearScheduledTimer(type) {
    const timer = type === "show" ? this.#showTimer : this.#hideTimer;
    if (timer === null) return;
    this.#clearTimer(timer);
    if (type === "show") this.#showTimer = null;
    else this.#hideTimer = null;
  }
}
