import { useId } from 'react';
import { TASTE_LABELS } from '../lib/format';

/**
 * Every glass in the app shares this scale, so two glasses side by side compare
 * honestly: a 36 g shot always stands at the same height. 48 g at the rim lets
 * the everyday 30–45 g range fill most of the glass, so a few grams show. A
 * longer pull stops at the rim and gets an overflow mark rather than a taller
 * glass, which would quietly change the scale.
 */
const FULL_G = 48;

const CREMA: Record<number, string> = {
  [-2]: 'var(--crema-sour)',
  [-1]: 'var(--crema-sourish)',
  0: 'var(--crema-balanced)',
  1: 'var(--crema-bitterish)',
  2: 'var(--crema-bitter)',
};

export function cremaColour(taste: number | null | undefined) {
  return taste == null ? 'var(--crema-unknown)' : CREMA[taste] ?? 'var(--crema-unknown)';
}

/** "Balanced", "Leaning sour", or "Not tasted", for labels beside a glass. */
export function tasteLabel(taste: number | null | undefined) {
  return taste == null ? 'Not tasted' : TASTE_LABELS[taste] ?? 'Not tasted';
}

/**
 * A shot as a demitasse: liquid height is the yield on one fixed scale, and the
 * crema band's colour is how it tasted, pale for sour through hazel for
 * balanced to dark for bitter. Untasted shots get a neutral crema so the glass
 * never claims a taste nobody recorded.
 */
export default function ShotGlass({
  yieldG,
  taste,
  width = 48,
  label,
  className,
}: {
  yieldG: number | null | undefined;
  taste?: number | null;
  width?: number;
  /** Accessible name; omit for a decorative glass beside text that says the same. */
  label?: string;
  className?: string;
}) {
  const clip = useId();

  // Interior of the glass, in viewBox units.
  const innerTop = 9;
  const innerBottom = 55;
  const innerH = innerBottom - innerTop;

  const level = Math.max(0, Math.min(1, (yieldG ?? 0) / FULL_G));
  const liquidH = level * innerH;
  const liquidTop = innerBottom - liquidH;
  // Crema is a share of the shot but never thinner than a visible band.
  const cremaH = liquidH > 0 ? Math.max(3.2, Math.min(9, liquidH * 0.2)) : 0;

  const balanced = taste === 0;
  const over = (yieldG ?? 0) > FULL_G;

  return (
    <svg
      className={`shot-glass${className ? ` ${className}` : ''}`}
      viewBox="0 0 60 62"
      width={width}
      height={(width * 62) / 60}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={clip}>
          <path d="M9.5 8 H42.5 L40.2 52 Q39.9 57 35 57 H17 Q12.1 57 11.8 52 Z" />
        </clipPath>
      </defs>

      <path className="handle" d="M43 18 C53 17 54.5 22 54.5 28.5 C54.5 36 50 40.5 41.4 40.5" />
      {/* The glass's own tint sits behind the coffee; only its outline goes on top. */}
      <path className="glass-back" d="M8 6.5 H44 L41.7 52.2 Q41.3 58.5 35 58.5 H17 Q10.7 58.5 10.3 52.2 Z" />

      <g clipPath={`url(#${clip})`}>
        <g className="liquid-group">
          {liquidH > 0 ? <rect className="liquid" x="0" y={liquidTop} width="60" height={liquidH + 4} /> : null}
          {cremaH > 0 ? (
            <>
              <rect x="0" y={liquidTop} width="60" height={cremaH} fill={cremaColour(taste)} />
              <rect className="crema-edge" x="0" y={liquidTop} width="60" height="1.2" />
              {balanced ? (
                // Tiger-striping: the mottle a well-extracted shot shows on top.
                <>
                  <ellipse className="fleck" cx="18" cy={liquidTop + cremaH * 0.45} rx="4" ry={cremaH * 0.22} />
                  <ellipse className="fleck" cx="30" cy={liquidTop + cremaH * 0.6} rx="5.5" ry={cremaH * 0.18} />
                  <ellipse className="fleck" cx="39" cy={liquidTop + cremaH * 0.4} rx="3" ry={cremaH * 0.2} />
                </>
              ) : null}
            </>
          ) : null}
        </g>
      </g>

      <path className="glass-rim" d="M8 6.5 H44 L41.7 52.2 Q41.3 58.5 35 58.5 H17 Q10.7 58.5 10.3 52.2 Z" />
      <path className="shine" d="M14 13 L15.4 46" />
      {over ? <path className="over" d="M22 2.5 L26 6.5 L30 2.5" /> : null}
    </svg>
  );
}
