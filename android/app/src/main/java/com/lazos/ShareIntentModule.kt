package com.lazos

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class ShareIntentModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

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

            if (intent.action == Intent.ACTION_SEND &&
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

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SHARE_INTENT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearSharedData() {
        val activity = ctx.currentActivity ?: return
        val intent = activity.intent ?: return
        intent.action = null
        intent.type = null
    }
}
