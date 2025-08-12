import { EventData } from '../models/index.js';

export type EventCallback = (data: EventData) => void;

export class EventBus {
  private static instance: EventBus | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: EventCallback): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  public emit(event: string, payload?: any): void {
    const eventData: EventData = {
      type: event,
      payload,
      timestamp: Date.now()
    };

    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error(`Error in event listener for '${event}':`, error);
        }
      });
    }
  }

  public once(event: string, callback: EventCallback): void {
    const wrapper = (data: EventData) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  public getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();