# Interview OS Design Application

## Reference Source

- Primary design reference: `DESIGN.md`
- Installed from the `awesome-design-md` / getdesign Linear reference.
- Local skill source checked first: `C:\Users\Yang\.codex\skills\awesome-design-md\references\design-md\linear.app\README.md`
- The reference is treated as inspiration, not official Linear brand guidance.

## Why Linear

Interview OS is a personal productivity and training cockpit. The closest available reference is Linear because it favors a precise dark product surface, dense task-oriented information, restrained navigation, and scarce accent color. That is a better fit than a marketing-first, playful, or image-heavy reference.

## Applied Decisions

- Canvas: use a near-black root surface (`#010102`) instead of a gradient background.
- Accent: use one primary lavender-blue (`#5e6ad2`) for brand mark, primary actions, active states, focus rings, and progress indicators.
- Surface hierarchy: use charcoal panels and hairline borders instead of heavy glow, bright gradients, or large drop shadows.
- Components: keep 8px radii already established in the app for buttons, cards, inputs, and tool surfaces.
- Typography: keep the existing Inter/system stack. Use fixed responsive breakpoint sizes instead of viewport-scaled type.
- Density: preserve the dashboard-first layout with compact nav, score modules, mission cards, role cards, and review panels.
- Accessibility: keep warning, danger, and success colors for functional states, but make them subdued and non-decorative.

## Deliberate Deviations

- The downloaded Linear reference includes negative display tracking, but this app keeps letter spacing at `0` to follow the project UI constraints.
- The Linear reference strongly prefers product screenshots as the main visual artifact. Interview OS is an app screen, so the implemented UI itself is the product artifact.
- The app keeps multiple semantic states because interview training requires warnings, completion, readiness, and privacy notes.
- No brand assets, logos, or trademarked Linear elements are reused.

## Current Implementation Touchpoints

- `src/App.css`: tokens, canvas, surfaces, buttons, focus states, progress indicators, and responsive heading sizes.
- `src/index.css`: root HTML background.
- `DESIGN.md`: reference document for future UI iteration.
