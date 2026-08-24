import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "backend",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "frontend",
          include: ["components/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
