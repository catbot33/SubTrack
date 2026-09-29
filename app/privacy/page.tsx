import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  AltArrowLeftIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  EyeIcon,
  LetterIcon,
  LockKeyholeMinimalisticIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from '@solar-icons/react/linear';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy | SubTrack',
  description:
    'Learn how SubTrack collects, uses, and protects your personal information and subscription data, with full Google API Limited Use compliance.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.legalShell}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brandLink} aria-label="SubTrack home">
            <Image
              src="/subtrack-logo-dark.png"
              alt="SubTrack"
              width={1616}
              height={367}
              className={styles.brandLogo}
              priority
            />
          </Link>

          <div className={styles.headerActions}>
            <nav className={styles.navTabs} aria-label="Legal documents">
              <span className={`${styles.navTab} ${styles.navTabActive}`}>
                <ShieldCheckIcon aria-hidden="true" style={{ width: 15, height: 15 }} />
                Privacy Policy
              </span>
              <Link href="/terms" className={styles.navTab}>
                <ScaleIcon aria-hidden="true" style={{ width: 15, height: 15 }} />
                Terms of Service
              </Link>
            </nav>

            <Link href="/dashboard" className={styles.backBtn}>
              <AltArrowLeftIcon aria-hidden="true" />
              <span>Back to App</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={styles.container}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.badge}>
            <ShieldCheckIcon aria-hidden="true" />
            <span>Data Protection & Privacy</span>
          </div>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lead}>
            At SubTrack, we believe keeping track of your recurring subscriptions should never come at
            the expense of your personal privacy. We collect only what is strictly necessary to detect
            renewals, send alerts, and give you complete control over your recurring costs.
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <strong>Effective Date:</strong> September 29, 2026
            </span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.metaItem}>
              <strong>Last Updated:</strong> September 29, 2026
            </span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.metaItem}>Version 1.0</span>
          </div>
        </section>

        {/* Highlights At A Glance */}
        <section className={styles.highlightsSection} aria-labelledby="highlights-title">
          <h2 id="highlights-title" className={styles.highlightsHeading}>
            Privacy Commitments at a Glance
          </h2>
          <div className={styles.highlightsGrid}>
            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <LockKeyholeMinimalisticIcon aria-hidden="true" />
              </div>
              <h3>Never Sold or Monetized</h3>
              <p>
                We do not sell, rent, or trade your personal data, email content, or subscription
                details to advertisers, brokers, or third parties.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <EyeIcon aria-hidden="true" />
              </div>
              <h3>Read-Only Gmail Access</h3>
              <p>
                Connecting Gmail is 100% optional. If enabled, access is strictly read-only and
                limited solely to identifying subscription receipts and renewal notices.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <ShieldCheckIcon aria-hidden="true" />
              </div>
              <h3>Google Limited Use Policy</h3>
              <p>
                Our handling of information received from Google APIs strictly complies with the
                Google API Services User Data Policy, including Limited Use requirements.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <CheckCircleIcon aria-hidden="true" />
              </div>
              <h3>Total User Ownership</h3>
              <p>
                Disconnect inboxes, clear subscriptions, or permanently delete your account and all
                associated records at any moment directly inside Settings.
              </p>
            </div>
          </div>
        </section>

        {/* Content Layout with Sticky TOC */}
        <div className={styles.contentLayout}>
          <aside className={styles.tocSticky} aria-label="Table of contents">
            <h3 className={styles.tocTitle}>Table of Contents</h3>
            <ul className={styles.tocList}>
              <li>
                <a href="#overview" className={styles.tocLink}>
                  1. Overview & Scope
                </a>
              </li>
              <li>
                <a href="#information-we-collect" className={styles.tocLink}>
                  2. Information We Collect
                </a>
              </li>
              <li>
                <a href="#google-api-disclosure" className={styles.tocLink}>
                  3. Google API Limited Use
                </a>
              </li>
              <li>
                <a href="#how-we-use-information" className={styles.tocLink}>
                  4. How We Use Information
                </a>
              </li>
              <li>
                <a href="#security-and-storage" className={styles.tocLink}>
                  5. Storage & Security
                </a>
              </li>
              <li>
                <a href="#data-sharing" className={styles.tocLink}>
                  6. Third Parties & Sharing
                </a>
              </li>
              <li>
                <a href="#user-rights" className={styles.tocLink}>
                  7. Your Rights & Deletion
                </a>
              </li>
              <li>
                <a href="#cookies-and-sessions" className={styles.tocLink}>
                  8. Cookies & Authentication
                </a>
              </li>
              <li>
                <a href="#children" className={styles.tocLink}>
                  9. Children’s Privacy
                </a>
              </li>
              <li>
                <a href="#updates" className={styles.tocLink}>
                  10. Changes to this Policy
                </a>
              </li>
              <li>
                <a href="#contact" className={styles.tocLink}>
                  11. Contact Us
                </a>
              </li>
            </ul>
          </aside>

          {/* Main Prose */}
          <article className={styles.prose}>
            {/* Section 1 */}
            <section id="overview" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>1.</span>
                <span>Overview & Scope</span>
              </h2>
              <p>
                SubTrack (&quot;SubTrack,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) provides a web-based
                productivity platform that enables users to record recurring subscriptions, track billing
                cycles, forecast recurring expenses, and receive proactive renewal alerts.
              </p>
              <p>
                This Privacy Policy describes how we collect, handle, store, and safeguard your personal
                information when you access our website, sign in with your Google account, connect external
                services, or interact with our dashboard. By accessing SubTrack, you acknowledge the
                practices detailed in this policy.
              </p>
            </section>

            {/* Section 2 */}
            <section id="information-we-collect" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>2.</span>
                <span>Information We Collect</span>
              </h2>
              <p>We collect information in three ways: information you provide, information automatically gathered from your authorization, and operational technical data:</p>

              <ul>
                <li>
                  <strong>Google Account Profile:</strong> When you sign in using Google OAuth 2.0, we receive
                  your primary email address, full name, Google unique user identifier, and public profile
                  avatar URL.
                </li>
                <li>
                  <strong>Subscription Records:</strong> Subscription merchant names (e.g. Netflix, Spotify, GitHub),
                  billing cycles (weekly, monthly, quarterly, annual), recurring prices, currency codes,
                  renewal or end dates, category classifications, and notes entered manually or approved by you.
                </li>
                <li>
                  <strong>Optional Gmail Read-Only Data:</strong> If you explicitly choose to connect Gmail for
                  automatic subscription detection, our backend receives read-only authorization
                  (<code>https://www.googleapis.com/auth/gmail.readonly</code>). We scan incoming message headers,
                  sender domains, dates, and snippets strictly to detect subscription invoices, renewal
                  confirmations, and trial expiration notices.
                </li>
                <li>
                  <strong>Optional WhatsApp Notification Details:</strong> If you choose to enable WhatsApp
                  renewal notifications, we store your designated international mobile phone number and your
                  per-subscription reminder preferences (e.g., alert 1, 3, or 7 days prior to renewal).
                </li>
                <li>
                  <strong>Technical & Security Metadata:</strong> Standard operational logs such as browser user-agent,
                  request timestamps, and session identifiers, utilized strictly to maintain application security,
                  prevent abuse, and troubleshoot technical errors.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="google-api-disclosure" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>3.</span>
                <span>Google API Limited Use Disclosure</span>
              </h2>
              <p>
                SubTrack values the sensitivity of email data and strictly limits any processing of information
                received from Google APIs.
              </p>

              <div className={styles.callout}>
                <div className={styles.calloutIcon}>
                  <ShieldCheckIcon aria-hidden="true" />
                </div>
                <div className={styles.calloutBody}>
                  <div className={styles.calloutTitle}>Google API Services User Data Policy Compliance</div>
                  <p>
                    SubTrack&apos;s use and transfer to any other app of information received from Google APIs will
                    adhere to{' '}
                    <a
                      href="https://developers.google.com/terms/api-services-user-data-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google API Services User Data Policy
                    </a>
                    , including the <strong>Limited Use</strong> requirements.
                  </p>
                  <p>
                    Specifically:
                  </p>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#243f37', fontSize: 13 }}>
                    <li>We do <strong>not</strong> use your Gmail data for serving advertisements.</li>
                    <li>We do <strong>not</strong> sell, transfer, or distribute your email data to third parties.</li>
                    <li>We do <strong>not</strong> use your email content to train generalized artificial intelligence (AI) or machine learning (ML) models.</li>
                    <li>Human beings will <strong>not</strong> read your emails unless you provide explicit consent to investigate a specific technical bug or as strictly required for legal and security compliance.</li>
                  </ul>
                </div>
              </div>

              <p>
                Gmail access is strictly limited to extracting subscription billing events that are presented
                directly to you for confirmation before being saved to your dashboard.
              </p>
            </section>

            {/* Section 4 */}
            <section id="how-we-use-information" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>4.</span>
                <span>How We Use Information</span>
              </h2>
              <p>SubTrack uses the collected information strictly for legitimate operational purposes:</p>
              <ul>
                <li>
                  <strong>Personal Workspace Management:</strong> Displaying your active subscriptions,
                  aggregating your monthly and annual commitments, and calculating your upcoming payment timelines.
                </li>
                <li>
                  <strong>Automated In-App and WhatsApp Reminders:</strong> Evaluating your renewal dates against
                  your scheduled reminder intervals and dispatching automated renewal warnings so you can cancel
                  unwanted subscriptions on time.
                </li>
                <li>
                  <strong>Receipt & Trial Detection:</strong> Parsing transaction receipts to discover new
                  subscriptions or price changes, placing them into your &quot;Needs review&quot; inbox for your
                  explicit approval.
                </li>
                <li>
                  <strong>Authentication & Security:</strong> Verifying your identity via signed JSON Web Tokens (JWT)
                  and preventing unauthorized access to your account data.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="security-and-storage" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>5.</span>
                <span>Storage & Security</span>
              </h2>
              <p>
                We implement industry-standard administrative, physical, and technical safeguards to protect your
                data against unauthorized access, loss, or alteration:
              </p>
              <ul>
                <li>
                  <strong>Encrypted Connection Tokens:</strong> All Google OAuth tokens and refresh keys are
                  cryptographically sealed using AES encryption before storage.
                </li>
                <li>
                  <strong>Secure Cookies:</strong> Session tokens are delivered with <code>HttpOnly</code>,{' '}
                  <code>Secure</code>, and <code>SameSite=Lax</code> cookie flags, protecting them against
                  cross-site scripting (XSS) and request forgery (CSRF).
                </li>
                <li>
                  <strong>Data Isolation:</strong> All subscriptions and review items are strictly segmented by user
                  identity. No user can view, edit, or access another user&apos;s subscription records.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="data-sharing" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>6.</span>
                <span>Third Parties & Service Providers</span>
              </h2>
              <p>
                We do not sell, rent, or lease your personal data. We engage a minimal set of trusted infrastructure
                processors solely to operate SubTrack:
              </p>
              <ul>
                <li>
                  <strong>Google Cloud / Google APIs:</strong> Facilitates OAuth 2.0 user authentication, Gmail
                  read-only synchronization, and Google Cloud Pub/Sub push notifications for real-time receipt detection.
                </li>
                <li>
                  <strong>Twilio / WhatsApp Business API:</strong> Dispatches automated WhatsApp reminder alerts
                  to your verified phone number when configured.
                </li>
                <li>
                  <strong>Cloud Database Hosting:</strong> Secure PostgreSQL database infrastructure storing your
                  confirmed subscription records and user preferences.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="user-rights" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>7.</span>
                <span>Your Rights & Complete Data Control</span>
              </h2>
              <p>
                You retain complete ownership and full control over your personal information at all times:
              </p>
              <ul>
                <li>
                  <strong>Disconnect Gmail Inboxes:</strong> In the <em>Connections</em> or <em>Settings</em> panel,
                  you can disconnect any connected Gmail address with one click. This terminates monitoring and revokes
                  inbox watch subscriptions immediately.
                </li>
                <li>
                  <strong>Edit or Remove Subscriptions:</strong> You can edit, update, or delete any individual
                  subscription at any time.
                </li>
                <li>
                  <strong>Delete All Subscriptions:</strong> You can wipe all saved subscription entries and scheduled
                  reminders simultaneously via the Settings panel while keeping your account active.
                </li>
                <li>
                  <strong>Permanent Account Deletion:</strong> Clicking <strong>&quot;Delete account&quot;</strong> in the
                  Settings panel permanently and irreversibly purges your user profile, all subscription records,
                  Gmail tokens, review candidates, and notification logs from our databases.
                </li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="cookies-and-sessions" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>8.</span>
                <span>Cookies & Authentication</span>
              </h2>
              <p>
                SubTrack uses only strictly essential cookies required to operate our authenticated service:
              </p>
              <ul>
                <li>
                  <code>session_token</code>: Secure, signed JSON Web Token used to authenticate your session across
                  pages. Valid for up to 90 days or until you sign out.
                </li>
                <li>
                  <code>gmail_connection</code>: Sealed credential cookie enabling your browser to synchronize
                  read-only inbox monitoring securely.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> deploy advertising trackers, tracking pixels, behavioral cookies, or
                third-party marketing analytic scripts.
              </p>
            </section>

            {/* Section 9 */}
            <section id="children" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>9.</span>
                <span>Children&apos;s Privacy</span>
              </h2>
              <p>
                SubTrack is not directed to individuals under the age of 16. We do not knowingly collect or solicit
                personal information from children. If we discover that personal data from a child under 16 has been
                collected without verified parental consent, we will promptly purge that information from our records.
              </p>
            </section>

            {/* Section 10 */}
            <section id="updates" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>10.</span>
                <span>Changes to this Privacy Policy</span>
              </h2>
              <p>
                We may periodically update this Privacy Policy to reflect improvements to SubTrack, changes in
                applicable regulations, or newly added features. When revisions occur, we will update the
                &quot;Last Updated&quot; date at the top of this document. Continued use of SubTrack following
                modifications constitutes your acceptance of the revised policy.
              </p>
            </section>

            {/* Section 11 */}
            <section id="contact" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>11.</span>
                <span>Contact Us</span>
              </h2>
              <p>
                If you have questions, feedback, or requests regarding this Privacy Policy or your personal data,
                please contact our privacy team:
              </p>

              <div className={styles.contactCard}>
                <h4>SubTrack Privacy & Legal Support</h4>
                <p>
                  Our team is dedicated to safeguarding your privacy and promptly responding to data requests.
                </p>
                <div className={styles.contactLinks}>
                  <a href="mailto:privacy@subtrack.app" className={styles.contactButton}>
                    <LetterIcon aria-hidden="true" />
                    <span>privacy@subtrack.app</span>
                  </a>
                  <a href="mailto:support@subtrack.app" className={styles.contactButton}>
                    <LetterIcon aria-hidden="true" />
                    <span>support@subtrack.app</span>
                  </a>
                </div>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image
              src="/subtrack-logo-dark.png"
              alt="SubTrack"
              width={1616}
              height={367}
              className={styles.brandLogo}
              style={{ width: 110 }}
            />
            <span className={styles.footerText}>
              © {new Date().getFullYear()} SubTrack. All rights reserved.
            </span>
          </div>

          <div className={styles.footerLinks}>
            <Link href="/terms" className={styles.footerLink}>
              Terms of Service
            </Link>
            <Link href="/dashboard" className={styles.footerLink}>
              Dashboard
            </Link>
            <a href="mailto:support@subtrack.app" className={styles.footerLink}>
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
