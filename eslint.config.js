import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "VariableDeclarator[init.type='MemberExpression'][init.object.name='supabase'][init.property.name='rpc']",
          message: "Do not detach supabase.rpc from the client. Call supabase.rpc(...) directly.",
        },
        {
          selector: "VariableDeclarator[init.type='MemberExpression'][init.object.name='supabase'][init.property.name='from']",
          message: "Do not detach supabase.from from the client. Call supabase.from(...) directly.",
        },
        {
          selector: "VariableDeclarator[init.type='TSAsExpression'][init.expression.type='MemberExpression'][init.expression.object.name='supabase'][init.expression.property.name='rpc']",
          message: "Do not cast-detach supabase.rpc from the client. Call supabase.rpc(...) directly.",
        },
        {
          selector: "VariableDeclarator[init.type='TSAsExpression'][init.expression.type='MemberExpression'][init.expression.object.name='supabase'][init.expression.property.name='from']",
          message: "Do not cast-detach supabase.from from the client. Call supabase.from(...) directly.",
        },
        {
          selector: "CallExpression[callee.type='TSAsExpression'][callee.expression.type='MemberExpression'][callee.expression.object.name='supabase'][callee.expression.property.name='rpc']",
          message: "Do not call a casted supabase.rpc callee. Call supabase.rpc(...) directly.",
        },
        {
          selector: "CallExpression[callee.type='TSAsExpression'][callee.expression.type='MemberExpression'][callee.expression.object.name='supabase'][callee.expression.property.name='from']",
          message: "Do not call a casted supabase.from callee. Call supabase.from(...) directly.",
        },
        {
          selector: "CallExpression[callee.type='TSAsExpression'][callee.expression.type='TSAsExpression'][callee.expression.expression.type='MemberExpression'][callee.expression.expression.object.name='supabase'][callee.expression.expression.property.name='rpc']",
          message: "Do not call a casted supabase.rpc callee. Call supabase.rpc(...) directly.",
        },
        {
          selector: "CallExpression[callee.type='TSAsExpression'][callee.expression.type='TSAsExpression'][callee.expression.expression.type='MemberExpression'][callee.expression.expression.object.name='supabase'][callee.expression.expression.property.name='from']",
          message: "Do not call a casted supabase.from callee. Call supabase.from(...) directly.",
        },
      ],
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/theme-provider.tsx",
      "src/components/theme-config-provider.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
