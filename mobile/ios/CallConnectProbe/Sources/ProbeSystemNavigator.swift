import UIKit
import Foundation

enum ProbeSystemNavigator {
    /// Apple does not provide a documented generic Voice Control settings deep link
    /// on iOS 18.7. Prefs URLs are opportunistic only, with a clear manual path in UI.
    static func voiceControl() {
        tryOpen([
            "App-prefs:root=ACCESSIBILITY&path=VOICE_CONTROL",
            "App-prefs:root=ACCESSIBILITY",
            "App-prefs:"
        ])
    }

    static func phoneSettings() {
        tryOpen(["App-prefs:root=PHONE", "App-prefs:"])
    }

    static func shortcuts() {
        tryOpen(["shortcuts://", "shortcuts://create-shortcut"])
    }

    static func createShortcut() {
        tryOpen(["shortcuts://create-shortcut", "shortcuts://"])
    }

    private static func tryOpen(_ urls: [String], index: Int = 0) {
        guard index < urls.count, let url = URL(string: urls[index]) else { return }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { success in
                if !success { tryOpen(urls, index: index + 1) }
            }
        }
    }
}
