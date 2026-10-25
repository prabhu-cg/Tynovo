/**
 * Version of the glyph-generation algorithm. Bump it whenever a change would alter the outlines
 * produced from the same DNA (new recipe geometry, different rounding rules...). Saved typefaces
 * record the version they were designed against so a mismatch can be reported rather than hidden.
 */
export const ENGINE_VERSION = 1
