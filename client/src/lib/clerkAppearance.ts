import { useEffect, useState } from 'react';
import { useTheme } from './theme';

/**
 * Clerk's sign-in box renders in its own light theme by default, which reads as a
 * white card dropped onto a dark app.
 *
 * Rather than restate the palette here in JavaScript — two copies of the same
 * colours, guaranteed to drift — this reads the CSS custom properties straight
 * off the document. The stylesheet stays the single source of truth, and both
 * themes come out right for free.
 *
 * Clerk parses these values to derive its own shades (hover, alpha, disabled), so
 * they have to be resolved colours. Passing `var(--crema)` through would give
 * Clerk a string it cannot do colour maths on.
 */
function buildAppearance() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();

  return {
    variables: {
      colorPrimary: v('--crema'),
      colorPrimaryForeground: v('--on-accent'),
      colorBackground: v('--surface'),
      colorForeground: v('--text'),
      colorMuted: v('--bg-raised'),
      colorMutedForeground: v('--text-dim'),
      colorInput: v('--bg-raised'),
      colorInputBackground: v('--bg-raised'),
      colorInputForeground: v('--text'),
      colorBorder: v('--border-strong'),
      colorRing: v('--crema-dim'),
      colorDanger: v('--bad'),
      colorSuccess: v('--good'),
      colorWarning: v('--warn'),
      colorModalBackdrop: v('--scrim'),
      // Legacy aliases: this version of Clerk still reads them, and setting both
      // costs nothing while covering whichever the installed build prefers.
      colorText: v('--text'),
      colorTextOnPrimaryBackground: v('--on-accent'),
      colorTextSecondary: v('--text-dim'),
      borderRadius: v('--radius'),
      fontFamily: v('--sans'),
    },
    elements: {
      // Match .card exactly (app.css:273) so the box sits in the page rather
      // than on top of it.
      cardBox: {
        border: `1px solid ${v('--border')}`,
        boxShadow: v('--shadow'),
      },
      // Clerk styles social buttons for a light card — a pale button with dark
      // label. Recolouring the card alone leaves dark text on a dark button, so
      // the label and icon have to be set explicitly. Matches .btn (app.css).
      socialButtonsBlockButton: {
        backgroundColor: v('--surface-2'),
        borderColor: v('--border-strong'),
        color: v('--text'),
      },
      socialButtonsBlockButtonText: {
        color: v('--text'),
        fontWeight: '500',
      },
      // Clerk gives the footer its own subtle background, which shows up as a
      // seam against --surface.
      footer: { background: 'transparent' },
      // "Don't have an account? Sign up" links to Clerk's hosted
      // <instance>.accounts.dev page, which walks the user out of the app. The
      // segmented control above already switches between the two, so this is
      // both redundant and a worse path. Drop it rather than style it.
      footerAction: { display: 'none' },
      headerTitle: { fontFamily: v('--display') },
    },
  };
}

/** Rebuilds when the resolved theme flips, including on the OS changing under "auto". */
export function useClerkAppearance() {
  const { resolved } = useTheme();
  const [appearance, setAppearance] = useState(buildAppearance);

  useEffect(() => {
    setAppearance(buildAppearance());
  }, [resolved]);

  return appearance;
}
