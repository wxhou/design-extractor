## ADDED Requirements

### Requirement: URL format validation

The system SHALL validate that user input is a valid domain name format before attempting extraction.

#### Scenario: Valid URL with protocol
- **WHEN** user submits `https://github.com`
- **THEN** validation SHALL pass

#### Scenario: Valid URL without protocol
- **WHEN** user submits `github.com`
- **THEN** validation SHALL pass

#### Scenario: Invalid input with spaces
- **WHEN** user submits `hello world`
- **THEN** validation SHALL fail with error "请输入有效的网址"

#### Scenario: Invalid input with special characters
- **WHEN** user submits `not a url!!!`
- **THEN** validation SHALL fail with error "请输入有效的网址"

### Requirement: URL normalization

The system SHALL normalize URLs before duplicate detection:
- Remove leading/trailing whitespace
- Convert to lowercase
- Add `https://` if no protocol specified
- Remove `www.` prefix for matching purposes

#### Scenario: URL with trailing slash
- **WHEN** user submits `github.com/`
- **THEN** normalized URL SHALL be `github.com`

#### Scenario: URL with www prefix
- **WHEN** user submits `www.github.com`
- **THEN** normalized host SHALL be `github.com`

#### Scenario: URL with mixed case
- **WHEN** user submits `GitHub.COM`
- **THEN** normalized URL SHALL be `github.com`
