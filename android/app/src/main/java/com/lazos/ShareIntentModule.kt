package com.lazos

import android.content.Intent
import android.net.Uri
import android.util.Log
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class ShareIntentModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    private var lastCachedPath: String? = null

    override fun getName(): String = "ShareIntent"

    @ReactMethod
    fun getSharedData(promise: Promise) {
        try {
            val activity = ctx.currentActivity
            if (activity == null) {
                promise.resolve(null)
                return
            }

            val intent: Intent? = activity.intent
            if (intent == null || intent.action == null) {
                promise.resolve(null)
                return
            }

            val action = intent.action

            // Texto plano
            if (action == Intent.ACTION_SEND &&
                intent.type?.startsWith("text/") == true
            ) {
                val text: String? = intent.getStringExtra(Intent.EXTRA_TEXT)
                if (text != null) {
                    val result = WritableNativeMap()
                    result.putString("type", "text")
                    result.putString("data", text)
                    promise.resolve(result)
                    return
                }
            }

            // Imagen o video (uno solo)
            if (action == Intent.ACTION_SEND) {
                val mime = intent.type
                if (mime != null && (mime.startsWith("image/") || mime.startsWith("video/"))) {
                    val uri: Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)
                    if (uri != null) {
                        val map = handleMediaUri(uri)
                        if (map != null) {
                            promise.resolve(map)
                            return
                        }
                    }
                }
            }

            // Múltiples imágenes/videos — MVP: solo el primero
            if (action == Intent.ACTION_SEND_MULTIPLE) {
                val mime = intent.type
                if (mime != null && (mime.startsWith("image/") || mime.startsWith("video/"))) {
                    val uris: ArrayList<Uri>? =
                        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
                    if (!uris.isNullOrEmpty()) {
                        if (uris.size > 1) {
                            Log.w(
                                "ShareIntent",
                                "TODO multi-item: received ${uris.size} items, processing only the first"
                            )
                        }
                        val map = handleMediaUri(uris[0])
                        if (map != null) {
                            promise.resolve(map)
                            return
                        }
                    }
                }
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SHARE_INTENT_ERROR", e.message, e)
        }
    }

    private fun handleMediaUri(uri: Uri): WritableNativeMap? {
        val resolver = ctx.contentResolver
        val resolvedMime = resolver.getType(uri) ?: return null
        val kind = when {
            resolvedMime.startsWith("image/") -> "photo"
            resolvedMime.startsWith("video/") -> "video"
            else -> return null
        }

        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(resolvedMime)
            ?: if (kind == "photo") "jpg" else "mp4"
        val outFile = File(ctx.cacheDir, "shared-${UUID.randomUUID()}.$ext")

        resolver.openInputStream(uri)?.use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        } ?: return null

        lastCachedPath = outFile.absolutePath

        val result = WritableNativeMap()
        result.putString("type", kind)
        result.putString("path", outFile.absolutePath)
        result.putString("mime", resolvedMime)
        result.putDouble("size", outFile.length().toDouble())
        return result
    }

    @ReactMethod
    fun clearSharedData() {
        val activity = ctx.currentActivity
        if (activity != null) {
            val intent = activity.intent
            if (intent != null) {
                intent.action = null
                intent.type = null
                intent.removeExtra(Intent.EXTRA_TEXT)
                intent.removeExtra(Intent.EXTRA_STREAM)
            }
        }
        // Eliminar el archivo cacheado si existe
        lastCachedPath?.let { path ->
            try {
                val f = File(path)
                if (f.exists()) { f.delete() }
            } catch (e: Exception) {
                Log.w("ShareIntent", "Failed to delete cached file: ${e.message}")
            }
        }
        lastCachedPath = null
    }
}
