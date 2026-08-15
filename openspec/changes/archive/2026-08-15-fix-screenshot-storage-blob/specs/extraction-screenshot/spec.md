# extraction-screenshot Delta

## MODIFIED Requirements

### Requirement: Screenshot shall be captured during extraction

The extraction process SHALL capture a screenshot of the target website using Playwright's screenshot capability.

#### Scenario: Screenshot captured at extraction time
- **WHEN** extraction begins with a valid URL
- **THEN** after the page loads and before extraction completes
- **AND** the system SHALL capture a viewport screenshot (1440px wide, `fullPage: false` — current `src/extractor-v2.js` behavior, unchanged)
- **AND** the screenshot buffer SHALL be handed to the storage layer for blob upload (see `screenshot-blob-storage` capability)

#### Scenario: Screenshot format and local disk
- **WHEN** screenshot is captured
- **THEN** the raw capture SHALL be in PNG format (current behavior), converted to JPEG (quality ~80) before storage upload
- **AND** the system SHALL NOT write screenshot files to local disk — `public/screenshots/` writes, the `/api/screenshots/` route, and the `/tmp/screenshot-*.png` debug writes in the AI-enrichment path are removed

### Requirement: Screenshot path stored in database

The screenshot location SHALL be stored in the database record as a Vercel Blob HTTPS URL for retrieval by the detail page. Local file paths and base64 data URIs SHALL NOT be stored for newly extracted cards.

#### Scenario: Screenshot URL in database record
- **WHEN** screenshot is uploaded successfully
- **THEN** the `screenshot` field in the `cards` table SHALL contain the blob HTTPS URL
- **AND** the `preview` field SHALL contain the same URL
- **AND** neither field SHALL contain a `data:` URI or a server-local path

#### Scenario: Detail page displays screenshot
- **WHEN** user navigates to `/style/<cardId>`
- **THEN** the detail page SHALL display the screenshot from the database record
- **AND** if no screenshot exists (capture failed at extraction time), a placeholder SHALL be shown
