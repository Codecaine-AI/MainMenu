export interface MainMenuAppInfo {
  productName: 'Main Menu'
  version: string
  platform: NodeJS.Platform
  packaged: boolean
  workspacePath: string | null
  rendererUrl: string
}

export interface MainMenuBridge {
  app: {
    getInfo(): Promise<MainMenuAppInfo>
  }
}

declare global {
  interface Window {
    mainMenu?: MainMenuBridge
  }
}

export {}
