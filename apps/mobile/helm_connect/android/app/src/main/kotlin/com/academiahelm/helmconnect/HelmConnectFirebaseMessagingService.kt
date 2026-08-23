// ============================================================================
// Helm Connect — Firebase Messaging Service
// ============================================================================
// Service Android pour recevoir les push notifications Firebase Cloud Messaging
// quand l'app est en arrière-plan ou tuée.
//
// ⭐ Fonctionnalités :
//   - onMessageReceived : extrait les données + affiche une notification locale
//   - onNewToken : envoie le token FCM au backend (à implémenter côté Flutter)
//
// ⭐ Format attendu des messages FCM (côté backend NestJS) :
//   {
//     "notification": {
//       "title": "Nouveau message",
//       "body": "Aurore AKPOVI: Bonjour!",
//     },
//     "data": {
//       "conversationId": "abc-123",
//       "senderId": "user-456",
//       "priority": "NORMAL",  // LOW | NORMAL | HIGH | URGENT
//       "type": "MESSAGE",    // MESSAGE | ANNOUNCEMENT | MENTION | FILE
//       "click_action": "FLUTTER_NOTIFICATION_CLICK"
//     }
//   }
// ============================================================================

package com.academiahelm.helmconnect

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.flutter.embedding.android.FlutterActivity

class HelmConnectFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "helm_connect_messages"
        private const val CHANNEL_NAME = "Helm Connect Messages"
        private const val CHANNEL_DESC = "Notifications for new messages, announcements, mentions"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        // Extract notification data
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "Helm Connect"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: ""
        val conversationId = message.data["conversationId"]
        val priority = message.data["priority"] ?: "NORMAL"
        val type = message.data["type"] ?: "MESSAGE"

        android.util.Log.i(
            "HelmConnectFCM",
            "Received: title=$title, body=$body, conv=$conversationId, prio=$priority, type=$type"
        )

        // Create notification channel (required for Android 8+)
        createNotificationChannel()

        // Display the notification
        showNotification(title, body, conversationId, priority)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        android.util.Log.i("HelmConnectFCM", "New FCM token: $token")
        // ⭐ V2.8: Send the new token to the backend via a Flutter method channel
        // For now, the Flutter side (firebase_messaging package) handles the token
        // registration with /api/chat/push/subscribe automatically when the app starts.
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showNotification(
        title: String,
        body: String,
        conversationId: String?,
        priority: String
    ) {
        // ⭐ Intent : ouvre MainActivity quand l'utilisateur clique sur la notification
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            // Pass conversationId as extra so Flutter can navigate to it
            if (conversationId != null) {
                putExtra("conversationId", conversationId)
            }
            putExtra("priority", priority)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        // ⭐ Choose icon and color based on priority
        val (smallIcon, color) = when (priority) {
            "URGENT" -> Pair(android.R.drawable.ic_dialog_alert, 0xFFDC2626.toInt())
            "HIGH" -> Pair(android.R.drawable.ic_popup_reminder, 0xFFF59E0B.toInt())
            else -> Pair(android.R.drawable.ic_dialog_info, 0xFF1677FF.toInt())
        }

        // Default sound
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setColor(color)
            .setPriority(if (priority == "URGENT") NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            // For long messages, expand to show full content
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        // Use conversationId.hashCode() as notification ID so each conversation has its own
        // (otherwise new messages in the same conv replace the previous notification)
        val notifId = conversationId?.hashCode() ?: NOTIFICATION_ID
        notificationManager.notify(notifId, notificationBuilder.build())
    }
}

/**
 * Simple launcher activity for deep-linking from notifications.
 * Currently MainActivity (FlutterActivity) handles everything, but this
 * could be used for shortcut intents.
 */
class HelmConnectLauncherActivity : FlutterActivity()
