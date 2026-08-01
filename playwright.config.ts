import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000"
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*visual\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // ffmpeg-core.wasm (32MB) loads + converts in-browser; disable the
        // sandbox and enable SwiftShader so captureStream works in headless.
        launchOptions: {
          chromiumSandbox: false,
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        }
      }
    },
    {
      name: "chromium-vrt",
      testMatch: /.*visual\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          chromiumSandbox: false,
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--font-render-hinting=none"]
        }
      }
    }
  ]
});
