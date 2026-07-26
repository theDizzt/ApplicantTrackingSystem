/**
 * Platform contract file — do not restructure.
 *
 * This file is part of the contract between the slides artifact and
 * the surrounding workspace tooling (preview, thumbnails, exports).
 * Reorganizing it, swapping the router, or changing the structure
 * of `AllSlides` can quietly break that tooling even when the page
 * still looks correct in the preview.
 *
 * Agents: see the slides skill `<workspace_contract>` for the full
 * rules, and `references/visual_qa.md` → "Platform contract sanity
 * check" if this file has been hand-edited and needs repair.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { slides } from '@/slideLoader';
import { useLocation } from 'wouter';

function getSlideIndex(pathname: string): number {
  const match = pathname.match(/^\/slide(\d+)$/);
  if (!match) return -1;
  const position = parseInt(match[1], 10);
  return slides.findIndex((s) => s.position === position);
}

const PARENT_OWNS_NAVIGATION =
  new URLSearchParams(window.location.search).get('replitNav') === 'parent' ||
  window.parent !== window.parent.parent;

function SlideEditor() {
  const [location, navigate] = useLocation();
  const currentIndex = getSlideIndex(location);

  const navigationDisabledRef = useRef(PARENT_OWNS_NAVIGATION);
  const touchHandledRefStable = useRef(false);

  useEffect(() => {
    if (currentIndex === -1) return;

    const INTERACTIVE =
      'a,button,video,audio,input,select,textarea,details,summary,iframe,svg,canvas,' +
      '[role="button"],[contenteditable]:not([contenteditable="false"])';

    const isInteractive = (target: EventTarget | null) =>
      (target as HTMLElement | null)?.closest?.(INTERACTIVE);

    const ARROW_KEY_CONSUMERS =
      'input:not([type="button"]):not([type="submit"]):not([type="reset"]),' +
      'select,textarea,audio,video';

    const consumesArrowKeys = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable || !!target.closest(ARROW_KEY_CONSUMERS)
      );
    };

    const postNav = (type: 'advanceSlide' | 'retreatSlide') => {
      window.parent.postMessage({ type, source: 'keyboard' }, '*');
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (navigationDisabledRef.current) {
        if (event.defaultPrevented) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
          return;
        }
        if (event.key === ' ') {
          const focused = isInteractive(event.target);
          const role = focused?.getAttribute('role');
          const isPlainLink =
            !!focused &&
            focused.tagName === 'A' &&
            (!role ||
              role === 'link' ||
              role === 'none' ||
              role === 'presentation');
          if (focused && !isPlainLink) return;
          event.preventDefault();
          postNav('advanceSlide');
          return;
        }
        if (consumesArrowKeys(event.target)) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          postNav('retreatSlide');
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          postNav('advanceSlide');
        }
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
      }
      if (
        (event.key === 'ArrowLeft' || event.key === 'ArrowUp') &&
        currentIndex > 0
      ) {
        navigate(`/slide${slides[currentIndex - 1].position}`);
      }
      if (
        (event.key === 'ArrowRight' ||
          event.key === 'ArrowDown' ||
          event.key === ' ') &&
        currentIndex < slides.length - 1
      ) {
        navigate(`/slide${slides[currentIndex + 1].position}`);
      }
    };

    const touchHandledRef = touchHandledRefStable;

    const onClick = (event: MouseEvent) => {
      if (touchHandledRef.current) {
        touchHandledRef.current = false;
        return;
      }
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (isInteractive(event.target)) return;

      if (navigationDisabledRef.current) {
        window.parent.postMessage({ type: 'advanceSlide' }, '*');
        return;
      }

      if (currentIndex < slides.length - 1) {
        navigate(`/slide${slides[currentIndex + 1].position}`);
      }
    };

    let touchStartX = 0;
    let touchStartY = 0;
    let touchTarget: EventTarget | null = null;

    const onTouchStart = (event: TouchEvent) => {
      touchHandledRef.current = false;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchTarget = event.target;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const dx = event.changedTouches[0].clientX - touchStartX;
      const dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) >= 10 || Math.abs(dy) >= 10) return;
      if (isInteractive(touchTarget)) return;
      touchHandledRef.current = true;

      if (navigationDisabledRef.current) {
        window.parent.postMessage({ type: 'advanceSlide' }, '*');
        return;
      }

      const fraction = touchStartX / window.innerWidth;
      if (fraction < 0.4 && currentIndex > 0) {
        navigate(`/slide${slides[currentIndex - 1].position}`);
      } else if (fraction >= 0.4 && currentIndex < slides.length - 1) {
        navigate(`/slide${slides[currentIndex + 1].position}`);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('click', onClick);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [currentIndex, navigate]);

  return (
    <div className="select-none">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          style={{ display: index === currentIndex ? 'block' : 'none' }}
        >
          <slide.Component />
        </div>
      ))}
    </div>
  );
}

// Do not rewrite this component. Each slide must remain wrapped in
// `<div className="slide">` sized 1920×1080 — the class name and
// dimensions are part of the platform contract. See the file-level
// banner above for context.
function AllSlides() {
  return (
    <div className="bg-black">
      {slides.map((slide) => (
        <div
          key={slide.id}
          className="slide relative aspect-video overflow-hidden"
          style={{ width: '1920px', height: '1080px' }}
        >
          <div className="h-full w-full [&_.h-screen]:!h-full [&_.w-screen]:!w-full">
            <slide.Component />
          </div>
        </div>
      ))}
    </div>
  );
}

// Logical slide dimensions — slides are designed at this resolution.
// The iframe renders at this size; CSS transform scales it to fit the viewport.
const SLIDE_W = 1280;
const SLIDE_H = 720;

function computeScale(vw: number, vh: number, navBarH: number) {
  return Math.min(vw / SLIDE_W, (vh - navBarH) / SLIDE_H);
}

// This component is used for the deployed view at `/`
function SlideViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [scale, setScale] = useState(() => {
    const mobile = window.innerWidth < 768;
    return computeScale(window.innerWidth, window.innerHeight, mobile ? 56 : 0);
  });

  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setScale(computeScale(window.innerWidth, window.innerHeight, mobile ? 56 : 0));
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Navigate to a slide by index — updates local state and tells the iframe
  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, slides.length - 1));
    setCurrentIndex(clamped);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'navigateToSlide', position: slides[clamped].position },
      '*',
    );
  }, []);

  // Listen for advanceSlide / retreatSlide messages from the iframe
  // (sent when replitNav=parent is active)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'advanceSlide') {
        setCurrentIndex((prev) => {
          const next = Math.min(prev + 1, slides.length - 1);
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'navigateToSlide', position: slides[next].position },
            '*',
          );
          return next;
        });
      }
      if (event.data?.type === 'retreatSlide') {
        setCurrentIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'navigateToSlide', position: slides[next].position },
            '*',
          );
          return next;
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Forward keyboard events into the iframe
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowDown' &&
        event.key !== ' '
      )
        return;
      if (event.key === ' ') event.preventDefault();
      iframeRef.current?.contentWindow?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: event.key,
          code: event.code,
          bubbles: true,
        }),
      );
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Swipe-to-navigate on the outer container
  const touchRef = useRef({ x: 0, y: 0, time: 0 });
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchRef.current.x;
      const dy = e.changedTouches[0].clientY - touchRef.current.y;
      const dt = Date.now() - touchRef.current.time;
      // Only count clear horizontal swipes within 500 ms
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) * 0.7 || dt > 500)
        return;
      goTo(dx < 0 ? currentIndex + 1 : currentIndex - 1);
    },
    [currentIndex, goTo],
  );

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const firstPosition = slides.length > 0 ? slides[0].position : 1;

  return (
    <div
      className="slide-viewer h-screen w-screen overflow-hidden bg-black flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slide area — iframe rendered at SLIDE_W×SLIDE_H, scaled to fit */}
      <div
        className="flex-1 flex items-center justify-center min-h-0"
        onClick={() => iframeRef.current?.focus()}
      >
        <div
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            flexShrink: 0,
          }}
        >
          <iframe
            ref={iframeRef}
            src={`${base}/slide${firstPosition}?replitNav=parent`}
            style={{ width: SLIDE_W, height: SLIDE_H, border: 'none' }}
            onLoad={() => iframeRef.current?.focus()}
            title="Slide viewer"
          />
        </div>
      </div>

      {/* Mobile navigation bar — hidden on desktop via CSS */}
      <nav
        className="slide-mobile-nav"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="slide-mobile-nav-btn"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          aria-label="이전 슬라이드"
        >
          ‹ 이전
        </button>
        <span className="slide-mobile-nav-counter">
          {currentIndex + 1} / {slides.length}
        </span>
        <button
          className="slide-mobile-nav-btn"
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === slides.length - 1}
          aria-label="다음 슬라이드"
        >
          다음 ›
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  const [location, navigate] = useLocation();

  // DO NOT edit this useEffect - redirects unknown routes to the first slide.
  // The "/" and "/allslides" routes are handled separately below.
  useEffect(() => {
    if (
      location !== '/' &&
      location !== '/allslides' &&
      getSlideIndex(location) === -1
    ) {
      if (slides.length > 0) {
        navigate(`/slide${slides[0].position}`, { replace: true });
      }
    }
  }, [location, navigate]);

  // DO NOT edit this useEffect - allows the parent frame to navigate
  // between slides via postMessage so it can avoid changing the iframe
  // src (which causes a white flash).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.data?.type === 'navigateToSlide' &&
        typeof event.data.position === 'number' &&
        slides.some((s) => s.position === event.data.position)
      ) {
        navigate(`/slide${event.data.position}`);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  if (location === '/') return <SlideViewer />;
  if (location === '/allslides') return <AllSlides />;
  return <SlideEditor />;
}
