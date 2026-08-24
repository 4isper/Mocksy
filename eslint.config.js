const next = require("eslint-config-next/core-web-vitals");

module.exports = [
  ...next,
  {
    ignores: ["coverage/**", ".next/**", "node_modules/**"],
  },
  {
    rules: {
      // All editor media is stored as data: URLs (localStorage / share URL)
      // and device skins are static SVGs — next/image's optimizer can't
      // process either, so plain <img> is an intentional design choice.
      "@next/next/no-img-element": "off",
    },
  },
];
