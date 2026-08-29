/**
 * The Crema lockup: a shot profile — ramp, hold, decline — ruled above the
 * wordmark. The bars are flex children of a shrink-wrapped box, so the row
 * always measures exactly as wide as the word, at any font or size.
 */
const BARS = [28, 62, 100, 97, 72, 45];

export default function BrandLockup({ heading = false }: { heading?: boolean }) {
  const Name = (heading ? 'h1' : 'div') as 'h1' | 'div';
  return (
    <div className="brand-lockup">
      <div className="brand-bars" aria-hidden="true">
        {BARS.map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <Name className="brand-name">Crema</Name>
    </div>
  );
}
