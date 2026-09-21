package com.harshibar.recipebox.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/** Light scheme only for now — dark mode is a follow-up once the palette itself is settled. */
private val RecipeBoxColorScheme = lightColorScheme(
    primary = Clay,
    onPrimary = Surface,
    secondary = SageText,
    onSecondary = Surface,
    background = Ivory,
    onBackground = TextPrimary,
    surface = Surface,
    onSurface = TextPrimary,
    surfaceVariant = Sage,
    onSurfaceVariant = TextSecondary,
    outline = BorderColor,
    outlineVariant = BorderColor
)

@Composable
fun RecipeBoxTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = RecipeBoxColorScheme,
        typography = RecipeBoxTypography,
        shapes = RecipeBoxShapes,
        content = content
    )
}
