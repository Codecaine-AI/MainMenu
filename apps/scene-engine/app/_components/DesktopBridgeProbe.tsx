'use client'

import { useEffect } from 'react'

export function DesktopBridgeProbe() {
  useEffect(() => {
    const bridge = window.mainMenu
    if (!bridge) {
      document.documentElement.dataset.mainMenuBridge = 'unavailable'
      return
    }

    let cancelled = false
    bridge.app
      .getInfo()
      .then((info) => {
        if (cancelled) return
        document.documentElement.dataset.mainMenuBridge = 'ok'
        document.documentElement.dataset.mainMenuProduct = info.productName
        document.documentElement.dataset.mainMenuPackaged = String(info.packaged)
      })
      .catch(() => {
        if (!cancelled) document.documentElement.dataset.mainMenuBridge = 'error'
      })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
