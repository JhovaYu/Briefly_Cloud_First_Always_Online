package com.briefly.mobile.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.util.Log
import android.widget.RemoteViews
import android.view.View
import org.json.JSONObject
import java.io.File

/**
 * TodayWidgetRenderer — shared RemoteViews builder for widget updates.
 *
 * Used by both the AppWidgetProvider (system-triggered) and
 * BrieflyWidgetModule (JS-triggered immediate refresh).
 *
 * PM-10D.3
 */
object TodayWidgetRenderer {

    private const val CACHE_FILE_NAME = "today_widget_cache.json"
    private const val TAG = "BrieflyWidget"

    /**
     * Forces an immediate update of all Briefly Today widget instances.
     */
    fun updateAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(
            ComponentName(context.packageName, "com.briefly.mobile.TodayWidgetProvider")
        )
        if (ids.isEmpty()) {
            Log.d(TAG, "No widget instances to update")
            return
        }
        Log.d(TAG, "Updating ${ids.size} widget instance(s)")
        val views = buildRemoteViews(context)
        manager.updateAppWidget(ids, views)
    }

    /**
     * Builds RemoteViews using dynamic resource resolution.
     */
    fun buildRemoteViews(context: Context): RemoteViews {
        val packageName = context.packageName
        val layoutRes = context.resources.getIdentifier("today_widget", "layout", packageName)
        val rootId = context.resources.getIdentifier("widget_root", "id", packageName)
        val workspaceId = context.resources.getIdentifier("widget_workspace", "id", packageName)
        val dateId = context.resources.getIdentifier("widget_date", "id", packageName)
        val countId = context.resources.getIdentifier("widget_pending_count", "id", packageName)
        val task1Id = context.resources.getIdentifier("widget_task_1", "id", packageName)
        val task2Id = context.resources.getIdentifier("widget_task_2", "id", packageName)
        val task3Id = context.resources.getIdentifier("widget_task_3", "id", packageName)
        val blockId = context.resources.getIdentifier("widget_next_block", "id", packageName)
        val emptyId = context.resources.getIdentifier("widget_empty", "id", packageName)
        val staleId = context.resources.getIdentifier("widget_stale", "id", packageName)

        val views = RemoteViews(packageName, layoutRes)

        val cacheFile = File(context.filesDir, CACHE_FILE_NAME)

        when {
            !cacheFile.exists() -> {
                setEmptyState(views, "Abre Briefly para actualizar", workspaceId, dateId, countId, task1Id, task2Id, task3Id, blockId, emptyId)
                if (staleId != 0) views.setViewVisibility(staleId, View.GONE)
            }
            else -> {
                try {
                    val json = JSONObject(cacheFile.readText())
                    populateViews(views, json, workspaceId, dateId, countId, task1Id, task2Id, task3Id, blockId, emptyId, staleId)
                    if (staleId != 0) views.setViewVisibility(staleId, View.GONE)
                } catch (e: Exception) {
                    setEmptyState(views, "No se pudo leer Today", workspaceId, dateId, countId, task1Id, task2Id, task3Id, blockId, emptyId)
                    if (staleId != 0) views.setViewVisibility(staleId, View.GONE)
                }
            }
        }

        // Tap opens app
        if (rootId != 0) {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(rootId, pendingIntent)
            }
        }

        return views
    }

    private fun populateViews(
        views: RemoteViews,
        json: JSONObject,
        workspaceId: Int,
        dateId: Int,
        countId: Int,
        task1Id: Int,
        task2Id: Int,
        task3Id: Int,
        blockId: Int,
        emptyId: Int,
        staleId: Int
    ) {
        // Workspace name
        if (workspaceId != 0) {
            val workspaceName = json.optString("workspaceName", null)
            if (!workspaceName.isNullOrEmpty()) {
                views.setTextViewText(workspaceId, workspaceName)
            } else {
                views.setTextViewText(workspaceId, "Sin workspace")
            }
        }

        // Date label
        if (dateId != 0) {
            views.setTextViewText(dateId, json.optString("dateLabel", ""))
        }

        // Pending task count
        if (countId != 0) {
            val count = json.optInt("pendingTasksCount", 0)
            val countText = if (count == 0) "Sin tareas pendientes"
                            else "$count tarea${if (count != 1) "s" else ""} pendiente${if (count != 1) "s" else ""}"
            views.setTextViewText(countId, countText)
        }

        // Top tasks (up to 3)
        val taskIds = listOf(task1Id, task2Id, task3Id)
        val tasks = json.optJSONArray("topTasks")
        for (i in 0 until 3) {
            if (taskIds[i] != 0) {
                if (tasks != null && i < tasks.length()) {
                    val text = tasks.getJSONObject(i).optString("text", "")
                    views.setTextViewText(taskIds[i], text)
                    views.setViewVisibility(taskIds[i], View.VISIBLE)
                } else {
                    views.setTextViewText(taskIds[i], "")
                    views.setViewVisibility(taskIds[i], View.GONE)
                }
            }
        }

        // Next schedule block
        if (blockId != 0) {
            val nextBlock = json.optJSONObject("nextScheduleBlock")
            if (nextBlock != null) {
                val title = nextBlock.optString("title", "")
                val startTime = nextBlock.optString("start_time", "")
                val duration = nextBlock.optInt("duration_minutes", 0)
                val blockText = if (title.isNotEmpty())
                    "$title · $startTime · ${duration}min"
                else
                    ""
                views.setTextViewText(blockId, blockText)
                views.setViewVisibility(blockId, View.VISIBLE)
            } else {
                views.setTextViewText(blockId, "")
                views.setViewVisibility(blockId, View.GONE)
            }
        }

        // Empty state message
        if (emptyId != 0) {
            val emptyMsg = json.optString("emptyStateMessage", null)
            if (!emptyMsg.isNullOrEmpty()) {
                views.setTextViewText(emptyId, emptyMsg)
                views.setViewVisibility(emptyId, View.VISIBLE)
            } else {
                views.setViewVisibility(emptyId, View.GONE)
            }
        }

        // Stale indicator
        if (staleId != 0) {
            val stale = json.optBoolean("stale", false)
            views.setViewVisibility(staleId, if (stale) View.VISIBLE else View.GONE)
        }
    }

    private fun setEmptyState(
        views: RemoteViews,
        message: String,
        workspaceId: Int,
        dateId: Int,
        countId: Int,
        task1Id: Int,
        task2Id: Int,
        task3Id: Int,
        blockId: Int,
        emptyId: Int
    ) {
        if (workspaceId != 0) views.setTextViewText(workspaceId, "Today Widget")
        if (dateId != 0) views.setTextViewText(dateId, "")
        if (countId != 0) views.setTextViewText(countId, message)
        if (task1Id != 0) views.setViewVisibility(task1Id, View.GONE)
        if (task2Id != 0) views.setViewVisibility(task2Id, View.GONE)
        if (task3Id != 0) views.setViewVisibility(task3Id, View.GONE)
        if (blockId != 0) views.setViewVisibility(blockId, View.GONE)
        if (emptyId != 0) views.setViewVisibility(emptyId, View.GONE)
    }
}