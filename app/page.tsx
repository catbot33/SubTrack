import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LockKeyholeMinimalisticIcon, Login3Icon } from '@solar-icons/react/linear';
import { verifySessionToken } from '../Workers/Authentication-JWT.ts';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sessionToken = (await cookies()).get('session_token')?.value;

  if (sessionToken && verifySessionToken(sessionToken)) {
    redirect('/dashboard');
  }

  const { error } = await searchParams;

  return (
    <main className="signin-shell">
      <a className="brand" href="/" aria-label="SubTrack home">
        SubTrack
      </a>

      <section className="signin-content" aria-labelledby="signin-heading">
        <div className="signin-copy">
          <div>
            <h1 id="signin-heading">
              <span className="headline-line">One sign-in.</span>
              <span className="headline-line">Every subscription.</span>
            </h1>
            <p className="intro">
              Track renewals, avoid surprise charges, and take control of your subscriptions—all
              in one place.
            </p>
          </div>

          <div className="auth-actions">
            {error ? (
              <p className="auth-error" role="alert">
                We couldn&apos;t complete your Google sign-in. Please try again.
              </p>
            ) : null}

            <a className="google-button" href="/auth/google">
              <Login3Icon aria-hidden="true" className="auth-icon" />
              <span>Continue with Google</span>
            </a>

            <p className="trust-note">
              <LockKeyholeMinimalisticIcon aria-hidden="true" />
              Secure, private, and read-only access.
            </p>
          </div>
        </div>

        <div className="illustration" aria-hidden="true">
          <Image
            src="/images/subscription-orbit-v2.png"
            alt=""
            width={1254}
            height={1254}
            priority
            sizes="(max-width: 767px) 88vw, 50vw"
          />
        </div>
      </section>

      <footer className="legal">
        <span>By continuing, you agree to our</span>{' '}
        <a href="#terms">Terms of Service</a>
        <span> and </span>
        <a href="#privacy">Privacy Policy</a>.
      </footer>
    </main>
  );
}
