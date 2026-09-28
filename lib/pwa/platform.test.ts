import { test } from "node:test";
import assert from "node:assert/strict";
import { detecterNavigateurAndroid, estAndroid, estNavigateurEmbarque } from "./platform.ts";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const SAMSUNG_INTERNET =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/115.0.0.0 Mobile Safari/537.36";
const OPERA_ANDROID =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 OPR/76.2";
const EDGE_ANDROID =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0";
const FIREFOX_ANDROID =
  "Mozilla/5.0 (Android 13; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0";
const FACEBOOK_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A]";
const INSTAGRAM_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.0";
const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

test("estAndroid : reconnaît un Android, jamais iOS ni desktop", () => {
  assert.equal(estAndroid(CHROME_ANDROID), true);
  assert.equal(estAndroid(IOS_SAFARI), false);
  assert.equal(estAndroid(DESKTOP_CHROME), false);
});

test("detecterNavigateurAndroid : identifiants spécifiques avant le repli chrome", () => {
  assert.equal(detecterNavigateurAndroid(CHROME_ANDROID), "chrome");
  assert.equal(detecterNavigateurAndroid(SAMSUNG_INTERNET), "samsung");
  assert.equal(detecterNavigateurAndroid(OPERA_ANDROID), "opera");
  assert.equal(detecterNavigateurAndroid(EDGE_ANDROID), "edge");
  assert.equal(detecterNavigateurAndroid(FIREFOX_ANDROID), "firefox");
  assert.equal(detecterNavigateurAndroid(FACEBOOK_WEBVIEW), "embarque_facebook");
  assert.equal(detecterNavigateurAndroid(INSTAGRAM_WEBVIEW), "embarque_instagram");
});

test("estNavigateurEmbarque : seuls les navigateurs intégrés sont signalés", () => {
  assert.equal(estNavigateurEmbarque("embarque_facebook"), true);
  assert.equal(estNavigateurEmbarque("embarque_instagram"), true);
  assert.equal(estNavigateurEmbarque("embarque_tiktok"), true);
  assert.equal(estNavigateurEmbarque("chrome"), false);
  assert.equal(estNavigateurEmbarque("samsung"), false);
});
