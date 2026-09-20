package com.harshibar.recipebox.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Plain-string constants instead of an enum + TypeConverter — one less moving part. */
object RecipeSource {
    const val QUICK_CAPTURE = "quick_capture"
    const val LIVE_CAPTURE = "live_capture"
    const val IMPORTED = "imported"
}

@Entity(tableName = "recipes")
data class Recipe(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val servings: Int? = null,
    val source: String,
    val createdAt: Long,
    val updatedAt: Long
)
