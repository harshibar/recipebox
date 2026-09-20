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

    @Query("SELECT * FROM recipes ORDER BY updatedAt DESC")
    fun observeRecipes(): Flow<List<Recipe>>

    @Query("SELECT * FROM recipes WHERE title LIKE '%' || :query || '%' ORDER BY updatedAt DESC")
    fun searchRecipes(query: String): Flow<List<Recipe>>

    @Query("SELECT DISTINCT title FROM recipes ORDER BY title ASC")
    suspend fun getAllTitles(): List<String>

    @Transaction
    @Query("SELECT * FROM recipes WHERE id = :recipeId")
    fun observeRecipeWithDetails(recipeId: Long): Flow<RecipeWithDetails?>

    @Insert
    suspend fun insertStep(step: RecipeStep): Long

    @Update
    suspend fun updateStep(step: RecipeStep)

    @Delete
    suspend fun deleteStep(step: RecipeStep)

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

    @Query("SELECT * FROM cook_logs WHERE recipeId = :recipeId ORDER BY cookedOnEpochDay DESC")
    fun observeCookLogsForRecipe(recipeId: Long): Flow<List<CookLog>>
}
