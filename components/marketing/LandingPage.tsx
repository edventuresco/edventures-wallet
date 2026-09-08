import Image from "next/image";
import Link from "next/link";
import { LANDING } from "@/lib/marketing/copy";
import { appHref, EDVENTURES_URL } from "@/lib/marketing/links";
import { WaitlistForm } from "./WaitlistForm";

/**
 * The public front of Edventures Wallet, per docs/design/EDVENTURES-WALLET-
 * WAITLIST-BUILD-GUIDE.md: one audience (the parent), one primary action
 * (join the waitlist), one secondary (explore Edventures). Served at / when
 * signed out and, through a rewrite, at edventures.co/wallet. Adult palette.
 */

const BENEFITS = [
  { title: "Save together", body: "Fund goals everyone can see.", art: "/illustrations/benefit-save-together.png" },
  { title: "Grow their future", body: "Automate allowances and savings.", art: "/illustrations/benefit-grow-future.png" },
  { title: "Learn safely", body: "Practice before money moves.", art: "/illustrations/benefit-learn-safely.png" },
];

const STEPS = [
  { label: "Join", body: "Get on the waitlist." },
  { label: "Set up", body: "Add your family." },
  { label: "Choose", body: "Create your rules." },
  { label: "Grow", body: "Save and learn." },
];

const PROOF = ["Parent permissions", "Guided learning", "No trading clutter"];

const cta = "inline-flex min-h-[54px] items-center justify-center rounded-2xl bg-terracotta px-7 text-lg font-semibold text-white hover:bg-terracotta-dark active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-terracotta/40";
const quiet = "inline-flex min-h-[54px] items-center justify-center whitespace-nowrap rounded-2xl border border-forest/30 px-7 text-lg font-semibold text-forest hover:bg-forest/5";

export function LandingPage() {
  return (
    <div className="bg-sand text-ink">
      <header className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 md:px-12">
        <Wordmark />
        <nav aria-label="Site" className="flex items-center gap-5 text-sm font-semibold text-forest">
          <a href="#how-it-works" className="hidden md:inline">
            How it works
          </a>
          <a href={EDVENTURES_URL} className="hidden md:inline">
            Explore Edventures
          </a>
          <Link href={appHref("/login")} className="rounded-xl border border-forest/30 px-4 py-2">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-6 md:min-h-[640px] md:grid-cols-[46%_54%] md:px-12 md:pb-20">
          <div className="max-w-[650px] space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-light">{LANDING.tagline}</p>
            <h1 className="font-display text-[45px] font-semibold leading-[1.05] text-forest md:text-[72px]">{LANDING.headline}</h1>
            <p className="max-w-[620px] text-lg leading-relaxed text-ink/80 md:text-xl">{LANDING.subhead}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#waitlist" className={`${cta} sm:min-w-[300px]`}>
                Join the waitlist
              </a>
              <a href={EDVENTURES_URL} className={quiet}>
                Explore Edventures
              </a>
            </div>
            <p className="text-sm text-ink/60">{LANDING.betaNote}</p>
          </div>
          <Image src="/illustrations/hero-phone-cluster.png" alt="Three phone screens of Edventures Wallet: a family balance, a savings goal called Japan together, and a kid's fund" width={1536} height={1024} priority sizes="(min-width: 768px) 54vw, 100vw" className="h-auto w-full object-contain" />
        </section>

        <section aria-labelledby="benefits-heading" className="mx-auto max-w-6xl px-5 py-14 md:px-12 md:py-24">
          <h2 id="benefits-heading" className="font-display text-[32px] font-semibold leading-tight text-forest md:text-[42px]">
            Built for real family money
          </h2>
          <ul className="mt-6 grid gap-4 md:mt-10 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-center gap-4 rounded-[22px] bg-white p-4 shadow-[0_14px_40px_rgb(34_31_26/8%)] md:flex-col md:items-start md:p-6">
                <Image src={b.art} alt="" width={1254} height={1254} sizes="(min-width: 768px) 30vw, 64px" className="h-16 w-16 shrink-0 object-contain md:h-auto md:w-full" />
                <div>
                  <h3 className="text-xl font-semibold text-forest md:text-2xl">{b.title}</h3>
                  <p className="text-ink/75 md:text-lg">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="how-it-works" aria-labelledby="steps-heading" className="bg-forest text-white">
          <div className="mx-auto max-w-6xl px-5 py-14 md:px-12 md:py-20">
            <h2 id="steps-heading" className="font-display text-[32px] font-semibold leading-tight md:text-[42px]">
              Four small steps
            </h2>
            <ol className="mt-6 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-4 md:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.label} className="rounded-2xl bg-white/10 p-4 md:bg-transparent md:p-0">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand text-sm font-bold text-forest">{i + 1}</span>
                  <p className="mt-2 text-lg font-semibold">{s.label}</p>
                  <p className="text-white/80">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[30%_70%] md:px-12 md:py-24">
          <Image src="/illustrations/family-path-wallet.png" alt="" width={1156} height={1361} sizes="(min-width: 768px) 30vw, 60vw" className="mx-auto h-auto w-48 rounded-full object-contain md:w-full" />
          <div className="space-y-4">
            <h2 id="trust-heading" className="font-display text-[32px] font-semibold leading-tight text-forest md:text-[42px]">
              Built by a parent, educator, and web3 builder.
            </h2>
            <p className="max-w-[620px] text-lg text-ink/80">Edventures Wallet makes digital money feel useful, human, and safe.</p>
            <ul className="flex flex-wrap gap-2">
              {PROOF.map((chip) => (
                <li key={chip} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-forest ring-1 ring-sand-dark">
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="waitlist" aria-labelledby="offer-heading" className="mx-auto max-w-6xl px-5 pb-16 md:px-12 md:pb-24">
          <div className="grid gap-8 rounded-[22px] bg-white p-6 shadow-[0_14px_40px_rgb(34_31_26/8%)] md:grid-cols-2 md:p-10">
            <div className="space-y-4">
              <h2 id="offer-heading" className="font-display text-[32px] font-semibold leading-tight text-forest md:text-[42px]">
                Be a founding family.
              </h2>
              <p className="text-lg text-ink/80">Get priority access and help shape Edventures Wallet.</p>
              <ul className="space-y-2 text-ink/85">
                {["Early testing access", "Founding-family updates", "A say in what we build next"].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-terracotta text-xs font-bold text-white">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <Image src="/illustrations/founding-family-stamp.svg" alt="" width={512} height={512} unoptimized className="hidden h-40 w-40 object-contain md:block" />
            </div>
            <WaitlistForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-sand-dark">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-12">
          <div className="flex items-center gap-3">
            <Wordmark />
            <p className="text-sm text-ink/60">{LANDING.tagline}</p>
          </div>
          <nav aria-label="Footer" className="flex gap-5 text-sm font-semibold text-forest">
            <a href={EDVENTURES_URL}>Explore Edventures</a>
            <Link href={appHref("/login")}>Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <Image src="/illustrations/edventures-wallet-leaf-mark.png" alt="" width={1312} height={1199} sizes="32px" className="h-8 w-8 object-contain" />
      <span className="font-display text-2xl font-semibold text-forest">Edventures Wallet</span>
    </span>
  );
}
