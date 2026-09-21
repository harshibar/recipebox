package com.harshibar.recipebox.util

import android.content.Context
import android.content.Intent
import com.harshibar.recipebox.data.RecipeWithDetails

object RecipeTextFormatter {

    fun format(details: RecipeWithDetails): String {
        val recipe = details.recipe
        val sb = StringBuilder()
        sb.append(recipe.title.uppercase())
        recipe.servings?.let { sb.append(" (Serves $it)") }
        sb.append("\n\n")

        if (details.sortedIngredients.isNotEmpty()) {
            sb.append("Ingredients:\n")
            details.sortedIngredients.forEach { sb.append("- ${it.text}\n") }
            sb.append("\n")
        }

        val steps = details.sortedSteps.filter { it.instructionText.isNotBlank() }
        if (steps.isNotEmpty()) {
            sb.append("Instructions:\n")
            steps.forEachIndexed { index, step -> sb.append("${index + 1}. ${step.instructionText}\n") }
            sb.append("\n")
        }

        if (details.sortedNotes.isNotEmpty()) {
            sb.append("Tips:\n")
            details.sortedNotes.forEach { sb.append("- ${it.text}\n") }
        }

        return sb.toString().trim()
    }

    fun share(context: Context, details: RecipeWithDetails) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, details.recipe.title)
            putExtra(Intent.EXTRA_TEXT, format(details))
        }
        context.startActivity(Intent.createChooser(intent, "Share recipe"))
    }
}
