import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/LegalPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "Privacy Policy",
  "What Track My Roadmap collects when you sign in, how it is used and stored, and how to delete it.",
  "/privacy",
);

const CONTACT = "trackmyroadmap@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="13 November 2026">
      <p>
        Track My Roadmap (“we”, “the site”) at trackmyroadmap.com helps you follow tech career roadmaps and keep daily
        habits. This page explains what we collect, why, and the choices you have. In short: we keep only what the site
        needs to save your progress, we don’t show ads, and we never sell your data.
      </p>

      <Section title="What we collect">
        <ul>
          <li>
            <b>Your Google account basics</b>, when you sign in with Google: your name, email address and profile
            photo. We don’t get your Google password or access to anything else in your Google account.
          </li>
          <li>
            <b>Your progress</b>: which roadmap topics you tick off, and your habit tracker (habits, daily check-ins
            and notes).
          </li>
          <li>
            <b>Feedback you send us</b>: your message, an optional rating, and the page you sent it from, linked to
            your account so we can follow up.
          </li>
          <li>
            <b>A copy on your device</b>: the site keeps your progress in your browser’s local storage, so it works
            offline and loads quickly.
          </li>
        </ul>
        <p>We don’t use advertising, analytics or tracking cookies. The only cookies we set keep you signed in.</p>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To sign you in and save your progress to your account, so it’s on every device you use.</li>
          <li>To show your name and photo on your account page.</li>
          <li>To contact you about your account, only if you write to us first.</li>
        </ul>
      </Section>

      <Section title="Sharing">
        <p>
          We don’t sell, rent or trade your information. Your progress is private to your account: other users can’t
          see it. It is only shared if you create a <b>Road Card</b> link yourself: that link shows your name, photo
          and a summary of your progress to anyone you give it to.
        </p>
        <p>
          Recommended videos open on YouTube, which is run by Google under its own{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.
        </p>
      </Section>

      <Section title="Who can see it on our side">
        <p>
          The site’s administrators can see your name, email, photo, when you joined and were last active, and your
          roadmap progress, so they can run the service, fix problems, and decide which topics need better learning
          material. They don’t see your Google password, and they don’t share or sell what they see.
        </p>
      </Section>

      <Section title="Where it is stored">
        <p>
          Your account and progress are stored with <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>{" "}
          (database and sign-in), and the site is hosted on <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a>.
          Both process data only to run the service for us. Data is sent over encrypted connections (HTTPS), and the
          database only lets each person read and change their own progress.
        </p>
      </Section>

      <Section title="Keeping and deleting your data">
        <p>
          We keep your data while you have an account. You can clear your progress at any time from a roadmap’s
          settings. To delete your account and everything stored with it, email{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you sign in with, and we’ll delete it within
          30 days. Signing out also clears the copy kept on that device.
        </p>
      </Section>

      <Section title="Google user data">
        <p>
          Track My Roadmap’s use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We only request your basic profile (name, email and photo) to
          sign you in.
        </p>
      </Section>

      <Section title="Children">
        <p>The site is meant for people aged 13 and over. We don’t knowingly collect data from younger children.</p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If we change this policy, we’ll update the date at the top. Questions? Email{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
