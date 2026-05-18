import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "convex",
      include: ["convex/**/*.test.ts"],
      environment: "edge-runtime",
    },
  },
  {
    test: {
      name: "dashboard",
      include: ["dashboard/src/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      globals: true,
    },
    esbuild: {
      jsx: "automatic",
    },
  },
  {
    extends: "sdk-react/vitest.config.ts",
    test: {
      name: "sdk-react",
      include: ["sdk-react/src/**/*.test.{ts,tsx}"],
    },
  },
]);
