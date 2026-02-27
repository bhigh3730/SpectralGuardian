package com.spectral.matrix

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.wifi.WifiManager
import android.util.Log

import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.WifiP2pManager.PeerListListener

/**
 * SensorFusionScanner - Real-time environment analysis.
 * 
 * Collects data from:
 * 1. Magnetometer (EMF)
 * 2. WiFi Scan Results
 * 3. Bluetooth Discovery
 * 4. WiFi Direct (P2P) Peers
 */
class SensorFusionScanner(private val context: Context, private val onUpdate: (ScannerData) -> Unit) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    
    private val p2pManager = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    private val p2pChannel = p2pManager?.initialize(context, context.mainLooper, null)

    private var currentEmf: Float = 0f
    private val detectedDevices = mutableListOf<DetectedEntity>()
    private val systemEvents = mutableListOf<String>()

    data class DetectedEntity(
        val name: String,
        val id: String,
        val type: String, // WiFi, BT, DIRECT, etc.
        val signalStrength: Int, // RSSI
        val threatLevel: String = "Low",
        val details: String = "",
        val timestamp: String = ""
    )

    data class ScannerData(
        val emf: Float,
        val entities: List<DetectedEntity>,
        val systemEvents: List<String>
    )

    fun start() {
        // EMF Sensor
        val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI)

        // WiFi Scan
        val wifiFilter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        context.registerReceiver(wifiReceiver, wifiFilter)
        wifiManager.startScan()

        // Bluetooth Scan
        val btFilter = IntentFilter(BluetoothDevice.ACTION_FOUND)
        context.registerReceiver(btReceiver, btFilter)
        bluetoothAdapter?.startDiscovery()

        // WiFi Direct Scan
        p2pManager?.discoverPeers(p2pChannel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                addSystemEvent("WiFi Direct Discovery Started.")
            }
            override fun onFailure(reason: Int) {
                addSystemEvent("WiFi Direct Discovery Failed: $reason")
            }
        })
        
        val p2pFilter = IntentFilter(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
        context.registerReceiver(p2pReceiver, p2pFilter)

        addSystemEvent("Sensor Fusion Core Initialized.")
    }

    fun stop() {
        sensorManager.unregisterListener(this)
        try {
            context.unregisterReceiver(wifiReceiver)
            context.unregisterReceiver(btReceiver)
            context.unregisterReceiver(p2pReceiver)
        } catch (e: Exception) {}
        bluetoothAdapter?.cancelDiscovery()
        p2pManager?.stopPeerDiscovery(p2pChannel, null)
    }

    private val p2pReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION == intent.action) {
                p2pManager?.requestPeers(p2pChannel) { peers ->
                    peers.deviceList.forEach { device ->
                        val entity = DetectedEntity(
                            name = device.deviceName ?: "P2P Device",
                            id = device.deviceAddress,
                            type = "DIRECT",
                            signalStrength = -50, // P2P doesn't give RSSI easily, using placeholder
                            details = "Status: ${getDeviceStatus(device.status)}"
                        )
                        updateOrAddEntity(entity)
                    }
                    notifyUpdate()
                }
            }
        }
    }

    private fun getDeviceStatus(status: Int): String {
        return when (status) {
            WifiP2pDevice.AVAILABLE -> "Available"
            WifiP2pDevice.INVITED -> "Invited"
            WifiP2pDevice.CONNECTED -> "Connected"
            WifiP2pDevice.FAILED -> "Failed"
            WifiP2pDevice.UNAVAILABLE -> "Unavailable"
            else -> "Unknown"
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type == Sensor.TYPE_MAGNETIC_FIELD) {
            // EMF calculation: sqrt(x^2 + y^2 + z^2)
            currentEmf = Math.sqrt(
                (event.values[0] * event.values[0] +
                 event.values[1] * event.values[1] +
                 event.values[2] * event.values[2]).toDouble()
            ).toFloat()
            notifyUpdate()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private val wifiReceiver = object : BroadcastReceiver() {
        @SuppressLint("MissingPermission")
        override fun onReceive(context: Context, intent: Intent) {
            val results = wifiManager.scanResults
            results.forEach { result ->
                val entity = DetectedEntity(
                    name = result.SSID.ifEmpty { "Hidden Network" },
                    id = result.BSSID,
                    type = "WiFi",
                    signalStrength = result.level,
                    details = "Freq: ${result.frequency}MHz | Caps: ${result.capabilities}"
                )
                updateOrAddEntity(entity)
            }
            notifyUpdate()
        }
    }

    private val btReceiver = object : BroadcastReceiver() {
        @SuppressLint("MissingPermission")
        override fun onReceive(context: Context, intent: Intent) {
            if (BluetoothDevice.ACTION_FOUND == intent.action) {
                val device: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                val rssi: Short = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE)
                device?.let {
                    val entity = DetectedEntity(
                        name = it.name ?: "Unknown BT Device",
                        id = it.address,
                        type = "Bluetooth",
                        signalStrength = rssi.toInt(),
                        details = "Class: ${it.bluetoothClass?.deviceClass ?: "N/A"}"
                    )
                    updateOrAddEntity(entity)
                }
                notifyUpdate()
            }
        }
    }

    private fun addSystemEvent(msg: String) {
        val time = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
        systemEvents.add(0, "[$time] $msg")
        if (systemEvents.size > 20) systemEvents.removeAt(systemEvents.size - 1)
    }

    private fun assessThreat(entity: DetectedEntity): String {
        return when {
            entity.signalStrength > -40 -> "CRITICAL"
            entity.signalStrength > -60 -> "HIGH"
            entity.type == "WiFi" && entity.details.contains("OPEN") -> "MEDIUM"
            else -> "LOW"
        }
    }

    private fun updateOrAddEntity(entity: DetectedEntity) {
        val timestamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
        val updatedEntity = entity.copy(
            threatLevel = assessThreat(entity),
            timestamp = timestamp
        )
        
        val index = detectedDevices.indexOfFirst { it.id == entity.id }
        if (index != -1) {
            detectedDevices[index] = updatedEntity
        } else {
            detectedDevices.add(updatedEntity)
            addSystemEvent("New Entity Detected: ${entity.name} [${entity.type}]")
        }
        // Sort by signal strength (RSSI is negative, so closer to 0 is stronger)
        detectedDevices.sortByDescending { it.signalStrength }
    }

    private fun notifyUpdate() {
        onUpdate(ScannerData(currentEmf, detectedDevices.toList(), systemEvents.toList()))
    }
}
