'use client'

// Catches errors thrown by the root layout itself (AuthProvider, SplashScreen, Toaster — anything
// mounted directly in app/layout.tsx) — a plain app/error.tsx only wraps page content, not the
// layout it sits inside. Next requires this file to render its own <html>/<body> since it fully
// replaces the root layout when it triggers. Kept deliberately dependency-free (no Tailwind classes
// that assume globals.css loaded, no shared components) since the very thing that crashed might be
// upstream of those.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '24px',
            textAlign: 'center',
            background: '#fafafa',
            color: '#171717',
          }}
        >
          <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Something went wrong</p>
          <p style={{ fontSize: '14px', color: '#737373', margin: 0, maxWidth: '360px' }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#171717',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
