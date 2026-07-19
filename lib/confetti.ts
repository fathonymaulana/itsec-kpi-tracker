// "Confetti appears when approve a post" — a small celebratory burst on approval actions, the kind
// of micro-interaction catalogued on sites like designspells.com. canvas-confetti is dynamically
// imported so it never adds to any page's initial bundle — it only loads the moment an Approve
// button is actually clicked.
export async function fireApproveConfetti(originEl?: HTMLElement | null) {
  const { default: confetti } = await import('canvas-confetti')

  let origin = { x: 0.5, y: 0.5 }
  if (originEl) {
    const rect = originEl.getBoundingClientRect()
    origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    }
  }

  // Brand red + the app's semantic success/warning tones + near-black, so the burst reads as this
  // app's own palette rather than generic rainbow confetti.
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 32,
    origin,
    colors: ['#CC1F1F', '#16a34a', '#f59e0b', '#171717', '#ffffff'],
    scalar: 0.9,
    ticks: 160,
    zIndex: 9999,
  })
}
