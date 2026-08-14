## ADDED Requirements

### Requirement: Screenshot shall be captured during extraction

The extraction process SHALL capture a screenshot of the target website using Playwright's screenshot capability.

#### Scenario: Screenshot captured at extraction time
- **WHEN** extraction begins with a valid URL
- **THEN** after the page loads and before extraction completes
- **AND** the system SHALL capture a full-page screenshot
- **AND** the screenshot SHALL be saved to `public/screenshots/<cardId>.png`

#### Scenario: Screenshot dimensions and quality
- **WHEN** screenshot is captured
- **THEN** the image SHALL use default Playwright screenshot quality
- **AND** the image SHALL capture the full scrollable page (fullPage: true)
- **AND** the image SHALL be in PNG format

### Requirement: Screenshot path stored in database

The screenshot file path SHALL be stored in the database record for retrieval by the detail page.

#### Scenario: Screenshot path in database record
- **WHEN** screenshot is saved successfully
- **THEN** the `screenshot` field in the `cards` table SHALL contain the path relative to public folder
- **AND** the path SHALL be `/screenshots/<cardId>.png`
- **AND** the `preview` field SHALL contain the same path

#### Scenario: Detail page displays screenshot
- **WHEN** user navigates to `/style/<cardId>`
- **THEN** the detail page SHALL display the screenshot from the database record
- **AND** if no screenshot exists, a placeholder SHALL be shown
