// "Confetti appears when approve a post" — a small celebratory burst on approval actions, the kind
// of micro-interaction catalogued on sites like designspells.com. canvas-confetti is dynamically
// imported so it never adds to any page's initial bundle — it only loads the moment an Approve
// button is actually clicked.
//
// Fires from a dedicated, temporary canvas pinned directly over the clicking button (via
// confetti.create + getBoundingClientRect) rather than the library's single full-viewport canvas
// with a fractional `origin`. The fractional-origin approach looked right on paper but visually
// drifted toward a corner in this app — likely because the button sits inside layout that isn't a
// plain top-of-body flow (framer-motion's AnimatePresence rows, Popover/Dialog portals), and
// window.innerWidth/innerHeight fractions don't reliably map back to where the element actually
// renders in every one of those contexts. A canvas positioned via the button's own rect sidesteps
// that entirely — wherever the button visually is, the burst starts there.
export async function fireApproveConfetti(originEl?: HTMLElement | null) {
  const { default: confetti } = await import('canvas-confetti')
  if (!originEl) {
    confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 32,
      colors: ['#CC1F1F', '#16a34a', '#f59e0b', '#171717', '#ffffff'],
      scalar: 0.9,
      ticks: 160,
      zIndex: 9999,
    })
    return
  }

  const rect = originEl.getBoundingClientRect()
  // Generous padding around the button so the burst has room to spread without the canvas edge
  // clipping it — the canvas itself is fixed/transparent/pointer-events:none, purely a paint
  // surface, so an oversized box has no visual or layout side effects.
  const pad = 160
  const left = rect.left - pad
  const top = rect.top - pad
  const width = rect.width + pad * 2
  const height = rect.height + pad * 2

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.left = `${left}px`
  canvas.style.top = `${top}px`
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const burst = confetti.create(canvas, { resize: false, useWorker: true })

  // Brand red + the app's semantic success/warning tones + near-black, so the burst reads as this
  // app's own palette rather than generic rainbow confetti.
  const done = burst({
    particleCount: 90,
    spread: 75,
    startVelocity: 32,
    origin: { x: 0.5, y: (pad + rect.height / 2) / height },
    colors: ['#CC1F1F', '#16a34a', '#f59e0b', '#171717', '#ffffff'],
    scalar: 0.9,
    ticks: 160,
  })

  done?.then(() => canvas.remove()).catch(() => canvas.remove())
  // Belt-and-suspenders cleanup in case the promise never settles for some reason.
  setTimeout(() => canvas.remove(), 4000)
}
