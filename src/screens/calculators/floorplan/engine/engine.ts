// pdf.js 3.x legacy build: runs on older iPad/Safari versions.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url'
import { MARKS, type Kind, type Meas, type MarkKey, type Pt, type Scale, type Tool, type Units } from './types'
import { centroid, dist, esc, fmtArea, fmtLen, parea, parseNum, plen } from './geometry'
import { makeSample } from './sample'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const MAXPX = 12e6
const dpr = () => Math.min(window.devicePixelRatio || 1, 2)

type Els = { vp: HTMLDivElement; stage: HTMLDivElement; base: HTMLCanvasElement; det: HTMLCanvasElement; ov: SVGSVGElement }
type Source = HTMLImageElement | HTMLCanvasElement

/**
 * The plan viewer and measuring engine. It owns the document, the canvas
 * rendering, pointer input and the measurement data. The React screens read
 * its public fields and re-render when `subscribe` listeners fire.
 */
export class Engine {
  /* ----- document ----- */
  kind: 'pdf' | 'image' | null = null
  doc: PDFDocumentProxy | null = null
  pdfPage: PDFPageProxy | null = null
  img: Source | null = null
  pages = 1
  page = 1
  name = ''
  paper = true
  sample = false
  W = 1
  H = 1
  zoom = 1

  /* ----- measuring ----- */
  tool: Tool = 'line'
  pts: Pt[] = []
  hover: Pt | null = null
  scales: Record<number, Scale> = {}
  meas: Record<number, Meas[]> = {}
  sel: number | null = null
  units: Units = 'imp'
  prec = 16
  pending: Pt[] | null = null
  nextId = 1
  loading = false
  loadError = ''
  markKey: MarkKey = 'blue'

  toast: (msg: string) => void = () => {}

  /* ----- store plumbing ----- */
  private version = 0
  private listeners = new Set<() => void>()
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  getVersion = () => this.version
  private emit() {
    this.version++
    this.listeners.forEach((f) => f())
  }

  /* ----- DOM + render state ----- */
  private els: Els | null = null
  private baseGen = 0
  private baseTask: RenderTask | null = null
  private baseScaleDone = 0
  private detGen = 0
  private detTask: RenderTask | null = null
  private tBase: number | undefined
  private tDet: number | undefined
  private down: { x: number; y: number; sl: number; st: number; panning: boolean; id: number } | null = null
  private spaceDown = false
  private gz = 1

  /* ===================== lifecycle ===================== */
  attach(els: Els) {
    this.els = els
    els.det.hidden = true
    const { vp } = els
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      }
    }
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      this.gz = this.zoom
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const g = e as unknown as { scale: number; clientX: number; clientY: number }
      this.setZoom(this.gz * g.scale, g.clientX, g.clientY)
    }
    const onScroll = () => this.scheduleDetail()
    const onResize = () => this.scheduleDetail()
    const onContext = (e: Event) => {
      if (this.pts.length) {
        e.preventDefault()
        this.finish()
      }
    }
    const onPointerLeave = () => {
      if (this.hover) {
        this.hover = null
        this.drawOverlay()
      }
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    vp.addEventListener('gesturestart', onGestureStart)
    vp.addEventListener('gesturechange', onGestureChange)
    vp.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    vp.addEventListener('pointerdown', this.onPointerDown)
    vp.addEventListener('pointermove', this.onPointerMove)
    vp.addEventListener('pointerup', this.onPointerUp)
    vp.addEventListener('pointercancel', this.onPointerCancel)
    vp.addEventListener('pointerleave', onPointerLeave)
    vp.addEventListener('contextmenu', onContext)
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    return () => {
      vp.removeEventListener('wheel', onWheel)
      vp.removeEventListener('gesturestart', onGestureStart)
      vp.removeEventListener('gesturechange', onGestureChange)
      vp.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      vp.removeEventListener('pointerdown', this.onPointerDown)
      vp.removeEventListener('pointermove', this.onPointerMove)
      vp.removeEventListener('pointerup', this.onPointerUp)
      vp.removeEventListener('pointercancel', this.onPointerCancel)
      vp.removeEventListener('pointerleave', onPointerLeave)
      vp.removeEventListener('contextmenu', onContext)
      document.removeEventListener('keydown', this.onKeyDown)
      document.removeEventListener('keyup', this.onKeyUp)
      clearTimeout(this.tBase)
      clearTimeout(this.tDet)
      this.baseTask?.cancel()
      this.detTask?.cancel()
      this.els = null
    }
  }

  /* ===================== helpers ===================== */
  curScale(): Scale | null {
    return this.scales[this.page] || null
  }
  pageMeas(): Meas[] {
    return this.meas[this.page] || (this.meas[this.page] = [])
  }
  private toFt(units: number) {
    const sc = this.curScale()
    return sc ? units / sc.perFt : null
  }
  fmtLen = (ft: number | null) => fmtLen(ft, this.units, this.prec)
  lenText(units: number) {
    return this.fmtLen(this.toFt(units)) || 'no scale'
  }
  areaText(sqUnits: number) {
    const sc = this.curScale()
    return sc ? fmtArea(sqUnits / (sc.perFt * sc.perFt), this.units) || 'no scale' : 'no scale'
  }
  measText(mm: Meas) {
    return mm.kind === 'area' ? this.areaText(parea(mm.pts)) : this.lenText(plen(mm.pts, false))
  }
  measSub(mm: Meas) {
    if (mm.kind === 'area') return `Perimeter ${this.lenText(plen(mm.pts, true))} · ${mm.pts.length} corners`
    if (mm.kind === 'path') return `${mm.pts.length - 1} segments`
    return 'Straight line'
  }
  totals() {
    const list = this.pageMeas()
    const lines = list.filter((x) => x.kind !== 'area')
    const areas = list.filter((x) => x.kind === 'area')
    const has = !!this.curScale()
    return {
      lines: lines.length > 1 && has ? this.lenText(lines.reduce((s, x) => s + plen(x.pts, false), 0)) : null,
      areas: areas.length > 1 && has ? this.areaText(areas.reduce((s, x) => s + parea(x.pts), 0)) : null,
    }
  }
  /** The prompt shown on the plan. */
  hint(): { msg: string; warn: boolean } {
    const t = this.tool
    const n = this.pts.length
    if (!this.kind) return { msg: 'Open a plan to start.', warn: false }
    if (this.pending) return { msg: 'Type the real length of that line in the Scale panel.', warn: false }
    if (!this.curScale() && t !== 'scale' && t !== 'pan')
      return { msg: 'No scale on this page yet. Choose Set scale first, then measure.', warn: true }
    let msg = ''
    if (t === 'scale')
      msg = n
        ? 'Now click the other end of that dimension.'
        : 'Set scale: click one end of a dimension you know. A printed dimension line works best.'
    else if (t === 'pan') msg = 'Drag to move around the plan. Pinch or ⌘ + scroll to zoom.'
    else if (t === 'line') msg = n ? 'Click the end point. Hold Shift to keep it straight.' : 'Click the start point.'
    else if (t === 'path')
      msg = n
        ? 'Keep clicking corners. Click the last point twice, or press Enter, to finish.'
        : 'Click the first corner of the run.'
    else if (t === 'area')
      msg =
        n >= 3
          ? 'Click the first point again (circled) to close the shape.'
          : n
            ? 'Click the next corner of the room.'
            : 'Click the first corner of the room.'
    return { msg, warn: false }
  }
  canFinish() {
    const n = this.pts.length
    return (this.tool === 'path' && n >= 2) || (this.tool === 'area' && n >= 3)
  }
  otherScalePage(): number | null {
    for (const p of Object.keys(this.scales)) if (+p !== this.page) return +p
    return null
  }

  /* ===================== loading ===================== */
  private resetDoc() {
    this.scales = {}
    this.meas = {}
    this.sel = null
    this.pts = []
    this.pending = null
    this.page = 1
  }

  loadSample() {
    this.resetDoc()
    const s = makeSample()
    this.kind = 'image'
    this.img = s.img
    this.doc = null
    this.pages = 1
    this.paper = true
    this.sample = true
    this.name = 'Sample plan'
    this.W = s.W
    this.H = s.H
    this.scales[1] = { perFt: s.FT, label: `1/4" = 1'-0"`, how: 'preset' }
    this.meas[1] = [
      { id: this.nextId++, kind: 'line', name: 'Top wall', pts: [{ x: s.X0, y: s.Y0 }, { x: s.X1, y: s.Y0 }] },
      {
        id: this.nextId++,
        kind: 'area',
        name: 'Bedroom',
        pts: [{ x: s.XI, y: s.YI }, { x: s.X1, y: s.YI }, { x: s.X1, y: s.Y1 }, { x: s.XI, y: s.Y1 }],
      },
    ]
    this.afterLoad(true)
  }

  openFile(file: File | undefined | null) {
    if (!file) return
    this.loadError = ''
    const name = file.name || 'Plan'
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(name)
    this.loading = true
    this.emit()
    if (isPdf) {
      const fr = new FileReader()
      fr.onload = () => {
        pdfjsLib
          .getDocument({ data: new Uint8Array(fr.result as ArrayBuffer), isEvalSupported: false })
          .promise.then((doc) => {
            this.resetDoc()
            this.kind = 'pdf'
            this.doc = doc
            this.img = null
            this.pages = doc.numPages
            this.paper = true
            this.sample = false
            this.name = name
            return this.loadPage(1, true)
          })
          .catch((err: { name?: string }) => {
            this.loading = false
            this.loadError =
              err && err.name === 'PasswordException'
                ? 'This PDF is password-protected. Open it in Preview, export an unlocked copy, and open that here.'
                : 'This PDF could not be opened. Try saving a fresh copy of it and opening that.'
            console.error(err)
            this.emit()
          })
      }
      fr.onerror = () => {
        this.loading = false
        this.loadError = 'The file could not be read.'
        this.emit()
      }
      fr.readAsArrayBuffer(file)
    } else {
      const url = URL.createObjectURL(file)
      const im = new Image()
      im.onload = () => {
        this.resetDoc()
        this.kind = 'image'
        this.img = im
        this.doc = null
        this.pages = 1
        this.paper = false
        this.sample = false
        this.name = name
        this.W = im.naturalWidth
        this.H = im.naturalHeight
        this.afterLoad(true)
      }
      im.onerror = () => {
        this.loading = false
        this.loadError =
          'That image type will not open here. Use a PDF, JPG or PNG. (iPhone HEIC photos: export as JPG first.)'
        this.emit()
      }
      im.src = url
    }
  }

  async loadPage(n: number, fit: boolean) {
    this.page = n
    this.pts = []
    this.sel = null
    this.pending = null
    if (this.kind !== 'pdf' || !this.doc) {
      this.afterLoad(fit)
      return
    }
    this.loading = true
    this.emit()
    const p = await this.doc.getPage(n)
    this.pdfPage = p
    const v = p.getViewport({ scale: 1 })
    this.W = v.width
    this.H = v.height
    this.afterLoad(fit)
  }
  prevPage() {
    if (this.page > 1) void this.loadPage(this.page - 1, true)
  }
  nextPage() {
    if (this.page < this.pages) void this.loadPage(this.page + 1, true)
  }

  private afterLoad(fit: boolean) {
    this.loading = false
    this.baseScaleDone = 0
    if (this.els) {
      this.els.base.width = 0
      this.els.det.hidden = true
    }
    if (fit) this.fitZoom()
    else this.layout()
    this.emit()
  }

  /* ===================== rendering ===================== */
  private layout() {
    if (!this.els) return
    const { stage, base, ov, det } = this.els
    const w = this.W * this.zoom
    const h = this.H * this.zoom
    stage.style.width = w + 'px'
    stage.style.height = h + 'px'
    base.style.width = w + 'px'
    base.style.height = h + 'px'
    ov.setAttribute('width', String(w))
    ov.setAttribute('height', String(h))
    ov.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`)
    det.hidden = true
    this.detTask?.cancel()
    this.detGen++
    this.drawOverlay()
    clearTimeout(this.tBase)
    this.tBase = window.setTimeout(() => this.renderBase(), 60)
  }

  private renderBase() {
    if (!this.kind || !this.els) return
    const { base } = this.els
    const want = Math.min(this.zoom * dpr(), Math.sqrt(MAXPX / (this.W * this.H)))
    if (base.width > 0 && Math.abs(want - this.baseScaleDone) / want < 0.02) {
      this.scheduleDetail()
      return
    }
    const g = ++this.baseGen
    this.baseTask?.cancel()
    this.baseTask = null
    const off = document.createElement('canvas')
    const cw = Math.max(1, Math.ceil(this.W * want))
    const ch = Math.max(1, Math.ceil(this.H * want))
    off.width = cw
    off.height = ch
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)
    const done = () => {
      if (g !== this.baseGen || !this.els) return
      base.width = cw
      base.height = ch
      base.getContext('2d')!.drawImage(off, 0, 0)
      this.baseScaleDone = want
      this.scheduleDetail()
    }
    if (this.kind === 'pdf' && this.pdfPage) {
      const page = this.pdfPage
      this.baseTask = page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: want }) })
      this.baseTask.promise.then(done, (e: { name?: string }) => {
        if (!e || e.name !== 'RenderingCancelledException') console.error(e)
      })
    } else if (this.img) {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(this.img, 0, 0, cw, ch)
      done()
    }
  }

  private scheduleDetail() {
    clearTimeout(this.tDet)
    this.tDet = window.setTimeout(() => this.renderDetail(), 140)
  }
  private visibleRect() {
    const { vp, stage } = this.els!
    const vr = vp.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    const x0 = Math.max(0, vr.left - sr.left)
    const y0 = Math.max(0, vr.top - sr.top)
    const x1 = Math.min(sr.width, vr.left + vp.clientWidth - sr.left)
    const y1 = Math.min(sr.height, vr.top + vp.clientHeight - sr.top)
    return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) }
  }
  private renderDetail() {
    if (!this.els) return
    const { det } = this.els
    if (!this.kind || this.baseScaleDone >= this.zoom * dpr() * 0.97) {
      det.hidden = true
      return
    }
    const r = this.visibleRect()
    if (r.w < 4 || r.h < 4) return
    const g = ++this.detGen
    this.detTask?.cancel()
    this.detTask = null
    let ds = dpr()
    if (r.w * r.h * ds * ds > MAXPX) ds = Math.sqrt(MAXPX / (r.w * r.h))
    const cw = Math.ceil(r.w * ds)
    const ch = Math.ceil(r.h * ds)
    const off = document.createElement('canvas')
    off.width = cw
    off.height = ch
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)
    const zoomAt = this.zoom
    const done = () => {
      if (g !== this.detGen || zoomAt !== this.zoom || !this.els) return
      det.width = cw
      det.height = ch
      det.getContext('2d')!.drawImage(off, 0, 0)
      det.style.left = r.x + 'px'
      det.style.top = r.y + 'px'
      det.style.width = r.w + 'px'
      det.style.height = r.h + 'px'
      det.hidden = false
    }
    if (this.kind === 'pdf' && this.pdfPage) {
      const v = this.pdfPage.getViewport({ scale: this.zoom * ds, offsetX: -r.x * ds, offsetY: -r.y * ds })
      this.detTask = this.pdfPage.render({ canvasContext: ctx, viewport: v })
      this.detTask.promise.then(done, (e: { name?: string }) => {
        if (!e || e.name !== 'RenderingCancelledException') console.error(e)
      })
    } else if (this.img) {
      const iw = (this.img as HTMLImageElement).naturalWidth || this.img.width
      const k = iw / this.W
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(this.img, (r.x / this.zoom) * k, (r.y / this.zoom) * k, (r.w / this.zoom) * k, (r.h / this.zoom) * k, 0, 0, cw, ch)
      done()
    }
  }

  /* ===================== zoom ===================== */
  setZoom(z: number, cx?: number, cy?: number) {
    if (!this.els) return
    const { vp, stage } = this.els
    z = Math.max(0.05, Math.min(20, z))
    const vr = vp.getBoundingClientRect()
    if (cx == null || cy == null) {
      cx = vr.left + vp.clientWidth / 2
      cy = vr.top + vp.clientHeight / 2
    }
    const sr = stage.getBoundingClientRect()
    const px = (cx - sr.left) / this.zoom
    const py = (cy - sr.top) / this.zoom
    this.zoom = z
    this.layout()
    vp.scrollLeft = stage.offsetLeft + px * z - (cx - vr.left)
    vp.scrollTop = stage.offsetTop + py * z - (cy - vr.top)
    this.emit()
  }
  zoomIn() {
    this.setZoom(this.zoom * 1.25)
  }
  zoomOut() {
    this.setZoom(this.zoom / 1.25)
  }
  fitZoom() {
    if (!this.els) return
    const { vp } = this.els
    const w = vp.clientWidth - 64
    const h = vp.clientHeight - 64
    let z = Math.min(w / this.W, Math.max(h, 200) / this.H)
    if (!isFinite(z) || z <= 0) z = 1
    this.zoom = Math.max(0.05, z)
    this.layout()
    vp.scrollLeft = 0
    vp.scrollTop = 0
    this.emit()
  }

  /* ===================== pointer input ===================== */
  private evPt(e: PointerEvent): Pt {
    const sr = this.els!.stage.getBoundingClientRect()
    return { x: (e.clientX - sr.left) / this.zoom, y: (e.clientY - sr.top) / this.zoom }
  }
  private constrain(p: Pt, e: PointerEvent): Pt {
    if (!e.shiftKey || !this.pts.length) return p
    const a = this.pts[this.pts.length - 1]
    const dx = p.x - a.x
    const dy = p.y - a.y
    const ang = Math.atan2(dy, dx)
    const sn = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4)
    const L = Math.hypot(dx, dy) * Math.cos(ang - sn)
    return { x: a.x + Math.cos(sn) * L, y: a.y + Math.sin(sn) * L }
  }
  private onPointerDown = (e: PointerEvent) => {
    if (e.button === 2 || !this.els) return
    const { vp } = this.els
    this.down = {
      x: e.clientX,
      y: e.clientY,
      sl: vp.scrollLeft,
      st: vp.scrollTop,
      panning: this.tool === 'pan' || this.spaceDown || e.button === 1,
      id: e.pointerId,
    }
    try {
      vp.setPointerCapture(e.pointerId)
    } catch {
      /* not all browsers allow capture */
    }
    if (this.down.panning) vp.classList.add('panning')
  }
  private onPointerMove = (e: PointerEvent) => {
    if (!this.els) return
    const { vp } = this.els
    const d = this.down
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.panning && Math.hypot(dx, dy) > 6) {
        d.panning = true
        vp.classList.add('panning')
      }
      if (d.panning) {
        vp.scrollLeft = d.sl - dx
        vp.scrollTop = d.st - dy
        return
      }
    }
    if (this.tool !== 'pan' && this.pts.length) {
      this.hover = this.constrain(this.evPt(e), e)
      this.drawOverlay()
    }
  }
  private onPointerUp = (e: PointerEvent) => {
    const d = this.down
    if (!d || d.id !== e.pointerId || !this.els) return
    this.down = null
    this.els.vp.classList.remove('panning')
    if (d.panning) return
    if (this.tool === 'pan' || !this.kind) return
    this.addPoint(this.constrain(this.evPt(e), e))
  }
  private onPointerCancel = () => {
    this.down = null
    this.els?.vp.classList.remove('panning')
  }

  private addPoint(p: Pt) {
    const t = this.tool
    const pts = this.pts
    if (p.x < -this.W * 0.1 || p.y < -this.H * 0.1 || p.x > this.W * 1.1 || p.y > this.H * 1.1) return
    if (pts.length) {
      const last = pts[pts.length - 1]
      if (dist(last, p) * this.zoom < 5) {
        if (t === 'path' || t === 'area') this.finish()
        return
      }
    }
    if (t === 'area' && pts.length >= 3 && dist(pts[0], p) * this.zoom < 14) {
      this.finish()
      return
    }
    pts.push(p)
    this.hover = p
    if ((t === 'line' || t === 'scale') && pts.length === 2) {
      this.finish()
      return
    }
    this.drawOverlay()
    this.emit()
  }
  finish() {
    const t = this.tool
    const pts = this.pts.slice()
    this.pts = []
    this.hover = null
    if (t === 'scale') {
      if (pts.length === 2) this.pending = pts
    } else if ((t === 'line' && pts.length === 2) || (t === 'path' && pts.length >= 2) || (t === 'area' && pts.length >= 3)) {
      const list = this.pageMeas()
      const n = list.filter((x) => x.kind === t).length + 1
      const label = { line: 'Line', path: 'Path', area: 'Area' }[t as Kind]
      const mm: Meas = { id: this.nextId++, kind: t as Kind, pts, name: `${label} ${n}` }
      list.push(mm)
      this.sel = mm.id
    }
    this.drawOverlay()
    this.emit()
  }
  cancelDraw() {
    this.pts = []
    this.hover = null
    this.drawOverlay()
    this.emit()
  }
  undoPoint() {
    this.pts.pop()
    if (!this.pts.length) this.hover = null
    this.drawOverlay()
    this.emit()
  }

  setTool(t: Tool) {
    if (this.pts.length && t !== this.tool) {
      this.pts = []
      this.hover = null
    }
    this.tool = t
    this.els?.vp.classList.toggle('pan', t === 'pan')
    this.drawOverlay()
    this.emit()
  }

  /* ===================== scale ===================== */
  setPreset(perFt: number, label: string) {
    this.scales[this.page] = { perFt, label, how: 'preset' }
    if (this.tool === 'scale') this.setTool('line')
    this.drawOverlay()
    this.emit()
    this.toast('Scale set to ' + label)
  }
  copyScaleFrom(page: number) {
    const s = this.scales[page]
    if (!s) return
    this.scales[this.page] = { perFt: s.perFt, label: s.label, how: s.how, realFt: s.realFt }
    this.drawOverlay()
    this.emit()
  }
  /** Returns an error message, or null when the scale was set. */
  submitCalibration(feet: string, inches: string, meters: string): string | null {
    if (!this.pending) return 'Click both ends of a dimension first.'
    let realFt: number
    if (this.units === 'imp') {
      const f = parseNum(feet)
      const i = parseNum(inches)
      if (isNaN(f) || isNaN(i)) return 'Use numbers only, like 12 and 6 1/2.'
      realFt = f + i / 12
    } else {
      const m = parseNum(meters)
      if (isNaN(m)) return 'Use a number, like 3.6.'
      realFt = m / 0.3048
    }
    if (!(realFt > 0)) return 'Enter a length greater than zero.'
    const u = dist(this.pending[0], this.pending[1])
    if (u < 1e-6) return 'The two points were in the same spot. Cancel and try again.'
    this.scales[this.page] = {
      perFt: u / realFt,
      label: `${this.fmtLen(realFt)} line`,
      how: 'calib',
      line: this.pending,
      realFt,
    }
    this.pending = null
    this.tool = 'line'
    this.els?.vp.classList.remove('pan')
    this.drawOverlay()
    this.emit()
    this.toast('Scale set. Now measure a printed dimension to check it.')
    return null
  }
  cancelCalibration() {
    this.pending = null
    this.drawOverlay()
    this.emit()
  }
  setUnits(u: Units) {
    this.units = u
    this.drawOverlay()
    this.emit()
  }
  setPrec(p: number) {
    this.prec = p
    this.drawOverlay()
    this.emit()
  }
  setMark(k: MarkKey) {
    this.markKey = k
    this.drawOverlay()
  }

  /* ===================== measurements ===================== */
  select(id: number | null) {
    if (this.sel === id) return
    this.sel = id
    this.drawOverlay()
    this.emit()
  }
  rename(id: number, name: string) {
    this.pageMeas().forEach((x) => {
      if (x.id === id) x.name = name
    })
    this.drawOverlay()
    this.emit()
  }
  remove(id: number) {
    this.meas[this.page] = this.pageMeas().filter((x) => x.id !== id)
    if (this.sel === id) this.sel = null
    this.drawOverlay()
    this.emit()
  }
  clearPage() {
    this.meas[this.page] = []
    this.sel = null
    this.drawOverlay()
    this.emit()
  }
  /** Plain-text list of every measurement on every page. */
  listText(): string {
    const lines: string[] = []
    const keep = this.page
    Object.keys(this.meas)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((p) => {
        const list = this.meas[p]
        if (!list || !list.length) return
        this.page = p
        const sc = this.curScale()
        lines.push(this.name + (this.pages > 1 ? ` — page ${p}` : '') + (sc ? ` — scale ${sc.label}` : ' — no scale set'))
        list.forEach((mm) => {
          let t = `${mm.name}: ${this.measText(mm)}`
          if (mm.kind === 'area') t += ` (perimeter ${this.lenText(plen(mm.pts, true))})`
          lines.push(t)
        })
        lines.push('')
      })
    this.page = keep
    return lines.join('\n').trim()
  }

  /* ===================== keyboard ===================== */
  private onKeyDown = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    const tag = el?.tagName || ''
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return
    if (el?.closest('.ant-drawer, .ant-modal, .ant-select-dropdown, .ant-popover')) return
    if (e.key === ' ') {
      if (tag === 'BUTTON') return
      this.spaceDown = true
      this.els?.vp.classList.add('pan')
      e.preventDefault()
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (k === 'l') this.setTool('line')
    else if (k === 'p') this.setTool('path')
    else if (k === 'a') this.setTool('area')
    else if (k === 's') this.setTool('scale')
    else if (k === 'h') this.setTool('pan')
    else if (e.key === 'Escape') {
      if (this.pts.length) this.cancelDraw()
      else if (this.pending) this.cancelCalibration()
      else this.select(null)
    } else if (e.key === 'Enter') {
      if (this.pts.length) this.finish()
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (this.pts.length) {
        this.undoPoint()
        e.preventDefault()
      } else if (this.sel != null) {
        this.remove(this.sel)
        e.preventDefault()
      }
    } else if (k === '+' || k === '=') this.zoomIn()
    else if (k === '-') this.zoomOut()
    else if (k === '0') this.fitZoom()
  }
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      this.spaceDown = false
      this.els?.vp.classList.toggle('pan', this.tool === 'pan')
    }
  }

  /* ===================== overlay ===================== */
  private markCol() {
    return MARKS[this.markKey] || MARKS.blue
  }
  private shape(pts: Pt[], closed: boolean, o: { col?: string; sel?: boolean; dash?: boolean }) {
    const col = o.col || this.markCol()
    const k = 1 / this.zoom
    const tag = closed ? 'polygon' : 'polyline'
    const pa = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    const w = o.sel ? 4 : 3
    const dash = o.dash ? ' stroke-dasharray="8 6"' : ''
    let h = `<${tag} points="${pa}" fill="none" stroke="#fff" stroke-width="${w + 4}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    h += `<${tag} points="${pa}" fill="${closed ? col : 'none'}" fill-opacity="${o.sel ? 0.24 : 0.15}" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"${dash}/>`
    pts.forEach((p) => {
      h += `<circle cx="${p.x}" cy="${p.y}" r="${4.5 * k}" fill="${col}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`
    })
    return h
  }
  private label(x: number, y: number, text: string, col: string, bold?: boolean) {
    const k = 1 / this.zoom
    const fs = (bold ? 14 : 13) * k
    const pad = 5 * k
    const tw = text.length * 0.6 * fs
    return (
      `<g><rect x="${x - tw / 2 - pad}" y="${y - fs / 2 - pad}" width="${tw + 2 * pad}" height="${fs + 2 * pad}" rx="${3 * k}" fill="${col}" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
      `<text x="${x}" y="${y + fs * 0.36}" text-anchor="middle" font-family="IBM Plex Mono, Menlo, monospace" font-weight="600" font-size="${fs}" fill="#fff">${esc(text)}</text></g>`
    )
  }
  private labelPos(mm: Meas): Pt {
    const k = 1 / this.zoom
    if (mm.kind === 'area') return centroid(mm.pts)
    let best = 0
    let bi = 1
    for (let i = 1; i < mm.pts.length; i++) {
      const d = dist(mm.pts[i - 1], mm.pts[i])
      if (d > best) {
        best = d
        bi = i
      }
    }
    const a = mm.pts[bi - 1]
    const b = mm.pts[bi]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 16 * k }
  }
  drawOverlay() {
    if (!this.els) return
    const k = 1 / this.zoom
    const col = this.markCol()
    const sc = this.curScale()
    let h = ''
    if (sc && sc.line) {
      h += this.shape(sc.line, false, { col: '#595959', dash: true })
      const a = sc.line[0]
      const b = sc.line[1]
      h += this.label((a.x + b.x) / 2, (a.y + b.y) / 2 + 18 * k, 'scale ' + (this.fmtLen(sc.realFt ?? null) || ''), '#595959')
    }
    if (this.pending) h += this.shape(this.pending, false, { col: '#595959', dash: true, sel: true })
    this.pageMeas().forEach((mm) => {
      h += this.shape(mm.pts, mm.kind === 'area', { sel: mm.id === this.sel })
    })
    this.pageMeas().forEach((mm) => {
      const p = this.labelPos(mm)
      const t = this.measText(mm)
      h += this.label(p.x, p.y, (this.sel === mm.id && mm.name ? mm.name + ': ' : '') + t, col, this.sel === mm.id)
    })
    if (this.pts.length) {
      const live = this.pts.concat(this.hover ? [this.hover] : [])
      const closed = this.tool === 'area' && live.length > 2
      h += this.shape(live, closed, { sel: true, col: this.tool === 'scale' ? '#595959' : col, dash: this.tool === 'scale' })
      const hp = this.hover || this.pts[this.pts.length - 1]
      let txt = ''
      if (this.tool === 'area') txt = live.length > 2 ? this.areaText(parea(live)) : this.lenText(plen(live, false))
      else if (this.tool === 'path' || this.tool === 'line') txt = this.lenText(plen(live, false))
      if (txt && txt !== 'no scale') h += this.label(hp.x + 22 * k + txt.length * 3.9 * k, hp.y - 22 * k, txt, '#141414', true)
      if (this.tool === 'area' && this.pts.length >= 3) {
        const f = this.pts[0]
        h += `<circle cx="${f.x}" cy="${f.y}" r="${11 * k}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`
      }
    }
    this.els.ov.innerHTML = h
  }
}
