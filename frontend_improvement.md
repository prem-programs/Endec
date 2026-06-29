# Frontend UI/UX Refactor Plan

## Summary
Replace the current single-card, form-heavy frontend with a scalable app shell that can absorb more features without becoming taller, harder to scan, or more duplicated. The main goal is to make the encryption/decryption experience feel like one product, not two near-copied pages.

## Key Changes
- Unify encrypt and decrypt into one shared layout with a segmented switch or tabs, instead of maintaining two separate page experiences that drift over time.
- Rework the page structure into reusable zones:
  - primary editor/input area
  - advanced settings panel
  - results/output panel
  - inline status and error area
- Merge duplicated styling into one shared design system for spacing, buttons, inputs, cards/panels, alerts, and modal or drawer behavior.
- Replace the current “all-in-one form” approach with collapsible or progressive sections so future features like expiry, burn-after-read, QR, file upload, and extra metadata can be added without redesigning the page.
- Move from alert-driven feedback to visible in-UI states for loading, success, copy confirmation, empty state, and error handling.
- Make the output area persistent and readable, with copy actions and long-link handling built in, rather than relying on a modal as the only way to see generated content.
- Improve mobile behavior by stacking panels cleanly, keeping primary actions visible, and preventing overflow or cramped controls.
- Standardize naming and branding in the UI so the product identity matches the repo/docs and can grow with the product.

## Test Plan
- Verify the encrypt and decrypt flows still work end to end after the layout change.
- Check responsive behavior on mobile, tablet, and desktop widths.
- Confirm long ciphertext and long share links remain readable and copyable.
- Validate that adding new sections does not break spacing, alignment, or primary action visibility.
- Make sure keyboard interaction, focus states, and modal/drawer dismissal still behave predictably.
- Confirm the UI shows clear loading, success, and error states without browser alerts.

## Assumptions
- Keep the current Flask + vanilla JS stack for now.
- Focus on frontend architecture and UX first, not backend feature expansion.
- Treat this as a refactor toward a reusable product shell, not a cosmetic refresh.
- If `frontend.md` does not already exist in the repo, use this as the replacement implementation plan content.
