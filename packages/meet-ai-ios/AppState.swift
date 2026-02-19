import Foundation
import Observation

@Observable
@MainActor
final class AppState {
    var apiKey: String?
    var isLoggedIn: Bool = false

    init() {
        if let key = KeychainHelper.load() {
            apiKey = key
            isLoggedIn = true
        }
    }

    func login(key: String) async throws {
        let url = URL(string: "https://meet-ai.cc/api/rooms")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.userAuthenticationRequired)
        }
        KeychainHelper.save(key)
        apiKey = key
        isLoggedIn = true
    }

    func logout() {
        KeychainHelper.delete()
        apiKey = nil
        isLoggedIn = false
    }
}
