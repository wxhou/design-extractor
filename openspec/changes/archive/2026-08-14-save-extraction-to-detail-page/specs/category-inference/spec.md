## ADDED Requirements

### Requirement: Color scheme shall be inferred from background color

The system SHALL infer whether the site uses a light or dark color scheme based on the background color's luminance.

#### Scenario: Dark scheme inference
- **WHEN** extracted colors include a background color
- **AND** the background color's relative luminance is less than 0.5 (CSS relative luminance formula)
- **THEN** the `color_scheme` field SHALL be set to "dark"

#### Scenario: Light scheme inference
- **WHEN** extracted colors include a background color
- **AND** the background color's relative luminance is 0.5 or greater
- **THEN** the `color_scheme` field SHALL be set to "light"

#### Scenario: Default to light when no background
- **WHEN** no background color is found in extraction
- **THEN** the `color_scheme` field SHALL default to "light"

### Requirement: Category shall be inferred from color distribution

The system SHALL infer a design category based on the distribution and characteristics of extracted colors.

#### Scenario: Dark category when dark scheme dominates
- **WHEN** more than 60% of extracted colors have luminance < 0.3
- **THEN** the `category` field SHALL be set to "dark"

#### Scenario: Minimal category for muted colors
- **WHEN** the primary color has saturation < 30%
- **AND** color scheme is light
- **THEN** the `category` field SHALL be set to "minimal"

#### Scenario: SaaS category for blue/purple tones
- **WHEN** the primary color has a hue between 200 and 280 degrees (blue to purple)
- **AND** saturation > 50%
- **THEN** the `category` field SHALL be set to "saas"

#### Scenario: Playful category for vibrant colors
- **WHEN** the primary color has saturation > 70%
- **AND** lightness > 60%
- **THEN** the `category` field SHALL be set to "playful"

#### Scenario: Default category
- **WHEN** none of the above conditions are met
- **THEN** the `category` field SHALL be set to "minimal"

### Requirement: Category affects card display

The inferred category SHALL affect how the card is displayed in the gallery.

#### Scenario: Category badge shown on card
- **WHEN** card is displayed in the gallery grid
- **THEN** the category badge SHALL be displayed
- **AND** the badge SHALL use category-specific colors

#### Scenario: Category affects color scheme styling
- **WHEN** user views the detail page
- **THEN** the page SHALL use appropriate light/dark theme based on `color_scheme`
- **AND** the category-specific accent colors SHALL be used for UI elements
