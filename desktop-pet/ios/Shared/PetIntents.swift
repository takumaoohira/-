import AppIntents
import WidgetKit

/// ウィジェット / Dynamic Island の「ごはん」ボタン。
struct FeedPetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "ごはんをあげる"
    static var description = IntentDescription("ペットにごはんをあげます")

    func perform() async throws -> some IntentResult {
        let s = PetStore.feed()
        await PetActivityController.updateAll(with: s)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

/// ウィジェット / Dynamic Island の「なでる」ボタン。
struct PetPetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "なでる"
    static var description = IntentDescription("ペットをなでます")

    func perform() async throws -> some IntentResult {
        let s = PetStore.pet()
        await PetActivityController.updateAll(with: s)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
