import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  AltArrowLeftIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  LetterIcon,
  LockKeyholeMinimalisticIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@solar-icons/react/linear';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Terms of Service | SubTrack',
  description:
    'Review the terms, conditions, and rules governing your use of the SubTrack subscription tracking and alert platform.',
};

export default function TermsOfServicePage() {
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
              <Link href="/privacy" className={styles.navTab}>
                <ShieldCheckIcon aria-hidden="true" style={{ width: 15, height: 15 }} />
                Privacy Policy
              </Link>
              <span className={`${styles.navTab} ${styles.navTabActive}`}>
                <ScaleIcon aria-hidden="true" style={{ width: 15, height: 15 }} />
                Terms of Service
              </span>
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
            <ScaleIcon aria-hidden="true" />
            <span>Terms & Conditions</span>
          </div>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.lead}>
            These Terms of Service govern your access to and use of SubTrack. Please read these terms
            carefully before creating an account or using our subscription monitoring and notification
            services.
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
            Terms at a Glance
          </h2>
          <div className={styles.highlightsGrid}>
            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <DocumentTextIcon aria-hidden="true" />
              </div>
              <h3>Tracking & Alert Tool</h3>
              <p>
                SubTrack is an organizational platform designed to help you track recurring commitments and
                receive renewal alerts. We are not a payment processor or banking entity.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <ScaleIcon aria-hidden="true" />
              </div>
              <h3>Your Provider Agreements</h3>
              <p>
                You remain solely responsible for managing, paying for, and canceling your subscriptions
                directly with third-party providers. SubTrack does not cancel services for you.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <LockKeyholeMinimalisticIcon aria-hidden="true" />
              </div>
              <h3>Safe & Read-Only</h3>
              <p>
                All inbox integrations operate strictly in read-only mode to find subscription receipts.
                SubTrack will never send emails, modify account settings, or charge credit cards.
              </p>
            </div>

            <div className={styles.highlightCard}>
              <div className={styles.highlightIcon}>
                <UserCircleIcon aria-hidden="true" />
              </div>
              <h3>Delete Data Anytime</h3>
              <p>
                You retain complete control. You can remove subscriptions, pause monitoring, or permanently
                delete your account and all associated records with one click in Settings.
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
                <a href="#acceptance" className={styles.tocLink}>
                  1. Acceptance of Terms
                </a>
              </li>
              <li>
                <a href="#description-of-service" className={styles.tocLink}>
                  2. Description of Service
                </a>
              </li>
              <li>
                <a href="#eligibility" className={styles.tocLink}>
                  3. Eligibility & Registration
                </a>
              </li>
              <li>
                <a href="#acceptable-use" className={styles.tocLink}>
                  4. Acceptable Use & Conduct
                </a>
              </li>
              <li>
                <a href="#third-parties" className={styles.tocLink}>
                  5. Third-Party Integrations
                </a>
              </li>
              <li>
                <a href="#disclaimers-billing" className={styles.tocLink}>
                  6. Subscriptions & Billing
                </a>
              </li>
              <li>
                <a href="#intellectual-property" className={styles.tocLink}>
                  7. Intellectual Property
                </a>
              </li>
              <li>
                <a href="#termination" className={styles.tocLink}>
                  8. Termination & Deletion
                </a>
              </li>
              <li>
                <a href="#warranty-disclaimer" className={styles.tocLink}>
                  9. Warranty Disclaimer
                </a>
              </li>
              <li>
                <a href="#limitation-of-liability" className={styles.tocLink}>
                  10. Limitation of Liability
                </a>
              </li>
              <li>
                <a href="#indemnification" className={styles.tocLink}>
                  11. Indemnification
                </a>
              </li>
              <li>
                <a href="#governing-law" className={styles.tocLink}>
                  12. Governing Law
                </a>
              </li>
              <li>
                <a href="#modifications" className={styles.tocLink}>
                  13. Changes to Terms
                </a>
              </li>
              <li>
                <a href="#contact" className={styles.tocLink}>
                  14. Contact Information
                </a>
              </li>
            </ul>
          </aside>

          {/* Main Prose */}
          <article className={styles.prose}>
            {/* Section 1 */}
            <section id="acceptance" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>1.</span>
                <span>Acceptance of Terms</span>
              </h2>
              <p>
                By signing in with Google, accessing, or using SubTrack (&quot;SubTrack,&quot; &quot;we,&quot; &quot;our,&quot; or
                &quot;us&quot;), you acknowledge that you have read, understood, and agree to be bound by these
                Terms of Service (&quot;Terms&quot;) and our Privacy Policy.
              </p>
              <p>
                If you do not agree to these Terms in their entirety, you must not access or use SubTrack.
              </p>
            </section>

            {/* Section 2 */}
            <section id="description-of-service" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>2.</span>
                <span>Description of Service</span>
              </h2>
              <p>
                SubTrack is a personal software tool developed to assist individuals in managing recurring
                subscription services. SubTrack provides functionalities including:
              </p>
              <ul>
                <li>Manual recording and tracking of recurring subscriptions, amounts, and renewal dates.</li>
                <li>Optional read-only scanning of connected Gmail inboxes to detect recurring billing receipts.</li>
                <li>A unified dashboard summarizing monthly, annual, and category-level expenditures.</li>
                <li>Automated renewal reminders delivered via in-app dashboard views or WhatsApp notifications.</li>
              </ul>
              <p>
                <strong>Important Notice:</strong> SubTrack is strictly an informational and organizational
                aid. SubTrack is <strong>not</strong> a financial institution, credit counselor, payment gateway,
                or subscription cancellation service.
              </p>
            </section>

            {/* Section 3 */}
            <section id="eligibility" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>3.</span>
                <span>Eligibility & Account Registration</span>
              </h2>
              <p>
                To use SubTrack, you must be at least 16 years of age (or the minimum legal age required in your
                jurisdiction to enter into binding agreements).
              </p>
              <ul>
                <li>
                  You authenticate through Google OAuth 2.0. You are responsible for safeguarding your Google account
                  credentials.
                </li>
                <li>
                  You agree to notify us immediately of any unauthorized access or security breach involving your
                  SubTrack account.
                </li>
                <li>
                  You may only connect email accounts and enter phone numbers that you personally own and are authorized
                  to use.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="acceptable-use" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>4.</span>
                <span>Acceptable Use & Conduct</span>
              </h2>
              <p>When using SubTrack, you agree not to:</p>
              <ul>
                <li>Violate any applicable federal, state, local, or international laws or regulations.</li>
                <li>Attempt to decompile, reverse-engineer, disassemble, or extract the source code of SubTrack.</li>
                <li>
                  Interfere with, overload, or compromise the stability, security, or proper operation of SubTrack’s
                  servers or API endpoints.
                </li>
                <li>
                  Employ automated bots, spiders, crawlers, or scrapers to access or extract data from the platform.
                </li>
                <li>
                  Attempt to circumvent authentication systems or access data belonging to another user.
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="third-parties" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>5.</span>
                <span>Third-Party Integrations</span>
              </h2>
              <p>SubTrack integrates with several external platforms to deliver its features:</p>
              <ul>
                <li>
                  <strong>Google Services:</strong> Google Sign-In and the Gmail API are utilized to authenticate users
                  and optionally detect subscription receipts. SubTrack is an independent service and is not affiliated
                  with, endorsed by, or sponsored by Google LLC. Your use of Google accounts is subject to Google&apos;s
                  Terms of Service.
                </li>
                <li>
                  <strong>WhatsApp & Twilio:</strong> WhatsApp reminder delivery relies on third-party messaging
                  infrastructure. We cannot guarantee message delivery in the event of carrier disruptions, phone
                  misconfigurations, or network downtime.
                </li>
                <li>
                  <strong>Exchange Rate Providers:</strong> Multi-currency conversion estimates utilize public exchange
                  rates and are intended as non-binding estimates for informational planning only.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="disclaimers-billing" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>6.</span>
                <span>Subscriptions & Billing Disclaimers</span>
              </h2>
              <div className={styles.callout}>
                <div className={styles.calloutIcon}>
                  <ScaleIcon aria-hidden="true" />
                </div>
                <div className={styles.calloutBody}>
                  <div className={styles.calloutTitle}>Sole Responsibility for Third-Party Subscriptions</div>
                  <p>
                    SubTrack does <strong>not</strong> charge your credit cards for your subscriptions, does{' '}
                    <strong>not</strong> manage merchant billing contracts, and does <strong>not</strong> execute
                    cancellations on your behalf.
                  </p>
                  <p>
                    You remain exclusively responsible for verifying renewal dates, terms, cancellation policies, and
                    initiating cancellations directly with your third-party service providers (such as Netflix, Amazon,
                    Spotify, Apple, etc.).
                  </p>
                </div>
              </div>
              <p>
                While our extraction algorithms aim for high accuracy, automatic email parsing may not detect 100% of
                invoices, or merchants may alter billing schedules without notice. You should never rely solely on
                SubTrack for critical financial obligations.
              </p>
            </section>

            {/* Section 7 */}
            <section id="intellectual-property" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>7.</span>
                <span>Intellectual Property</span>
              </h2>
              <p>
                All original content, interface designs, logos, software algorithms, stylesheets, and documentation
                comprising SubTrack are the exclusive property of SubTrack and are protected by copyright, trademark,
                and applicable intellectual property laws.
              </p>
              <p>
                You retain full ownership and rights in your personal subscription data. You grant SubTrack a limited,
                non-exclusive license to process your data solely for the purpose of delivering the service to you.
              </p>
            </section>

            {/* Section 8 */}
            <section id="termination" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>8.</span>
                <span>Termination & Account Deletion</span>
              </h2>
              <p>
                You may terminate your agreement with SubTrack at any time. Inside the <strong>Settings</strong> panel of
                your dashboard, you may select <strong>&quot;Delete account&quot;</strong>. This action immediately and
                permanently erases your user record, saved subscriptions, Gmail watch connections, and reminder
                schedules.
              </p>
              <p>
                SubTrack reserves the right to suspend or terminate your access to the service at our sole discretion,
                without prior notice, if you breach these Terms or engage in conduct that harms the platform, other users,
                or third parties.
              </p>
            </section>

            {/* Section 9 */}
            <section id="warranty-disclaimer" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>9.</span>
                <span>Warranty Disclaimer</span>
              </h2>
              <p>
                SUBTRACK IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND,
                WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
              </p>
              <p>
                WE EXPRESSLY DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT SUBTRACK WILL BE
                UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE FROM VIRUSES OR DEFECTS.
              </p>
            </section>

            {/* Section 10 */}
            <section id="limitation-of-liability" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>10.</span>
                <span>Limitation of Liability</span>
              </h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SUBTRACK, ITS CREATORS, DIRECTORS,
                OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul>
                <li>Unwanted subscription renewals, automatic charges, or overdraft fees by third-party merchants.</li>
                <li>Failure or delay of email notifications, webhook signals, or WhatsApp reminder messages.</li>
                <li>Loss of profits, goodwill, data, or other intangible losses arising from your use of SubTrack.</li>
              </ul>
              <p>
                IN NO EVENT SHALL OUR TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS ARISING OUT OF THESE TERMS EXCEED THE
                GREATER OF $50 USD OR THE AMOUNT YOU PAID TO SUBTRACK IN THE PAST TWELVE MONTHS.
              </p>
            </section>

            {/* Section 11 */}
            <section id="indemnification" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>11.</span>
                <span>Indemnification</span>
              </h2>
              <p>
                You agree to defend, indemnify, and hold harmless SubTrack, its officers, directors, employees, and agents
                from and against any claims, liabilities, damages, judgments, awards, losses, costs, or expenses
                (including reasonable attorney&apos;s fees) resulting from your violation of these Terms or your use of the
                service.
              </p>
            </section>

            {/* Section 12 */}
            <section id="governing-law" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>12.</span>
                <span>Governing Law & Dispute Resolution</span>
              </h2>
              <p>
                These Terms and any dispute arising out of or related to your use of SubTrack shall be governed by and
                construed in accordance with applicable laws, without regard to conflicts of law provisions.
              </p>
              <p>
                Any formal legal proceedings arising under these Terms shall be instituted exclusively in competent courts
                of competent jurisdiction.
              </p>
            </section>

            {/* Section 13 */}
            <section id="modifications" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>13.</span>
                <span>Changes to these Terms</span>
              </h2>
              <p>
                We reserve the right to amend or update these Terms at any time in our sole discretion. We will indicate
                the date of the latest update at the top of this document.
              </p>
              <p>
                Your continued use of SubTrack after any changes become effective constitutes your acceptance of the
                new Terms. If you do not accept the updated terms, you must discontinue using SubTrack and delete your
                account.
              </p>
            </section>

            {/* Section 14 */}
            <section id="contact" className={styles.section}>
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>14.</span>
                <span>Contact Information</span>
              </h2>
              <p>
                If you have any questions or concerns regarding these Terms of Service, please reach out to our legal
                and support team:
              </p>

              <div className={styles.contactCard}>
                <h4>SubTrack Legal & Operations</h4>
                <p>
                  Questions about our service terms or agreement details? We are here to assist you.
                </p>
                <div className={styles.contactLinks}>
                  <a href="mailto:legal@subtrack.app" className={styles.contactButton}>
                    <LetterIcon aria-hidden="true" />
                    <span>legal@subtrack.app</span>
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
            <Link href="/privacy" className={styles.footerLink}>
              Privacy Policy
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
