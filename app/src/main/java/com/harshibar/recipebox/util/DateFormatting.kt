package com.harshibar.recipebox.util

import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val mediumDate = DateTimeFormatter.ofPattern("MMM d")

fun formatEpochDay(epochDay: Long): String = LocalDate.ofEpochDay(epochDay).format(mediumDate)
