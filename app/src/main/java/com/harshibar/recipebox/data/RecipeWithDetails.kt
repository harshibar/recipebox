package com.harshibar.recipebox.data

import androidx.room.Embedded
import androidx.room.Relation

data class RecipeWithDetails(
    @Embedded val recipe: Recipe,
    @Relation(parentColumn = "id", entityColumn = "recipeId")
    val steps: List<RecipeStep>,
    @Relation(parentColumn = "id", entityColumn = "recipeId")
    val ingredients: List<Ingredient>,
    @Relation(parentColumn = "id", entityColumn = "recipeId")
    val notes: List<RecipeNote>,
    @Relation(parentColumn = "id", entityColumn = "recipeId")
    val cookLogs: List<CookLog>
) {
    val sortedSteps: List<RecipeStep> get() = steps.sortedBy { it.orderIndex }
    val sortedIngredients: List<Ingredient> get() = ingredients.sortedBy { it.orderIndex }
    val sortedNotes: List<RecipeNote> get() = notes.sortedBy { it.orderIndex }
    val cookCount: Int get() = cookLogs.size
    val lastCookedEpochDay: Long? get() = cookLogs.maxOfOrNull { it.cookedOnEpochDay }
}
