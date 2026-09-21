package com.harshibar.recipebox.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface RecipeDao {

    @Insert
    suspend fun insertRecipe(recipe: Recipe): Long

    @Update
    suspend fun updateRecipe(recipe: Recipe)

    @Delete
    suspend fun deleteRecipe(recipe: Recipe)

    @Query(
        """
        SELECT r.id AS id, r.title AS title, r.updatedAt AS updatedAt,
               COUNT(c.id) AS cookCount, MAX(c.cookedOnEpochDay) AS lastCookedEpochDay
        FROM recipes r
        LEFT JOIN cook_logs c ON c.recipeId = r.id
        GROUP BY r.id
        ORDER BY r.updatedAt DESC
        """
    )
    fun observeRecipeSummaries(): Flow<List<RecipeSummary>>

    @Query("SELECT id, title FROM recipes ORDER BY title ASC")
    suspend fun getAllTitleSummaries(): List<TitleSummary>

    @Query("UPDATE recipes SET updatedAt = :updatedAt WHERE id = :recipeId")
    suspend fun touchUpdatedAt(recipeId: Long, updatedAt: Long)

    @Transaction
    @Query("SELECT * FROM recipes WHERE id = :recipeId")
    fun observeRecipeWithDetails(recipeId: Long): Flow<RecipeWithDetails?>

    @Insert
    suspend fun insertStep(step: RecipeStep): Long

    @Update
    suspend fun updateStep(step: RecipeStep)

    @Delete
    suspend fun deleteStep(step: RecipeStep)

    @Query("SELECT COUNT(*) FROM recipe_steps WHERE recipeId = :recipeId")
    suspend fun countSteps(recipeId: Long): Int

    @Insert
    suspend fun insertIngredient(ingredient: Ingredient): Long

    @Update
    suspend fun updateIngredient(ingredient: Ingredient)

    @Delete
    suspend fun deleteIngredient(ingredient: Ingredient)

    @Insert
    suspend fun insertNote(note: RecipeNote): Long

    @Update
    suspend fun updateNote(note: RecipeNote)

    @Delete
    suspend fun deleteNote(note: RecipeNote)

    @Insert
    suspend fun insertCookLog(cookLog: CookLog): Long
}

data class RecipeSummary(
    val id: Long,
    val title: String,
    val updatedAt: Long,
    val cookCount: Int,
    val lastCookedEpochDay: Long?
)

data class TitleSummary(
    val id: Long,
    val title: String
)
