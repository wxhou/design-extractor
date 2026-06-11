/**
 * Shared utility functions for design-extractor API routes
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safely parse JSON with a fallback value on failure
 */
export function safeParse(json, fallback = []) {
  try {
    return JSON.parse(json || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

/**
 * Validate that an ID string is a valid UUID v4 format
 */
export function isValidUUID(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}