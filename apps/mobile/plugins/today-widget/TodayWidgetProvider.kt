package com.briefly.mobile

import android.appwidget.AppWidgetManager
import android.content.Context
import android.appwidget.AppWidgetProvider

/**
 * TodayWidgetProvider — Android AppWidget for Briefly Today dashboard.
 *
 * Delegates RemoteViews building to TodayWidgetRenderer in the
 * briefly-widget Expo module (com.briefly.mobile.widget).
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
            val views = com.briefly.mobile.widget.TodayWidgetRenderer.buildRemoteViews(context)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}