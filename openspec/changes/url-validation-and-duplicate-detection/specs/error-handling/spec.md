## ADDED Requirements

### Requirement: Friendly error messages

The system SHALL return user-friendly Chinese error messages instead of raw error codes.

#### Scenario: Domain not resolvable
- **WHEN** Playwright throws `net::ERR_NAME_NOT_RESOLVED`
- **THEN** response SHALL be `{"success": false, "error": "无法访问该网站，请检查域名是否正确"}`

#### Scenario: Connection refused
- **WHEN** Playwright throws `net::ERR_CONNECTION_REFUSED`
- **THEN** response SHALL be `{"success": false, "error": "连接被拒绝，网站可能暂时不可用"}`

#### Scenario: Connection timed out
- **WHEN** Playwright throws `net::ERR_TIMED_OUT`
- **THEN** response SHALL be `{"success": false, "error": "访问超时，请稍后重试"}`

#### Scenario: Protocol error (invalid URL)
- **WHEN** Playwright throws protocol error for invalid URL
- **THEN** response SHALL be `{"success": false, "error": "无法访问该网站，请检查域名是否正确"}`

#### Scenario: Unknown error
- **WHEN** Playwright throws an unexpected error
- **THEN** response SHALL be `{"success": false, "error": "提取失败，请稍后重试"}`
- **AND** error SHALL be logged to console

### Requirement: Frontend error display

The frontend SHALL display error messages in a user-friendly way.

#### Scenario: Extraction fails
- **WHEN** API returns `{"success": false, "error": "..."}`
- **THEN** frontend SHALL display the error message to user
- **AND** loading state SHALL be cleared
- **AND** user SHALL be able to retry
