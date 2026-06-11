import { ArrowRight, ArrowUpRight } from "lucide-react";
import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { Link } from "react-router";
import { gsap, ScrollTrigger } from "../lib/gsap";
import { getLenis } from "../components/SmoothScroll";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { ErrorBoundary } from "../components/ErrorBoundary";

const HeroScene = lazy(() =>
  import("../components/three/HeroScene").then((m) => ({ default: m.HeroScene })),
);
import { ImageWithFallback } from "../components/custom/ImageWithFallback";
import { ThemeToggle } from "../components/ThemeToggle";
import { IMAGES } from "../lib/images";

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const STAGES = [
  { n: "01", name: "Fetch", tech: "NewsAPI · on-device RSS crawler", desc: "Candidate stories are pulled from the sources you trust." },
  { n: "02", name: "Curate", tech: "gemma4:e4b", desc: "A local model filters for relevance and removes duplicates." },
  { n: "03", name: "Verify", tech: "all-MiniLM-L6-v2", desc: "Semantic similarity cross-corroborates every individual claim." },
  { n: "04", name: "File", tech: ".docx · confidence ledger", desc: "A clean brief is composed, each story scored for trust." },
];

const FEATURES = [
  { n: "01", tag: "Neuzo Pulse", title: "Verification, drawn as a graph", body: "An interactive constellation of sources and articles — nodes sized by reliability, colored by confidence, linked by corroboration. Follow a thread to its origin.", img: IMAGES.press, alt: "Newspaper printing press in motion" },
  { n: "02", tag: "Daily Briefing", title: "The morning edition, composed on-device", body: "Six stories across your categories, each with a two-sentence digest, a 'why it matters' line, and a confidence chip — the full agent trace one tap away.", img: IMAGES.article, alt: "Folded business newspaper" },
  { n: "03", tag: "Bias & Sentiment Lens", title: "Read the room, not just the wire", body: "Per-article sentiment and tone, plus a coverage-balance meter that shows where your sources cluster across the spectrum.", img: IMAGES.pilesBw, alt: "Piles of stacked newspapers" },
  { n: "04", tag: "Report Copilot", title: "Interrogate any report", body: "Ask which story had the weakest corroboration — and watch the agent search, retrieve, and compare sources, step by step, before it answers.", img: IMAGES.bundle, alt: "Bundle of newspapers on a table" },
];

export default function Landing() {
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("neuzo_auth_token");
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const heroProgress = useRef(0);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(el, { offset: -40 });
    else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context((self) => {
      const q = self.selector!;

      /* ---- HERO: pin + scrub the three.js dispersion & headline lift ---- */
      const heroTl = gsap.timeline({
        scrollTrigger: {
          trigger: "#hero",
          start: "top top",
          end: "+=110%",
          pin: true,
          scrub: 0.6,
          onUpdate: (st) => (heroProgress.current = st.progress),
        },
      });
      heroTl
        .to("#hero-head", { yPercent: -22, opacity: 0.15, ease: "none" }, 0)
        .to("#hero-sub", { yPercent: -40, opacity: 0, ease: "none" }, 0)
        .to("#hero-cta", { yPercent: -60, opacity: 0, ease: "none" }, 0)
        .fromTo("#hero-stamp", { scale: 0.4, rotate: -16, opacity: 0 }, { scale: 1, rotate: -8, opacity: 1, ease: "power2.out" }, 0.15);

      // word-by-word entrance on load
      gsap.from(q(".hero-word"), {
        yPercent: 115,
        opacity: 0,
        duration: 1,
        ease: "power4.out",
        stagger: 0.08,
        delay: 0.1,
      });

      /* ---- PROCESS: pinned scrubbed sequence (desktop), stagger (mobile) ---- */
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        gsap.set(".process-line-fill", { scaleX: 0, transformOrigin: "left center" });
        gsap.set(".process-stage", { opacity: 0.25 });
        gsap.set(".process-stage .stage-body", { opacity: 0, y: 14 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: "#process",
            start: "top top",
            end: "+=2600",
            pin: ".process-pin",
            scrub: 0.5,
          },
        });
        tl.to(".process-line-fill", { scaleX: 1, ease: "none" }, 0);
        STAGES.forEach((_, i) => {
          const at = 0.06 + i * 0.23;
          tl.to(`.process-stage[data-i="${i}"]`, { opacity: 1, ease: "none" }, at)
            .to(`.process-stage[data-i="${i}"] .stage-dot`, { backgroundColor: "var(--primary)", scale: 1.25, ease: "none" }, at)
            .to(`.process-stage[data-i="${i}"] .stage-body`, { opacity: 1, y: 0, ease: "power2.out" }, at + 0.02);
        });
      });
      mm.add("(max-width: 767px)", () => {
        gsap.utils.toArray<HTMLElement>(".process-stage").forEach((el, i) => {
          gsap.from(el, {
            opacity: 0,
            x: -24,
            duration: 0.6,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%" },
            delay: (i % 2) * 0.05,
          });
        });
      });

      /* ---- INTERLUDE: photographic parallax ---- */
      gsap.fromTo(
        "#interlude-img",
        { yPercent: -14 },
        { yPercent: 14, ease: "none", scrollTrigger: { trigger: "#interlude", start: "top bottom", end: "bottom top", scrub: true } },
      );
      gsap.from("#interlude-quote", {
        opacity: 0,
        y: 30,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: "#interlude-quote", start: "top 80%" },
      });

      /* ---- FEATURES: image parallax + masked headline reveal ---- */
      q(".feat").forEach((feat: Element) => {
        const img = feat.querySelector(".feat-img");
        if (img) {
          gsap.fromTo(
            img,
            { yPercent: -12, scale: 1.12 },
            { yPercent: 12, scale: 1.12, ease: "none", scrollTrigger: { trigger: feat, start: "top bottom", end: "bottom top", scrub: true } },
          );
        }
        const lines = feat.querySelectorAll(".feat-reveal");
        gsap.from(lines, {
          yPercent: 120,
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.08,
          scrollTrigger: { trigger: feat, start: "top 72%" },
        });
      });

      /* ---- STATS: count up on enter ---- */
      q(".stat-num").forEach((el: Element) => {
        const target = Number(el.getAttribute("data-to"));
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
          onUpdate: () => ((el as HTMLElement).textContent = String(Math.round(obj.v))),
        });
      });
    }, root);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <div ref={root} className="relative bg-background text-foreground">
      {/* MASTHEAD */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3 sm:px-8">
          <Link to="/" className="font-display text-2xl font-black tracking-tight">
            Neuzo
          </Link>
          <span className="kicker hidden sm:block">The Verified Press</span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button onClick={() => goTo("process")} className="hidden text-sm hover:text-primary md:block">
              How it works
            </button>
            <ThemeToggle />
            <Link
              to={hasToken ? "/app" : "/auth"}
              className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open Neuzo
            </Link>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-1.5 sm:px-8">
            <span className="kicker">Vol. MMXXVI · No. 01</span>
            <span className="kicker hidden sm:block">{TODAY}</span>
            <span className="kicker">Runs on your machine</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="hero" className="relative flex min-h-screen items-center overflow-hidden pt-28">
        <ErrorBoundary fallback={<div />}>
          <Suspense fallback={null}>
            <HeroScene progressRef={heroProgress} className="pointer-events-none absolute inset-0 opacity-90" />
          </Suspense>
        </ErrorBoundary>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <div className="max-w-4xl">
            <p className="kicker mb-5">Agentic news verification</p>
            <h1
              id="hero-head"
              className="font-display font-black leading-[0.92] tracking-[-0.02em]"
              style={{ fontSize: "clamp(3rem, 11vw, 9rem)" }}
            >
              <span className="block overflow-hidden">
                <span className="hero-word inline-block">News you</span>
              </span>
              <span className="block overflow-hidden">
                <span className="hero-word inline-block italic text-primary" style={{ fontFamily: "var(--font-display)" }}>
                  can verify.
                </span>
              </span>
            </h1>
            <p id="hero-sub" className="mt-7 max-w-xl text-lg text-muted-foreground text-balance sm:text-xl">
              Neuzo fetches, curates with a local model, and cross-checks every claim with
              semantic similarity — then files a brief with confidence scores you can defend.
            </p>
            <div id="hero-cta" className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to={hasToken ? "/app" : "/auth"}
                className="group inline-flex items-center gap-2 rounded-sm bg-primary px-7 py-3.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open Neuzo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button
                onClick={() => goTo("process")}
                className="inline-flex items-center gap-2 rounded-sm border border-foreground/30 px-7 py-3.5 font-medium hover:border-primary hover:text-primary"
              >
                How it works
              </button>
            </div>
          </div>
        </div>

        {/* rotating verification stamp */}
        <div
          id="hero-stamp"
          className="pointer-events-none absolute bottom-10 right-6 hidden h-28 w-28 place-items-center rounded-full border-2 border-primary text-center md:grid"
          style={{ opacity: reduced ? 1 : 0 }}
        >
          <div className="font-mono text-[10px] uppercase leading-tight tracking-widest text-primary">
            Cross<br />verified<br />✦
          </div>
        </div>
      </section>

      {/* PROCESS — pinned scrubbed sequence */}
      <section id="process" className="relative bg-secondary/40">
        <div className="process-pin mx-auto flex min-h-screen max-w-[1400px] flex-col justify-center px-5 py-20 sm:px-8">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="kicker mb-3">The pipeline</p>
              <h2 className="font-display font-black leading-[0.95] tracking-[-0.02em]" style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}>
                Four agents.<br />One verified brief.
              </h2>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              Scroll to follow a story from raw wire to filed report — each stage handed off to the next.
            </p>
          </div>

          {/* connector line */}
          <div className="relative mb-8 hidden h-px bg-border md:block">
            <div className="process-line-fill absolute inset-0 h-px bg-primary" />
          </div>

          <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-4">
            {STAGES.map((s, i) => (
              <div key={s.n} data-i={i} className="process-stage bg-background p-6">
                <div className="flex items-center gap-3">
                  <span className="stage-dot inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                  <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold">{s.name}</h3>
                <div className="stage-body">
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                  <p className="mt-4 font-mono text-xs text-primary">{s.tech}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERLUDE — full-bleed photographic parallax */}
      <section id="interlude" className="relative h-[80vh] overflow-hidden">
        <ImageWithFallback
          src={IMAGES.shelf}
          alt="A long row of printed newspapers on a rack"
          id="interlude-img"
          className="absolute inset-0 h-[120%] w-full object-cover"
        />
        <div className="absolute inset-0 bg-foreground/60" />
        <div className="relative mx-auto flex h-full max-w-[1400px] items-center px-5 sm:px-8">
          <blockquote id="interlude-quote" className="max-w-3xl">
            <p className="kicker mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>
              The Neuzo principle
            </p>
            <p
              className="font-display font-medium leading-[1.05] tracking-[-0.01em] text-balance"
              style={{ fontSize: "clamp(1.8rem, 4.5vw, 3.6rem)", color: "#faf7f0" }}
            >
              &ldquo;Every claim, cross-checked against the record. Every score, earned — never asserted.&rdquo;
            </p>
          </blockquote>
        </div>
      </section>

      {/* FEATURES — editorial spreads */}
      <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8">
        <div className="double-rule mb-16 py-3 text-center">
          <p className="kicker">Inside this edition</p>
        </div>
        <div className="space-y-28">
          {FEATURES.map((f, i) => {
            const flip = i % 2 === 1;
            return (
              <article key={f.n} className="feat grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <div className={`relative aspect-[5/4] overflow-hidden bg-secondary ${flip ? "lg:order-2" : ""}`}>
                  <ImageWithFallback src={f.img} alt={f.alt} className="feat-img absolute inset-0 h-full w-full object-cover grayscale" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-foreground/10" />
                  <span className="absolute left-4 top-4 bg-primary px-2 py-1 font-mono text-xs text-primary-foreground">
                    {f.n}
                  </span>
                </div>
                <div className={flip ? "lg:order-1" : ""}>
                  <p className="kicker mb-4">{f.tag}</p>
                  <h3 className="font-display font-bold leading-[1.02] tracking-[-0.02em]" style={{ fontSize: "clamp(1.8rem, 3.6vw, 3rem)" }}>
                    <span className="block overflow-hidden">
                      <span className="feat-reveal inline-block">{f.title}</span>
                    </span>
                  </h3>
                  <p className="mt-5 max-w-md text-muted-foreground text-balance">{f.body}</p>
                  <Link to={hasToken ? "/app" : "/auth"} className="ink-link mt-6 inline-flex items-center gap-1 text-sm font-medium">
                    See it in the app <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* STATS LEDGER */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-border md:grid-cols-4">
          {[
            { to: 8, suffix: "+", label: "Curated sources" },
            { to: 12, suffix: "", label: "News categories" },
            { to: 100, suffix: "%", label: "On-device verify" },
            { to: 0, suffix: "", label: "API keys (crawler)" },
          ].map((s) => (
            <div key={s.label} className="bg-background px-6 py-12 text-center">
              <div className="font-display font-black tracking-tight text-primary" style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}>
                <span className="stat-num" data-to={s.to}>
                  {reduced ? s.to : 0}
                </span>
                {s.suffix}
              </div>
              <div className="kicker mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER MASTHEAD */}
      <footer className="mx-auto max-w-[1400px] px-5 py-16 text-center sm:px-8">
        <div className="font-display text-5xl font-black tracking-tight sm:text-7xl">Neuzo</div>
        <p className="kicker mt-4">The Verified Press · Runs entirely on your machine</p>
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-6 text-sm text-muted-foreground">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-primary">GitHub ↗</a>
          <Link to="/auth" className="hover:text-primary">Sign in</Link>
          <button onClick={() => { const l = getLenis(); l ? l.scrollTo(0) : window.scrollTo({ top: 0 }); }} className="hover:text-primary">
            Back to top
          </button>
        </div>
      </footer>
    </div>
  );
}
