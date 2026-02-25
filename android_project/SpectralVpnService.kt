package com.spectral.matrix

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log

/**
 * SpectralVpnService - Local loopback VPN for port filtering.
 * 
 * This service creates a virtual network interface.
 * In a full implementation, it would read packets from the interface
 * and drop those targeting restricted ports (5900, 3389, 5555).
 */
class SpectralVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Establish the VPN interface
        establishVpn()
        return START_STICKY
    }

    private fun establishVpn() {
        val builder = Builder()
        
        // Configure the interface
        builder.setSession("SpectralShield")
            .addAddress("10.0.0.2", 24)
            .addDnsServer("8.8.8.8")
            .addRoute("0.0.0.0", 0)
            
        // Establish the interface
        try {
            vpnInterface = builder.establish()
            Log.d("SpectralShield", "VPN Interface established")
        } catch (e: Exception) {
            Log.e("SpectralShield", "Failed to establish VPN", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            vpnInterface?.close()
        } catch (e: Exception) {
            // Ignore
        }
    }
}
