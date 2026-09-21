package com.harshibar.recipebox.data

import androidx.room.withTransaction
import java.time.LocalDate
import kotlinx.coroutines.flow.Flow

class RecipeRepository(private val database: AppDatabase) {

    private val dao = database.recipeDao()

    fun observeRecipeSummaries(): Flow<List<RecipeSummary>> = dao.observeRecipeSummaries()

    suspend fun getAllTitleSummaries(): List<TitleSummary> = dao.getAllTitleSummaries()

    fun observeRecipeWithDetails(recipeId: Long): Flow<RecipeWithDetails?> =
        dao.observeRecipeWithDetails(recipeId)

    /** Quick Capture: a title + an optional photo becomes a one-step recipe, logged as cooked today. */
    suspend fun createQuickCapture(title: String, photoPath: String?): Long =
        database.withTransaction {
            val now = System.currentTimeMillis()
            val recipeId = dao.insertRecipe(
                Recipe(
                    title = title,
                    source = RecipeSource.QUICK_CAPTURE,
                    createdAt = now,
                    updatedAt = now
                )
            )
            dao.insertStep(
                RecipeStep(
                    recipeId = recipeId,
                    orderIndex = 0,
                    instructionText = "",
                    photoPath = photoPath
                )
            )
            dao.insertCookLog(
                CookLog(
                    recipeId = recipeId,
                    cookedOnEpochDay = LocalDate.now().toEpochDay(),
                    createdAt = now
                )
            )
            recipeId
        }

    suspend fun updateRecipe(recipe: Recipe) =
        dao.updateRecipe(recipe.copy(updatedAt = System.currentTimeMillis()))

    suspend fun deleteRecipe(recipe: Recipe) = dao.deleteRecipe(recipe)

    suspend fun addStep(recipeId: Long, orderIndex: Int, instructionText: String, photoPath: String?): Long =
        dao.insertStep(
            RecipeStep(
                recipeId = recipeId,
                orderIndex = orderIndex,
                instructionText = instructionText,
                photoPath = photoPath
            )
        )

    suspend fun updateStep(step: RecipeStep) = dao.updateStep(step)

    suspend fun deleteStep(step: RecipeStep) = dao.deleteStep(step)

    suspend fun addIngredient(recipeId: Long, orderIndex: Int, text: String): Long =
        dao.insertIngredient(Ingredient(recipeId = recipeId, orderIndex = orderIndex, text = text))

    suspend fun updateIngredient(ingredient: Ingredient) = dao.updateIngredient(ingredient)

    suspend fun deleteIngredient(ingredient: Ingredient) = dao.deleteIngredient(ingredient)

    suspend fun addNote(recipeId: Long, orderIndex: Int, text: String): Long =
        dao.insertNote(RecipeNote(recipeId = recipeId, orderIndex = orderIndex, text = text))

    suspend fun updateNote(note: RecipeNote) = dao.updateNote(note)

    suspend fun deleteNote(note: RecipeNote) = dao.deleteNote(note)

    /** Re-cooking an existing recipe: log today, and append a new photo step if one was taken. */
    suspend fun logExistingRecipeCook(recipeId: Long, photoPath: String?): Unit =
        database.withTransaction {
            val now = System.currentTimeMillis()
            if (photoPath != null) {
                val nextOrder = dao.countSteps(recipeId)
                dao.insertStep(
                    RecipeStep(recipeId = recipeId, orderIndex = nextOrder, instructionText = "", photoPath = photoPath)
                )
            }
            dao.insertCookLog(
                CookLog(recipeId = recipeId, cookedOnEpochDay = LocalDate.now().toEpochDay(), createdAt = now)
            )
            dao.touchUpdatedAt(recipeId, now)
        }
}
