package com.harshibar.recipebox.ui.capture

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.harshibar.recipebox.data.RecipeRepository
import com.harshibar.recipebox.data.TitleSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class QuickCaptureViewModel(private val repository: RecipeRepository) : ViewModel() {

    private val _title = MutableStateFlow("")
    val title: StateFlow<String> = _title.asStateFlow()

    private val _photoPath = MutableStateFlow<String?>(null)
    val photoPath: StateFlow<String?> = _photoPath.asStateFlow()

    private val _existingTitles = MutableStateFlow<List<TitleSummary>>(emptyList())

    val suggestions: StateFlow<List<String>> = combine(_title, _existingTitles) { title, existing ->
        if (title.isBlank()) {
            emptyList()
        } else {
            existing.map { it.title }
                .filter { it.contains(title, ignoreCase = true) && !it.equals(title, ignoreCase = true) }
                .take(4)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _savedRecipeId = MutableStateFlow<Long?>(null)
    val savedRecipeId: StateFlow<Long?> = _savedRecipeId.asStateFlow()

    init {
        viewModelScope.launch { _existingTitles.value = repository.getAllTitleSummaries() }
    }

    fun onTitleChange(newTitle: String) {
        _title.value = newTitle
    }

    fun onSuggestionPicked(suggestion: String) {
        _title.value = suggestion
    }

    fun onPhotoTaken(path: String) {
        _photoPath.value = path
    }

    /** Matching an existing title logs a new cook against that recipe instead of creating a duplicate. */
    fun save() {
        val currentTitle = _title.value.trim()
        if (currentTitle.isEmpty()) return
        viewModelScope.launch {
            val existing = _existingTitles.value.firstOrNull { it.title.equals(currentTitle, ignoreCase = true) }
            val id = if (existing != null) {
                repository.logExistingRecipeCook(existing.id, _photoPath.value)
                existing.id
            } else {
                repository.createQuickCapture(currentTitle, _photoPath.value)
            }
            _savedRecipeId.value = id
        }
    }
}
