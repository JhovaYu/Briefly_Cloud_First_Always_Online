package com.briefly.mobile.widget

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * BrieflyWidgetModule — Expo Modules API bridge for widget refresh.
 *
 * Exposes updateTodayWidget() to JS. When called after a cache write,
 * forces an immediate refresh of all Today widget instances.
 *
 * PM-10D.3
 */
class BrieflyWidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BrieflyWidget")

        AsyncFunction("updateTodayWidget") {
            val context: Context = appContext.reactContext ?: return@AsyncFunction null
            TodayWidgetRenderer.updateAll(context)
            null
        }
    }
}