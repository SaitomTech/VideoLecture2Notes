import { Check, KeyRound, LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getErrorDetail } from '../../../lib/errors'
import {
  deleteOpenAiApiKey,
  getOpenAiApiKeyStatus,
  testOpenAiConnection,
  validateAndSaveOpenAiApiKey,
  type OpenAiCredentialStatus,
} from '../../../lib/openai/openai'

type CredentialAction = 'saving' | 'testing' | 'deleting' | null

export function OpenAiApiKeySettings({ disabled = false }: { disabled?: boolean }) {
  const [credential, setCredential] = useState<OpenAiCredentialStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [action, setAction] = useState<CredentialAction>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getOpenAiApiKeyStatus()
      .then((status) => {
        if (active) setCredential(status)
      })
      .catch((statusError) => {
        if (active)
          setError(getErrorDetail(statusError, 'APIキーの設定状態を確認できませんでした。'))
      })
    return () => {
      active = false
    }
  }, [])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!apiKey.trim() || action) return
    setAction('saving')
    setError(null)
    setMessage(null)
    try {
      const status = await validateAndSaveOpenAiApiKey(apiKey)
      setCredential(status)
      setApiKey('')
      setMessage('接続を確認し、APIキーをmacOS Keychainへ保存しました。')
    } catch (saveError) {
      setError(getErrorDetail(saveError, 'APIキーを確認・保存できませんでした。'))
    } finally {
      setAction(null)
    }
  }

  const handleTest = async () => {
    if (action) return
    setAction('testing')
    setError(null)
    setMessage(null)
    try {
      await testOpenAiConnection()
      setMessage('GPT-5.6 Lunaへの接続を確認しました。')
    } catch (testError) {
      setError(getErrorDetail(testError, 'OpenAI APIへ接続できませんでした。'))
    } finally {
      setAction(null)
    }
  }

  const handleDelete = async () => {
    if (action || !window.confirm('保存済みのOpenAI APIキーを削除しますか？')) return
    setAction('deleting')
    setError(null)
    setMessage(null)
    try {
      await deleteOpenAiApiKey()
      setCredential({ configured: false })
      setMessage('APIキーをmacOS Keychainから削除しました。')
    } catch (deleteError) {
      setError(getErrorDetail(deleteError, 'APIキーを削除できませんでした。'))
    } finally {
      setAction(null)
    }
  }

  const isBusy = action !== null

  return (
    <div className="mt-3 rounded-[10px] border border-[#b7cbc0] bg-[#fbfcfa] p-3.5">
      <div className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 shrink-0 text-[#1d6b50]" size={16} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#18211f]">OpenAI APIキー</p>
          <p className="mt-1 text-[10px] leading-4 text-[#71807b]">
            キーはmacOS Keychainへ保存され、本文生成時もReactへ読み戻しません。
          </p>

          {credential?.configured ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2eee8] px-2.5 py-1 text-[10px] font-semibold text-[#174d3c]">
                <Check size={11} />
                設定済み{credential.lastFour ? `（末尾 ${credential.lastFour}）` : ''}
              </span>
              <button
                className="rounded-md border border-[#b7cbc0] px-2.5 py-1.5 text-[10px] font-semibold text-[#174d3c] hover:bg-[#eaf3ee] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleTest()}
                disabled={disabled || isBusy}
              >
                {action === 'testing' ? '確認中…' : '接続を確認'}
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-semibold text-[#9d422d] hover:bg-[#fff0eb] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleDelete()}
                disabled={disabled || isBusy}
              >
                <Trash2 size={11} />
                {action === 'deleting' ? '削除中…' : '削除'}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[10px] font-semibold text-[#9a7a35]">
              APIキーはまだ設定されていません。
            </p>
          )}

          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => void handleSave(event)}
          >
            <label className="sr-only" htmlFor="openai-api-key">
              OpenAI APIキー
            </label>
            <input
              id="openai-api-key"
              className="min-w-0 flex-1 rounded-[8px] border border-[#b7cbc0] bg-white px-3 py-2 text-xs outline-none placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value)
                setError(null)
                setMessage(null)
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={credential?.configured ? '新しいキーへ差し替える' : 'sk-...'}
              disabled={disabled || isBusy}
            />
            <button
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#174d3c] disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={disabled || isBusy || apiKey.trim().length < 20}
            >
              {action === 'saving' && <LoaderCircle className="animate-spin" size={12} />}
              {credential?.configured ? '接続して差し替え' : '接続して保存'}
            </button>
          </form>

          {message && (
            <p className="mt-2 text-[10px] text-[#1d6b50]" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-2 text-[10px] text-[#b6533a]" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
