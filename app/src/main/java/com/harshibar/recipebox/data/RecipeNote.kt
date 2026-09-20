package com.harshibar.recipebox.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/** A tip / learning, kept separate from instructions since it isn't tied to a step's photo. */
@Entity(
    tableName = "recipe_notes",
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
data class RecipeNote(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val recipeId: Long,
    val orderIndex: Int,
    val text: String
)
