## ADDED Requirements

### Requirement: Duplicate site detection

Before creating a new card, the system SHALL check if the site has already been extracted.

#### Scenario: Exact duplicate detected
- **WHEN** user submits `github.com` and `github.com` already exists in database
- **THEN** the system SHALL return existing card with `isDuplicate: true`

#### Scenario: Duplicate with www prefix
- **WHEN** user submits `www.github.com` and `github.com` exists
- **THEN** the system SHALL return existing card with `isDuplicate: true`

#### Scenario: Duplicate without www prefix
- **WHEN** user submits `github.com` and `www.github.com` exists
- **THEN** the system SHALL return existing card with `isDuplicate: true`

#### Scenario: No duplicate found
- **WHEN** user submits `newsite.com` and no matching site exists
- **THEN** the system SHALL proceed with extraction and create new card

### Requirement: Duplicate response format

When a duplicate is detected, the system SHALL return a specific response format.

#### Scenario: Duplicate response includes cardId
- **WHEN** duplicate is detected
- **THEN** response SHALL include `cardId: <existing-uuid>`
- **AND** response SHALL include `isDuplicate: true`
- **AND** response SHALL include `message: "该网站已提取过"`

#### Scenario: Frontend handles duplicate response
- **WHEN** frontend receives `isDuplicate: true`
- **THEN** frontend SHALL navigate to `/style/<cardId>`
- **AND** frontend MAY show a toast message "已跳转到已有记录"
