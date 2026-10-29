import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, LEGAL_UPDATED, type LegalDoc } from "@/lib/legal";
import { Logo } from "@/components/ui";

type Params = { params: Promise<{ doc: string }> };

function getDoc(slug: string): LegalDoc | undefined {
  return Object.hasOwn(LEGAL_DOCS, slug) ? LEGAL_DOCS[slug as LegalDoc["slug"]] : undefined;
}

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const doc = getDoc((await params).doc);
  return { title: doc ? `${doc.title} — TryAnything` : "Not found" };
}

export default async function LegalPage({ params }: Params) {
  const doc = getDoc((await params).doc);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-[680px] px-4 pb-16 pt-[max(20px,env(safe-area-inset-top))] sm:pt-10">
      <div className="mb-10 flex items-center justify-between">
        <Link href="/" aria-label="Back to TryAnything">
          <Logo />
        </Link>
        <nav className="flex gap-4 text-[12px] text-muted">
          {Object.values(LEGAL_DOCS).map((d) => (
            <Link key={d.slug} href={`/legal/${d.slug}`} className={d.slug === doc.slug ? "text-fg underline underline-offset-2" : "hover:text-fg"}>
              {d.title.replace(" of Service", "").replace("Acceptable Use Policy", "Use policy")}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mb-3 text-[13px] text-muted">Last updated {LEGAL_UPDATED}</p>
      <h1 className="mb-5 text-[30px] font-semibold leading-tight tracking-tight">{doc.title}</h1>
      <p className="mb-10 rounded-md border border-line bg-surface p-4 text-[15px] leading-relaxed">
        <span className="font-semibold">In short: </span>
        {doc.summary}
      </p>

      <div className="space-y-9">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-3 text-[17px] font-semibold">{s.heading}</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-fg/80">
              {s.blocks.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i}>{b}</p>
                ) : (
                  <ul key={i} className="space-y-2">
                    {b.list.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-fg" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
