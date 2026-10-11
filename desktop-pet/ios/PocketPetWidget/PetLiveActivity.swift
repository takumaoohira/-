import ActivityKit
import SwiftUI
import WidgetKit

/// Dynamic Island とロック画面に出るペット。
struct PetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PetActivityAttributes.self) { context in
            LockScreenPetView(name: context.attributes.name, state: context.state)
                .activityBackgroundTint(Color.petSkyBottom)
                .activitySystemActionForegroundColor(Color.petInk)
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    PetSprite(breedId: s.breedId, pose: s.pose)
                        .frame(width: 72, height: 64)
                        .id(s.pose)
                        .transition(.scale.combined(with: .opacity))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    MoodBars(hunger: s.hunger, energy: s.energy, affection: s.affection)
                        .frame(width: 120)
                        .padding(.top, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.name)
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 8) {
                        Text(s.line)
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        ActionButton(intent: FeedPetIntent(), symbol: "fork.knife", label: "ごはん", color: .petHunger)
                            .frame(width: 84)
                        ActionButton(intent: PetPetIntent(), symbol: "hand.raised.fill", label: "なでる", color: .petLove)
                            .frame(width: 84)
                    }
                }
            } compactLeading: {
                Image(PetMood.faceName(s.breedId, s.pose))
                    .resizable().scaledToFit()
                    .id(s.pose)
            } compactTrailing: {
                Image(systemName: symbol(for: s.pose))
                    .foregroundStyle(color(for: s.pose))
                    .symbolEffect(.bounce, value: s.pose)
            } minimal: {
                Image(PetMood.faceName(s.breedId, s.pose))
                    .resizable().scaledToFit()
            }
            .keylineTint(Color.petLove)
        }
    }

    private func symbol(for pose: PetPose) -> String {
        switch pose {
        case .sleep: return "moon.zzz.fill"
        case .beg, .eat: return "fork.knife"
        case .petted, .happy, .wave: return "heart.fill"
        case .lonely: return "questionmark"
        default: return "pawprint.fill"
        }
    }

    private func color(for pose: PetPose) -> Color {
        switch pose {
        case .sleep: return .petEnergy
        case .beg, .eat: return .petHunger
        default: return .petLove
        }
    }
}

struct LockScreenPetView: View {
    let name: String
    let state: PetActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            PetSprite(breedId: state.breedId, pose: state.pose)
                .frame(width: 96, height: 86)
                .id(state.pose)
                .transition(.push(from: .bottom))
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(name).font(.system(size: 16, weight: .heavy, design: .rounded)).foregroundStyle(Color.petInk)
                    SpeechBubble(text: state.line, size: 11)
                }
                MoodBars(hunger: state.hunger, energy: state.energy, affection: state.affection)
                HStack(spacing: 6) {
                    ActionButton(intent: FeedPetIntent(), symbol: "fork.knife", label: "ごはん", color: .petHunger)
                    ActionButton(intent: PetPetIntent(), symbol: "hand.raised.fill", label: "なでる", color: .petLove)
                }
            }
        }
        .padding(14)
    }
}
