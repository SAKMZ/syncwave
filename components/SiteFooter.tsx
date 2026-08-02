import Link from "next/link";
import { Github, Mail, Globe } from "lucide-react";
import MadeWithLove from "@/components/MadeWithLove";
import { Wordmark } from "@/components/Logo";
import { REPO_URL, STUDIO } from "@/lib/brand";

/**
 * The bottom of the public pages: what this is, where the source lives, and
 * who builds it.
 *
 * Deliberately quiet. Everything above it is the product; a studio credit that
 * competes with the product for attention reads as an advert rather than an
 * authorship. Same tokens as everything else — no new colours, one accent, and
 * the studio mark sits in `--ink` rather than the brand ramp so it stays a
 * signature instead of a second call to action.
 */
export default function SiteFooter() {
  return (
    <footer className="relative border-t border-white/8 px-6 py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Product */}
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Self-hosted listening rooms. Open source under the MIT licence — run it, fork
              it, keep it.
            </p>
            <MadeWithLove className="mt-5 max-w-sm" />
          </div>

          {/* Links */}
          <nav className="flex gap-10 text-sm sm:gap-14" aria-label="Footer">
            <div>
              <h2 className="sw-label mb-4">Project</h2>
              <ul className="space-y-2.5">
                <li>
                  <FooterLink href={REPO_URL} external>
                    Source on GitHub
                  </FooterLink>
                </li>
                <li>
                  <FooterLink href={`${REPO_URL}/blob/main/DEPLOY.md`} external>
                    Self-host guide
                  </FooterLink>
                </li>
                <li>
                  <FooterLink href={`${REPO_URL}/issues`} external>
                    Report an issue
                  </FooterLink>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="sw-label mb-4">This server</h2>
              <ul className="space-y-2.5">
                <li>
                  <FooterLink href="/admin">Server settings</FooterLink>
                </li>
                <li>
                  <FooterLink href="/setup">First-run setup</FooterLink>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* Studio */}
        <div className="flex flex-col gap-6 border-t border-white/6 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] text-muted/70 uppercase">
              Built by
            </p>
            <a
              href={STUDIO.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-baseline gap-2 text-lg font-extrabold tracking-[0.26em] text-ink transition-opacity duration-200 ease-[var(--ease)] hover:opacity-70"
            >
              {STUDIO.name}
            </a>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
              A development studio. We build software that runs on the machines of the
              people who use it.
            </p>
          </div>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <li>
              <a
                href={`mailto:${STUDIO.email}`}
                className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-[var(--ease)] hover:text-ink"
              >
                <Mail className="size-3.5" aria-hidden />
                {STUDIO.email}
              </a>
            </li>
            <li>
              <a
                href={STUDIO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-[var(--ease)] hover:text-ink"
              >
                <Globe className="size-3.5" aria-hidden />
                {STUDIO.url.replace(/^https?:\/\//, "")}
              </a>
            </li>
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-[var(--ease)] hover:text-ink"
              >
                <Github className="size-3.5" aria-hidden />
                GitHub
              </a>
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-muted/60">
          © {new Date().getFullYear()} {STUDIO.name} · Syncwave is MIT licensed · Audio is
          resolved by this server from sources you supply.
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
  const className =
    "text-muted transition-colors duration-200 ease-[var(--ease)] hover:text-ink";
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
