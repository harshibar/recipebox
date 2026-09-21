# 🍝 RecipeBox

A native Android app for capturing, organizing, and planning around the recipes you actually cook.

## Status

Early rewrite in progress. The original Flutter prototype has been retired in favor of a native
Android app (Kotlin + Jetpack Compose) — see git history for the old version.

**Phase 1 (Recipe Box + Quick Capture) is in place**: a searchable Recipe Box, a blog-style recipe
detail view (photo steps, ingredients, tips, full text) with inline add/edit, a Quick Capture flow
(photo + title, with autocomplete against existing recipes so cooking something again logs a new
date instead of creating a duplicate), and text export. This hasn't been built with a real Android
SDK yet (see Building below) — first real build/run should happen in Android Studio.

Visual design is still a placeholder pending feedback — see the [design mockup](https://claude.ai/artifact/CCvSyyCFsKcp4N1pUb64YX).

Not yet built: recipe calendar, meal planner + shopping list, live voice+photo capture while
cooking, and importing recipes shared from Instagram/the web.

## Stack

- Kotlin + Jetpack Compose (Material 3)
- Room (local-first SQLite storage)
- Coil for image loading, Navigation Compose

## Building

Open in Android Studio, or run `./gradlew assembleDebug` from the command line (requires the
Android SDK).
