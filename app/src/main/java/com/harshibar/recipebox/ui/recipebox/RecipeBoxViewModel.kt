package com.harshibar.recipebox.ui.recipebox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.harshibar.recipebox.data.RecipeRepository
import com.harshibar.recipebox.data.RecipeSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

class RecipeBoxViewModel(repository: RecipeRepository) : ViewModel() {

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val allRecipes: StateFlow<List<RecipeSummary>> = repository.observeRecipeSummaries()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val recipes: StateFlow<List<RecipeSummary>> = combine(allRecipes, _query) { recipes, q ->
        if (q.isBlank()) recipes else recipes.filter { it.title.contains(q, ignoreCase = true) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun onQueryChange(newQuery: String) {
        _query.value = newQuery
    }
}
