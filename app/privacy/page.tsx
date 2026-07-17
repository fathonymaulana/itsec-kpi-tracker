import { PolicyPage } from '@/components/layout/PolicyPage'

export const metadata = { title: 'Privacy Policy — ITSEC KPI Tracker' }

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="Privacy Policy" updated="July 17, 2026">
      <section>
        <p>
          ITSEC KPI Tracker (&ldquo;the Platform&rdquo;) is an internal performance-management tool used by
          department heads, Corporate Planning, and the Board to record, review, and report on
          IT security KPIs. This policy explains what information the Platform collects from the
          people who use it, why it&apos;s collected, and how it&apos;s protected. The Platform is
          provisioned for internal company use only — it is not a public-facing product and does
          not collect information from visitors outside the organization.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account information</strong> — your name, department, role, avatar image (if you upload one), and a securely hashed PIN. We never store PINs in plain text.</li>
          <li><strong>Performance data you enter</strong> — KPI actuals, targets, data-source notes, and modification requests submitted through the Data Entry and Data Review workflows.</li>
          <li><strong>Session data</strong> — a signed authentication token used to keep you logged in, and basic timestamps (last updated, submission times) attached to the records you create or edit.</li>
          <li><strong>Device preferences</strong> — local, non-identifying settings such as your light/dark mode choice, stored only on your own device.</li>
        </ul>
      </section>

      <section>
        <h2>How we use this information</h2>
        <p>
          Information collected by the Platform is used exclusively to operate the KPI tracking
          and reporting workflow: displaying dashboards, computing on-track/off-track status,
          routing modify-requests for approval, and giving Corporate Planning and the Board an
          accurate, up-to-date view of departmental performance. We do not sell, rent, or share
          this information with third parties, and we do not use it for advertising or any
          purpose unrelated to internal performance management.
        </p>
      </section>

      <section>
        <h2>Where your data lives</h2>
        <p>
          Platform data is stored in a managed Supabase (PostgreSQL) database with row-level
          security enabled, and static assets such as avatar images are stored in a private
          Supabase Storage bucket. Access to raw production data is restricted to Corporate
          Planning administrators and the engineering team responsible for maintaining the
          Platform.
        </p>
      </section>

      <section>
        <h2>Data retention</h2>
        <p>
          KPI records, submissions, and audit history are retained for as long as they remain
          relevant for reporting and audit purposes, in line with the organization&apos;s standard
          records-retention practice. Account information is retained while your account remains
          active; when an account is deactivated, its login access is revoked immediately while
          historical KPI records it contributed to are preserved for continuity of reporting.
        </p>
      </section>

      <section>
        <h2>Your rights and choices</h2>
        <p>
          You can review and update your name and avatar at any time from your Profile page.
          PIN changes go through a Super Admin approval step for account-security reasons. If you
          believe any information on your account is inaccurate or you have questions about how
          your data is handled, contact your Corporate Planning administrator.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy as the Platform evolves. Material changes will be reflected
          by updating the &ldquo;Last updated&rdquo; date above.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about this policy or your data can be directed to your organization&apos;s
          Corporate Planning team, who administer the Platform.
        </p>
      </section>
    </PolicyPage>
  )
}
