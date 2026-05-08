# Publishing checklist — Chrome Web Store

Run through these steps in order. The build script
(`./build-zip.sh`) packages the extension into
`smart-translator-earphone-v<version>.zip` ready for upload.

## One-time setup

- [ ] **Pay the $5 USD developer registration fee**.
      <https://chrome.google.com/webstore/devconsole/register>
- [ ] **Verify a publisher account**. Personal account is fine; if you
      ever want a custom publisher name (e.g. "Mard Labs") create a
      group publisher and add yourself.
- [ ] **Bookmark** the dev console at
      <https://chrome.google.com/webstore/devconsole/>.

## Per-release

- [ ] Bump `version` in `manifest.json` (semver-ish; Chrome Web Store
      expects strictly increasing versions).
- [ ] Run `npm run quality` at the repo root and at
      `projects/smart-translator-earphone/app/`.
- [ ] In the extension folder run:

      ```sh
      cd projects/smart-translator-earphone/extension
      ./store/build-zip.sh
      ```

      You'll get `store/dist/smart-translator-earphone-v<version>.zip`.

- [ ] (Optional) Sanity-check the zip by reloading it as an unpacked
      extension in `chrome://extensions`:

      ```sh
      unzip -d /tmp/stx store/dist/smart-translator-earphone-v0.1.0.zip
      # then Load unpacked → /tmp/stx in chrome://extensions
      ```

## Listing fields (paste from `LISTING.md`)

- [ ] **Name** — copy from `LISTING.md`.
- [ ] **Short description** — copy from `LISTING.md`.
- [ ] **Detailed description** — copy from `LISTING.md`.
- [ ] **Category** — Productivity.
- [ ] **Language** — English (Vietnamese is supported in the UI but
      Chrome shows one listing locale at a time; English maximises
      reach).

## Visual assets (required by the dashboard)

| Asset | Size | Status |
| --- | --- | --- |
| Icon (small) | 128 × 128 | `icons/icon-128.png` (placeholder, replace before public release) |
| Screenshot 1 | 1280 × 800 or 640 × 400 | TODO — screenshot of popup with Free preset selected |
| Screenshot 2 | 1280 × 800 or 640 × 400 | TODO — screenshot of YouTube tab with translation playing |
| Screenshot 3 | 1280 × 800 or 640 × 400 | TODO — screenshot of dev-tools with stereo channel split visible (shows dual-ear is real) |
| Promo tile (small) | 440 × 280 | Optional but recommended |
| Marquee tile | 1400 × 560 | Required only for featured slots |

> Tip: take screenshots with **only the popup + a YouTube tab visible**.
> Crop to 1280 × 800. Keep the layout clean — no personal browser
> windows in frame.

## Privacy & permissions

- [ ] Tick the data declarations exactly as in `LISTING.md` →
      "Privacy practices".
- [ ] Privacy policy URL = the raw GitHub URL of `PRIVACY.md` (after
      this PR merges).
- [ ] Single-purpose statement: copy from `LISTING.md`.
- [ ] Permission justifications: paste each row from `LISTING.md` into
      the corresponding field.
- [ ] Confirm "Use of remote code" = **No**. We ship everything.

## Distribution

- [ ] Visibility: **Public**. (If you want to dog-food first, pick
      **Unlisted** and share the listing URL with testers.)
- [ ] Country availability: leave default (all countries).
- [ ] Pricing: free.

## Submit

- [ ] Hit **Submit for review**.
- [ ] Expect ~1–3 business days for a first review. Subsequent updates
      are usually same-day.
- [ ] If reviewers reject, the email lists the exact policy violation.
      Common ones:
      - Missing privacy policy URL → make sure `PRIVACY.md` is on the
        `main` branch and the URL resolves.
      - "Excessive permissions" → re-check that each host permission
        is used.
      - Screenshots that include other extensions or unrelated content.

## After publish

- [ ] Verify the public listing renders the way you expect:
      icon, screenshots, description.
- [ ] Add the public listing URL to the README:
      `projects/smart-translator-earphone/extension/README.md`.
- [ ] Tag the release in git:

      ```sh
      git tag extension-v0.1.0
      git push origin extension-v0.1.0
      ```

- [ ] Subscribe to the Chrome Web Store user-feedback emails so you see
      bug reports.
