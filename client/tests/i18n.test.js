import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import i18n from "../i18n/index.js";
import { API_ERROR_KEYS } from "../domain/api-error.js";
import {
  calendarLocaleForLanguage,
  DEFAULT_LANGUAGE,
  localeForLanguage,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
} from "../i18n/languages.js";

const namespaces = ["common", "auth", "calendar", "management", "report", "kiosk"];

const readJson = (language, namespace) => JSON.parse(fs.readFileSync(
  new URL(`../locales/${language}/${namespace}.json`, import.meta.url),
  "utf8"
));

const flatten = (value, prefix = "", result = new Map()) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, result);
    else result.set(path, child);
  }
  return result;
};

const interpolationTokens = (value) => [...String(value).matchAll(/{{\s*([^},\s]+)[^}]*}}/g)]
  .map((match) => match[1])
  .sort();

test("English is the default and Indonesian is the second supported language", () => {
  assert.equal(DEFAULT_LANGUAGE, "en");
  assert.deepEqual(SUPPORTED_LANGUAGES.map(({ code }) => code), ["en", "id"]);
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("id_ID"), "id");
  assert.equal(normalizeLanguage("fr"), "en");
  assert.equal(localeForLanguage("en-US"), "en-GB");
  assert.equal(localeForLanguage("id_ID"), "id-ID");
  assert.equal(calendarLocaleForLanguage("en"), "en-gb");
  assert.equal(i18n.getFixedT("en", "common")("brand.name"), "Room Booking");
  assert.equal(i18n.getFixedT("id", "common")("language.indonesian"), "Bahasa Indonesia");
});

test("registered dynamic translation keys exist in every supported language", () => {
  const keys = [
    "calendar:editor.created",
    "calendar:editor.updated",
    "calendar:editor.createError",
    "calendar:editor.updateError",
    "calendar:validation.invalidTime",
    "calendar:validation.pastCreate",
    "calendar:validation.pastEdit",
    "calendar:validation.endBeforeStart",
    "calendar:validation.roomRequired",
    "management:devices.status.active",
    "management:devices.status.revoked",
    "management:devices.status.unknown",
    "management:users.createError",
    "management:users.updateError",
    "management:users.createTitle",
    "management:users.editTitle",
    "common:actions.create",
    "common:actions.save",
    "common:roles.admin",
    "common:roles.user",
    "common:dataGrid.displayedRows",
    "common:dataGrid.displayedRowsMore",
    "kiosk:states.unknown",
    "kiosk:states.available",
    "kiosk:states.upcoming",
    "kiosk:states.occupied",
  ];

  for (const { code } of SUPPORTED_LANGUAGES) {
    for (const qualifiedKey of keys) {
      const [namespace, key] = qualifiedKey.split(":", 2);
      assert.equal(i18n.exists(key, { lng: code, ns: namespace }), true, `${code}:${qualifiedKey}`);
    }
    const t = i18n.getFixedT(code, "kiosk");
    assert.notEqual(t("schedule.count", { count: 1 }), "schedule.count");
    assert.notEqual(t("schedule.count", { count: 2 }), "schedule.count");
    for (const key of Object.values(API_ERROR_KEYS)) {
      assert.equal(i18n.exists(key, { lng: code, ns: "common" }), true, `${code}:common:${key}`);
    }
    for (const { labelKey } of SUPPORTED_LANGUAGES) {
      assert.equal(i18n.exists(labelKey, { lng: code, ns: "common" }), true, `${code}:common:${labelKey}`);
    }
  }
});

test("target catalogs match every English source key and interpolation", () => {
  for (const { code } of SUPPORTED_LANGUAGES.filter(({ code }) => code !== DEFAULT_LANGUAGE)) {
    for (const namespace of namespaces) {
      const english = flatten(readJson(DEFAULT_LANGUAGE, namespace));
      const translationCatalog = flatten(readJson(code, namespace));
      assert.deepEqual([...translationCatalog.keys()].sort(), [...english.keys()].sort(), `${code}:${namespace}`);
      for (const [key, source] of english) {
        const translation = translationCatalog.get(key);
        assert.equal(typeof source, "string", `${namespace}:${key} source type`);
        assert.equal(typeof translation, "string", `${code}:${namespace}:${key} translation type`);
        assert.notEqual(source.trim(), "", `${namespace}:${key} empty source`);
        assert.notEqual(translation.trim(), "", `${code}:${namespace}:${key} empty translation`);
        assert.deepEqual(
          interpolationTokens(translation),
          interpolationTokens(source),
          `${code}:${namespace}:${key} interpolation`
        );
      }
    }
  }
});

test("static translation keys used by client components exist in the English source", () => {
  const clientRoot = new URL("../", import.meta.url);
  const files = fs.readdirSync(clientRoot, { recursive: true })
    .filter((entry) => typeof entry === "string" && entry.endsWith(".js") && !entry.startsWith("tests/"));

  for (const entry of files) {
    const source = fs.readFileSync(new URL(entry, clientRoot), "utf8");
    const namespace = source.match(/useTranslation\(\s*(?:\[\s*)?["']([^"']+)/)?.[1];
    if (!namespace) continue;
    for (const match of source.matchAll(/\bt\(\s*["']([^"'`]+)["']/g)) {
      const key = match[1];
      const [explicitNamespace, explicitKey] = key.includes(":") ? key.split(":", 2) : [namespace, key];
      const exists = i18n.exists(explicitKey, { lng: "en", ns: explicitNamespace })
        || (
          i18n.exists(`${explicitKey}_one`, { lng: "en", ns: explicitNamespace })
          && i18n.exists(`${explicitKey}_other`, { lng: "en", ns: explicitNamespace })
        );
      assert.equal(
        exists,
        true,
        `${entry}: missing ${explicitNamespace}:${explicitKey}`
      );
    }
  }
});

test("Crowdin maps English JSON sources to language-code target folders without secrets", () => {
  const config = fs.readFileSync(new URL("../../crowdin.yml", import.meta.url), "utf8");
  assert.match(config, /project_id_env: CROWDIN_PROJECT_ID/);
  assert.match(config, /api_token_env: CROWDIN_PERSONAL_TOKEN/);
  assert.match(config, /source: "\/client\/locales\/en\/\*\.json"/);
  assert.match(config, /translation: "\/client\/locales\/%locale%\/%original_file_name%"/);
  assert.doesNotMatch(config, /api_token:\s*\S+/);
});

test("user-facing brand and Meeting copy no longer expose legacy names", () => {
  const files = [
    "../auth/Signin.js",
    "../auth/Signup.js",
    "../core/Menu.js",
    "../calendar/CalendarSidebar.js",
    "../calendar/EventEditor.js",
    "../../index.html",
  ];
  const source = files.map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /360Books|360Booking/);
  assert.doesNotMatch(source, />\s*Add Event\s*</);
  assert.doesNotMatch(source, /"Event (details|successfully)/);
});
