import SwiftUI

/// ウィジェットとライブアクティビティで共通の小さな部品。
extension Color {
    static let petSkyTop = Color(red: 0.81, green: 0.91, blue: 1.0)
    static let petSkyBottom = Color(red: 0.96, green: 0.98, blue: 1.0)
    static let petFloor = Color(red: 0.89, green: 0.95, blue: 0.84)
    static let petInk = Color(red: 0.23, green: 0.18, blue: 0.24)
    static let petHunger = Color(red: 0.95, green: 0.64, blue: 0.23)
    static let petEnergy = Color(red: 0.31, green: 0.71, blue: 0.91)
    static let petLove = Color(red: 0.93, green: 0.42, blue: 0.56)
}

struct PetSprite: View {
    let breedId: String
    let pose: PetPose
    var facingLeft = false

    var body: some View {
        Image(PetMood.imageName(breedId, pose))
            .resizable()
            .scaledToFit()
            .scaleEffect(x: facingLeft ? -1 : 1, y: 1)
    }
}

struct SpeechBubble: View {
    let text: String
    var size: CGFloat = 12

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: .bold, design: .rounded))
            .foregroundStyle(Color.petInk)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Capsule().fill(.white))
            .overlay(Capsule().stroke(Color.petInk.opacity(0.6), lineWidth: 1))
    }
}

struct MoodBar: View {
    let label: String
    let value: Double
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
                .frame(width: 44, alignment: .leading)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.2))
                    Capsule().fill(color).frame(width: max(4, g.size.width * value / 100))
                }
            }
            .frame(height: 6)
        }
    }
}

struct MoodBars: View {
    let hunger: Double
    let energy: Double
    let affection: Double

    var body: some View {
        VStack(spacing: 5) {
            MoodBar(label: "おなか", value: 100 - hunger, color: .petHunger)
            MoodBar(label: "げんき", value: energy, color: .petEnergy)
            MoodBar(label: "なかよし", value: affection, color: .petLove)
        }
    }
}
