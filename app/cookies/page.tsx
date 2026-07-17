import { PolicyPage } from '@/components/layout/PolicyPage'

export const metadata = { title: 'Cookie Policy — ITSEC KPI Tracker' }

export default function CookiePolicyPage() {
  return (
    <PolicyPage title="Cookie Policy" updated="July 17, 2026">
      <section>
        <p>
          ITSEC KPI Tracker keeps its use of cookies and browser storage deliberately minimal.
          As an internal tool, the Platform doesn&apos;t run advertising, analytics trackers, or
          any third-party marketing pixels — everything stored in your browser exists to make the
          Platform itself work.
        </p>
      </section>

      <section>
        <h2>What we store, and why</h2>
        <ul>
          <li><strong>Authentication token</strong> — kept in your browser&apos;s local storage after you sign in, so you stay logged in between page visits without re-entering your PIN every time. Strictly necessary — the Platform can&apos;t function without it.</li>
          <li><strong>Theme preference</strong> — a small flag remembering whether you last used light or dark mode, stored locally on your device only.</li>
          <li><strong>Session cookies from our hosting provider</strong> — our hosting infrastructure (Vercel) may set short-lived, strictly necessary cookies to route requests and protect the Platform from abuse. These contain no personal information and are not used for tracking.</li>
        </ul>
      </section>

      <section>
        <h2>What we don&apos;t use</h2>
        <p>
          We do not use third-party advertising cookies, cross-site tracking pixels, or analytics
          cookies that build a profile of your behavior outside this Platform. Nothing stored by
          the Platform is sold or shared with advertisers.
        </p>
      </section>

      <section>
        <h2>Managing storage</h2>
        <p>
          Because the authentication token is strictly necessary, clearing it (via your browser
          settings or by signing out) simply signs you out of the Platform — you can sign back in
          at any time with your PIN. Your theme preference can be changed at any time from the
          Add-ons panel and will simply reset to the default if cleared.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          If the Platform&apos;s use of cookies or local storage changes, this page will be
          updated and the &ldquo;Last updated&rdquo; date above will reflect the change.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy can be directed to your organization&apos;s Corporate
          Planning team, who administer the Platform.
        </p>
      </section>
    </PolicyPage>
  )
}
