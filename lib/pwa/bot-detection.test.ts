import { test } from "node:test";
import assert from "node:assert/strict";
import { estRobot, userAgentEstRobot } from "./bot-detection.ts";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const ADSBOT = "Mozilla/5.0 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)";
const LIGHTHOUSE = "Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.0.0 Mobile Safari/537.36 Lighthouse";
const HEADLESS = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36";
const GENERIC_CRAWLER = "SomeCustomCrawler/1.0 (+https://example.com/spider)";

test("userAgentEstRobot : reconnaît les robots/outils listés", () => {
  assert.equal(userAgentEstRobot(GOOGLEBOT), true);
  assert.equal(userAgentEstRobot(ADSBOT), true);
  assert.equal(userAgentEstRobot(LIGHTHOUSE), true);
  assert.equal(userAgentEstRobot(HEADLESS), true);
  assert.equal(userAgentEstRobot(GENERIC_CRAWLER), true);
});

test("userAgentEstRobot : jamais un vrai Chrome Android", () => {
  assert.equal(userAgentEstRobot(CHROME_ANDROID), false);
});

test("estRobot : navigator.webdriver suffit à lui seul", () => {
  assert.equal(estRobot(CHROME_ANDROID, true), true);
  assert.equal(estRobot(CHROME_ANDROID, false), false);
});
