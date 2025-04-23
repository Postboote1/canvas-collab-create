interface Window {
  __canvasExportMethods?: {
    exportAsImage: () => void;
    exportAsPDF: () => void;
  };
  
  __canvasInterface?: {
    setScale: (scale: number) => void;
    pan: (dx: number, dy: number) => void;
    setActiveTool: (tool: string) => void;
  };
}
