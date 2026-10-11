---
version: 1
slug: "src-pages-landing-tsx"
primary_target: "src/pages/Landing.tsx"
related_targets: ["src/App.tsx","src/components/charts.tsx","src/lib/theme.tsx"]
---

# Landing (public "/")

Scope: the public front page shown at `/` to signed-out visitors. Mode: Persuade.

Audience: Fellow ES1 owners who have never heard of Mousetail (and the owner, returning signed out). Job: understand in seconds that this is an espresso logbook + dial-in coach + profile studio for the ES1, and who it's for. Action: Create account (primary), Sign in (secondary). Auth lives at `/sign-in` and `/sign-up`.
Proof: live demos running the app's own shared code on labelled sample data. No testimonials, stats, or users exist; none are invented. Independence from Fellow stated.
Constraints (user, 2026-10-04): match the redesigned dashboard world; pressure graphs are smooth curves everywhere (landing and in-app charts); first-time visitors get light, landing and app alike, until they choose.

## Direction contract

THESIS: The page is one shot, now pulled in the app's own world. A single curved pressure profile runs across the page and its stages structure the story; the shot ends in a glass. Refuses the split hero with a screenshot and a three-card feature row.
OWN-WORLD: Mousetail as in DESIGN.md: warm counter ground with the finish's faint cast, soft-shadowed 20px cards (hairline in dark), pill buttons with tamp press, Bricolage headings with matched opsz, Figtree UI, Red Hat Mono figures only. Pressure line in chart-pressure, stage bands at chart opacity, the Crema orange only on presses and the one coach card.
STORY: Watch a shot pull and pour into a glass; learn Mousetail logs every shot as a glass on one scale, hands back one barista instruction, translates grind across grinders, builds profiles the ES1 can run; read that it is independent and honest; create an account.
FIRST VIEWPORT: Top bar: lockup left, Sign in ghost pill right. Headline in Bricolage 800 (up to ~4.6rem), three-line sub, Create account (orange pill, large) + Sign in. Below, full-bleed curved Modern Arc profile drawing over ~5s with stage bands to the edge; a playhead dot rides the curve; a floating readout card holds a shot glass that fills to 36 g as the pull runs, plus live bar, s, flow-limit figures and the stage. Caption with Pull it again above the fold at 1440x900.
FORM: Inherited Mousetail surface (no concept round: user pinned structure), seed key none — direction carried over from 869fab12 into dashboard world 4455cff9. Signature: the curve draws as a live pull and pours into the glass; reduced motion shows the finished curve and full glass.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
