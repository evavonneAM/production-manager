/** Draws the built-in sample plan (a 40' x 28' house with dimension strings). */
export type Sample = {
  img: HTMLCanvasElement
  W: number
  H: number
  FT: number
  X0: number
  Y0: number
  X1: number
  Y1: number
  XI: number
  YI: number
}

export function makeSample(): Sample {
  const W = 1224
  const H = 792
  const K = 3
  const c = document.createElement('canvas')
  c.width = W * K
  c.height = H * K
  const x = c.getContext('2d')!
  x.scale(K, K)
  x.fillStyle = '#fff'
  x.fillRect(0, 0, W, H)
  const X0 = 200
  const Y0 = 130
  const FT = 18
  const X1 = X0 + 40 * FT
  const Y1 = Y0 + 28 * FT
  const XI = X0 + 18 * FT
  const YI = Y0 + 14 * FT
  x.strokeStyle = '#111'
  x.lineCap = 'butt'
  x.lineWidth = 9
  x.strokeRect(X0, Y0, X1 - X0, Y1 - Y0)
  x.lineWidth = 6
  const ln = (a: number, b: number, c2: number, d: number) => {
    x.beginPath()
    x.moveTo(a, b)
    x.lineTo(c2, d)
    x.stroke()
  }
  ln(XI, Y0, XI, Y0 + 10 * FT)
  ln(XI, Y0 + 13 * FT, XI, Y1)
  ln(XI, YI, X0 + 28 * FT, YI)
  ln(X0 + 31 * FT, YI, X1, YI)
  // windows
  x.lineWidth = 1.5
  x.fillStyle = '#fff'
  ;[
    [X0 + 5 * FT, Y0, 6 * FT],
    [X0 + 26 * FT, Y0, 6 * FT],
    [X0 + 28 * FT, Y1, 6 * FT],
  ].forEach((w) => {
    x.fillRect(w[0], w[1] - 5, w[2], 10)
    x.strokeRect(w[0], w[1] - 5, w[2], 10)
    ln(w[0], w[1], w[0] + w[2], w[1])
  })
  // door swing
  x.lineWidth = 1.2
  x.beginPath()
  x.arc(XI, Y0 + 13 * FT, 3 * FT, -Math.PI / 2, 0)
  x.stroke()
  ln(XI, Y0 + 13 * FT, XI + 3 * FT, Y0 + 13 * FT)
  // room labels
  x.fillStyle = '#111'
  x.textAlign = 'center'
  x.font = '700 15px "IBM Plex Mono", Menlo, monospace'
  x.fillText('LIVING / DINING', (X0 + XI) / 2, (Y0 + Y1) / 2)
  x.fillText('KITCHEN', (XI + X1) / 2, (Y0 + YI) / 2)
  x.fillText('BEDROOM', (XI + X1) / 2, YI + 44)
  x.font = '500 12px "IBM Plex Mono", Menlo, monospace'
  x.fillText(`18'-0" x 28'-0"`, (X0 + XI) / 2, (Y0 + Y1) / 2 + 20)
  x.fillText(`22'-0" x 14'-0"`, (XI + X1) / 2, (Y0 + YI) / 2 + 20)
  x.fillText(`22'-0" x 14'-0"`, (XI + X1) / 2, YI + 64)
  // dimension strings
  x.lineWidth = 1
  x.font = '600 13px "IBM Plex Mono", Menlo, monospace'
  const dimH = (a: number, b: number, y: number, t: string) => {
    ln(a, y, b, y)
    ln(a - 5, y + 5, a + 5, y - 5)
    ln(b - 5, y + 5, b + 5, y - 5)
    ln(a, y - 8, a, y + 8)
    ln(b, y - 8, b, y + 8)
    x.fillStyle = '#fff'
    const tw = x.measureText(t).width + 10
    x.fillRect((a + b) / 2 - tw / 2, y - 9, tw, 18)
    x.fillStyle = '#111'
    x.textAlign = 'center'
    x.fillText(t, (a + b) / 2, y + 4.5)
  }
  const dimV = (xx: number, a: number, b: number, t: string) => {
    x.save()
    x.translate(xx, (a + b) / 2)
    x.rotate(-Math.PI / 2)
    dimH(-(b - a) / 2, (b - a) / 2, 0, t)
    x.restore()
  }
  dimH(X0, X1, Y0 - 50, `40'-0"`)
  dimH(X0, XI, Y1 + 50, `18'-0"`)
  dimH(XI, X1, Y1 + 50, `22'-0"`)
  dimV(X0 - 50, Y0, Y1, `28'-0"`)
  dimV(X1 + 50, Y0, YI, `14'-0"`)
  dimV(X1 + 50, YI, Y1, `14'-0"`)
  // scale bar
  const sy = H - 62
  x.lineWidth = 1.2
  for (let i = 0; i < 4; i++) {
    x.fillStyle = i % 2 ? '#fff' : '#111'
    x.fillRect(X0 + i * 4 * FT, sy, 4 * FT, 8)
    x.strokeRect(X0 + i * 4 * FT, sy, 4 * FT, 8)
  }
  x.fillStyle = '#111'
  x.font = '500 11px "IBM Plex Mono", Menlo, monospace'
  x.textAlign = 'center'
  ;[0, 4, 8, 12, 16].forEach((f) => x.fillText(f + "'", X0 + f * FT, sy + 24))
  // title block
  x.textAlign = 'right'
  x.font = '700 16px Inter, Arial, sans-serif'
  x.fillText('SAMPLE PLAN', W - 60, H - 58)
  x.font = '500 12px "IBM Plex Mono", Menlo, monospace'
  x.fillText(`SCALE: 1/4" = 1'-0"   SHEET A-1`, W - 60, H - 38)
  x.lineWidth = 2
  x.strokeRect(W - 330, H - 84, 290, 62)
  return { img: c, W, H, FT, X0, Y0, X1, Y1, XI, YI }
}
