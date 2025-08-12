import { TabComponent } from './components/TabComponent.js';
import { BulkProcessor } from './features/BulkProcessor.js';
import { LayerEditor } from './features/LayerEditor.js';
import { eventBus } from './utils/EventBus.js';

class Application {
  private tabComponent: TabComponent;
  private bulkProcessor: BulkProcessor;
  private layerEditor: LayerEditor;

  constructor() {
    this.preventDefaultDragBehaviors();
    
    // Initialize components
    this.tabComponent = new TabComponent();
    this.bulkProcessor = new BulkProcessor();
    this.layerEditor = new LayerEditor();
    
    this.setupTabs();
    this.setupGlobalEventHandlers();
  }

  private preventDefaultDragBehaviors(): void {
    // Prevent default drag behaviors on entire document
    const preventDefault = (e: DragEvent) => e.preventDefault();
    
    document.addEventListener('dragenter', preventDefault);
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('dragleave', preventDefault);
    document.addEventListener('drop', preventDefault);
  }

  private setupTabs(): void {
    this.tabComponent.addTab({
      id: 'bulk',
      label: '📦 Bulk Verarbeitung',
      panelId: 'bulk-tab',
      onActivate: () => {
        console.log('Bulk processing tab activated');
        eventBus.emit('tab-changed', { activeTab: 'bulk' });
      }
    });

    this.tabComponent.addTab({
      id: 'layer',
      label: '🎨 Layer Editor',
      panelId: 'layer-tab',
      onActivate: () => {
        console.log('Layer editor tab activated');
        eventBus.emit('tab-changed', { activeTab: 'layer' });
      }
    });
  }

  private setupGlobalEventHandlers(): void {
    // Global error handling
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      eventBus.emit('global-error', { 
        message: event.error?.message || 'Unbekannter Fehler',
        error: event.error 
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      eventBus.emit('global-error', { 
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason 
      });
    });

    // Global event listeners for cross-component communication
    eventBus.on('tab-changed', (data) => {
      console.log('Tab changed:', data.payload);
    });

    eventBus.on('global-error', (data) => {
      // Could implement global error reporting here
      console.error('Application error:', data.payload);
    });
  }

  public init(): void {
    try {
      // Initialize all components
      this.tabComponent.init();
      this.bulkProcessor.init();
      this.layerEditor.init();
      
      console.log('Application initialized successfully');
      eventBus.emit('app-initialized');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      alert('Fehler beim Initialisieren der Anwendung. Bitte laden Sie die Seite neu.');
    }
  }

  public destroy(): void {
    // Clean up components
    this.tabComponent.destroy();
    this.bulkProcessor.destroy();
    this.layerEditor.destroy();
    
    // Clear event bus
    eventBus.removeAllListeners();
    
    console.log('Application destroyed');
  }
}

// Application startup
function initializeApp(): void {
  const app = new Application();
  app.init();
  
  // Make app available globally for debugging
  (window as any).app = app;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}