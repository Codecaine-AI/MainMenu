import { contextBridge, ipcRenderer } from 'electron'
import type { MainMenuBridge } from '../types/main-menu'

const bridge: MainMenuBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke('main-menu:app:get-info'),
  },
}

contextBridge.exposeInMainWorld('mainMenu', bridge)
