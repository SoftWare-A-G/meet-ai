import Foundation
import Observation

@Observable
@MainActor
final class LobbyWebSocketManager {
    var connectionStatus: ConnectionStatus = .connected

    private var task: URLSessionWebSocketTask?
    private var apiKey: String?
    private var backoff: TimeInterval = 1.0
    private var receiveTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    var onRoomCreated: ((String, String) -> Void)?

    func connect(apiKey: String, onRoomCreated: @escaping (String, String) -> Void) {
        self.apiKey = apiKey
        self.onRoomCreated = onRoomCreated
        backoff = 1.0
        openSocket()
    }

    func disconnect() {
        receiveTask?.cancel()
        reconnectTask?.cancel()
        task?.cancel()
        task = nil
        apiKey = nil
    }

    private func openSocket() {
        guard let apiKey else { return }
        receiveTask?.cancel()
        task?.cancel()

        let url = wsURL(path: "/api/lobby/ws", apiKey: apiKey)
        let newTask = URLSession.shared.webSocketTask(with: url)
        task = newTask
        newTask.resume()

        receiveTask = Task { [weak self] in
            await self?.receiveLoop(task: newTask)
        }
    }

    private func receiveLoop(task: URLSessionWebSocketTask) async {
        connectionStatus = .connected
        backoff = 1.0
        do {
            while !Task.isCancelled {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    handleText(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        handleText(text)
                    }
                @unknown default:
                    break
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            scheduleReconnect()
        }
    }

    private func handleText(_ text: String) {
        guard let data = text.data(using: .utf8),
              let event = try? JSONDecoder().decode(LobbyEvent.self, from: data),
              event.type == "room_created"
        else { return }
        onRoomCreated?(event.id, event.name)
    }

    private func scheduleReconnect() {
        let delay = backoff
        backoff = min(backoff * 2, 30.0)
        connectionStatus = .reconnecting
        reconnectTask = Task {
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            openSocket()
        }
    }
}
