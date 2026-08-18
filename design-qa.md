# Camera Result Hierarchy — Design QA

- Source visual truth: `C:/Users/WebApp/Documents/Codex/2026-08-12/ben-u-anda-t-rkiye-deyim/.codex-remote-attachments/019ff4e0-bb76-70d0-bac0-655a4d2a6def/dccfb866-2706-4478-a6e1-bac82feeaf7e/1-Photo-1.jpg`
- Implementation screenshot: `C:/Users/WebApp/.codex/visualizations/2026/08/12/019ff4e0-bb76-70d0-bac0-655a4d2a6def/camera-result-compact-qa.png`
- Combined comparison: `C:/Users/WebApp/.codex/visualizations/2026/08/12/019ff4e0-bb76-70d0-bac0-655a4d2a6def/camera-result-comparison-qa.png`
- Viewport: 464 × 1234 CSS px for app-owned content
- Source pixels: 464 × 1344; the top 110 px of browser chrome were excluded, leaving a normalized 464 × 1234 comparison region
- Implementation pixels: 464 × 1234 at device pixel ratio 1
- State: OCR result, TRY selected, one `9000.00` candidate, GBP conversion visible, captured-photo preview

## Full-view comparison evidence

The normalized side-by-side comparison shows that the converter header, currency selector, colors, radii and mobile shell remain consistent with the supplied screen. The result now appears immediately after the currency selector and before the image. The image changed from a tall 4:3 region to a compact 2:1 region, so the result, photo, status and primary action fit into a much shorter scan path.

## Focused region comparison evidence

The result and photo region is large enough to judge in the full 464 px comparison, so a separate magnified crop was not required. Both monetary values remain readable on one row, the `yaklaşık` relationship is visible between them, the photographed `9000.00` remains centered, and no amount or label is clipped.

## Required fidelity surfaces

- Fonts and typography: the existing family and weight system is preserved. Monetary values have stronger optical weight than their 8 px uppercase labels, with no wrapping at the reference width.
- Spacing and layout rhythm: the result uses a balanced three-column grid and 15 px internal padding. The photo height is reduced by roughly one third while retaining the existing 22 px radius and section spacing.
- Colors and visual tokens: the result retains the established pale-green background, dark-green values, muted labels and cream page surface.
- Image quality and asset fidelity: the original captured image remains the preview source and uses the existing grayscale/contrast treatment. The shorter container changes only the visible crop; OCR still processes the prepared full image.
- Copy and content: `OKUNAN FİYAT`, `yaklaşık` and `KARŞILIĞI` communicate the relationship without adding product claims or changing the privacy message.

## Findings

No actionable P0, P1 or P2 visual differences remain. Moving the result and shortening the photo are intentional deviations requested by the user, not fidelity regressions.

## Primary interactions tested

- The result state rendered with TRY selected and the expected GBP conversion.
- Currency buttons, camera action and photo-selection action remained present in the accessibility tree.
- The page produced no browser console errors.
- Production build, 22 automated tests, lint and TypeScript checks passed.

## Comparison history

Initial evidence showed the conversion result below the photo and both action buttons, requiring vertical scrolling. The first implementation pass moved the result above the image, converted it to a compact horizontal card and changed the viewport from 4:3 to 2:1. The post-fix combined comparison shows the result above the fold with no clipping or hierarchy regression; no further P0/P1/P2 changes were required.

## Follow-up polish

No blocking polish remains. Very large future amounts with substantially more digits may merit a dedicated extreme-value responsive test.

final result: passed
