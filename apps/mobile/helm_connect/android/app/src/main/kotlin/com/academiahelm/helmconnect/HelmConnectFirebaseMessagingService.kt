// ============================================================================
// Helm Connect — Firebase Messaging Service (V2)
// ============================================================================
// Service Android pour recevoir les push notifications Firebase Cloud Messaging
// quand l'app est en arrière-plan ou tuée.
//
// ⭐ À activer en V2 : décommenter le bloc <service> dans AndroidManifest.xml
//    ET ajouter la dépendance firebase-messaging dans app/build.gradle
// ============================================================================

package com.academiahelm.helmconnect

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class HelmConnectFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        // Extract Helm Connect notification data
        val title = message.notification?.title ?: message.data["title"] ?: "Helm Connect"
        val body = message.notification?.body ?: message.data["body"] ?: ""
        val conversationId = message.data["conversationId"]
        val priority = message.data["priority"] ?: "NORMAL"

        // TODO V2: Use flutter_local_notifications to display the notification
        // For now, just log
        android.util.Log.i("HelmConnectFCM", "Received: $title / $body / conv=$conversationId / prio=$priority")
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send the new token to the backend so the user can receive push notifications
        android.util.Log.i("HelmConnectFCM", "New FCM token: $token")
        // TODO V2: POST to /api/chat/push/subscribe with this token
    }
}
