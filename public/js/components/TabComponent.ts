import { BaseComponent } from './BaseComponent.js';

export interface TabConfig {
  id: string;
  label: string;
  panelId: string;
  onActivate?: () => void;
}

export class TabComponent extends BaseComponent {
  private tabs: TabConfig[] = [];
  private activeTab: string | null = null;

  constructor() {
    super('main');
  }

  public addTab(config: TabConfig): void {
    this.tabs.push(config);
  }

  public init(): void {
    this.render();
    this.bindEvents();
  }

  private render(): void {
    const navElement = this.$('.tab-navigation');
    const contentElement = this.$('.tab-content');
    
    if (!navElement || !contentElement) return;

    // Clear existing content
    navElement.innerHTML = '';
    
    // Create tab buttons
    this.tabs.forEach((tab, index) => {
      const button = document.createElement('button');
      button.className = `tab-btn ${index === 0 ? 'active' : ''}`;
      button.dataset['tab'] = tab.id;
      button.innerHTML = tab.label;
      navElement.appendChild(button);

      if (index === 0) {
        this.activeTab = tab.id;
      }
    });
  }

  private bindEvents(): void {
    const buttons = this.$$('.tab-btn');
    const listeners = Array.from(buttons).map(button => ({
      element: button,
      event: 'click' as const,
      handler: this.handleTabClick.bind(this)
    }));

    this.addEventListeners('tabs', listeners);
  }

  private handleTabClick(e: Event): void {
    const target = e.target as HTMLButtonElement;
    const tabId = target.dataset['tab'];
    
    if (!tabId) return;

    this.activateTab(tabId);
  }

  public activateTab(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || this.activeTab === tabId) return;

    // Update button states
    this.$$('.tab-btn').forEach(btn => btn.classList.remove('active'));
    this.$$('.tab-panel').forEach(panel => panel.classList.remove('active'));

    // Activate new tab
    const activeButton = this.$(`[data-tab="${tabId}"]`);
    const activePanel = document.getElementById(tab.panelId);

    if (activeButton && activePanel) {
      activeButton.classList.add('active');
      activePanel.classList.add('active');
      this.activeTab = tabId;

      // Call activation callback
      if (tab.onActivate) {
        tab.onActivate();
      }
    }
  }

  public getActiveTab(): string | null {
    return this.activeTab;
  }
}