---
version: 1
slug: "client-src-pages-landing-tsx"
primary_target: "client/src/pages/Landing.tsx"
related_targets: ["client/src/App.tsx"]
---

# Landing (public "/")

Scope: the public front page shown at `/` to signed-out visitors. Mode: Persuade.

Audience: Fellow ES1 owners who have never heard of Crema (and the owner, returning signed out). Job: understand in seconds that this is an espresso logbook + dial-in coach + profile studio for the ES1, and who it's for. Action: Create account (primary, working toward public sign-up), Sign in (secondary). Auth page lives at `/sign-in` and `/sign-up`.
Proof: live demo UI with labelled sample data only. No testimonials, stats, or users exist; none are invented. Independence from Fellow stated.

## Direction contract

THESIS: The page is one shot. A single pressure profile runs across the page and its three stages (pre-infusion, infusion, ramp-down) structure the story. Refuses the split hero with a screenshot and a three-card feature row.
OWN-WORLD: Crema as recorded in DESIGN.md: roast-black ground, one crema-amber line and action, cool-water pre-infusion, espresso-rust ramp-down, stage bands at chart opacity, JetBrains Mono readings with faint units, flat 1px-bordered panels, Space Grotesk only in the lockup.
STORY: Visitor sees a shot being pulled, learns Crema logs it, tells them the one next change, normalises grind across grinders, and builds profiles the ES1 can run; understands it is independent and honest about estimates; creates an account. The story ends on the shot's yield: a lone 'Who it's for' section whose gutter mark lights the whole shot.
FIRST VIEWPORT: Top bar: lockup left, Sign in right. Left column: headline (clamp up to 4.75rem), a three-line sub (it must say what, for whom and the loop), Create account (amber) + Sign in. Below the copy (not behind it, so the line never crosses the CTAs), a full-bleed SVG pressure profile of Fellow's Modern Arc draws left to right over ~5s with stage bands running to the viewport edge; a mono readout tracks the playhead with bar, s and the stage's flow limit (ml/s max: the profile carries a ceiling, not measured flow). Stage labels in the plot link to their sections. The caption with Pull it again sits above the 900px fold at 1440.
FORM: The Pressure Curve, position 3 of 7 on the ranked list, seed key 869fab12. Signature interaction: the curve draws as a live pull with a moving playhead and readout; reduced motion shows the finished curve.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
