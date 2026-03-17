class GameCoreService {
  private core: IGameCore | null = null;

  constructor() {
    this.initializeCore();
  }

  private initializeCore() {
    try {
      const path = (window as any).require('path');
      const process = (window as any).require('process');

      const addonPath = path.join(process.cwd(), 'build', 'Release', 'gamecore.node');

      this.core = (window as any).require(addonPath) as IGameCore;
      
      console.log("C++ Core loaded successfully!", this.core);
    } catch (error) {
      console.error("Failed to load C++ core:", error);
    }
  }
}

export const gameCoreService = new GameCoreService()