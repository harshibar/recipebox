package com.harshibar.recipebox

import android.app.Application
import com.harshibar.recipebox.data.AppDatabase
import com.harshibar.recipebox.data.RecipeRepository

/** Small manual DI container — no Hilt/Dagger for a project this size yet. */
class RecipeBoxApplication : Application() {

    lateinit var recipeRepository: RecipeRepository
        private set

    override fun onCreate() {
        super.onCreate()
        val database = AppDatabase.getInstance(this)
        recipeRepository = RecipeRepository(database)
    }
}
