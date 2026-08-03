import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { REPO_URL, STUDIO } from "@/lib/brand";

/**
 * The bottom of the public pages: what this is, where the source lives, and
 * who builds it — in that order, on as few lines as it takes.
 *
 * It used to be two stacked blocks, a product one and a studio one, each with
 * its own heading and its own set of links. Two footers, effectively, and the
 * second one repeated what the first had already said: GitHub appeared twice,
 * the MIT licence twice, the studio URL twice. A footer is a place to leave,
 * not a second page — so it's one row of links and one line of small print.
 */
export default function SiteFooter() {
  return (
    <footer className="relative border-t border-white/8 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-xs text-muted">
              Self-hosted listening rooms. MIT licensed.
            </p>
          </div>

          <nav
            className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted"
            aria-label="Footer"
          >
            <FooterLink href={REPO_URL} external>
              GitHub
            </FooterLink>
            <FooterLink href={`${REPO_URL}/blob/main/DEPLOY.md`} external>
              Self-host guide
            </FooterLink>
            <FooterLink href={`${REPO_URL}/issues`} external>
              Report an issue
            </FooterLink>
            <FooterLink href="/admin">Server settings</FooterLink>
          </nav>
        </div>

        <p className="mt-8 border-t border-white/6 pt-5 text-[11px] text-muted/60">
          © {new Date().getFullYear()} Syncwave · Built by{" "}
          <a
            href={STUDIO.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold tracking-[0.14em] text-muted transition-colors duration-200 ease-[var(--ease)] hover:text-ink"
          >
            {STUDIO.name}
          </a>{" "}
          ·{" "}
          <a
            href={`mailto:${STUDIO.email}`}
            className="transition-colors duration-200 ease-[var(--ease)] hover:text-ink"
          >
            {STUDIO.email}
          </a>{" "}
          · Audio is resolved by this server from sources you supply.
        </p>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className = "transition-colors duration-200 ease-[var(--ease)] hover:text-ink";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
