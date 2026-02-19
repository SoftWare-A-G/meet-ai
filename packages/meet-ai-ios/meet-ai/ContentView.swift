import SwiftUI

struct ContentView: View {
    @State private var appState = AppState()

    var body: some View {
        Group {
            if appState.isLoggedIn {
                RoomsView()
            } else {
                NavigationStack {
                    LandingView()
                }
            }
        }
        .environment(appState)
    }
}
