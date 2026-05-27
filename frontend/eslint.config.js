export default [
  {
    ignores: ["build/", "node_modules/"]
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        module: "readonly",
        require: "readonly",
        process: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];
