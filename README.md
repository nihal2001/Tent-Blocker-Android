# TentBlocker for Android

An independent Android port of TentBlocker. Instagram and YouTube, without the rabbit holes.

## Install on Android

[Download the APK](https://github.com/nihal2001/Tent-Blocker-Android/releases/download/v1.0.1/TentBlocker-Android-v1.0.1.apk) directly on your Android phone, open the file, and tap **Install**. If prompted, allow your browser or file manager to install unknown apps.

Requires Android 8.0 or newer. This is a debug/test build. See the [release page](https://github.com/nihal2001/Tent-Blocker-Android/releases/tag/v1.0.1) for installation details. The repository and APK are public; no GitHub account is required to download.

## Features

- Native launcher with Instagram and YouTube wrappers, persistent login cookies, and Home navigation.
- Instagram: independently retained Home, Messages, Search, and Profile tabs; hide any tab while keeping at least one; Discover off by default; Reels feeds removed while individual reel links remain accessible.
- YouTube: Shorts off by default; optional subscriptions and recommendations; Shorts links open as ordinary videos when Shorts are disabled.
- Original-app blocking: always on, timed blocks, weekly schedules including overnight intervals, and daily usage allowances. Rules combine independently.
- Upload files using Android's picker, fullscreen video, browser Back and refresh.

The website-filter JavaScript is ported from the iOS project. This repository has its own build and Git history; it does not depend on the iOS checkout.

## Build and install

Use Android Studio with JDK 17, Android SDK platform 35, and build tools 35.0.0. Minimum Android version: 8.0 (API 26). Keep Android System WebView updated.

```sh
./gradlew testDebugUnitTest lintDebug assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Open the repository folder in Android Studio, let Gradle sync, and run `app` on a device or emulator. Set `sdk.dir` in an untracked `local.properties` if necessary. Gradle dependencies require internet on the first build. GitHub Actions builds and uploads a debug APK on pushes and pull requests.

## Enable original-app blocking

1. Open TentBlocker → Settings → Enable app blocking. Read the disclosure and enable TentBlocker in Android Accessibility settings.
2. For daily limits, also grant Usage access from TentBlocker Settings.
3. Configure Instagram or YouTube's block rules. They apply to `com.instagram.android` and `com.google.android.youtube` respectively; wrapper usage is excluded.

Accessibility observes foreground app identity, not screen contents. When a rule matches, it returns to Android Home. A one-second check enforces timers, schedules, and limits while an app stays open. Usage access counts original-app activity since local midnight, including activity before TentBlocker was opened. No account credentials, usage records, or accessibility events are sent to a TentBlocker server. Sites receive normal browsing traffic. Website sessions remain in Android's private WebView storage; app backup is disabled.

This is a voluntary focus aid. Accessibility can be disabled, manufacturers may stop services, and Android does not provide iOS Screen Time's shielding API. On some sideloaded installations Android requires allowing restricted settings from the app's system information page before accessibility can be enabled. Blocks cover the standard apps, not Lite variants, cloned apps, other profiles, or external browsers. Play Store distribution would require separate accessibility-policy review.

## Implementation

Native Java Android UI, AndroidX WebKit for origin-scoped document-start scripts and messages, SharedPreferences for local settings, AccessibilityService for original-app blocking, and UsageStatsManager for daily usage. JavaScript messages are accepted only from Instagram's main frame. No unrestricted JavaScript/native bridge is exposed. HTTPS only; non-site links go to the external browser and app-launch schemes are suppressed.

Modern WebView versions inject filters at document start. Older providers fall back to page-finish injection, which can briefly show unfiltered content. Site DOM changes can break filtering. Google or Meta can restrict embedded-browser login; account login and live feed behavior require verification on a physical device. Camera/microphone capture and push notifications are not implemented; picker uploads are supported. Tabs survive in-app switching, but page state is not restored after process death (login cookies persist).

## Verification

`testDebugUnitTest` exercises daytime and overnight schedules, Sunday/Monday rollover, excluded weekdays, exact timer expiry, and independent block rules. `node scripts/test-filters.cjs` checks the ported scripts' navigation rules. See `TESTING.md` for the device acceptance checklist.

## Updates for GitHub installs

GitHub does not update installed apps automatically. Users can install [Obtainium](https://github.com/ImranR98/Obtainium), add `https://github.com/nihal2001/Tent-Blocker-Android` as an app source, and include prereleases while this app is in testing. Obtainium checks releases and handles update downloads; Android may still request installation confirmation depending on device and permissions.

Published APK updates must keep the same application ID and signing certificate and increase `versionCode`. The published test APKs use this developer machine's debug signing certificate; CI artifacts have a different debug key and must not be used as updates to these releases. Before production distribution, migrate deliberately to a protected release signing key (changing from the existing debug key requires a reinstall). Never commit signing keys to Git.
