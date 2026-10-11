/**
 * The Mousetail lockup: a small demitasse, the same glass every shot is drawn
 * as, with the thin wavy stream of a good pull (the "mouse tail") running into
 * it, beside the lowercase wordmark. The crema band is a fixed balanced hazel
 * rather than the finish colour, which would vanish on the Black machine; the
 * stream takes the action colour, which every finish keeps legible on its ground.
 */
export default function BrandLockup({ heading = false }: { heading?: boolean }) {
  const Name = (heading ? 'h1' : 'div') as 'h1' | 'div';
  return (
    <div className="brand-lockup">
      <svg className="brand-glass" viewBox="0 0 60 72" aria-hidden="true">
        <path
          d="M43 38 C52 37 53.5 41 53.5 47 C53.5 54 49 58 41.5 58"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M8 30 H44 L42 64 Q41.6 70 35.5 70 H16.5 Q10.4 70 10 64 Z" fill="currentColor" />
        <path d="M8.4 36 H43.6 L43.2 43 H8.8 Z" fill="var(--crema-balanced)" />
        <path
          className="brand-stream"
          d="M27 3 C27 11 32.5 13 31 20 C29.8 25 25.5 26.5 26.5 34"
          fill="none"
          stroke="var(--action)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      </svg>
      <Name className="brand-name">
        {/* The drawn word swaps the i for a dotless one under a drop, so
            assistive tech gets the plain word instead. */}
        <span className="sr-only">mousetail</span>
        <span aria-hidden="true">
          mouseta<span className="brand-i">ı</span>l
        </span>
      </Name>
    </div>
  );
}
