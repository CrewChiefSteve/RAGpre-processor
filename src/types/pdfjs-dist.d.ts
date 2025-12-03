// Type declarations for pdfjs-dist to satisfy TypeScript module resolution
// These modules are dynamically loaded at runtime, so we just declare them to avoid TS errors

declare module 'pdfjs-dist/build/pdf.mjs' {
  const content: any;
  export = content;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const content: any;
  export = content;
}
