package com.spectral.matrix

import android.annotation.SuppressLint
import android.app.usage.NetworkStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
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
 * SpectralShield Dashboard - The hidden resistance layer.
 * 
 * Features:
 * 1. Connection Monitor: Shows active network status.
 * 2. Permission Scanner: Identifies high-risk apps.
 * 3. Port Shield: Toggle for the local VPN port blocker.
 */
class DashboardActivity : AppCompatActivity() {

    private lateinit var connectionStatus: TextView
    private lateinit var appListContainer: LinearLayout
    private lateinit var logContainer: LinearLayout
    private lateinit var vpnToggleButton: Button
    
    private val handler = Handler(Looper.getMainLooper())
    private val VPN_REQUEST_CODE = 100

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Maintain stealth security
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
        
        setContentView(R.layout.activity_dashboard)

        connectionStatus = findViewById(R.id.connectionStatus)
        appListContainer = findViewById(R.id.appListContainer)
        logContainer = findViewById(R.id.logContainer)
        vpnToggleButton = findViewById(R.id.vpnToggleButton)

        findViewById<Button>(R.id.scanButton).setOnClickListener { scanHighRiskApps() }
        vpnToggleButton.setOnClickListener { toggleVpn() }
        findViewById<Button>(R.id.closeButton).setOnClickListener { finish() }

        startConnectionMonitor()
        addLogEntry("SpectralShield initialized. Monitoring active.")
    }

    private fun startConnectionMonitor() {
        val runnable = object : Runnable {
            override fun run() {
                updateConnectionInfo()
                handler.postDelayed(this, 3000)
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
            connectionStatus.text = "Active Link: $type | Secure: ${!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)}"
        } else {
            connectionStatus.text = "Active Link: Disconnected"
        }
    }

    @SuppressLint("SetTextI18n")
    private fun scanHighRiskApps() {
        appListContainer.removeAllViews()
        addLogEntry("Scanning installed packages for high-risk permissions...")
        
        val pm = packageManager
        val packages = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)
        
        var riskCount = 0
        for (pkg in packages) {
            val permissions = pkg.requestedPermissions ?: continue
            val highRisk = permissions.filter { 
                it.contains("ACCESSIBILITY") || 
                it.contains("SCREEN_CAPTURE") || 
                it.contains("SYSTEM_ALERT_WINDOW") ||
                it.contains("RECORD_AUDIO")
            }

            if (highRisk.isNotEmpty()) {
                val appName = pkg.applicationInfo.loadLabel(pm).toString()
                val tv = TextView(this)
                tv.text = "⚠️ $appName\n   Risk: ${highRisk.joinToString(", ")}"
                tv.setTextColor(resources.getColor(android.R.color.holo_red_light))
                tv.setPadding(0, 10, 0, 10)
                appListContainer.addView(tv)
                riskCount++
            }
        }
        
        if (riskCount == 0) {
            val tv = TextView(this)
            tv.text = "No high-risk apps detected."
            tv.setTextColor(resources.getColor(android.R.color.holo_green_light))
            appListContainer.addView(tv)
        }
        
        addLogEntry("Scan complete. $riskCount risk(s) identified.")
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
            vpnToggleButton.text = "Shield Active"
            vpnToggleButton.isEnabled = false
            addLogEntry("Port Shield active. Blocking 5900, 3389, 5555.")
        }
    }

    private fun addLogEntry(message: String) {
        val tv = TextView(this)
        val time = java.text.SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        tv.text = "[$time] $message"
        tv.setTextColor(resources.getColor(android.R.color.white))
        tv.textSize = 12f
        logContainer.addView(tv, 0)
    }
}
