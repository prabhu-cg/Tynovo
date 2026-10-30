/** The `brotli` package ships no types. Pure JavaScript Brotli (no WebAssembly, so the page's strict content security policy needs no exception). */
declare module 'brotli/compress' {
  export default function compress(input: Uint8Array, options?: { mode?: number; quality?: number; lgwin?: number }): Uint8Array | null
}
declare module 'brotli/decompress' {
  export default function decompress(input: Uint8Array): Uint8Array
}
