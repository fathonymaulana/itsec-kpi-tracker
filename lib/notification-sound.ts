let audioCtx: AudioContext | null = null

// Two-note soft chime, synthesized rather than a bundled asset — no third-party sound file to
// license or ship. Fired once per poll batch (not once per item) so a burst of several new
// notifications doesn't stack overlapping dings. Deliberately not used for the login-success
// toast (see AddOnsPanel/login flow) — only for the notification-polling loop in DeptTopNav.
export function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const ctx = audioCtx
    const now = ctx.currentTime
    const notes = [
      { freq: 880, start: 0, dur: 0.12, peak: 0.16 },
      { freq: 1318.51, start: 0.09, dur: 0.2, peak: 0.14 },
    ]
    for (const { freq, start, dur, peak } of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(peak, now + start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.02)
    }
  } catch {
    // Sound is a nice-to-have — never let it break the notification flow itself.
  }
}
