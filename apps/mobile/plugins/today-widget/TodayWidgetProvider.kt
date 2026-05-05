package com.briefly.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import android.view.View
import org.json.JSONObject
import java.io.File

/**
 * TodayWidgetProvider — Android AppWidget for Briefly Today dashboard.
 *
 * Reads today_widget_cache.json from context.filesDir and populates
 * RemoteViews with the cached TodayData. Tap opens MainActivity.
 *
 * PM-10D.2
 */
class TodayWidgetProvider : AppWidgetProvider() {

    companion object {
        const val CACHE_FILE_NAME = "today_widget_cache.json"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val cacheFile = File(context.filesDir, CACHE_FILE_NAME)

        val views = RemoteViews(context.packageName, R.layout.today_widget)

        when {
            !cacheFile.exists() -> {
                setEmptyState(views, "Abre Briefly para actualizar")
                views.setViewVisibility(R.id.widget_stale, View.GONE)
            }
            else -> {
                try {
                    val json = JSONObject(cacheFile.readText())
                    populateViews(views, json)
                    views.setViewVisibility(R.id.widget_stale, View.GONE)
                } catch (e: Exception) {
                    setEmptyState(views, "No se pudo leer Today")
                    views.setViewVisibility(R.id.widget_stale, View.GONE)
                }
            }
        }

        // Tap opens app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun populateViews(views: RemoteViews, json: JSONObject) {
        // Workspace name
        val workspaceName = json.optString("workspaceName", null)
        if (!workspaceName.isNullOrEmpty()) {
            views.setTextViewText(R.id.widget_workspace, workspaceName)
        } else {
            views.setTextViewText(R.id.widget_workspace, "Sin workspace")
        }

        // Date label
        val dateLabel = json.optString("dateLabel", "")
        views.setTextViewText(R.id.widget_date, dateLabel)

        // Pending task count
        val count = json.optInt("pendingTasksCount", 0)
        val countText = if (count == 0) "Sin tareas pendientes"
                        else "$count tarea${if (count != 1) "s" else ""} pendiente${if (count != 1) "s" else ""}"
        views.setTextViewText(R.id.widget_pending_count, countText)

        // Top tasks (up to 3)
        val taskIds = listOf(R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3)
        val tasks = json.optJSONArray("topTasks")
        for (i in 0 until 3) {
            if (tasks != null && i < tasks.length()) {
                val task = tasks.getJSONObject(i)
                val text = task.optString("text", "")
                views.setTextViewText(taskIds[i], text)
                views.setViewVisibility(taskIds[i], View.VISIBLE)
            } else {
                views.setTextViewText(taskIds[i], "")
                views.setViewVisibility(taskIds[i], View.GONE)
            }
        }

        // Next schedule block
        val nextBlock = json.optJSONObject("nextScheduleBlock")
        if (nextBlock != null) {
            val title = nextBlock.optString("title", "")
            val startTime = nextBlock.optString("start_time", "")
            val duration = nextBlock.optInt("duration_minutes", 0)
            val blockText = if (title.isNotEmpty())
                "$title · $startTime · ${duration}min"
            else
                ""
            views.setTextViewText(R.id.widget_next_block, blockText)
            views.setViewVisibility(R.id.widget_next_block, View.VISIBLE)
        } else {
            views.setTextViewText(R.id.widget_next_block, "")
            views.setViewVisibility(R.id.widget_next_block, View.GONE)
        }

        // Empty state message
        val emptyMsg = json.optString("emptyStateMessage", null)
        if (!emptyMsg.isNullOrEmpty()) {
            views.setTextViewText(R.id.widget_empty, emptyMsg)
            views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_empty, View.GONE)
        }

        // Stale indicator
        val stale = json.optBoolean("stale", false)
        views.setViewVisibility(R.id.widget_stale, if (stale) View.VISIBLE else View.GONE)
    }

    private fun setEmptyState(views: RemoteViews, message: String) {
        views.setTextViewText(R.id.widget_workspace, "Today Widget")
        views.setTextViewText(R.id.widget_date, "")
        views.setTextViewText(R.id.widget_pending_count, message)
        views.setViewVisibility(R.id.widget_task_1, View.GONE)
        views.setViewVisibility(R.id.widget_task_2, View.GONE)
        views.setViewVisibility(R.id.widget_task_3, View.GONE)
        views.setViewVisibility(R.id.widget_next_block, View.GONE)
        views.setViewVisibility(R.id.widget_empty, View.GONE)
    }
}