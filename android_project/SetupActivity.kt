package com.spectral.matrix

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * SetupActivity - The one-time configuration portal.
 * 
 * Responsibilities:
 * 1. Request Overlay Permission (for gesture detection).
 * 2. Request Battery Optimization exclusion (for persistence).
 * 3. Start the SpectralService.
 * 4. Self-destruct (disable launcher component) after setup.
 */
class SetupActivity : AppCompatActivity() {

    private val OVERLAY_PERMISSION_REQ_CODE = 1234

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        findViewById<Button>(R.id.btnGrantOverlay).setOnClickListener {
            if (!Settings.canDrawOverlays(this)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivityForResult(intent, OVERLAY_PERMISSION_REQ_CODE)
            } else {
                Toast.makeText(this, "Overlay permission already granted", Toast.LENGTH_SHORT).show()
            }
        }

        findViewById<Button>(R.id.btnBatteryOpt).setOnClickListener {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            startActivity(intent)
        }

        findViewById<Button>(R.id.btnStartService).setOnClickListener {
            if (Settings.canDrawOverlays(this)) {
                startService(Intent(this, SpectralService::class.java))
                Toast.makeText(this, "Guardian Service Started", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Please grant overlay permission first", Toast.LENGTH_SHORT).show()
            }
        }

        findViewById<Button>(R.id.btnHideApp).setOnClickListener {
            // Disable the launcher component
            val pkg = packageManager
            pkg.setComponentEnabledSetting(
                ComponentName(this, SetupActivity::class.java),
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )
            Toast.makeText(this, "App icon removed. Use gesture to access.", Toast.LENGTH_LONG).show()
            finish()
        }
    }
}
