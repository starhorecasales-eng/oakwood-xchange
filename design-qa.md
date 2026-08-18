# Design QA — Simplified manual and camera converter

- Source visual truth: `C:\Users\WebApp\Documents\Codex\2026-08-12\ben-u-anda-t-rkiye-deyim\.codex-remote-attachments\019ff4e0-bb76-70d0-bac0-655a4d2a6def\dccfb866-2706-4478-a6e1-bac82feeaf7e\1-Photo-1.jpg`
- Implementation: `http://localhost:4173/`
- Implementation screenshot: `C:\Users\WebApp\Documents\Codex\2026-08-12\ben-u-anda-t-rkiye-deyim\qa\mobile-home-390x844.png`
- Combined comparison: `C:\Users\WebApp\Documents\Codex\2026-08-12\ben-u-anda-t-rkiye-deyim\qa\design-comparison.png`
- Viewport: 390 × 844 CSS px
- Pixels and normalization: source 464 × 1280 px; implementation 390 × 844 px at the browser's 1× capture; the comparison normalizes both panels to 390 px width. The source includes mobile browser chrome and shows the camera result state, while the implementation is a content-only idle state after the requested one-screen restructure, so comparison is qualitative rather than pixel-exact.
- State: simplified TRY → GBP manual conversion with the inline camera ready to open. EUR was also tested as the manual output and camera output.

**Findings**

- No actionable P0, P1, or P2 issues remain.
- Fonts and typography: Geist preserves the compact geometric hierarchy of the source. Labels, amounts, and status copy remain legible at 390 px without truncation.
- Spacing and layout rhythm: the manual converter and every camera control fit in the initial 390 × 844 viewport. The secondary legal/footer copy starts at the lower edge, but no primary control is hidden.
- Colors and visual tokens: the dark green, cream, coral TRY, blue GBP, and muted green camera panel remain consistent with the source. EUR uses a distinct green accent without breaking the existing palette.
- Image quality and asset fidelity: the supplied vector brand lockup remains sharp. The idle camera viewport intentionally uses a neutral currency preview; captured photos retain the existing full-bleed crop and on-device processing flow.
- Copy and content: explanatory copy and duplicate formatted amounts were removed. Currency labels, camera actions, the short privacy statement, and essential stale-rate warning remain clear.

**Open Questions**

- The source reference shows an OCR result while this pass compares the new initial one-screen state. The existing result-above-photo behavior is preserved in the component, but a real camera permission/OCR run was not triggered during automated visual QA.

**Primary interactions tested**

- Manual TRY → GBP conversion rendered with a live rate.
- Manual TRY → EUR selection updated 1,000 TRY to approximately 18.02 EUR.
- Selecting a currency already used in the opposite row exchanged the pair and retained both values.
- Camera output selector accepted EUR and GBP.
- All 22 automated tests passed, including offline rate fallback, OCR parsing, security headers, and production server integration.
- Browser console checked: no warnings or errors.

**Focused region comparison**

- No separate crop was needed: at the normalized 390 px panel width, the brand, both manual rows, camera selectors, viewport, action buttons, privacy message, and rate strip are readable in the combined comparison.

**Comparison history**

- Initial comparison: no P0/P1/P2 findings. The requested structural difference—manual conversion above the camera section—is intentional. No post-comparison visual fix loop was required.

**Follow-up Polish**

- P3: on devices shorter than roughly 800 CSS px, the legal copy will require a small scroll; primary conversion and camera actions remain above it.

**Implementation Checklist**

- [x] Combine manual and camera conversion on the home page.
- [x] Keep the primary interactions within the initial mobile viewport.
- [x] Add EUR to manual and camera source/target selection.
- [x] Preserve last-known-rate fallback and on-device OCR privacy.
- [x] Verify responsive rendering, interactions, console, lint, TypeScript, build, and tests.

final result: passed
