package com.briefly.mobile

import android.appwidget.AppWidgetManager
import android.content.Context
import android.appwidget.AppWidgetProvider

/**
 * TodayWidgetProvider — Android AppWidget for Briefly Today dashboard.
 *
 * Delegates all RemoteViews building to TodayWidgetRenderer to avoid
 * duplication between the provider (system-triggered updates) and
 * the Expo module (JS-triggered immediate refresh).
 *
 * PM-10D.3
 */
class TodayWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val views = TodayWidgetRenderer.buildRemoteViews(context)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}