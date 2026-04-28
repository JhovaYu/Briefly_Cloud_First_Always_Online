/**
 * Cross-environment UUID v4 generator.
 *
 * crypto.randomUUID() requires a secure context (HTTPS or localhost).
 * On HTTP public IPs it is undefined.
 *
 * Strategy:
 * 1. crypto.randomUUID() — native, RFC 4122 compliant (secure contexts)
 * 2. crypto.getRandomValues + RFC 4122 construction — fallback (secure contexts)
 * 3. Math.random + Date.now — demo/legacy fallback (non-secure, non-prod)
 */
export function createUuid(): string {
  // Path 1: native browser/Web Crypto (secure context)
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // Path 2: Web Crypto with manual RFC 4122 v4 construction
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Set variant bits per RFC 4122: version 4 (random) + variant 10
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  // Path 3: demo/legacy fallback (non-secure context, non-prod)
  // Math.random is not cryptographically random but works when no Web Crypto is available.
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}