/**
 * The Crema lockup: a small demitasse, the same glass every shot is drawn as,
 * beside the lowercase wordmark, with a balanced hazel crema. The crema is fixed
 * rather than the finish colour, which would vanish on the Black machine.
 */
export default function BrandLockup({ heading = false }: { heading?: boolean }) {
  const Name = (heading ? 'h1' : 'div') as 'h1' | 'div';
  return (
    <div className="brand-lockup">
      <svg className="brand-glass" viewBox="0 0 60 62" aria-hidden="true">
        <path d="M43 18 C53 17 54.5 22 54.5 28.5 C54.5 36 50 40.5 41.4 40.5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M8 6.5 H44 L41.7 52.2 Q41.3 58.5 35 58.5 H17 Q10.7 58.5 10.3 52.2 Z" fill="currentColor" />
        <path d="M9.9 14 H42.1 L41.6 23 H10.4 Z" fill="var(--crema-balanced)" />
      </svg>
      <Name className="brand-name">crema</Name>
    </div>
  );
}
