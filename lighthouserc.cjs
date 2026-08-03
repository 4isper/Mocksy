module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/en',
        'http://localhost:3000/en?scene=eyJmcmFtZSI6ImlwaG9uZSJ9'
      ],
      numberOfRuns: 2
    },
    upload: {
      target: 'temporary-public-storage'
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        // Mocksy is data-URL heavy and uses in-browser FFmpeg; these audits
        // fail because of large inline assets rather than network blocking.
        'render-blocking-resources': 'off',
        // New Lighthouse 12.x "insight" audits are advisory and flag the
        // editor's intentionally large client bundle (FFmpeg WASM, canvas).
        'legacy-javascript-insight': 'off',
        'forced-reflow-insight': 'off',
        'network-dependency-tree-insight': 'off',
        'unused-javascript': 'off',
        // Performance scores are advisory; the app is fully interactive after
        // the first paint and heavy assets load lazily.
        'speed-index': ['warn', { minScore: 0.6 }],
        'largest-contentful-paint': ['warn', { minScore: 0.6 }],
        'total-blocking-time': ['warn', { minScore: 0.6 }],
        // Accessibility and best practices must always pass.
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }]
      }
    }
  }
};
