import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the jsx-a11y plugin (with a small
  // subset of rules); enable the full recommended rule set on top of it.
  {
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Conscious triage: the only autoFocus uses are on the first text
      // field of small edit dialogs, where moving focus into the dialog is
      // the expected (and screen-reader-friendly) behaviour per the WAI
      // dialog pattern. Blanket removal would hurt usability.
      "jsx-a11y/no-autofocus": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
