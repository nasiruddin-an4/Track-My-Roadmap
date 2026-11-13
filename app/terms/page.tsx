import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/LegalPage";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "Terms of Service",
  "The terms for using Track My Roadmap: free roadmaps, progress tracking and a habit tracker.",
  "/terms",
);

const CONTACT = "trackmyroadmap@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="13 November 2026">
      <p>
        By using Track My Roadmap at trackmyroadmap.com, you agree to these terms. If you don’t agree, please don’t use
        the site.
      </p>

      <Section title="The service">
        <p>
          Track My Roadmap is a free tool for following learning roadmaps, ticking off topics and keeping daily habits.
          Roadmaps and recommended videos are guidance for self-study, not a guarantee of any job, grade or result.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You sign in with Google and are responsible for activity on your account.</li>
          <li>You must be at least 13 years old to use the site.</li>
          <li>Don’t misuse the site: no attempts to break it, overload it, or reach other people’s data.</li>
        </ul>
      </Section>

      <Section title="Content and links">
        <p>
          Roadmap content is provided as is. Recommended videos belong to their creators and are hosted on YouTube; we
          link to them but don’t control them. Road Card links you share are your choice and show what’s on the card.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          We aim to keep the site running and your progress safe, but the service is provided “as is”, without
          warranties, and may change or pause at times. To the extent the law allows, we aren’t liable for losses from
          using the site.
        </p>
      </Section>

      <Section title="Ending use">
        <p>
          You can stop using the site at any time and ask us to delete your account (see the{" "}
          <Link href="/privacy">Privacy Policy</Link>). We may suspend accounts that misuse the service.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update these terms and will change the date at the top when we do. Questions? Email{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
