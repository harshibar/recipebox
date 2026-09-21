package com.harshibar.recipebox.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.harshibar.recipebox.data.RecipeRepository
import com.harshibar.recipebox.ui.ViewModelFactory
import com.harshibar.recipebox.ui.capture.QuickCaptureScreen
import com.harshibar.recipebox.ui.capture.QuickCaptureViewModel
import com.harshibar.recipebox.ui.detail.RecipeDetailScreen
import com.harshibar.recipebox.ui.detail.RecipeDetailViewModel
import com.harshibar.recipebox.ui.recipebox.RecipeBoxScreen
import com.harshibar.recipebox.ui.recipebox.RecipeBoxViewModel

private object Routes {
    const val RECIPE_BOX = "recipeBox"
    const val QUICK_CAPTURE = "quickCapture"
    const val RECIPE_DETAIL = "recipeDetail/{recipeId}"
    fun recipeDetail(recipeId: Long) = "recipeDetail/$recipeId"
}

@Composable
fun RecipeBoxNavHost(repository: RecipeRepository) {
    val navController = rememberNavController()
    val factory = remember(repository) { ViewModelFactory(repository) }

    NavHost(navController = navController, startDestination = Routes.RECIPE_BOX) {
        composable(Routes.RECIPE_BOX) {
            val viewModel: RecipeBoxViewModel = viewModel(factory = factory)
            RecipeBoxScreen(
                viewModel = viewModel,
                onRecipeClick = { id -> navController.navigate(Routes.recipeDetail(id)) },
                onCaptureClick = { navController.navigate(Routes.QUICK_CAPTURE) }
            )
        }
        composable(Routes.QUICK_CAPTURE) {
            val viewModel: QuickCaptureViewModel = viewModel(factory = factory)
            QuickCaptureScreen(
                viewModel = viewModel,
                onCancel = { navController.popBackStack() },
                onSaved = { id ->
                    navController.navigate(Routes.recipeDetail(id)) {
                        popUpTo(Routes.RECIPE_BOX)
                    }
                }
            )
        }
        composable(
            route = Routes.RECIPE_DETAIL,
            arguments = listOf(navArgument("recipeId") { type = NavType.LongType })
        ) { backStackEntry ->
            val recipeId = backStackEntry.arguments?.getLong("recipeId") ?: 0L
            val detailFactory = remember(repository, recipeId) {
                object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T =
                        RecipeDetailViewModel(repository, recipeId) as T
                }
            }
            val viewModel: RecipeDetailViewModel = viewModel(factory = detailFactory)
            RecipeDetailScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }
    }
}
