package com.spectral.matrix

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat

/**
 * SpectralService - The silent guardian.
 * 
 * Responsibilities:
 * 1. Maintain a foreground presence to avoid being killed.
 * 2. Create a transparent overlay to detect the 5-tap stealth gesture.
 * 3. Monitor system state for security.
 */
class SpectralService : Service() {

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private val CHANNEL_ID = "spectral_guardian"
    private val NOTIFICATION_ID = 3730

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        
        setupGestureOverlay()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "System Sync Service", // Stealthy name
                NotificationManager.IMPORTANCE_MIN
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("System Synchronized")
            .setContentText("Security protocols active.")
            .setSmallIcon(android.R.drawable.ic_menu_info_details) // Generic icon
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    private fun setupGestureOverlay() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
            WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        )

        overlayView = View(this)
        overlayView?.setBackgroundColor(Color.TRANSPARENT)

        val gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            private var tapCount = 0
            private var lastTapTime: Long = 0

            override fun onDown(e: MotionEvent): Boolean {
                val screenWidth = resources.displayMetrics.widthPixels
                val screenHeight = resources.displayMetrics.heightPixels
                
                // Define corner bounds: bottom 25%, right 25%
                val boundX = screenWidth * 0.75
                val boundY = screenHeight * 0.75

                if (e.x >= boundX && e.y >= boundY) {
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastTapTime > 5000) {
                        tapCount = 0
                    }
                    tapCount++
                    lastTapTime = currentTime

                    if (tapCount >= 5) {
                        launchDashboard()
                        tapCount = 0
                    }
                } else {
                    tapCount = 0
                }
                return false
            }
        })

        overlayView?.setOnTouchListener { _, event ->
            gestureDetector.onTouchEvent(event)
            false
        }

        windowManager.addView(overlayView, params)
    }

    private fun launchDashboard() {
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        startActivity(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (overlayView != null) {
            windowManager.removeView(overlayView)
        }
    }
}
