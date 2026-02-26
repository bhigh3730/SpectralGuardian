package com.spectral.matrix

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.util.*

/**
 * DashboardActivity - Futuristic Sensor Fusion Interface.
 * 
 * Features:
 * 1. Real-time EMF monitoring.
 * 2. WiFi & Bluetooth entity detection.
 * 3. Threat assessment based on signal strength and device type.
 * 4. Advanced Port Shield toggle.
 */
class DashboardActivity : AppCompatActivity() {

    private lateinit var connectionStatus: TextView
    private lateinit var emfValue: TextView
    private lateinit var entityList: LinearLayout
    private lateinit var vpnToggleButton: Button
    
    private lateinit var scanner: SensorFusionScanner
    private val handler = Handler(Looper.getMainLooper())
    private val VPN_REQUEST_CODE = 100

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Stealth: Block screenshots and recordings
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
        
        setContentView(R.layout.activity_dashboard)

        connectionStatus = findViewById(R.id.connectionStatus)
        emfValue = findViewById(R.id.emfValue)
        entityList = findViewById(R.id.entityList)
        vpnToggleButton = findViewById(R.id.vpnToggleButton)

        vpnToggleButton.setOnClickListener { toggleVpn() }
        findViewById<Button>(R.id.closeButton).setOnClickListener { finish() }

        // Initialize Sensor Fusion Scanner
        scanner = SensorFusionScanner(this) { data ->
            runOnUiThread {
                updateUI(data)
            }
        }

        startConnectionMonitor()
    }

    override fun onResume() {
        super.onResume()
        scanner.start()
    }

    override fun onPause() {
        super.onPause()
        scanner.stop()
    }

    private fun startConnectionMonitor() {
        val runnable = object : Runnable {
            override fun run() {
                updateConnectionInfo()
                handler.postDelayed(this, 5000)
            }
        }
        handler.post(runnable)
    }

    @SuppressLint("SetTextI18n")
    private fun updateConnectionInfo() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork
        val capabilities = cm.getNetworkCapabilities(network)
        
        if (capabilities != null) {
            val type = when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WiFi"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
                else -> "Unknown"
            }
            connectionStatus.text = "LINK STATUS: $type | SECURE: ${!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)}"
        } else {
            connectionStatus.text = "LINK STATUS: DISCONNECTED"
        }
    }

    @SuppressLint("SetTextI18n")
    private fun updateUI(data: SensorFusionScanner.ScannerData) {
        // Update EMF
        emfValue.text = String.format("%.2f µT", data.emf)
        if (data.emf > 100) {
            emfValue.setTextColor(android.graphics.Color.parseColor("#FF0033")) // Spectral Red
        } else {
            emfValue.setTextColor(android.graphics.Color.parseColor("#00FFCC")) // Alien Cyan
        }

        // Update Entity List
        entityList.removeAllViews()

        // Add System Events Header
        val eventHeader = TextView(this)
        eventHeader.text = "SYSTEM LOGS"
        eventHeader.setTextColor(android.graphics.Color.parseColor("#444444"))
        eventHeader.textSize = 10f
        eventHeader.setPadding(0, 20, 0, 10)
        entityList.addView(eventHeader)

        data.systemEvents.take(5).forEach { event ->
            val tv = TextView(this)
            tv.text = event
            tv.setTextColor(android.graphics.Color.parseColor("#666666"))
            tv.textSize = 9f
            tv.fontFamily = android.graphics.Typeface.MONOSPACE
            entityList.addView(tv)
        }

        // Add Detected Entities Header
        val entityHeader = TextView(this)
        entityHeader.text = "DETECTED ENTITIES"
        entityHeader.setTextColor(android.graphics.Color.parseColor("#444444"))
        entityHeader.textSize = 10f
        entityHeader.setPadding(0, 30, 0, 10)
        entityList.addView(entityHeader)

        data.entities.forEach { entity ->
            val entityView = layoutInflater.inflate(android.R.layout.simple_list_item_2, null)
            val text1 = entityView.findViewById<TextView>(android.R.id.text1)
            val text2 = entityView.findViewById<TextView>(android.R.id.text2)

            val threatColor = when (entity.threatLevel) {
                "CRITICAL" -> android.graphics.Color.parseColor("#FF0033")
                "HIGH" -> android.graphics.Color.parseColor("#FF9900")
                "MEDIUM" -> android.graphics.Color.parseColor("#FFFF00")
                else -> android.graphics.Color.parseColor("#00FFCC")
            }

            text1.text = "ID: ${entity.id} | THREAT: ${entity.threatLevel}"
            text1.setTextColor(threatColor)
            text1.textSize = 12f
            text1.fontFamily = android.graphics.Typeface.MONOSPACE

            text2.text = "NAME: ${entity.name}\nTYPE: ${entity.type} | RSSI: ${entity.signalStrength} dBm\nTIME: ${entity.timestamp}\nDATA: ${entity.details}"
            text2.setTextColor(android.graphics.Color.parseColor("#AAAAAA"))
            text2.textSize = 9f
            text2.setPadding(0, 0, 0, 20)

            entityList.addView(entityView)
        }
    }

    private fun toggleVpn() {
        val intent = VpnService.prepare(this)
        if (intent != null) {
            startActivityForResult(intent, VPN_REQUEST_CODE)
        } else {
            onActivityResult(VPN_REQUEST_CODE, RESULT_OK, null)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE && resultCode == RESULT_OK) {
            val intent = Intent(this, SpectralVpnService::class.java)
            startService(intent)
            vpnToggleButton.text = "SHIELD ACTIVE"
            vpnToggleButton.isEnabled = false
        }
    }
}
