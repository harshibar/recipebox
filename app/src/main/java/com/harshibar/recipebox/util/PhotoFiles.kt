package com.harshibar.recipebox.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

object PhotoFiles {

    /** A fresh file under files/photos/ plus the content:// Uri the camera app can write to. */
    fun createPhotoDestination(context: Context): Pair<File, Uri> {
        val dir = File(context.filesDir, "photos").apply { if (!exists()) mkdirs() }
        val file = File(dir, "${UUID.randomUUID()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        return file to uri
    }
}
