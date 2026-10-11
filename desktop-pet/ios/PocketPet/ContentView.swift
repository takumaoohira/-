import ActivityKit
import SwiftUI
import WidgetKit

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var bridge = PetBridge()
    @State private var islandOn = PetActivityController.isRunning
    @State private var showHelp = false
    @State private var message: String?

    private let tick = Timer.publish(every: 20, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("ポケットペット")
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                Spacer()
                Button {
                    showHelp = true
                } label: {
                    Image(systemName: "questionmark.circle")
                }
                Button {
                    Task { await toggleIsland() }
                } label: {
                    Label(islandOn ? "島からもどす" : "Dynamic Islandに出す",
                          systemImage: islandOn ? "xmark.circle.fill" : "capsule.fill")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(Capsule().fill(islandOn ? Color.secondary.opacity(0.2) : Color.petHunger))
                        .foregroundStyle(islandOn ? Color.primary : Color.white)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            PetWebView(bridge: bridge)
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            if let message {
                Text(message)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Capsule().fill(.regularMaterial))
                    .padding(.top, 52)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $showHelp) { HelpView() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                islandOn = PetActivityController.isRunning
                bridge.syncFromStore()
            } else if phase == .background {
                WidgetCenter.shared.reloadAllTimelines()
                Task { await PetActivityController.updateAll(with: PetStore.load()) }
            }
        }
        .onReceive(tick) { _ in
            // アプリを開いている間は、島のペットもときどきポーズを変える
            guard islandOn else { return }
            Task { await PetActivityController.updateAll(with: PetStore.load()) }
        }
    }

    private func toggleIsland() async {
        if PetActivityController.isRunning {
            await PetActivityController.endAll()
            islandOn = false
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            flash("設定アプリ →「ポケットペット」→「ライブアクティビティ」をオンにしてください")
            return
        }
        do {
            try PetActivityController.start(PetStore.load())
            islandOn = true
            flash("ホーム画面に戻ると、画面上部にペットが出ます")
        } catch {
            flash("Dynamic Islandに出せませんでした: \(error.localizedDescription)")
        }
    }

    private func flash(_ text: String) {
        withAnimation { message = text }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) { withAnimation { message = nil } }
    }
}

struct HelpView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("この画面") {
                    Text("タップ・ダブルタップ(ごはん)・長押し(なでなで)・つまんで投げる、で遊べます。下の「えらぶ」で種類や名前を変えられます。")
                }
                Section("ホーム画面のウィジェット") {
                    Text("ホーム画面を長押し →「編集」→「ウィジェットを追加」→「ポケットペット」。気分や時間帯でポーズとセリフが変わり、「ごはん」「なでる」ボタンもその場で使えます。")
                }
                Section("Dynamic Island / ロック画面") {
                    Text("上の「Dynamic Islandに出す」を押すと、画面上部とロック画面にペットが出ます。長押しで大きく開き、ごはん・なでるができます。iOSの決まりで、最長およそ8時間で自動的に消えます。")
                }
            }
            .navigationTitle("あそびかた")
            .toolbar { Button("とじる") { dismiss() } }
        }
    }
}
