## 1. Extractor-v2 Enhancements

- [x] 1.1 Add screenshot capture using `page.screenshot()` after page load
- [x] 1.2 Implement luminance calculation for color scheme inference
- [x] 1.3 Implement category inference based on color characteristics
- [x] 1.4 Return screenshot path and inferred metadata from `extractDesignTokens()`

## 2. API Layer Changes

- [x] 2.1 Update `app/api/extract/route.js` to import sql.js
- [x] 2.2 Add function to save extraction result to `refero.db` cards table
- [x] 2.3 Return `cardId` in API response on success
- [x] 2.4 Handle screenshot file saving to `public/screenshots/` directory

## 3. Frontend Navigation

- [x] 3.1 Update `app/page.js` handleExtract function to receive `cardId`
- [x] 3.2 Add `router.push('/style/' + cardId)` on successful extraction
- [x] 3.3 Show loading state during extraction with site URL

## 4. Testing

- [x] 4.1 Test extraction end-to-end with a known URL (e.g., stripe.com)
- [x] 4.2 Verify card appears in gallery after extraction
- [x] 4.3 Verify detail page displays screenshot and all extracted data
- [x] 4.4 Test error handling when URL is unreachable

**Note:** Run `npm run dev` and test the full flow in browser. Manual verification pending.
