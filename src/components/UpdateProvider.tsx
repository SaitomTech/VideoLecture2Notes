import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getErrorDetail } from '../lib/errors'
import { UpdateContext, type UpdateState } from '../lib/updateContext'
import { downloadAndInstallUpdate } from '../lib/updates'

const STORAGE_KEY = 'videolecture2notes.auto-check-updates'

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [update, setUpdate] = useState<Update | null>(null)
  const [phase, setPhase] = useState<UpdateState['phase']>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [autoCheck, setAutoCheckState] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== 'false',
  )
  const resource = useRef<Update | null>(null)
  const busy = useRef(false)
  const mounted = useRef(false)

  const checkForUpdates = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setPhase('checking')
    setMessage(null)
    try {
      const next = await check()
      if (!mounted.current) {
        await next?.close()
        return
      }
      const previous = resource.current
      resource.current = next
      setUpdate(next)
      setMessage(next ? null : '最新版です。')
      await previous?.close()
    } catch (error) {
      if (mounted.current) setMessage(getErrorDetail(error, 'アップデートを確認できませんでした。'))
    } finally {
      busy.current = false
      if (mounted.current) setPhase('idle')
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer =
      localStorage.getItem(STORAGE_KEY) !== 'false'
        ? setTimeout(() => void checkForUpdates(), 0)
        : undefined
    return () => {
      mounted.current = false
      clearTimeout(timer)
      void resource.current?.close().catch(console.error)
      resource.current = null
    }
  }, [checkForUpdates])

  const setAutoCheck = (enabled: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(enabled))
    setAutoCheckState(enabled)
  }

  const installUpdate = async () => {
    if (!resource.current || busy.current) return
    busy.current = true
    setMessage(null)
    let installed = phase === 'installed'
    try {
      if (!installed) {
        setPhase('downloading')
        setProgress(null)
        await downloadAndInstallUpdate(resource.current, setProgress, () => setPhase('installing'))
        installed = true
        setPhase('installed')
      }
      await relaunch()
    } catch (error) {
      setMessage(
        getErrorDetail(
          error,
          installed
            ? '更新済みですが再起動できませんでした。'
            : 'アップデートをインストールできませんでした。',
        ),
      )
      if (!installed) setPhase('idle')
    } finally {
      busy.current = false
    }
  }

  return (
    <UpdateContext.Provider
      value={{
        update,
        phase,
        progress,
        message,
        autoCheck,
        setAutoCheck,
        checkForUpdates,
        installUpdate,
      }}
    >
      <div className="contents" inert={phase === 'downloading' || phase === 'installing'}>
        {children}
      </div>
      {(phase === 'downloading' || phase === 'installing') && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-white/80"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-[#1d6b50]">
            {phase === 'installing'
              ? 'インストール中…'
              : progress === null
                ? '更新をダウンロード中…'
                : `更新をダウンロード中（${progress}%）…`}
            <br />
            完了後にアプリを再起動します。
          </p>
        </div>
      )}
    </UpdateContext.Provider>
  )
}
