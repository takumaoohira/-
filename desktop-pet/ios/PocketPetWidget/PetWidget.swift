import AppIntents
import SwiftUI
import WidgetKit

struct PetEntry: TimelineEntry {
    let date: Date
    let state: PetState
    let moment: PetMoment
}

struct PetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PetEntry {
        let s = PetState()
        return PetEntry(date: .now, state: s, moment: .init(pose: .wave, line: "こんにちは〜", facingLeft: false))
    }

    func getSnapshot(in context: Context, completion: @escaping (PetEntry) -> Void) {
        let s = PetStore.load().advanced(to: .now)
        completion(PetEntry(date: .now, state: s, moment: PetMood.moment(for: s, at: .now)))
    }

    /// 10分ごとに3時間ぶん先まで「そのときのポーズ」を用意しておく。
    func getTimeline(in context: Context, completion: @escaping (Timeline<PetEntry>) -> Void) {
        let base = PetStore.load()
        let now = Date()
        var entries: [PetEntry] = []
        for i in 0..<18 {
            let d = now.addingTimeInterval(Double(i) * 600)
            let s = base.advanced(to: d)
            entries.append(PetEntry(date: d, state: s, moment: PetMood.moment(for: s, at: d)))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct PetWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PetEntry

    var body: some View {
        switch family {
        case .systemMedium: medium
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        default: small
        }
    }

    private var sprite: some View {
        PetSprite(breedId: entry.state.breedId, pose: entry.moment.pose, facingLeft: entry.moment.facingLeft)
            .id(entry.moment.pose)
            .transition(.push(from: .bottom))
    }

    private var small: some View {
        VStack(spacing: 2) {
            SpeechBubble(text: entry.moment.line, size: 11)
            sprite.frame(maxHeight: .infinity)
            HStack(spacing: 6) {
                ActionButton(intent: FeedPetIntent(), symbol: "fork.knife", color: .petHunger)
                ActionButton(intent: PetPetIntent(), symbol: "hand.raised.fill", color: .petLove)
            }
        }
        .widgetURL(URL(string: "pocketpet://open"))
    }

    private var medium: some View {
        HStack(spacing: 10) {
            VStack(spacing: 2) {
                SpeechBubble(text: entry.moment.line, size: 12)
                sprite.frame(maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.state.name)
                        .font(.system(size: 17, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.petInk)
                    Text(entry.state.breed.label)
                        .font(.system(size: 10, design: .rounded))
                        .foregroundStyle(.secondary)
                }
                MoodBars(hunger: entry.state.hunger, energy: entry.state.energy, affection: entry.state.affection)
                HStack(spacing: 6) {
                    ActionButton(intent: FeedPetIntent(), symbol: "fork.knife", label: "ごはん", color: .petHunger)
                    ActionButton(intent: PetPetIntent(), symbol: "hand.raised.fill", label: "なでる", color: .petLove)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image(PetMood.faceName(entry.state.breedId, entry.moment.pose))
                .resizable().scaledToFit().padding(4)
        }
    }

    private var rectangular: some View {
        HStack(spacing: 6) {
            Image(PetMood.faceName(entry.state.breedId, entry.moment.pose))
                .resizable().scaledToFit()
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.state.name).font(.headline)
                Text(entry.moment.line).font(.caption).lineLimit(1)
            }
        }
    }
}

struct ActionButton<I: AppIntent>: View {
    let intent: I
    let symbol: String
    var label: String? = nil
    let color: Color

    var body: some View {
        Button(intent: intent) {
            HStack(spacing: 3) {
                Image(systemName: symbol).font(.system(size: 11, weight: .bold))
                if let label { Text(label).font(.system(size: 11, weight: .bold, design: .rounded)) }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 5)
            .background(Capsule().fill(color))
        }
        .buttonStyle(.plain)
    }
}

struct PetWidget: Widget {
    let kind = "PetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PetProvider()) { entry in
            PetWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    LinearGradient(stops: [
                        .init(color: .petSkyTop, location: 0),
                        .init(color: .petSkyBottom, location: 0.72),
                        .init(color: .petFloor, location: 0.72),
                        .init(color: .petFloor, location: 1),
                    ], startPoint: .top, endPoint: .bottom)
                }
        }
        .configurationDisplayName("ポケットペット")
        .description("ペットがホーム画面でくらします。ごはん・なでるもできます。")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}
