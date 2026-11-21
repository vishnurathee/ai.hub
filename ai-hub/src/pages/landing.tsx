import { useState, type PointerEvent } from "react";
import { Link } from "wouter";
import "@/landing-motion.css";

const features = [
  {
    number: "01",
    title: "Choose a point of view",
    copy: "Move between AI assistants without losing the thread of your work.",
  },
  {
    number: "02",
    title: "Keep the useful parts",
    copy: "Return to recent conversations and pick up where your thinking paused.",
  },
  {
    number: "03",
    title: "Compare the answers",
    copy: "Put perspectives side by side when one response is not enough.",
  },
];

export default function Landing() {
  const [motionPaused, setMotionPaused] = useState(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (motionPaused || event.pointerType === "touch" || window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  };

  const resetPointer = () => setPointer({ x: 0, y: 0 });

  return (
    <main className={`motion-landing${motionPaused ? " motion-paused" : ""}`} id="top">
      <header className="motion-nav">
        <a href="#top" className="motion-brand" aria-label="AI Hub home" data-testid="link-landing-home">
          <span className="motion-brand-mark" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span>AI <b>Hub</b></span>
        </a>
        <div className="motion-nav-right">
          <button
            type="button"
            className="motion-pause"
            onClick={() => setMotionPaused((paused) => !paused)}
            aria-pressed={motionPaused}
            data-testid="button-toggle-motion"
          >
            <span aria-hidden="true">{motionPaused ? "▶" : "Ⅱ"}</span>
            {motionPaused ? "Resume motion" : "Pause motion"}
          </button>
          <nav className="motion-account-nav" aria-label="Account">
            <Link href="/sign-in" data-testid="link-sign-in">Sign in</Link>
            <Link href="/sign-up" className="motion-nav-cta" data-testid="link-create-account">
              Create account <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>

      <section className="motion-hero" aria-labelledby="motion-title">
        <div className="motion-hero-copy">
          <p className="motion-eyebrow"><span /> A QUIETER WAY TO THINK WITH AI</p>
          <h1 id="motion-title">
            One question.<br />
            <span className="motion-headline-accent">Many minds.</span>
          </h1>
          <p className="motion-intro">
            Ask across AI assistants from one focused workspace. Keep the conversation close, then compare perspectives when the question deserves more.
          </p>
          <div className="motion-hero-actions">
            <Link href="/sign-up" className="motion-primary-cta" data-testid="button-landing-create-account">
              Create your account <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/sign-in" className="motion-secondary-cta" data-testid="button-landing-sign-in">
              I already have an account
            </Link>
          </div>
          <p className="motion-note"><span aria-hidden="true">↳</span> Sign in to open your AI Hub workspace.</p>
          <div className="motion-scroll-cue" aria-hidden="true"><span /> SCROLL TO EXPLORE</div>
        </div>

        <div
          className="motion-art"
          role="img"
          aria-label="Abstract illustration of several perspectives flowing into a shared question"
          onPointerMove={trackPointer}
          onPointerLeave={resetPointer}
          style={{ "--pointer-x": pointer.x, "--pointer-y": pointer.y } as React.CSSProperties}
        >
          <div className="motion-art-topline">
            <span>THOUGHT, IN ORBIT</span>
            <span><i /> A SHARED SPACE</span>
          </div>
          <svg className="motion-orbit-svg" viewBox="0 0 620 500" aria-hidden="true">
            <defs>
              <linearGradient id="threadMint" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#00ffc2" />
                <stop offset="1" stopColor="#96f4dd" />
              </linearGradient>
              <linearGradient id="threadInk" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#b9c9c4" />
                <stop offset="1" stopColor="#596762" />
              </linearGradient>
            </defs>
            <g className="motion-orbit-lines" fill="none">
              <ellipse cx="310" cy="246" rx="230" ry="104" transform="rotate(-28 310 246)" />
              <ellipse cx="310" cy="246" rx="191" ry="144" transform="rotate(31 310 246)" />
              <ellipse cx="310" cy="246" rx="143" ry="204" transform="rotate(77 310 246)" />
            </g>
            <path className="motion-flow motion-flow-a" d="M82 100 C190 100 198 193 310 246" />
            <path className="motion-flow motion-flow-b" d="M533 109 C424 113 414 194 310 246" />
            <path className="motion-flow motion-flow-c" d="M145 417 C238 379 223 292 310 246" />
            <path className="motion-flow motion-flow-d" d="M501 409 C397 378 406 293 310 246" />
            <circle className="motion-orbit-point point-a" cx="82" cy="100" r="7" />
            <circle className="motion-orbit-point point-b" cx="533" cy="109" r="7" />
            <circle className="motion-orbit-point point-c" cx="145" cy="417" r="7" />
            <circle className="motion-orbit-point point-d" cx="501" cy="409" r="7" />
            <circle className="motion-node-halo" cx="310" cy="246" r="90" />
            <circle className="motion-node-ring" cx="310" cy="246" r="67" />
            <circle className="motion-node-core" cx="310" cy="246" r="42" />
            <path className="motion-node-glyph" d="M295 247h10l8-14 10 28 8-14h9" />
          </svg>
          <div className="motion-perspective-card card-north">
            <span className="motion-card-index">A / VIEWPOINT</span>
            <span className="motion-card-line line-short" />
            <span className="motion-card-line line-long" />
            <span className="motion-card-line line-mid" />
          </div>
          <div className="motion-perspective-card card-east">
            <span className="motion-card-index">B / VIEWPOINT</span>
            <span className="motion-card-line line-mid" />
            <span className="motion-card-line line-long" />
            <span className="motion-card-line line-short" />
          </div>
          <div className="motion-perspective-card card-south">
            <span className="motion-card-index">C / VIEWPOINT</span>
            <span className="motion-card-line line-long" />
            <span className="motion-card-line line-short" />
            <span className="motion-card-line line-mid" />
          </div>
          <div className="motion-center-label"><b>your question</b><span>the thread between ideas</span></div>
          <p className="motion-art-caption"><span>01—04</span> Perspectives, brought together.</p>
          <span className="motion-art-footnote">ILLUSTRATION ONLY · NOT LIVE PROVIDER OUTPUT</span>
        </div>
        <div className="motion-hero-index" aria-hidden="true">01 <span>—</span> 03</div>
      </section>

      <section className="motion-principle" aria-labelledby="motion-principle-title">
        <div className="motion-principle-index">A BETTER KIND OF TOOL <span>↘</span></div>
        <div className="motion-principle-content">
          <h2 id="motion-principle-title">Less tab juggling.<br /><span>More clear thinking.</span></h2>
          <p>AI Hub keeps your assistants and your conversations in one considered workspace. You decide which perspective to follow.</p>
        </div>
        <div className="motion-principle-orbit" aria-hidden="true"><i /><i /><i /><b>↗</b></div>
      </section>

      <section className="motion-capabilities" aria-label="How AI Hub works">
        <div className="motion-capabilities-heading">
          <p className="motion-eyebrow"><span /> A SIMPLE WAY THROUGH</p>
          <h2>Keep your focus.<br /><em>Widen your view.</em></h2>
        </div>
        <div className="motion-capability-list">
          {features.map((feature, index) => (
            <article className="motion-capability" key={feature.number} style={{ "--item-index": index } as React.CSSProperties}>
              <span className="motion-capability-number">{feature.number}</span>
              <div className="motion-capability-copy">
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </div>
              <span className="motion-capability-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="motion-bottom">
        <div className="motion-bottom-topline"><span>YOUR NEXT QUESTION IS YOURS</span><span>AI HUB / OPEN SPACE</span></div>
        <p className="motion-eyebrow"><span /> READY WHEN YOU ARE</p>
        <div className="motion-bottom-row">
          <h2>Make space<br />for the next idea.</h2>
          <Link href="/sign-up" className="motion-bottom-cta" data-testid="button-bottom-create-account">
            Create an account <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="motion-bottom-graphic" aria-hidden="true"><i /><i /><i /><i /><b /></div>
      </section>

      <footer className="motion-footer">
        <a href="#top" className="motion-brand" aria-label="AI Hub home" data-testid="link-footer-home">
          <span className="motion-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>AI <b>Hub</b></span>
        </a>
        <span>A workspace for thinking with AI.</span>
        <Link href="/sign-in" data-testid="link-footer-sign-in">Sign in <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
