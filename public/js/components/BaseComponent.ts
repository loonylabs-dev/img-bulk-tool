export abstract class BaseComponent {
  protected element: HTMLElement;
  protected eventListeners: Map<string, Array<{ element: Element, event: string, handler: EventListener }>> = new Map();

  constructor(elementId: string) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id '${elementId}' not found`);
    }
    this.element = element;
  }

  protected $(selector: string): HTMLElement | null {
    return this.element.querySelector(selector);
  }

  protected $$(selector: string): NodeListOf<Element> {
    return this.element.querySelectorAll(selector);
  }

  protected addEventListeners(scope: string, listeners: Array<{ element: Element, event: string, handler: EventListener }>): void {
    listeners.forEach(({ element, event, handler }) => {
      element.addEventListener(event, handler);
    });
    this.eventListeners.set(scope, listeners);
  }

  protected removeEventListeners(scope: string): void {
    const listeners = this.eventListeners.get(scope);
    if (listeners) {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventListeners.delete(scope);
    }
  }

  protected show(): void {
    this.element.style.display = 'block';
  }

  protected hide(): void {
    this.element.style.display = 'none';
  }

  protected toggle(visible?: boolean): void {
    if (visible !== undefined) {
      this.element.style.display = visible ? 'block' : 'none';
    } else {
      this.element.style.display = this.element.style.display === 'none' ? 'block' : 'none';
    }
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  public abstract init(): void;

  public destroy(): void {
    this.eventListeners.forEach((_, scope) => {
      this.removeEventListeners(scope);
    });
  }
}