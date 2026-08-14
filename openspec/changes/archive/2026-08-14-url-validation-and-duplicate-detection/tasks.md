## 1. URL Validation & Normalization

- [x] 1.1 Add URL validation regex to extractor-v2.js
- [x] 1.2 Implement `normalizeUrl()` function
- [x] 1.3 Add validation before extraction starts

## 2. Duplicate Detection

- [x] 2.1 Add function to check if site exists in database
- [x] 2.2 Implement normalized URL comparison (remove www, trailing slash)
- [x] 2.3 Return `isDuplicate: true` and existing `cardId` when duplicate found
- [x] 2.4 Skip extraction if duplicate found

## 3. Error Handling

- [x] 3.1 Add Playwright error to friendly message mapping
- [x] 3.2 Return user-friendly Chinese error messages
- [x] 3.3 Log full error for debugging

## 4. Frontend Updates

- [x] 4.1 Add basic URL format validation in `handleSubmit()`
- [x] 4.2 Handle `isDuplicate` response and show toast
- [x] 4.3 Display friendly error messages from API

## 5. Testing

- [x] 5.1 Test invalid URL: "hello world" → ✓ 返回"请输入有效的网址"
- [x] 5.2 Test duplicate: www.baidu.com → ✓ 返回 isDuplicate: true
- [x] 5.3 Test normal extraction → (已通过之前的测试)
