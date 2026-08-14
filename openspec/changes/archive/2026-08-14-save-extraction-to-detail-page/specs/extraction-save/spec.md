## ADDED Requirements

### Requirement: Extraction results shall be saved to database

After successful design token extraction, the system SHALL save all extracted data to the `cards` table in `refero.db`.

The saved fields SHALL include:
- `id`: Auto-generated UUID
- `name`: Site name from extraction
- `url`: Original URL
- `colors`: JSON array of color objects with name, hex, role, description
- `fonts`: JSON array of font objects with fontFamily, weight, description
- `north_star`: Design philosophy text
- `color_scheme`: "light" or "dark"
- `category`: Design category (minimal/saas/editorial/retro/playful/gradient/dark)
- `typography`: JSON object with font details
- `type_scale`: JSON object with type scale steps
- `gradient`: JSON array of gradient values
- `screenshot`: Path to screenshot file
- `preview`: Same as screenshot (for compatibility)
- `raw_data`: JSON with any additional raw extracted data
- `created_at`: Current timestamp

#### Scenario: Successful extraction saves all fields
- **WHEN** user submits a valid URL and extraction completes successfully
- **THEN** all extracted fields SHALL be written to a new row in the `cards` table
- **AND** the system SHALL return a response containing `cardId` with the new card's ID

#### Scenario: Extraction with AI enrichment saves semantic names
- **WHEN** extraction includes AI enrichment (useAI: true)
- **THEN** color names SHALL include AI-generated semantic names (e.g., "Lime Fizz" not just "Primary")
- **AND** north_star SHALL contain the AI-generated design philosophy

#### Scenario: API returns card ID for navigation
- **WHEN** extraction and save complete successfully
- **THEN** the API response SHALL include `cardId: <uuid>`
- **AND** the API response SHALL include `success: true`
- **AND** the frontend SHALL navigate to `/style/<cardId>`

### Requirement: Failed extraction does not create database record

If extraction fails for any reason, the system SHALL NOT create a partial record in the database.

#### Scenario: Network error during extraction
- **WHEN** URL is unreachable or times out
- **THEN** no database record SHALL be created
- **AND** the API SHALL return `success: false` with `error` message

#### Scenario: AI enrichment failure does not block save
- **WHEN** AI enrichment fails but basic extraction succeeds
- **THEN** the system SHALL save the extraction with basic (non-AI) names
- **AND** the `north_star` field MAY be null or contain a basic description
