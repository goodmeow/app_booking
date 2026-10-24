# Localization

RoomBooking uses English (`en`) as its source and default language. Indonesian
(`id`) is the second supported language. All other translations are derived from
the English catalogs through Crowdin.

## Catalogs and keys

Translation catalogs live under `client/locales/<language>/`. Catalog filenames
are namespaces grouped by product area:

- `common.json`: shared actions, navigation, generic states, and branding.
- `auth.json`: sign-in, sign-up, and profile copy.
- `calendar.json`: Calendar views, meeting forms, validation, and recurrence.
- `management.json`: Users, Rooms, Access Cards, and kiosk device management.
- `report.json`: report screens and exported workbook labels.
- `kiosk.json`: room kiosk provisioning, states, and schedule copy.

English catalogs are the only source catalogs. Use stable semantic keys such as
`actions.save` or `validation.roomRequired`; do not use an English sentence
as a key. Keep API and code terms such as `event` internal while user-facing keys
and translations use `Meeting`.

Use i18next interpolation for dynamic values instead of joining translated text:

```json
{
  "welcome": "Welcome, {{name}}",
  "scheduledMeetings_one": "{{count}} scheduled meeting",
  "scheduledMeetings_other": "{{count}} scheduled meetings"
}
```

Every translation must preserve the source interpolation variable names. Use
i18next plural suffixes (`_one`, `_other`, and any locale-specific categories)
rather than conditional string fragments in React components. See the official
[i18next interpolation](https://www.i18next.com/translation-function/interpolation)
and [pluralization](https://www.i18next.com/translation-function/plurals)
documentation.

## Add or change copy

1. Add or update the semantic key in the appropriate
   `client/locales/en/<namespace>.json` source catalog.
2. Use the key from the UI through `t("namespace:key")` or the namespace-scoped
   `t("key")` form.
3. Upload the English source catalogs to Crowdin.
4. Translate and review the strings in Crowdin.
5. Download generated target catalogs and run the client tests and build.

Do not hand-edit a downloaded target catalog after Crowdin owns it: the next
download can overwrite local changes. Fix the translation in Crowdin and download
again. Indonesian may be seeded locally during initial setup, but subsequent
changes follow the same Crowdin workflow.

## Crowdin CLI workflow

CLI versi 5.5.0 sudah tersedia sebagai binary tunggal di
`~/toolchain/crowdin-cli/crowdin` (symlink `~/bin/crowdin`). Setelah
menambah/mengubah string, sinkronkan `en` (sumber) dan `id`, lalu:

Install the [official Crowdin CLI](https://crowdin.github.io/crowdin-cli/) and set
the project credentials in the shell or CI secret store:

```bash
export CROWDIN_PROJECT_ID="your-project-id"
export CROWDIN_PERSONAL_TOKEN="your-personal-token"
```

Never commit either value. The root `crowdin.yml` reads them through
`project_id_env` and `api_token_env`.

Upload English sources:

```bash
crowdin upload sources
```

Download reviewed translations:

```bash
crowdin download
```

The configuration preserves namespace filenames and uses Crowdin's exact
`%locale%` value, writing Indonesian to `client/locales/id/<namespace>.json`
while keeping regional variants such as `pt-BR` distinct. Configuration options and
placeholders are documented in Crowdin's official
[configuration file reference](https://support.crowdin.com/developer/configuration-file/).

## Add another language

1. Enable the target language in the Crowdin project.
2. Upload the unchanged English sources and complete translation review.
3. Run `crowdin download` to create `client/locales/<language>/` catalogs.
4. Import the downloaded catalogs and register them in `client/i18n/index.js`.
5. Register the exact language code, display name, Intl locale, and calendar
   locale in `client/i18n/languages.js`.
6. Add locale data for date/calendar components when required.
7. Verify catalog key and interpolation parity, then run the client tests and
   production build.

English remains the fallback when a key or locale is unavailable. A user's
explicit language choice is persisted by the client; a fresh browser starts in
English.
