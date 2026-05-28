import { contextBridge, ipcRenderer } from 'electron'
import type { MainMenuBridge } from '../types/main-menu'

const bridge: MainMenuBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke('main-menu:app:get-info'),
  },
  agent: {
    getState: () => ipcRenderer.invoke('main-menu:agent:get-state'),
    sendMessage: (request) => ipcRenderer.invoke('main-menu:agent:send-message', request),
    abort: () => ipcRenderer.invoke('main-menu:agent:abort'),
    reset: () => ipcRenderer.invoke('main-menu:agent:reset'),
    onEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, event: unknown) => {
        listener(event as Parameters<typeof listener>[0])
      }
      ipcRenderer.on('main-menu:agent:event', handler)
      return () => ipcRenderer.removeListener('main-menu:agent:event', handler)
    },
  },
}

contextBridge.exposeInMainWorld('mainMenu', bridge)
