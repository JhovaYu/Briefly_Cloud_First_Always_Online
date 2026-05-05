package com.briefly.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
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

        // RemoteViews view IDs (must match res/layout/today_widget.xml)
        const val ID_WORKSPACE = 0x7f010001
        const val ID_DATE = 0x7f010002
        const val ID_PENDING_COUNT = 0x7f010003
        const val ID_TASK_1 = 0x7f010004
        const val ID_TASK_2 = 0x7f010005
        const val ID_TASK_3 = 0x7f010006
        const val ID_NEXT_BLOCK = 0x7f010007
        const val ID_EMPTY = 0x7f010008
        const val ID_STALE = 0x7f010009
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
                // No cache yet — prompt user to open app
                setEmptyState(views, "Abre Briefly para actualizar")
                views.setViewVisibility(ID_STALE, View.GONE)
            }
            else -> {
                try {
                    val json = JSONObject(cacheFile.readText())
                    populateViews(views, json)
                    views.setViewVisibility(ID_STALE, View.GONE)
                } catch (e: Exception) {
                    // Corrupt or unreadable JSON
                    setEmptyState(views, "No se pudo leer Today")
                    views.setViewVisibility(ID_STALE, View.GONE)
                }
            }
        }

        // PendingIntent: tap opens MainActivity
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(android.R.id.background, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun populateViews(views: RemoteViews, json: JSONObject) {
        // Workspace name
        val workspaceName = json.optString("workspaceName", null)
        if (!workspaceName.isNullOrEmpty()) {
            views.setTextViewText(ID_WORKSPACE, workspaceName)
        } else {
            views.setTextViewText(ID_WORKSPACE, "Sin workspace")
        }

        // Date label
        val dateLabel = json.optString("dateLabel", "")
        views.setTextViewText(ID_DATE, dateLabel)

        // Pending task count
        val count = json.optInt("pendingTasksCount", 0)
        val countText = if (count == 0) "Sin tareas pendientes"
                        else "$count tarea${if (count != 1) "s" else ""} pendiente${if (count != 1) "s" else ""}"
        views.setTextViewText(ID_PENDING_COUNT, countText)

        // Top tasks (up to 3)
        val tasks = json.optJSONArray("topTasks")
        val taskIds = listOf(ID_TASK_1, ID_TASK_2, ID_TASK_3)
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
            views.setTextViewText(ID_NEXT_BLOCK, blockText)
            views.setViewVisibility(ID_NEXT_BLOCK, View.VISIBLE)
        } else {
            views.setTextViewText(ID_NEXT_BLOCK, "")
            views.setViewVisibility(ID_NEXT_BLOCK, View.GONE)
        }

        // Empty state message
        val emptyMsg = json.optString("emptyStateMessage", null)
        if (!emptyMsg.isNullOrEmpty()) {
            views.setTextViewText(ID_EMPTY, emptyMsg)
            views.setViewVisibility(ID_EMPTY, View.VISIBLE)
        } else {
            views.setViewVisibility(ID_EMPTY, View.GONE)
        }

        // Stale indicator
        val stale = json.optBoolean("stale", false)
        views.setViewVisibility(ID_STALE, if (stale) View.VISIBLE else View.GONE)
    }

    private fun setEmptyState(views: RemoteViews, message: String) {
        views.setTextViewText(ID_WORKSPACE, "Today Widget")
        views.setTextViewText(ID_DATE, "")
        views.setTextViewText(ID_PENDING_COUNT, message)
        views.setViewVisibility(ID_TASK_1, View.GONE)
        views.setViewVisibility(ID_TASK_2, View.GONE)
        views.setViewVisibility(ID_TASK_3, View.GONE)
        views.setViewVisibility(ID_NEXT_BLOCK, View.GONE)
        views.setViewVisibility(ID_EMPTY, View.GONE)
    }
}