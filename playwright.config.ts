import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "mobile",
      testIgnore: [/auth\.setup\.ts/, /mobile-layout\.spec\.ts/],
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        storageState: "playwright/.auth/user.json",
      },
    },
    {
      // WebKit が無い環境でも動くよう、iPhone 15 の画面・UA のまま Chromium で実行する。
      name: "iphone",
      testMatch: /mobile-layout\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["iPhone 15"],
        defaultBrowserType: "chromium",
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
  webServer: {
    // CI では先に `npm run build` を済ませてから起動する。
    command: process.env.CI ? "npm start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
