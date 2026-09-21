package com.harshibar.recipebox.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.harshibar.recipebox.data.RecipeRepository
import com.harshibar.recipebox.ui.capture.QuickCaptureViewModel
import com.harshibar.recipebox.ui.recipebox.RecipeBoxViewModel

/** Manual DI, no-arg screens only — RecipeDetailViewModel takes a recipeId and gets its own inline factory. */
class ViewModelFactory(private val repository: RecipeRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = when {
        modelClass.isAssignableFrom(RecipeBoxViewModel::class.java) -> RecipeBoxViewModel(repository) as T
        modelClass.isAssignableFrom(QuickCaptureViewModel::class.java) -> QuickCaptureViewModel(repository) as T
        else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
