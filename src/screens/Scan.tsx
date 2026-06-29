import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { getJobIdByCode } from '../lib/data'

export default function Scan() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const [cameraError, setCameraError] = useState(false)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  function safeClear(s: Html5Qrcode) {
    try {
      s.clear()
    } catch {
      /* ignore */
    }
  }

  // html5-qrcode's stop() throws synchronously if not actively scanning, so
  // always check state first.
  function isRunning(s: Html5Qrcode) {
    try {
      const st = s.getState()
      return st === Html5QrcodeScannerState.SCANNING || st === Html5QrcodeScannerState.PAUSED
    } catch {
      return false
    }
  }

  async function stopScanner() {
    const s = scannerRef.current
    if (!s || !isRunning(s)) return
    try {
      await s.stop()
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let scanner: Html5Qrcode
    try {
      scanner = new Html5Qrcode('qr-reader')
    } catch {
      setCameraError(true)
      return
    }
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => void onDecoded(decoded),
        () => {}, // ignore per-frame "not found" errors
      )
      .catch(() => setCameraError(true))

    return () => {
      if (isRunning(scanner)) {
        scanner.stop().then(() => safeClear(scanner)).catch(() => {})
      } else {
        safeClear(scanner)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onDecoded(text: string) {
    if (handledRef.current) return
    handledRef.current = true
    await stopScanner()
    try {
      const u = new URL(text)
      navigate(u.pathname + u.search)
    } catch {
      const id = await getJobIdByCode(text.trim())
      if (id) navigate(`/jobs/${id}`)
      else {
        handledRef.current = false
        setManualError(t('scan.notFound'))
      }
    }
  }

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault()
    setManualError(null)
    const id = await getJobIdByCode(manual.trim())
    if (id) {
      await stopScanner()
      navigate(`/jobs/${id}`)
    } else {
      setManualError(t('scan.notFound'))
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('nav.scan')}</h1>

      {/* Camera viewport (html5-qrcode injects the video here) */}
      <div id="qr-reader" className="overflow-hidden rounded-xl bg-black" />

      {cameraError ? (
        <p className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">
          {t('scan.cameraUnavailable')}
        </p>
      ) : (
        <p className="mt-3 text-center text-sm text-slate-500">{t('scan.hint')}</p>
      )}

      {/* Manual job-code entry fallback */}
      <form onSubmit={onManualSubmit} className="mt-6">
        <label htmlFor="jobCode" className="mb-1 block text-sm text-slate-300">
          {t('scan.manualLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="jobCode"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="AM1234-A"
            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 font-mono text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manual.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {t('scan.go')}
          </button>
        </div>
        {manualError && <p className="mt-2 text-sm text-red-400">{manualError}</p>}
      </form>
    </div>
  )
}
