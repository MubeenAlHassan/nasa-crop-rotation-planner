'use client';

import { useEffect } from 'react';
import { ArrowRight, ArrowUpRight, Globe2, Leaf, Satellite, Sprout, Wheat } from 'lucide-react';

const steps = [
  {
    icon: Globe2,
    n: '01',
    title: 'Understand your context',
    body: 'Bring historical weather together with crop calendars, soil assumptions and the realities of your farm.',
  },
  {
    icon: Wheat,
    n: '02',
    title: 'Compare your possibilities',
    body: 'Evaluate your current rotation and three alternatives against the same weather record and your priorities.',
  },
  {
    icon: Leaf,
    n: '03',
    title: 'Know what could change',
    body: 'Test drier seasons, different prices and uncertain soil capacity. Find the next question worth answering.',
  },
] as const;

export default function Landing() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.ra-reveal'));
    if (!nodes.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('ra-revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('ra-revealed');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ra-app ra-landing">
      <header className="ra-landing-header">
        <a href="/" className="ra-brand">
          <span className="ra-brand-icon">
            <Sprout size={28} />
          </span>
          <span>
            rotation<span className="ra-brand-light">atlas</span>
            <small>ROOTED IN EARTH. INFORMED BY SPACE.</small>
          </span>
        </a>
        <nav>
          <a href="#approach">Our approach</a>
          <a href="/atlas">Explore the evidence</a>
        </nav>
        <a href="/atlas" className="ra-button ra-button-primary ra-button-motion">
          Enter the field <ArrowUpRight size={16} />
        </a>
      </header>

      <main>
        <section className="ra-landing-hero">
          <div className="ra-landing-copy">
            <p className="ra-eyebrow ra-anim ra-anim-1">
              <Satellite size={16} className="ra-eyebrow-sat" /> EARTH OBSERVATIONS. EVERYDAY DECISIONS.
            </p>
            <h1 className="ra-anim ra-anim-2">
              The next chapter
              <br />
              of your field
              <br />
              starts <em>here.</em>
            </h1>
            <p className="ra-anim ra-anim-3">
              Every rotation is a tradeoff. Explore what a different crop could mean for your water, your soil and
              your livelihood—with the evidence in view.
            </p>
            <div className="ra-landing-actions ra-anim ra-anim-4">
              <a className="ra-button ra-button-primary ra-button-motion" href="/atlas">
                Explore the Iowa demonstration <ArrowRight size={18} />
              </a>
              <span>One field. Four possibilities.</span>
            </div>
            <div className="ra-landing-proof ra-anim ra-anim-5">
              <Satellite size={20} className="ra-proof-sat" />
              <span>
                Built with NASA POWER open data
                <small>12 years of historical weather · transparent model assumptions</small>
              </span>
            </div>
          </div>

          <div className="ra-landscape ra-anim ra-anim-6" aria-label="Illustrated farmland, not satellite imagery">
            <svg viewBox="0 0 600 640" role="img">
              <title>Illustrative farming landscape connecting satellite observation to crop decisions</title>
              <defs>
                <pattern id="rows" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                  <path d="M0 0V12" stroke="#edf2d5" strokeWidth="2" opacity=".45" />
                </pattern>
                <linearGradient id="sky" x2="0" y2="1">
                  <stop stopColor="#e2e7d3" />
                  <stop offset="1" stopColor="#f4efd7" />
                </linearGradient>
                <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#6f8f6444" />
                  <stop offset="1" stopColor="#6f8f6400" />
                </linearGradient>
              </defs>
              <rect width="600" height="640" rx="20" fill="url(#sky)" />
              <circle className="ra-sun" cx="430" cy="140" r="65" fill="#f5f3d8" />
              <path className="ra-field-rise" d="M0 350Q210 230 600 340V640H0Z" fill="#b3c699" />
              <path className="ra-field-rise ra-field-delay-1" d="M0 430L220 310L420 430L170 640H0Z" fill="#8ca575" />
              <path className="ra-field-rise ra-field-delay-2" d="M230 315L600 350V510L430 440Z" fill="#d4c68d" />
              <path className="ra-field-rise ra-field-delay-3" d="M180 640L440 445L600 530V640Z" fill="#4c7050" />
              <path d="M0 430L220 310L420 430L170 640H0Z" fill="url(#rows)" />
              <path d="M180 640L440 445L600 530V640Z" fill="url(#rows)" />
              <path d="M225 310L430 437L600 520M430 437L170 640" stroke="#efebcf" strokeWidth="12" fill="none" />
              <path d="M0 400Q100 395 125 450T110 640" fill="none" stroke="#809f95" strokeWidth="17" />

              <g className="ra-orbit-track" aria-hidden>
                <path d="M80 120C180 40 420 40 540 130" fill="none" stroke="#56745c33" strokeWidth="1.5" strokeDasharray="4 8" />
              </g>

              <g className="ra-sat-flight">
                <path className="ra-sat-beam" d="M0 18L-28 170L28 170Z" fill="url(#beam)" />
                <g className="ra-sat-body">
                  <rect x="-18" y="-8" width="14" height="16" rx="2" fill="#5f7d58" />
                  <rect x="4" y="-8" width="14" height="16" rx="2" fill="#5f7d58" />
                  <rect x="-6" y="-10" width="12" height="20" rx="3" fill="#49694d" />
                  <circle cx="0" cy="0" r="3" fill="#dce8c8" />
                  <path d="M-22 -2H-18M18 -2H22" stroke="#76906a" strokeWidth="2" />
                </g>
              </g>

              <path className="ra-signal-pulse" d="M442 151L340 330" stroke="#76906a" strokeDasharray="5 7" opacity=".45" />
              <path className="ra-signal-pulse ra-signal-delay" d="M451 155L500 350" stroke="#76906a" strokeDasharray="5 7" opacity=".45" />
              <text x="30" y="608" fontSize="11" fill="#eff3dc" letterSpacing="2">
                A GLOBAL PERSPECTIVE. A LOCAL DECISION.
              </text>
            </svg>
            <div className="ra-landscape-card">
              <span>
                <Leaf size={16} /> A QUESTION WORTH ASKING
              </span>
              <strong>
                What would change
                <br />
                your recommendation?
              </strong>
              <p>Explore the conditions where another rotation becomes the better fit.</p>
              <a href="/atlas">
                See the possibilities <ArrowUpRight size={16} />
              </a>
            </div>
            <span className="ra-landscape-label">Concept illustration · not observed field imagery</span>
          </div>
        </section>

        <section id="approach" className="ra-landing-steps">
          <div className="ra-reveal" style={{ ['--ra-delay' as string]: '0ms' }}>
            <p className="ra-eyebrow">FROM ORBIT TO OPPORTUNITY</p>
            <h2>Make the tradeoffs visible.</h2>
            <p>Support for a conversation with your local adviser, with room for what the data cannot tell us.</p>
          </div>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article
                key={step.n}
                className="ra-reveal ra-step-card"
                style={{ ['--ra-delay' as string]: `${100 + index * 110}ms` }}
              >
                <span>
                  <Icon size={26} />
                  <small>{step.n}</small>
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </section>

        <section className="ra-landing-bottom ra-reveal" style={{ ['--ra-delay' as string]: '60ms' }}>
          <div>
            <span className="ra-eyebrow">SCIENCE WITH ITS LIMITS ATTACHED</span>
            <h2>
              Observed. Modeled. Assumed.
              <br />
              You should know the difference.
            </h2>
            <p>
              Real NASA POWER weather. An illustrative Iowa farm. Quality-screened satellite and soil layers appear only
              when available. No invented field measurements or promises about your harvest.
            </p>
          </div>
          <a href="/atlas" className="ra-button ra-button-light ra-button-motion">
            Open the workspace <ArrowRight size={18} />
          </a>
        </section>
      </main>

      <footer>
        <span>Rotation Atlas · NASA Space Apps research prototype</span>
        <span>AI-assisted software · Independent project, not a NASA endorsement.</span>
      </footer>
    </div>
  );
}
