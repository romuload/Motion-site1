/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';

// Custom typewriter hook according to specifications:
// takes text, speed (default 38ms), startDelay (default 600ms).
// After delay, reveals one character at a time. Returns { displayed, done }.
function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;
    let currentIndex = 0;

    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        currentIndex += 1;
        setDisplayed(text.slice(0, currentIndex));
        if (currentIndex >= text.length) {
          clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>(`${import.meta.env.BASE_URL}background.mp4`);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
      }
    }
  };

  // Typewriter text specification:
  // "Glad you stopped in. Good taste tends to find us. Now, what are we building?"
  const { displayed, done } = useTypewriter(
    'Glad you stopped in. Good taste tends to find us. Now, what are we building?',
    38,
    600
  );

  // Action pill buttons become visible 400ms after page load,
  // independent of the typewriter animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setButtonsVisible(true);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  // Video mouse-scrub controller:
  // - A full-screen <video> element is position: fixed; inset: 0; z-index: 0; object-fit: cover; object-position: 70% center;
  // - Scrubs forward/backward based on horizontal mouse movement.
  // - Track prevX, compute delta = currentX - prevX, convert to time offset:
  //   (delta / window.innerWidth) * SENSITIVITY * video.duration where SENSITIVITY = 0.8
  // - Clamp targetTime between 0 and video.duration.
  // - Use video.currentTime to seek, and onSeeked handler to queue next seek if targetTime moved.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Seek slightly forward on load if needed to ensure first frame is drawn
      if (video.currentTime === 0) {
        try {
          video.currentTime = 0.01;
        } catch {
          // ignore
        }
      }
      targetTimeRef.current = video.currentTime || 0;
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    const handleMouseMove = (e: MouseEvent) => {
      if (!video || !video.duration || Number.isNaN(video.duration)) return;

      if (prevXRef.current === null) {
        prevXRef.current = e.clientX;
        return;
      }

      const delta = e.clientX - prevXRef.current;
      prevXRef.current = e.clientX;

      const SENSITIVITY = 0.8;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      const newTarget = Math.max(0, Math.min(video.duration, targetTimeRef.current + timeOffset));
      targetTimeRef.current = newTarget;

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleMouseLeave = () => {
      prevXRef.current = null;
    };

    // Touch support for mobile scrubbing
    const handleTouchMove = (e: TouchEvent) => {
      if (!video || !video.duration || Number.isNaN(video.duration) || e.touches.length === 0) return;
      const touchX = e.touches[0].clientX;
      if (prevXRef.current === null) {
        prevXRef.current = touchX;
        return;
      }
      const delta = touchX - prevXRef.current;
      prevXRef.current = touchX;

      const SENSITIVITY = 0.8;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      const newTarget = Math.max(0, Math.min(video.duration, targetTimeRef.current + timeOffset));
      targetTimeRef.current = newTarget;

      if (!isSeekingRef.current) {
        isSeekingRef.current = true;
        video.currentTime = targetTimeRef.current;
      }
    };

    const handleTouchEnd = () => {
      prevXRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;

    if (Math.abs(video.currentTime - targetTimeRef.current) > 0.02) {
      video.currentTime = targetTimeRef.current;
    } else {
      isSeekingRef.current = false;
    }
  };

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText('hello@mainframe.co');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = 'hello@mainframe.co';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openAction = (label: string) => {
    setActiveModal(label);
  };

  return (
    <div
      className="relative min-h-screen w-full select-none overflow-hidden bg-black text-white"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleVideoUpload}
        accept="video/*"
        className="hidden"
      />

      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm pointer-events-none">
          <div className="rounded-2xl border-2 border-dashed border-white/60 p-8 text-center text-white">
            <p className="text-xl font-medium">Solte o arquivo de vídeo aqui</p>
            <p className="mt-1 text-sm text-white/70">O vídeo será carregado instantaneamente</p>
          </div>
        </div>
      )}

      {/* Background Video (mouse-scrub controlled) */}
      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        muted
        playsInline
        preload="auto"
        onSeeked={handleSeeked}
        className="hero-video-bg fixed inset-0 z-0 h-full w-full object-cover"
      />

      {/* NAVBAR (fixed, z-index: 10) */}
      <header className="fixed top-0 left-0 right-0 z-10 flex w-full items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        {/* Logo (left) */}
        <div className="flex items-center gap-3">
          <a
            href={import.meta.env.BASE_URL}
            style={{ fontFamily: 'var(--font-heading)' }}
            className="text-[21px] font-medium leading-none tracking-tight text-white sm:text-[26px]"
          >
            Mainframe&reg;
          </a>
          <span
            className="select-none text-[25px] leading-none text-white sm:text-[30px]"
            style={{ letterSpacing: '-0.02em' }}
            aria-hidden="true"
          >
            &#10035;&#xfe0e;
          </span>
        </div>

        {/* Desktop nav links (center, hidden below md) */}
        <nav className="hidden items-center text-[23px] text-white md:flex">
          <a href="#labs" onClick={() => openAction('Labs')} className="transition-opacity hover:opacity-70">
            Labs
          </a>
          <span className="mr-1.5">, </span>
          <a href="#studio" onClick={() => openAction('Studio')} className="transition-opacity hover:opacity-70">
            Studio
          </a>
          <span className="mr-1.5">, </span>
          <a href="#openings" onClick={() => openAction('Openings')} className="transition-opacity hover:opacity-70">
            Openings
          </a>
          <span className="mr-1.5">, </span>
          <a href="#shop" onClick={() => openAction('Shop')} className="transition-opacity hover:opacity-70">
            Shop
          </a>
        </nav>

        {/* Desktop CTA (right, hidden below md) */}
        <div className="hidden md:block">
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              openAction('Contact');
            }}
            className="text-[23px] text-white underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Get in touch
          </a>
        </div>

        {/* Mobile hamburger (visible below md) */}
        <button
          type="button"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="relative z-20 flex h-8 w-8 cursor-pointer flex-col items-center justify-center gap-[5px] focus:outline-none md:hidden"
        >
          <span
            className={`h-[2px] w-6 bg-white transition-all duration-300 ${
              mobileMenuOpen ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`h-[2px] w-6 bg-white transition-all duration-300 ${
              mobileMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`h-[2px] w-6 bg-white transition-all duration-300 ${
              mobileMenuOpen ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay (z-index: 9) */}
      <div
        className={`fixed inset-0 z-[9] flex flex-col justify-center gap-8 bg-neutral-950/95 px-8 text-white backdrop-blur-md transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <a
          href="#labs"
          onClick={() => {
            setMobileMenuOpen(false);
            openAction('Labs');
          }}
          className="text-[32px] font-medium text-white transition-opacity hover:opacity-70"
        >
          Labs
        </a>
        <a
          href="#studio"
          onClick={() => {
            setMobileMenuOpen(false);
            openAction('Studio');
          }}
          className="text-[32px] font-medium text-white transition-opacity hover:opacity-70"
        >
          Studio
        </a>
        <a
          href="#openings"
          onClick={() => {
            setMobileMenuOpen(false);
            openAction('Openings');
          }}
          className="text-[32px] font-medium text-white transition-opacity hover:opacity-70"
        >
          Openings
        </a>
        <a
          href="#shop"
          onClick={() => {
            setMobileMenuOpen(false);
            openAction('Shop');
          }}
          className="text-[32px] font-medium text-white transition-opacity hover:opacity-70"
        >
          Shop
        </a>
        <a
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            setMobileMenuOpen(false);
            openAction('Contact');
          }}
          className="text-[32px] font-medium text-white underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          Get in touch
        </a>
      </div>

      {/* HERO SECTION (z-index: 1) */}
      <main className="relative z-[1] flex h-screen w-full flex-col justify-end overflow-hidden px-5 pb-12 sm:px-8 md:justify-center md:px-10 md:pb-0">
        <div className="relative z-10 max-w-xl">
          {/* 1. Blurred intro label */}
          <div
            className="pointer-events-none mb-5 select-none sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.3,
              fontWeight: 400,
              color: '#ffffff',
              filter: 'blur(4px)',
            }}
          >
            Hey there, meet A.R.I.A,
            <br />
            Mainframe&apos;s Adaptive Response Interface Agent
          </div>

          {/* 2. Typewriter text */}
          <p
            className="mb-5 min-h-[54px] font-normal text-white sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.35,
              fontWeight: 400,
            }}
          >
            {displayed}
            {!done && (
              <span
                className="ml-[2px] inline-block h-[1.1em] w-[2px] bg-white align-middle"
                style={{ animation: 'blink 1s step-end infinite' }}
                aria-hidden="true"
              />
            )}
          </p>

          {/* 3. Action pill buttons */}
          <div
            className="flex flex-wrap gap-y-1 transition-all duration-400 ease-out"
            style={{
              opacity: buttonsVisible ? 1 : 0,
              transform: buttonsVisible ? 'translateY(0px)' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {/* 4 action pill buttons with white text */}
            <button
              type="button"
              onClick={() => openAction('Pitch us an idea')}
              className="mx-[0.2em] mb-[0.4em] inline-flex cursor-pointer items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-md px-4 py-[0.3em] text-[13px] whitespace-nowrap text-white transition-colors duration-200 hover:bg-white/20 hover:border-white sm:px-5 sm:text-[15px]"
            >
              Pitch us an idea
            </button>

            <button
              type="button"
              onClick={() => openAction('Come work here')}
              className="mx-[0.2em] mb-[0.4em] inline-flex cursor-pointer items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-md px-4 py-[0.3em] text-[13px] whitespace-nowrap text-white transition-colors duration-200 hover:bg-white/20 hover:border-white sm:px-5 sm:text-[15px]"
            >
              Come work here
            </button>

            <button
              type="button"
              onClick={() => openAction('Send a brief hello')}
              className="mx-[0.2em] mb-[0.4em] inline-flex cursor-pointer items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-md px-4 py-[0.3em] text-[13px] whitespace-nowrap text-white transition-colors duration-200 hover:bg-white/20 hover:border-white sm:px-5 sm:text-[15px]"
            >
              Send a brief hello
            </button>

            <button
              type="button"
              onClick={() => openAction('See how we operate')}
              className="mx-[0.2em] mb-[0.4em] inline-flex cursor-pointer items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-md px-4 py-[0.3em] text-[13px] whitespace-nowrap text-white transition-colors duration-200 hover:bg-white/20 hover:border-white sm:px-5 sm:text-[15px]"
            >
              See how we operate
            </button>

            {/* 1 outline pill button with white text */}
            <div className="relative inline-flex">
              {copied && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-black shadow-lg pointer-events-none transition-all duration-200">
                  Copied!
                </div>
              )}
              <button
                type="button"
                onClick={handleCopyEmail}
                title="Click to copy email address"
                className="mx-[0.2em] mb-[0.4em] inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white bg-black/30 backdrop-blur-md px-4 py-[0.3em] text-[13px] whitespace-nowrap text-white transition-colors duration-200 hover:bg-white/20 sm:gap-3 sm:px-5 sm:text-[15px]"
              >
                <span>
                  Reach us:{' '}
                  <span className="underline underline-offset-1">hello@mainframe.co</span>
                </span>

                {/* Small 12x12 copy icon (inline SVG of two overlapping rectangles) */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="7" height="7" rx="1" />
                  <path d="M2.5 8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v0.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle bottom-right video replacement button */}
      <div className="fixed right-4 bottom-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Selecionar outro arquivo de vídeo do computador"
          className="cursor-pointer rounded-full bg-black/35 px-3 py-1 text-[11px] text-white/70 backdrop-blur-md transition-all hover:bg-black/70 hover:text-white"
        >
          Substituir vídeo &#8679;
        </button>
      </div>

      {/* Interactive Modal Sheet for Agency Actions */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md transition-opacity duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-neutral-900/95 p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close dialog"
            >
              &times;
            </button>

            <div className="mb-2 text-xs font-semibold tracking-widest uppercase text-white/50">
              Mainframe&reg; Agency &bull; A.R.I.A
            </div>
            <h3 className="mb-4 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              {activeModal}
            </h3>

            {activeModal === 'Pitch us an idea' && (
              <div className="space-y-4 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  We partner with forward-thinking founders, cultural icons, and disruptive teams to build
                  defining digital experiences and next-generation interfaces.
                </p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-medium text-white/60">Direct Inquiries</div>
                  <div className="mt-1 font-mono text-sm text-white">newbusiness@mainframe.co</div>
                </div>
                <div className="pt-2">
                  <a
                    href="mailto:newbusiness@mainframe.co?subject=Project%20Pitch%20via%20Mainframe"
                    className="inline-flex w-full items-center justify-center rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                  >
                    Open Mail Client &rarr;
                  </a>
                </div>
              </div>
            )}

            {activeModal === 'Come work here' || activeModal === 'Openings' ? (
              <div className="space-y-4 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  Mainframe operates at the intersection of computational design, interface architecture,
                  and creative engineering. Current open disciplines:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between border-b border-white/10 py-2">
                    <span className="font-medium text-white">Creative Technologist / WebGL</span>
                    <span className="text-xs text-white/50">Remote / NYC</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-white/10 py-2">
                    <span className="font-medium text-white">Principal Product Designer</span>
                    <span className="text-xs text-white/50">Remote / London</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-white/10 py-2">
                    <span className="font-medium text-white">Interactive Systems Architect</span>
                    <span className="text-xs text-white/50">Tokyo / Remote</span>
                  </li>
                </ul>
                <div className="pt-2">
                  <a
                    href="mailto:careers@mainframe.co?subject=Job%20Application"
                    className="inline-flex w-full items-center justify-center rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                  >
                    Send Portfolio (careers@mainframe.co)
                  </a>
                </div>
              </div>
            ) : null}

            {activeModal === 'Send a brief hello' || activeModal === 'Contact' ? (
              <div className="space-y-4 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  Drop a message or stop by our virtual headquarters. We reply within one solar rotation.
                </p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50">Primary Studio Channel</div>
                  <div className="mt-1 font-mono text-base font-medium text-white">hello@mainframe.co</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex w-full items-center justify-center rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  {copied ? 'Copied to Clipboard!' : 'Copy hello@mainframe.co'}
                </button>
              </div>
            ) : null}

            {activeModal === 'See how we operate' && (
              <div className="space-y-3 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  We blend autonomous intelligence with artisanal craftsmanship. Our 4-stage engine:
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="font-medium text-white">01. Signal Synthesis</div>
                    <div className="text-xs text-white/60">Clarifying the core emotional thesis.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="font-medium text-white">02. Spatial Prototyping</div>
                    <div className="text-xs text-white/60">Real code & kinetic simulations in week 1.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="font-medium text-white">03. Adaptive Engineering</div>
                    <div className="text-xs text-white/60">Ultra-fast web architectures & physics.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="font-medium text-white">04. Cultural Launch</div>
                    <div className="text-xs text-white/60">Precision rollouts that capture mindshare.</div>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-white py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {activeModal === 'Labs' && (
              <div className="space-y-4 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  Mainframe Labs explores experimental human-computer interfaces, sensory computation,
                  and dynamic canvas systems.
                </p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="font-medium text-white">A.R.I.A Engine v2.4</div>
                  <div className="text-xs text-white/60">
                    Kinetic mouse scrub, contextual audio-haptic feedback, and fluid canvas rasterization.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  Understood
                </button>
              </div>
            )}

            {activeModal === 'Studio' && (
              <div className="space-y-4 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  Our core production arm designs and engineers brands, high-craft web environments, and interactive software.
                </p>
                <div className="text-xs text-white/60">
                  Select clientele across artificial intelligence, luxury fashion, music, and spatial hardware.
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  Close
                </button>
              </div>
            )}

            {activeModal === 'Shop' && (
              <div className="space-y-4 text-white/80">
                <p className="text-[15px] leading-relaxed text-white/85">
                  Curated physical and digital artifacts produced in limited runs. Edition 003 drops Autumn 2026.
                </p>
                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-xs text-white/60">
                  Catalog currently locked. Subscriber presale active.
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full rounded-full bg-white py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  Back to Hero
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
