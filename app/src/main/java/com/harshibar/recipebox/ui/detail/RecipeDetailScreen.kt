package com.harshibar.recipebox.ui.detail

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.harshibar.recipebox.data.Ingredient
import com.harshibar.recipebox.data.RecipeNote
import com.harshibar.recipebox.data.RecipeStep
import com.harshibar.recipebox.data.RecipeWithDetails
import com.harshibar.recipebox.ui.theme.CardPlaceholderColors
import com.harshibar.recipebox.util.PhotoFiles
import com.harshibar.recipebox.util.RecipeTextFormatter
import java.io.File

@Composable
fun RecipeDetailScreen(
    viewModel: RecipeDetailViewModel,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val details by viewModel.recipe.collectAsStateWithLifecycle()
    val currentDetails = details

    var editMode by remember { mutableStateOf(false) }
    var titleDraft by remember { mutableStateOf("") }
    var servingsDraft by remember { mutableStateOf("") }
    var newIngredientText by remember { mutableStateOf("") }
    var newStepText by remember { mutableStateOf("") }
    var newStepPhoto by remember { mutableStateOf<String?>(null) }
    var newTipText by remember { mutableStateOf("") }

    var pendingPhoto by remember { mutableStateOf<Pair<File, Uri>?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val destination = pendingPhoto
        if (success && destination != null) {
            newStepPhoto = destination.first.absolutePath
        }
    }

    if (currentDetails == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item {
            HeroHeader(
                details = currentDetails,
                onBack = onBack,
                editMode = editMode,
                onToggleEdit = {
                    if (editMode) {
                        viewModel.updateTitle(titleDraft)
                        viewModel.updateServings(servingsDraft.toIntOrNull())
                    } else {
                        titleDraft = currentDetails.recipe.title
                        servingsDraft = currentDetails.recipe.servings?.toString() ?: ""
                    }
                    editMode = !editMode
                },
                onShare = { RecipeTextFormatter.share(context, currentDetails) }
            )
        }

        item {
            Column(modifier = Modifier.padding(20.dp, 20.dp, 20.dp, 6.dp)) {
                if (editMode) {
                    OutlinedTextField(
                        value = titleDraft,
                        onValueChange = { titleDraft = it },
                        singleLine = true,
                        textStyle = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = servingsDraft,
                        onValueChange = { input -> servingsDraft = input.filter { it.isDigit() } },
                        singleLine = true,
                        label = { Text("Servings") },
                        modifier = Modifier.width(140.dp)
                    )
                } else {
                    Text(text = currentDetails.recipe.title, style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(8.dp))
                    Text(text = metaLine(currentDetails), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        item {
            SectionCard(title = "Ingredients") {
                currentDetails.sortedIngredients.forEach { ingredient ->
                    IngredientRow(ingredient, editMode) { viewModel.deleteIngredient(ingredient) }
                }
                if (editMode) {
                    AddRow(
                        value = newIngredientText,
                        onValueChange = { newIngredientText = it },
                        placeholder = "Add ingredient",
                        onAdd = {
                            viewModel.addIngredient(newIngredientText)
                            newIngredientText = ""
                        }
                    )
                }
            }
        }

        item {
            SectionCard(title = "Steps") {
                currentDetails.sortedSteps.forEachIndexed { index, step ->
                    StepRow(index + 1, step, editMode) { viewModel.deleteStep(step) }
                }
                if (editMode) {
                    Column {
                        AddRow(
                            value = newStepText,
                            onValueChange = { newStepText = it },
                            placeholder = "Add a step",
                            onAdd = {
                                viewModel.addStep(newStepText, newStepPhoto)
                                newStepText = ""
                                newStepPhoto = null
                            }
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                            IconButton(onClick = {
                                val destination = PhotoFiles.createPhotoDestination(context)
                                pendingPhoto = destination
                                takePicture.launch(destination.second)
                            }) {
                                Icon(Icons.Filled.PhotoCamera, contentDescription = "Attach a photo to this step")
                            }
                            Text(
                                text = if (newStepPhoto != null) "Photo attached" else "Attach a photo (optional)",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }

        item {
            TipsCard(
                notes = currentDetails.sortedNotes,
                editMode = editMode,
                newTipText = newTipText,
                onNewTipChange = { newTipText = it },
                onAddTip = {
                    viewModel.addNote(newTipText)
                    newTipText = ""
                },
                onDeleteTip = { viewModel.deleteNote(it) }
            )
        }

        item {
            FullTextCard(details = currentDetails, onShare = { RecipeTextFormatter.share(context, currentDetails) })
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun HeroHeader(
    details: RecipeWithDetails,
    onBack: () -> Unit,
    editMode: Boolean,
    onToggleEdit: () -> Unit,
    onShare: () -> Unit
) {
    val heroPhoto = details.sortedSteps.firstOrNull { it.photoPath != null }?.photoPath
    val placeholderColor = CardPlaceholderColors[(details.recipe.id % CardPlaceholderColors.size).toInt()]

    Box(modifier = Modifier.fillMaxWidth().height(260.dp)) {
        if (heroPhoto != null) {
            AsyncImage(
                model = File(heroPhoto),
                contentDescription = null,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Box(
                modifier = Modifier.fillMaxSize().background(placeholderColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.Restaurant, contentDescription = null, tint = Color.White.copy(alpha = 0.85f), modifier = Modifier.size(54.dp))
            }
        }
        OverlayIconButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart).padding(16.dp)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
        }
        Row(modifier = Modifier.align(Alignment.TopEnd).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OverlayIconButton(onClick = onShare) {
                Icon(Icons.Filled.Share, contentDescription = "Share recipe")
            }
            OverlayIconButton(onClick = onToggleEdit) {
                Icon(if (editMode) Icons.Filled.Check else Icons.Filled.Edit, contentDescription = if (editMode) "Done editing" else "Edit recipe")
            }
        }
    }
}

@Composable
private fun OverlayIconButton(onClick: () -> Unit, modifier: Modifier = Modifier, icon: @Composable () -> Unit) {
    IconButton(
        onClick = onClick,
        colors = IconButtonDefaults.iconButtonColors(containerColor = Color.White.copy(alpha = 0.9f), contentColor = Color(0xFF211D18)),
        modifier = modifier.size(38.dp)
    ) { icon() }
}

private fun metaLine(details: RecipeWithDetails): String {
    val parts = mutableListOf<String>()
    details.recipe.servings?.let { parts.add("Serves $it") }
    parts.add(if (details.cookCount == 0) "Not cooked yet" else "Cooked ${details.cookCount} times")
    return parts.joinToString(" · ")
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.padding(20.dp, 14.dp, 20.dp, 4.dp)) {
        Text(text = title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(10.dp))
        content()
    }
}

@Composable
private fun IngredientRow(ingredient: Ingredient, editMode: Boolean, onDelete: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Box(modifier = Modifier.size(5.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
        Text(text = ingredient.text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(start = 10.dp))
        if (editMode) {
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Remove ingredient", modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun StepRow(number: Int, step: RecipeStep, editMode: Boolean, onDelete: () -> Unit) {
    Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        val thumbColor = CardPlaceholderColors[(step.id % CardPlaceholderColors.size).toInt()]
        Box(
            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(14.dp)).background(thumbColor),
            contentAlignment = Alignment.Center
        ) {
            if (step.photoPath != null) {
                AsyncImage(model = File(step.photoPath), contentDescription = null, modifier = Modifier.fillMaxSize())
            } else {
                Text(text = number.toString(), color = Color.White, style = MaterialTheme.typography.titleSmall)
            }
        }
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            if (step.instructionText.isNotBlank()) {
                Text(text = step.instructionText, style = MaterialTheme.typography.bodyMedium)
            } else {
                Text(text = "(no instruction yet)", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (editMode) {
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Remove step", modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun AddRow(value: String, onValueChange: (String) -> Unit, placeholder: String, onAdd: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder) },
            singleLine = true,
            modifier = Modifier.weight(1f)
        )
        IconButton(onClick = onAdd, enabled = value.isNotBlank()) {
            Icon(Icons.Filled.Add, contentDescription = "Add")
        }
    }
}

@Composable
private fun TipsCard(
    notes: List<RecipeNote>,
    editMode: Boolean,
    newTipText: String,
    onNewTipChange: (String) -> Unit,
    onAddTip: () -> Unit,
    onDeleteTip: (RecipeNote) -> Unit
) {
    if (notes.isEmpty() && !editMode) return
    Column(
        modifier = Modifier
            .padding(20.dp, 16.dp, 20.dp, 4.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(18.dp, 16.dp, 18.dp, 16.dp)
    ) {
        Text(text = "Tips & Learnings", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.secondary)
        Spacer(Modifier.height(8.dp))
        notes.forEach { note ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                Text(text = "–", color = MaterialTheme.colorScheme.secondary)
                Text(
                    text = note.text,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.weight(1f).padding(start = 8.dp)
                )
                if (editMode) {
                    IconButton(onClick = { onDeleteTip(note) }, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Filled.Close, contentDescription = "Remove tip", modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
        if (editMode) {
            AddRow(value = newTipText, onValueChange = onNewTipChange, placeholder = "Add a tip", onAdd = onAddTip)
        }
    }
}

@Composable
private fun FullTextCard(details: RecipeWithDetails, onShare: () -> Unit) {
    Column(
        modifier = Modifier
            .padding(20.dp, 18.dp, 20.dp, 0.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
            .padding(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(text = "Full Recipe (text)", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            IconButton(onClick = onShare, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Filled.Share, contentDescription = "Share as text", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(text = RecipeTextFormatter.format(details), style = MaterialTheme.typography.bodySmall)
    }
}
