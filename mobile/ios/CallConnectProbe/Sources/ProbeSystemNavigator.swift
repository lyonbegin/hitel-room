import Foundation
import UIKit

/// Unofficial URLs are best-effort, never a guarantee of the exact destination.
@MainActor
enum ProbeSystemNavigator {
    private struct Target {
        let label: String
        let url: String
    }

    static func voiceControl(onResult: @escaping (String) -> Void = { _ in }) {
        openFirst([
            Target(label: "음성 명령 설정", url: "prefs:root=ACCESSIBILITY&path=CommandAndControlTitle"),
            Target(label: "음성 명령 설정 대체", url: "App-prefs:root=ACCESSIBILITY&path=CommandAndControlTitle"),
            Target(label: "손쉬운 사용", url: "prefs:root=ACCESSIBILITY"),
            Target(label: "손쉬운 사용 대체", url: "App-prefs:root=ACCESSIBILITY"),
            Target(label: "설정", url: "App-prefs:")
        ], completion: onResult)
    }

    static func shortcutsAutomation(onResult: @escaping (String) -> Void = { _ in }) {
        openFirst([
            Target(label: "단축어: 새 자동화", url: "shortcuts://create-automation"),
            Target(label: "단축어: 자동화", url: "shortcuts://automations"),
            Target(label: "단축어", url: "shortcuts://")
        ], completion: onResult)
    }

    static func shortcuts() {
        shortcutsAutomation()
    }

    static func createShortcut() {
        openFirst([
            Target(label: "단축어 새 단축어", url: "shortcuts://create-shortcut"),
            Target(label: "단축어", url: "shortcuts://")
        ]) { _ in }
    }

    static func phoneSettings() {
        openFirst([
            Target(label: "전화 설정", url: "prefs:root=PHONE"),
            Target(label: "설정", url: "App-prefs:")
        ]) { _ in }
    }

    private static func openFirst(
        _ links: [Target],
        index: Int = 0,
        completion: @escaping (String) -> Void
    ) {
        guard index < links.count else {
            ProbeEvidence.append("설정/단축어 딥링크 모두 거절")
            completion("설정 화면을 바로 열 수 없습니다. iOS 접근 제한 가능성")
            return
        }
        let chosen = links[index]
        guard let url = URL(string: chosen.url) else {
            openFirst(links, index: index + 1, completion: completion)
            return
        }
        UIApplication.shared.open(url, options: [:]) { opened in
            DispatchQueue.main.async {
                if opened {
                    let result = "열기 요청: " + chosen.label
                    ProbeEvidence.append(result + " / " + chosen.url)
                    // URL handled does not prove that iOS displayed the requested pane.
                    completion(result + " (도착 화면은 아이폰에서 확인)")
                } else {
                    ProbeEvidence.append("딥링크 거절: " + chosen.url)
                    openFirst(links, index: index + 1, completion: completion)
                }
            }
        }
    }
}
