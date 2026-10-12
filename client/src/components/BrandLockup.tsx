// The stream is a filled ribbon rather than a stroke so it can taper: full at
// the spout, a fine thread where it lands.
const STREAM =
  'M25.05 3.1 L25.22 4.81 L25.53 6.44 L25.96 7.92 L26.47 9.25 L27.03 10.45 L27.61 11.55 L28.17 12.56 L28.68 13.52 L29.13 14.44 L29.5 15.36 L29.76 16.31 L29.91 17.33 L29.92 18.45 L29.77 19.74 L29.54 20.62 L29.24 21.48 L28.87 22.3 L28.45 23.12 L27.99 23.96 L27.51 24.83 L27.03 25.75 L26.58 26.76 L26.17 27.85 L25.85 29.06 L25.61 30.39 L25.49 31.86 L25.5 33.5 L25.65 35.3 A0.75 0.75 0 0 0 27.15 35.2 L27.15 35.2 L27.07 33.46 L27.13 31.96 L27.3 30.65 L27.57 29.49 L27.92 28.47 L28.33 27.54 L28.79 26.68 L29.3 25.87 L29.82 25.06 L30.36 24.24 L30.89 23.38 L31.4 22.44 L31.85 21.42 L32.23 20.26 L32.51 18.69 L32.59 17.22 L32.49 15.85 L32.23 14.57 L31.86 13.38 L31.43 12.26 L30.96 11.19 L30.48 10.14 L30.04 9.1 L29.64 8.04 L29.31 6.93 L29.07 5.74 L28.94 4.45 L28.95 2.9 A1.95 1.95 0 0 0 25.05 3.1 Z';

/**
 * The Mousetail lockup: a tulip cup with the tapering stream of a good pull
 * (the "mouse tail") running into it, beside the lowercase wordmark. The crema
 * band is a fixed balanced hazel rather than the finish colour, which would
 * vanish on the Black machine; the stream takes the action colour, which every
 * finish keeps legible on its ground.
 *
 * `pour` plays the stream pouring in and the crema rising, once, on mount. It
 * is for the one big hero lockup, not the header, which would replay it on
 * every page.
 */
export default function BrandLockup({
  heading = false,
  pour = false,
}: {
  heading?: boolean;
  pour?: boolean;
}) {
  const Name = (heading ? 'h1' : 'div') as 'h1' | 'div';
  return (
    <div className={pour ? 'brand-lockup brand-pour' : 'brand-lockup'}>
      <svg className="brand-glass" viewBox="0 0 60 72" aria-hidden="true">
        <path
          d="M43.5 37 C52.5 35.5 55 40.5 53.5 46.5 C52 52.5 46.5 55 40.5 53.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M7 30 H45 C45 46 41.5 61 33.5 67.5 Q30.5 70 26 70 Q21.5 70 18.5 67.5 C10.5 61 7 46 7 30 Z"
          fill="currentColor"
        />
        <path
          className="brand-crema"
          d="M7.17 36 C7.31 38.39 7.53 40.73 7.84 43 H44.16 C44.47 40.73 44.69 38.39 44.83 36 Z"
          fill="var(--crema-balanced)"
        />
        <path
          d="M13 48 Q14.5 56 18 61"
          fill="none"
          stroke="var(--surface)"
          strokeOpacity="0.28"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path className="brand-stream" d={STREAM} fill="var(--action)" />
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
