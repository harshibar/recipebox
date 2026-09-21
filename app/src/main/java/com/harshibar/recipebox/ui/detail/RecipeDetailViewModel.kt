package com.harshibar.recipebox.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.harshibar.recipebox.data.Ingredient
import com.harshibar.recipebox.data.RecipeNote
import com.harshibar.recipebox.data.RecipeRepository
import com.harshibar.recipebox.data.RecipeStep
import com.harshibar.recipebox.data.RecipeWithDetails
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class RecipeDetailViewModel(
    private val repository: RecipeRepository,
    private val recipeId: Long
) : ViewModel() {

    val recipe: StateFlow<RecipeWithDetails?> = repository.observeRecipeWithDetails(recipeId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun updateTitle(title: String) {
        val current = recipe.value?.recipe ?: return
        if (title.isBlank() || title == current.title) return
        viewModelScope.launch { repository.updateRecipe(current.copy(title = title)) }
    }

    fun updateServings(servings: Int?) {
        val current = recipe.value?.recipe ?: return
        viewModelScope.launch { repository.updateRecipe(current.copy(servings = servings)) }
    }

    fun addIngredient(text: String) {
        if (text.isBlank()) return
        val nextOrder = recipe.value?.ingredients?.size ?: 0
        viewModelScope.launch { repository.addIngredient(recipeId, nextOrder, text) }
    }

    fun deleteIngredient(ingredient: Ingredient) {
        viewModelScope.launch { repository.deleteIngredient(ingredient) }
    }

    fun addStep(text: String, photoPath: String?) {
        if (text.isBlank() && photoPath == null) return
        val nextOrder = recipe.value?.steps?.size ?: 0
        viewModelScope.launch { repository.addStep(recipeId, nextOrder, text, photoPath) }
    }

    fun deleteStep(step: RecipeStep) {
        viewModelScope.launch { repository.deleteStep(step) }
    }

    fun addNote(text: String) {
        if (text.isBlank()) return
        val nextOrder = recipe.value?.notes?.size ?: 0
        viewModelScope.launch { repository.addNote(recipeId, nextOrder, text) }
    }

    fun deleteNote(note: RecipeNote) {
        viewModelScope.launch { repository.deleteNote(note) }
    }
}
