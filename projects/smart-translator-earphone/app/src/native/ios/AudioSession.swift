// Story 1.6 — iOS native audio session module (skeleton).
//
// This file is a contract sketch for the React Native turbo module that
// implements `AudioSession` (see app/src/core/audio/audio-session-types.ts).
// It is NOT compiled in the current repo snapshot — it requires the Expo
// Bare project to be bootstrapped first (see Project README "Roadmap from
// here").
//
// Reviewers: please verify the AVAudioSession option choices match ADR-005
// and the matrix of AudioSessionMode → category/options.

import AVFoundation
import Foundation

@objc(AudioSessionModule)
class AudioSessionModule: NSObject {

    private var engine: AVAudioEngine?

    @objc(start:lang:resolver:rejecter:)
    func start(_ mode: String,
               lang: String,
               resolver: @escaping RCTPromiseResolveBlock,
               rejecter: @escaping RCTPromiseRejectBlock) {
        do {
            let session = AVAudioSession.sharedInstance()
            switch mode {
            case "duplex-bt":
                try session.setCategory(.playAndRecord,
                                        mode: .voiceChat,
                                        options: [.allowBluetooth, .defaultToSpeaker])
            case "duplex-wired":
                try session.setCategory(.playAndRecord, mode: .voiceChat)
            case "capture-only":
                try session.setCategory(.record, mode: .measurement)
            case "capture-mic-play-speaker",
                 "capture-mic-play-earphone":
                try session.setCategory(.playAndRecord,
                                        mode: .voiceChat,
                                        options: [.allowBluetooth])
            case "capture-earphone-play-speaker",
                 "capture-earphone-play-both":
                try session.setCategory(.playAndRecord,
                                        mode: .voiceChat,
                                        options: [.allowBluetooth, .defaultToSpeaker])
                try session.overrideOutputAudioPort(.speaker)
            default:
                rejecter("E_BAD_MODE", "Unknown audio session mode: \(mode)", nil)
                return
            }
            try session.setActive(true, options: [])

            let engine = AVAudioEngine()
            // Voice processing enables the platform AEC. Required whenever
            // capture and playback share a device (ADR-005, NFR-5).
            try engine.inputNode.setVoiceProcessingEnabled(true)
            self.engine = engine
            try engine.start()
            resolver(nil)
        } catch {
            rejecter("E_AUDIO_START", "Failed to start audio session: \(error.localizedDescription)", error)
        }
    }

    @objc(stop:rejecter:)
    func stop(_ resolver: @escaping RCTPromiseResolveBlock,
              rejecter _: @escaping RCTPromiseRejectBlock) {
        if let engine = self.engine {
            engine.stop()
            self.engine = nil
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        resolver(nil)
    }

    @objc(setOutputRoute:resolver:rejecter:)
    func setOutputRoute(_ route: String,
                        resolver: @escaping RCTPromiseResolveBlock,
                        rejecter: @escaping RCTPromiseRejectBlock) {
        do {
            let session = AVAudioSession.sharedInstance()
            switch route {
            case "speaker":
                try session.overrideOutputAudioPort(.speaker)
            case "earphone":
                try session.overrideOutputAudioPort(.none)
            case "both":
                // iOS does not natively support simultaneous BT + speaker without
                // duplicating the playback graph in AVAudioEngine. The full
                // implementation tap-attaches a second output node bound to
                // the speaker route. For now, default to earphone routing.
                try session.overrideOutputAudioPort(.none)
            default:
                rejecter("E_BAD_ROUTE", "Unknown route: \(route)", nil)
                return
            }
            resolver(nil)
        } catch {
            rejecter("E_AUDIO_ROUTE", error.localizedDescription, error)
        }
    }

    // Real implementation would also:
    //   - register for AVAudioSession.routeChangeNotification and emit
    //     "route-changed" / "bluetooth-disconnected" events to JS.
    //   - tap the input node and forward 20 ms PCM frames to the JS bridge
    //     as base64 or a shared-array-buffer.
}
