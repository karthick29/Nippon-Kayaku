// ketcher-standalone's package exports map its build subpaths to JS without a
// "types" condition, so TypeScript can't find declarations for them. Every
// build exports the same API as the package root; reuse its types.
declare module 'ketcher-standalone/dist/binaryWasmNoRender' {
  export * from 'ketcher-standalone';
}
