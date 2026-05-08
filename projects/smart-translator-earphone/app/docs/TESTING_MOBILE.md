# Testing Smart Translator on iPhone / Android

This guide walks you through running the Expo app on a real phone in
two flavours:

- **Path A — Expo Go (5 min, free):** loads the JavaScript bundle in
  the public Expo Go app. The downside: `expo-speech-recognition` is a
  custom native module not bundled inside Expo Go, so the **Native
  Speech (free, iOS/Android)** STT engine won't load. TTS via
  `expo-speech` does work because it ships inside Expo Go. Use this
  path to verify TTS, the UI, and the translation pipeline.

- **Path B — development build (~25 min, free for ~30 builds/month
  via EAS):** produces a custom build of the app that includes every
  native module, so the Free preset runs end-to-end (Native STT →
  Free Google Translate → Native TTS). Use this path to verify the
  full mic→Vietnamese audio loop on-device.

You only need Path B once, then re-run `npx expo start --dev-client`
whenever you make JS changes.

---

## Prerequisites

| Tool | macOS | Windows | Notes |
| --- | --- | --- | --- |
| **Node 20+** | `brew install node@20` | <https://nodejs.org/> | Same version your laptop uses |
| **Git** | preinstalled | preinstalled with Git for Windows | |
| **Expo CLI** | bundled with `npx expo …` | bundled with `npx expo …` | No global install required |
| **Expo Go** (Path A) | App Store on iPhone / Play Store on Android | same | Free |
| **EAS account** (Path B) | `npx eas-cli@latest login` | same | Free tier — sign up at <https://expo.dev/signup> |
| **Apple Developer account** (Path B, iOS only) | Free tier OK | n/a | <https://developer.apple.com/account>; required by Apple to install the dev build via Xcode/TestFlight |
| **Android device with USB debugging** (Path B, Android local) | optional | optional | Settings → About phone → tap Build number 7× → Settings → Developer options → USB debugging |

> If you're on Windows, you can do everything in WSL2 except installing
> the iOS dev build. iOS dev builds **must** come from a Mac (or use
> EAS Build's cloud).

---

## Path A — Expo Go in 5 minutes

```sh
git clone https://github.com/mard66997700-arch/BMAD-METHOD
cd BMAD-METHOD/projects/smart-translator-earphone/app
npm ci
npx expo start
```

1. `expo start` prints a QR code in the terminal.
2. **iPhone:** open the Camera, point it at the QR code, tap the
   notification "Open in Expo Go".
3. **Android:** open Expo Go, tap **Scan QR code**, point at the QR.
4. The bundle downloads (~30 s on first run), the app opens.

**What you should see:**

- Home screen with **Microphone** + **Tab audio** buttons (tab audio
  won't work on phones; that's web-only).
- Settings → "Free (Google Translate)" preset Active.
- Settings → Advanced → STT engine = **Mock** (Native Speech is greyed
  out / unavailable because Expo Go doesn't bundle the native module).
  Pick **Browser Web Speech** if you opened the page in mobile Chrome
  via the web URL.
- Settings → Advanced → TTS engine = **Native TTS (free, iOS/Android)**
  Active by default; this is the real platform synth.

**Quick smoke test:**

1. Settings → Voice → leave gender Female / speed 1.0 / pitch 0.
2. Home → set "To" = Vietnamese.
3. Tap **Microphone** → **Start Translation** → allow mic.
4. Mock STT will fire a canned phrase ("Thank you very much"); you
   should hear the Vietnamese version on the phone speaker.

**Limit:** real speech transcription needs Path B because Mock STT
won't transcribe what you say. If you only need to verify the audio
plumbing + Vietnamese voice, Path A is enough.

---

## Path B — development build with native STT + TTS

This is the one to use if you want to **say something out loud and
hear the Vietnamese translation.**

### B.1 — One-time setup

```sh
cd BMAD-METHOD/projects/smart-translator-earphone/app
npm ci
npx eas-cli@latest login
npx eas-cli@latest init --id com.bmadmethod.smarttranslator
```

The `init` command writes an `extra.eas.projectId` field into
`app.json`. **Do not commit it.** Add it to `.gitignore` locally if you
want, or revert it after building. If you're going to keep using EAS
forever, it's fine to commit.

### B.2 — Cloud build (no Xcode / Android Studio needed)

#### iPhone

```sh
npx eas-cli@latest build --profile development --platform ios
```

The CLI asks:

- **Apple ID + app-specific password** — sign in with your Apple
  Developer account (free tier OK).
- **Provisioning profile** — pick "Let EAS handle credentials".
- **Distribution certificate** — same.

It spins up a cloud build (~20 min on free tier). When it's done:

1. The CLI prints a URL like `https://expo.dev/artifacts/eas/abc.ipa`.
2. Open that URL **on the iPhone** (Safari).
3. Tap **Install** → trust the developer profile under
   Settings → General → VPN & Device Management.

Now you have **Smart Translator** on your home screen.

#### Android

```sh
npx eas-cli@latest build --profile development --platform android
```

Free tier finishes in ~15 min and prints a `.apk` URL. Open it on the
Android phone and install — Android will warn about an unknown source;
allow it once.

### B.3 — Local build (faster if you have Xcode / Android Studio)

```sh
# iOS, requires Xcode 15+ on a Mac
npx expo prebuild --platform ios --clean
npx expo run:ios --device

# Android, requires Android Studio + USB debugging on
npx expo prebuild --platform android --clean
npx expo run:android --device
```

`prebuild` creates the native `ios/` + `android/` projects inside the
app folder. It's a one-shot — after the first run you can iterate JS
just with `npx expo start --dev-client`.

### B.4 — Run JS against the dev build

After Step B.2 or B.3 the app is installed but empty. Bring up the
metro bundler:

```sh
npx expo start --dev-client
```

Open Smart Translator on the phone → it auto-discovers the bundler →
the JS bundle downloads → the app starts.

### B.5 — End-to-end smoke test

1. Open Settings → preset = **Free (Google Translate)**.
2. Settings → Advanced — confirm:
   - **STT engine = Native Speech (free, iOS/Android) — Active**.
   - **Translation = Free (Google Translate) — Active**.
   - **TTS engine = Native TTS (free, iOS/Android) — Active**.
3. Home → set "To" = Vietnamese, "From" = English (or auto).
4. Tap **Microphone** → **Start Translation** → grant mic permission.
5. Plug in stereo earphones, toggle **Output → Stereo dual-ear**.
6. Say "Hello, how are you today?" out loud.
7. Within 1–2 s you should:
   - See `Hello, how are you today?` appear in the transcript pane.
   - See the Vietnamese translation: `Xin chào, hôm nay bạn thế nào?`
   - Hear your own voice in the **left ear** (mic monitor).
   - Hear `Xin chào, hôm nay bạn thế nào?` in the **right ear**.

If you only hear one channel, double-check earphones aren't
mono-bridged (some Bluetooth car kits collapse to mono).

---

## Common pitfalls

- **"Native Speech (free, iOS/Android) is unavailable"** in Path A —
  expected. Switch to Path B or use Mock STT to verify TTS only.
- **Expo Go can't find the bundle** — phone and laptop must share a
  Wi-Fi. If they're on different networks, run
  `npx expo start --tunnel` (uses ngrok, slower).
- **Black silence after "Start Translation" on iOS dev build** — the
  iOS background-audio session needs the AirPods/wired mic to be the
  current input. Open Control Center → Audio Output → pick your
  earphones explicitly.
- **Permission denied for SpeechRecognizer on Android** — Android 13+
  asks separately for `RECORD_AUDIO`. Settings → Apps → Smart
  Translator → Permissions → enable Microphone.
- **No Vietnamese voice on Android** — Settings → System → Languages
  & input → Text-to-speech → preferred engine = Google → install
  Vietnamese voice.

---

## When you're done

- `npx expo start --dev-client` is your daily driver — same app on
  the phone, Metro reloads on save.
- For a fresh dev build (e.g., after upgrading Expo SDK) re-run the
  command from B.2 / B.3.
- For a production-ish build that doesn't need Metro:
  `eas build --profile preview --platform <ios|android>`.

If you hit a wall, paste the failing CLI output back into chat and
I'll triage.
