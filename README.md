# diffpack

Compare package versions across ecosystems. Clean. Fast. Source-aware.

## Features

- **Multi-registry support** - Compare packages from npm and crates.io
- **Source-aware diffs** - View actual code changes between versions
- **Fast & lightweight** - Built with Astro for optimal performance
- **Dark mode** - Beautiful UI that adapts to your preference

## Getting Started

### Installation

```bash
bun install
```

### WASM Development

The core diffing logic is implemented in Rust and compiled to WebAssembly. To rebuild the WASM module:

```bash
bun run build:wasm
```

This requires [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/) to be installed on your system.

### Development Server

```bash
bun run dev
```

### Build for production

```bash
bun run build
```

## Tech Stack

- [Astro](https://astro.build) - Web framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Biome](https://biomejs.dev) - Linting & formatting

## Supported Registries

- **npm** - JavaScript & TypeScript packages
- **crates.io** - Rust ecosystem packages

More registries coming soon.

