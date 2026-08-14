# Cebimde Kur Brand Integration — Design QA

- Source visual truth: `public/brand/logo-primary-no-tagline.svg` and `public/brand/app-icon.svg`
- Upstream source: `https://github.com/erkanaltuntastr-cmyk/cebimde-kur-assets/tree/main/brand`
- Implementation screenshot: `outputs/brand-qa/design-qa-mobile.png`
- Focused header capture: `outputs/brand-qa/design-qa-header.png`
- Combined comparison: `outputs/brand-qa/design-qa-comparison.png`
- Viewport: 390 × 844 CSS px
- Implementation pixels: 390 × 844
- Device pixel ratio: 1
- Source logo pixels: 1500 × 500
- Source app icon pixels: 1024 × 1024
- Generated PWA icon reviewed at: 512 × 512
- State: mobile converter, live rate, TRY input active, install prompt unavailable in the test browser

## Full-view comparison evidence

The mobile screen keeps the existing converter hierarchy, spacing, cards, controls, rate detail, disclaimer and credit unchanged. The new compact logo sits in the existing header space without horizontal overflow or collision with the live-rate status pill. The page has no horizontal overflow at 390 px.

## Focused comparison evidence

The focused header comparison preserves the source artwork's dark-green scan frame, coral `CEBİMDE`, dark-green `KUR`, cream symbols and blue lower-right corner. The PWA export preserves the icon artwork and uses a full-bleed dark-green background so Android and iOS can apply their own circle or squircle masks without transparent corner halos.

Focused review was required because the header logo and currency marks are too small to judge reliably from the full mobile screenshot alone.

## Required fidelity surfaces

- Fonts and typography: source SVG font declarations and weights are preserved; the compact lockup remains legible at 172 px wide.
- Spacing and layout rhythm: the logo and status pill fit on one row; existing shell padding and vertical rhythm are unchanged.
- Colors and visual tokens: `#102B25`, `#D55B39`, `#244D91`, `#F4EEDF` and `#FFFDF8` match the supplied brand palette.
- Image quality and asset fidelity: SVG masters are used directly in the UI; 180, 192 and 512 PNG exports were generated from the master at high quality. No placeholder, emoji or CSS reconstruction is used.
- Copy and content: the logo reads `CEBİMDE KUR`; converter copy and labels remain unchanged.

## Findings

No actionable P0, P1 or P2 visual differences were found.

The app-icon source has transparent rounded corners, while installed PWA exports use full-bleed dark green. This is an intentional platform adaptation rather than design drift: the operating system supplies the final icon mask.

## Primary interactions tested

- Entering `2500` TRY updated the GBP result to `38,73`.
- The swap-direction control moved the active state to GBP without losing either amount.
- The page loaded at the phone viewport with no horizontal overflow.
- Browser console errors and warnings: none.

## Comparison history

The first formal source-to-implementation comparison passed with no P0/P1/P2 fixes required. Before formal QA, the icon generation path exposed a Windows character-encoding problem; the renderer was fixed to read the SVG as UTF-8 and the icons were regenerated before comparison.

## Follow-up polish

No blocking polish remains. The tagline version stays available for wider marketing placements, while the no-tagline lockup is intentionally used in the compact mobile header.

final result: passed
