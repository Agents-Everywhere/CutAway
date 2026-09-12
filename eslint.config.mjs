import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", ".cutaway/**"],
  },
  {
    files: [
      "apps/controller/src/**/*.ts",
      "examples/fieldnote/src/**/*.{ts,tsx}",
      "packages/cutaway-*/src/**/*.ts",
      "apps/web/src/components/cutaway/**/*.{ts,tsx}",
      "apps/web/src/lib/cutaway-client.ts",
      "apps/web/src/lib/server/cutaway/**/*.ts",
      "apps/web/src/app/api/cutaway/**/*.ts",
      "scripts/*cutaway*.ts",
    ],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
