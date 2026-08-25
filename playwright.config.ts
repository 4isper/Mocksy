import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // Retry flaky browser tests on CI (video/GIF exports are timing-sensitive
  // and GitHub-hosted macOS runners vary wildly in speed); keep local runs
  // single-shot for fast iteration.
  retries: process.env.CI ? 3 : 0,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000"
  },
  projects: [
    {
      name: "chromium",
      // Video/GIF exports run MediaRecorder + the 32MB FFmpeg WASM encoder
      // under SwiftShader; at the default worker count several run in
      // parallel and starve the machine, timing out exports and flaking
      // unrelated tests (fullscreen, a11y). Cap to keep headroom.
      workers: 2,
      // Mobile-only specs (stacked bottom-sheet layout) run under
      // chromium-mobile; on the desktop project they'd assert against a
      // 1280px layout and fail by design.
      testIgnore: /.*(visual|mobile)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // ffmpeg-core.wasm (32MB) loads + converts in-browser; disable the
        // sandbox and enable SwiftShader so captureStream works in headless.
        launchOptions: {
          chromiumSandbox: false,
          args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        }
      }
    },
    {
      name: "chromium-mobile",
      // Touch/coarse-viewport coverage for the stacked single-column layout
      // (globals.css <=980px). Video-export suites stay desktop-only: they
      // are slow and rely on desktop SwiftShader tuning.
      testIgnore: /.*(visual|editor|preview-export[^/]*)\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          chromiumSandbox: false,
          args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
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
