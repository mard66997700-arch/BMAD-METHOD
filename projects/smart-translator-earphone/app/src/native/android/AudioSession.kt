// Story 1.7 — Android native audio session module (skeleton).
//
// React Native turbo module that implements `AudioSession` from
// app/src/core/audio/audio-session-types.ts. NOT compiled in this snapshot.
//
// Reviewers: verify the BluetoothSco lifecycle and the foreground-service
// startup on Android 14+ match ADR-005.

package com.smarttranslatorearphone.audio

import android.bluetooth.BluetoothHeadset
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioSessionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val ctx: Context = reactContext.applicationContext
    private val audioManager: AudioManager =
        ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var audioRecord: AudioRecord? = null
    private var aec: AcousticEchoCanceler? = null
    private var scoReceiver: BroadcastReceiver? = null

    override fun getName(): String = "AudioSessionModule"

    @ReactMethod
    fun start(mode: String, @Suppress("UNUSED_PARAMETER") lang: String, promise: Promise) {
        try {
            // Android 14+ requires a foreground service of type "microphone"
            // before any mic capture begins. The actual service start is done
            // from the JS side via a separate module (omitted here).
            when (mode) {
                "duplex-bt", "capture-earphone-play-speaker", "capture-earphone-play-both" -> {
                    startBluetoothSco()
                }
            }
            val sampleRate = 16_000
            val bufferSize = AudioRecord.getMinBufferSize(
                sampleRate,
                android.media.AudioFormat.CHANNEL_IN_MONO,
                android.media.AudioFormat.ENCODING_PCM_16BIT,
            )
            val record = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                sampleRate,
                android.media.AudioFormat.CHANNEL_IN_MONO,
                android.media.AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
            )
            audioRecord = record
            if (AcousticEchoCanceler.isAvailable()) {
                aec = AcousticEchoCanceler.create(record.audioSessionId)?.apply {
                    enabled = true
                }
            }
            record.startRecording()
            // Real implementation spawns a reader thread that reads 320-sample
            // (20 ms) frames and posts them to the RN bridge.

            applyOutputRoute(mode)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_AUDIO_START", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            audioRecord?.let {
                it.stop()
                it.release()
            }
            audioRecord = null
            aec?.release()
            aec = null
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
            scoReceiver?.let {
                ctx.unregisterReceiver(it)
                scoReceiver = null
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_AUDIO_STOP", e.message, e)
        }
    }

    @ReactMethod
    fun setOutputRoute(route: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val target = when (route) {
                    "speaker" -> AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                    "earphone" -> AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                    "both" -> AudioDeviceInfo.TYPE_BUILTIN_SPEAKER // not natively supported
                    else -> {
                        promise.reject("E_BAD_ROUTE", "Unknown route: $route")
                        return
                    }
                }
                val device = audioManager.availableCommunicationDevices.firstOrNull { it.type == target }
                if (device != null) {
                    audioManager.setCommunicationDevice(device)
                }
            } else {
                @Suppress("DEPRECATION")
                audioManager.isSpeakerphoneOn = (route == "speaker")
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_AUDIO_ROUTE", e.message, e)
        }
    }

    private fun applyOutputRoute(mode: String) {
        when (mode) {
            "capture-earphone-play-speaker", "capture-mic-play-speaker" -> {
                @Suppress("DEPRECATION")
                audioManager.isSpeakerphoneOn = true
            }
            else -> {
                @Suppress("DEPRECATION")
                audioManager.isSpeakerphoneOn = false
            }
        }
    }

    private fun startBluetoothSco() {
        if (audioManager.isBluetoothScoAvailableOffCall) {
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
            // Listen for SCO state and emit "bluetooth-disconnected" if dropped.
            // Receiver registration omitted in this skeleton.
            @Suppress("UNUSED_VARIABLE")
            val filter = IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
            // Also listen for headset connection changes:
            @Suppress("UNUSED_VARIABLE")
            val headsetFilter = IntentFilter(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED)
        }
    }
}
