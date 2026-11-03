import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Hand-written application and tooling code only. Generated bundles, the copied
// reference tree and translated locale payloads stay out of the baseline.
const applicationFiles = [
  "client/**/*.js",
  "server/**/*.js",
  "scripts/**/*.js",
  "scripts/**/*.mjs",
  "config/**/*.js",
  "database/scripts/**/*.mjs",
  "vite.config.js",
  "webpack.config.cjs",
];

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "dist/**",
      "public/**",
      "client/locales/**",
      "docs/reference/**",
      "coverage/**",
    ],
  },
  {
    // The core recommended set is correctness only, no formatting rules.
    // Files outside applicationFiles match no config block and are not linted.
    files: applicationFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Baseline only: unused values are reported but do not fail the run yet.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Each folder has a different set of ambient globals (window, document,
      // process, Buffer, __dirname). Declaring them all is noise until the lint
      // gate is enforced, so undefined-name detection stays off.
      "no-undef": "off",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
