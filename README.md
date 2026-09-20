# 🍝 RecipeBox

A native Android app for capturing, organizing, and planning around the recipes you actually cook.

## Status

Early rewrite in progress. The original Flutter prototype has been retired in favor of a native
Android app (Kotlin + Jetpack Compose) — see git history for the old version.

Currently building **Phase 1: Recipe Box + Quick Capture** — the foundation the rest of the app
(recipe calendar, meal planner + shopping list, live voice+photo capture while cooking, and
importing recipes shared from Instagram/the web) builds on top of.

## Stack

- Kotlin + Jetpack Compose (Material 3)
- Room (local-first SQLite storage)
- Coil for image loading, Navigation Compose

## Building

Open in Android Studio, or run `./gradlew assembleDebug` from the command line (requires the
Android SDK).
