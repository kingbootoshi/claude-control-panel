import { logger } from "./utils/logger";

const log = logger.queue;

/**
 * Async message queue for bridging WebSocket messages to Claude session.
 * Supports push/pop with async waiting and graceful close handling.
 */
export class MessageQueue<T> {
  private queue: T[] = [];
  private resolvers: Array<(value: T | null) => void> = [];
  private closed = false;

  /**
   * Push a message to the queue.
   * If there are waiting consumers, delivers directly.
   */
  push(item: T): void {
    if (this.closed) {
      log.warn("Attempted to push to closed queue");
      return;
    }

    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.queue.push(item);
    }
  }

  /**
   * Pop a message from the queue.
   * Waits asynchronously if queue is empty.
   * Returns null if queue is closed.
   */
  async pop(): Promise<T | null> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    if (this.closed) {
      return null;
    }

    return new Promise<T | null>((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  /**
   * Close the queue.
   * All waiting consumers receive null.
   */
  close(): void {
    this.closed = true;
    for (const resolve of this.resolvers) {
      resolve(null);
    }
    this.resolvers = [];
  }

  /**
   * Check if queue is closed.
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get current queue length.
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Get number of waiting consumers.
   */
  get waitingCount(): number {
    return this.resolvers.length;
  }
}
