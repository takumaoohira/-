import ActivityKit
import Foundation

/// Dynamic Island / ロック画面のライブアクティビティ。
struct PetActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var breedId: String
        var pose: PetPose
        var line: String
        var hunger: Double
        var energy: Double
        var affection: Double
    }
    var name: String
}

enum PetActivityController {
    static func content(for s: PetState, at date: Date = .now) -> PetActivityAttributes.ContentState {
        let m = PetMood.moment(for: s, at: date)
        return .init(breedId: s.breedId, pose: m.pose, line: m.line,
                     hunger: s.hunger, energy: s.energy, affection: s.affection)
    }

    static var isRunning: Bool { !Activity<PetActivityAttributes>.activities.isEmpty }

    static func start(_ s: PetState) throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        guard !isRunning else { return }
        _ = try Activity.request(
            attributes: PetActivityAttributes(name: s.name),
            content: ActivityContent(state: content(for: s), staleDate: nil),
            pushType: nil
        )
    }

    static func updateAll(with s: PetState) async {
        let c = content(for: s)
        for a in Activity<PetActivityAttributes>.activities {
            await a.update(ActivityContent(state: c, staleDate: nil))
        }
    }

    static func endAll() async {
        for a in Activity<PetActivityAttributes>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}
