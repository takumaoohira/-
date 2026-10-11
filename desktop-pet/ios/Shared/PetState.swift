import Foundation

/// ウィジェット / Dynamic Island で使うポーズ(画像名の末尾)。
enum PetPose: String, Codable, CaseIterable {
    case sit, wave, happy, walk, sleep, lie, stretch, eat, petted, beg, lonely
}

struct PetBreed: Identifiable, Hashable {
    let id: String
    let label: String
    var isCat: Bool { id.hasPrefix("cat_") }
}

enum PetBreeds {
    static let all: [PetBreed] = [
        .init(id: "cat_orange", label: "茶トラ"), .init(id: "cat_black", label: "黒猫"),
        .init(id: "cat_white", label: "白猫"), .init(id: "cat_calico", label: "三毛猫"),
        .init(id: "cat_gray", label: "サバトラ"), .init(id: "dog_shiba", label: "柴犬"),
        .init(id: "dog_kuroshiba", label: "黒柴"), .init(id: "dog_beagle", label: "ビーグル"),
        .init(id: "dog_golden", label: "ゴールデン"), .init(id: "dog_white", label: "白いわんこ"),
    ]
    static func byId(_ id: String) -> PetBreed { all.first { $0.id == id } ?? all[0] }
}

/// アプリ・ウィジェット・Dynamic Island で共有するペットの状態。
struct PetState: Codable, Equatable {
    var breedId: String = "cat_orange"
    var name: String = "ミケ"
    var hunger: Double = 30      // 0=まんぷく 100=ぺこぺこ
    var energy: Double = 80
    var affection: Double = 60
    var updatedAt: Date = .now
    var lastEvent: String? = nil  // "fed" / "full" / "petted"
    var lastEventAt: Date? = nil
    /// ウィジェットや Dynamic Island のボタンで変わった時刻(アプリ側の画面に反映するため)
    var externalChangeAt: Date? = nil

    var breed: PetBreed { PetBreeds.byId(breedId) }
    var isCat: Bool { breed.isCat }

    /// 時間がたったぶん気分を進める(Web版の advanceOffline と同じ割合)。
    func advanced(to now: Date) -> PetState {
        var s = self
        let sec = min(max(now.timeIntervalSince(updatedAt), 0), 86_400)
        s.hunger = min(100, hunger + sec * 0.008)
        s.affection = max(0, affection - sec * 0.003)
        s.energy = min(100, energy + sec * 0.05)
        s.updatedAt = now
        return s
    }
}

/// App Group の UserDefaults に保存する。
enum PetStore {
    static let groupId = "group.jp.pocketpet.app"
    private static let key = "petState"
    static var defaults: UserDefaults { UserDefaults(suiteName: groupId) ?? .standard }

    static func load() -> PetState {
        guard let data = defaults.data(forKey: key),
              let s = try? JSONDecoder().decode(PetState.self, from: data) else { return PetState() }
        return s
    }

    static func save(_ s: PetState) {
        if let data = try? JSONEncoder().encode(s) { defaults.set(data, forKey: key) }
    }

    @discardableResult
    static func feed() -> PetState {
        let now = Date()
        var s = load().advanced(to: now)
        if s.hunger < 10 {
            s.lastEvent = "full"
        } else {
            s.hunger = max(0, s.hunger - 45)
            s.affection = min(100, s.affection + 5)
            s.energy = min(100, s.energy + 5)
            s.lastEvent = "fed"
        }
        s.lastEventAt = now
        s.externalChangeAt = now
        save(s)
        return s
    }

    @discardableResult
    static func pet() -> PetState {
        let now = Date()
        var s = load().advanced(to: now)
        s.affection = min(100, s.affection + 12)
        s.lastEvent = "petted"
        s.lastEventAt = now
        s.externalChangeAt = now
        save(s)
        return s
    }
}

/// 状態と時刻から「いまのポーズとセリフ」を決める。
struct PetMoment: Equatable {
    var pose: PetPose
    var line: String
    var facingLeft: Bool
}

enum PetMood {
    static func moment(for s: PetState, at date: Date) -> PetMoment {
        // 10分ごとに変わる、端末によらず決まった乱数
        let slot = Int(date.timeIntervalSince1970 / 600)
        var rng = SeededRandom(seed: UInt64(truncatingIfNeeded: slot &* 2_654_435_761 &+ s.breedId.count))
        let facing = rng.next() % 2 == 0
        let cat = s.isCat
        let hour = Calendar.current.component(.hour, from: date)
        let night = hour >= 23 || hour < 6

        if let ev = s.lastEvent, let at = s.lastEventAt, date.timeIntervalSince(at) < 600 {
            let recent = date.timeIntervalSince(at) < 90
            switch ev {
            case "fed": return .init(pose: recent ? .eat : .happy, line: recent ? (cat ? "おさかな!" : "ほね!") : "ごちそうさま♪", facingLeft: facing)
            case "full": return .init(pose: .sit, line: "おなかいっぱい…", facingLeft: facing)
            case "petted": return .init(pose: .petted, line: cat ? "ごろごろ♪" : "しあわせ〜", facingLeft: facing)
            default: break
            }
        }
        if night || s.energy < 25 { return .init(pose: .sleep, line: "Zzz…", facingLeft: false) }
        if s.hunger > 70 { return .init(pose: .beg, line: rng.pick(["おなかすいた…", "ごはんまだ?"]), facingLeft: facing) }
        if s.affection < 30 { return .init(pose: .lonely, line: rng.pick(["かまって〜", "なでて?"]), facingLeft: facing) }

        let sound = cat ? rng.pick(["にゃー", "にゃん♪", "みゃう"]) : rng.pick(["わん!", "わんわん!", "へっへっ♪"])
        let greeting: String
        switch hour {
        case 5...10: greeting = "おはよう!"
        case 11...16: greeting = "こんにちは〜"
        case 17...21: greeting = "おつかれさま!"
        default: greeting = "まだおきてるの?"
        }
        let options: [PetMoment] = [
            .init(pose: .sit, line: sound, facingLeft: facing),
            .init(pose: .wave, line: greeting, facingLeft: facing),
            .init(pose: .walk, line: "おさんぽ〜", facingLeft: facing),
            .init(pose: .stretch, line: "のび〜", facingLeft: facing),
            .init(pose: .lie, line: "ぽかぽか", facingLeft: facing),
            .init(pose: .happy, line: s.affection > 80 ? "だいすき!" : "きゅうけいしよ?", facingLeft: facing),
            .init(pose: .sit, line: "おしごとがんばって!", facingLeft: facing),
        ]
        return rng.pick(options)
    }

    static func imageName(_ breedId: String, _ pose: PetPose) -> String { "\(breedId)_\(pose.rawValue)" }

    static func faceName(_ breedId: String, _ pose: PetPose) -> String {
        switch pose {
        case .sleep: return "\(breedId)_face_sleep"
        case .happy, .wave, .petted, .eat, .stretch: return "\(breedId)_face_happy"
        default: return "\(breedId)_face"
        }
    }
}

struct SeededRandom {
    private var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 0x9E3779B97F4A7C15 : seed }
    mutating func next() -> UInt64 {
        state ^= state << 13; state ^= state >> 7; state ^= state << 17
        return state
    }
    mutating func pick<T>(_ items: [T]) -> T { items[Int(next() % UInt64(items.count))] }
}
