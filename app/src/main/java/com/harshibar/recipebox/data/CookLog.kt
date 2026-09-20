package com.harshibar.recipebox.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/** One row per day a recipe was cooked — feeds the calendar (Phase 2) without duplicating the recipe. */
@Entity(
    tableName = "cook_logs",
    foreignKeys = [
        ForeignKey(
            entity = Recipe::class,
            parentColumns = ["id"],
            childColumns = ["recipeId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("recipeId")]
)
data class CookLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val recipeId: Long,
    val cookedOnEpochDay: Long,
    val createdAt: Long
)
