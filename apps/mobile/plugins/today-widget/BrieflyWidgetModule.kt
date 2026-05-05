package com.briefly.mobile

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
            val context = appContext.reactContext
            if (context != null) {
                TodayWidgetRenderer.updateAll(context)
            }
            null
        }
    }
}