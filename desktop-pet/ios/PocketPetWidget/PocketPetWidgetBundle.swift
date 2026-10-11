import SwiftUI
import WidgetKit

@main
struct PocketPetWidgetBundle: WidgetBundle {
    var body: some Widget {
        PetWidget()
        PetLiveActivity()
    }
}
