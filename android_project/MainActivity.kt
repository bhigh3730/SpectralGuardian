package com.spectral.matrix

import android.annotation.SuppressLint
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File

/**
 * MainActivity - The Forefront Interface.
 * 
 * Features:
 * 1. Full-screen WebView loading local dashboard.
 * 2. JS Bridge for native security functions.
 * 3. FLAG_SECURE for screen capture protection.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Stealth: Block screenshots and recordings
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        setContentView(R.layout.activity_main)
        hideSystemUI()

        webView = findViewById(R.id.webView)
        
        webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_NO_CACHE
                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
            }
            
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    // Inject initial data if needed
                }
            }
            
            addJavascriptInterface(DashboardBridge(), "SpectralNative")
            
            // Load the local dashboard
            loadUrl("file:///android_asset/index.html")
        }
    }

    private fun hideSystemUI() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    inner class DashboardBridge {
        @JavascriptInterface
        fun onUnlock() {
            runOnUiThread {
                val intent = Intent(this@MainActivity, DashboardActivity::class.java)
                startActivity(intent)
            }
        }

        @JavascriptInterface
        fun toggleVpn() {
            val intent = VpnService.prepare(this@MainActivity)
            if (intent != null) {
                startActivityForResult(intent, 0)
            } else {
                startVpnService()
            }
        }

        @JavascriptInterface
        fun getRiskApps(): String {
            // Implementation from previous DashboardActivity
            return "[]" // Return JSON string
        }

        @JavascriptInterface
        fun getLogs(): String {
            return "[]" // Return JSON string
        }

        @JavascriptInterface
        fun closeInterface() {
            runOnUiThread {
                finish()
            }
        }
    }

    private fun startVpnService() {
        val intent = Intent(this, SpectralVpnService::class.java)
        startService(intent)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == RESULT_OK) {
            startVpnService()
        }
    }
}
