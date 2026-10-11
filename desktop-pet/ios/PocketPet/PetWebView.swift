import SwiftUI
import WebKit
import WidgetKit

/// Web版のペットのお部屋(index.html)を表示し、気分をウィジェットと共有する。
final class PetBridge: NSObject, ObservableObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private var lastReload = Date.distantPast
    private var lastAppliedExternal: Date?

    /// ページ読み込み時に渡す初期状態(ウィジェットで変わった気分を反映)
    func bootstrapScript() -> String {
        let s = PetStore.load().advanced(to: .now)
        lastAppliedExternal = s.externalChangeAt
        return "window.__pocketPetNative = \(json(s));"
    }

    func syncFromStore() {
        let s = PetStore.load()
        guard let ext = s.externalChangeAt, ext != lastAppliedExternal else { return }
        lastAppliedExternal = ext
        let now = s.advanced(to: .now)
        webView?.evaluateJavaScript("window.pocketPetSync && window.pocketPetSync(\(json(now)));")
    }

    private func json(_ s: PetState) -> String {
        let dict: [String: Any] = [
            "breed": s.breedId, "name": s.name,
            "hunger": s.hunger, "energy": s.energy, "affection": s.affection,
            "at": s.updatedAt.timeIntervalSince1970 * 1000,
            "event": s.lastEvent ?? "",
        ]
        let data = (try? JSONSerialization.data(withJSONObject: dict)) ?? Data("{}".utf8)
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        var s = PetStore.load()
        let before = s
        if let v = body["breed"] as? String { s.breedId = v }
        if let v = body["name"] as? String { s.name = v }
        if let v = body["hunger"] as? Double { s.hunger = v }
        if let v = body["energy"] as? Double { s.energy = v }
        if let v = body["affection"] as? Double { s.affection = v }
        if let ev = body["event"] as? String, !ev.isEmpty {
            s.lastEvent = ev
            s.lastEventAt = .now
        }
        s.updatedAt = .now
        PetStore.save(s)

        // 見た目が変わったとき、または1分おきにウィジェットを更新
        let visualChange = before.breedId != s.breedId || before.name != s.name || body["event"] != nil
        if visualChange || Date().timeIntervalSince(lastReload) > 60 {
            lastReload = .now
            WidgetCenter.shared.reloadAllTimelines()
            Task { await PetActivityController.updateAll(with: s) }
        }
    }
}

struct PetWebView: UIViewRepresentable {
    let bridge: PetBridge

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let ucc = WKUserContentController()
        ucc.add(bridge, name: "pet")
        ucc.addUserScript(WKUserScript(source: bridge.bootstrapScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = ucc
        config.websiteDataStore = .default()

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        bridge.webView = web
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
