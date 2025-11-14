type DropHandler = (info: {
  day: string;
  line: string;
  draggedItems: string[];
  insertBeforeWO?: string;
}) => void;

class DropMonitor {
  private static instance: DropMonitor;
  private dropHandler: DropHandler | null = null;

  private constructor() {}

  public static getInstance(): DropMonitor {
    if (!DropMonitor.instance) {
      DropMonitor.instance = new DropMonitor();
    }
    return DropMonitor.instance;
  }

  public registerDropHandler(handler: DropHandler): void {
    if (this.dropHandler) {
      console.warn('DropMonitor: Ya existe un handler registrado. Reemplazando...');
    }
    this.dropHandler = handler;
  }

  public unregisterDropHandler(): void {
    this.dropHandler = null;
  }

  public notifyDrop(info: {
    day: string;
    line: string;
    draggedItems: string[];
    insertBeforeWO?: string;
  }): void {
    if (this.dropHandler) {
      this.dropHandler(info);
    } else {
      console.warn('DropMonitor: No hay handler registrado para manejar el drop');
    }
  }
}

export default DropMonitor.getInstance();