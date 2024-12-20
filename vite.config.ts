import shopify from 'vite-plugin-shopify'

export default {
  build: {
    minify: false
  },
  plugins: [
    shopify({
      sourceCodeDir:"src",
      entrypointsDir: 'src/entrypoints',
      snippetFile: "assets.liquid",
      versionNumbers: true
    }),
  ],
  test: {
    environment: "jsdom"
  }
}
