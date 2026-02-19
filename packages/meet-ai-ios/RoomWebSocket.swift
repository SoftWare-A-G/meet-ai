import Foundation
import Observation

private let minBackoff: TimeInterval = 1.0
private let maxBackoff: TimeInterval = 30.0
private let sendTimeout: TimeInterval = 10.0
private var localCounter = 0

@Observable
@MainActor
final class RoomWebSocketManager {
    var connectionStatus: ConnectionStatus = .connected
    var teamInfo: TeamInfo?
    var messages: [Message] = []

    private var task: URLSessionWebSocketTask?
    private var roomId: String?
    private var apiKey: String?
    private var backoff: TimeInterval = minBackoff
    private var lastSeq: Int = 0
    private var reconnectTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?
    private var offlineQueue: [(localId: String, sender: String, content: String)] = []
    private var reconnectingDebounce: Task<Void, Never>?

    func connect(roomId: String, apiKey: String) {
        self.roomId = roomId
        self.apiKey = apiKey
        backoff = minBackoff
        openSocket()
    }

    func disconnect() {
        reconnectTask?.cancel()
        receiveTask?.cancel()
        reconnectingDebounce?.cancel()
        task?.cancel()
        task = nil
        roomId = nil
        apiKey = nil
    }

    // MARK: - Send

    func sendOptimistic(sender: String, content: String) async {
        guard let roomId else { return }
        localCounter += 1
        let localId = "local_\(localCounter)"
        let optimistic = Message(
            id: localId,
            room_id: roomId,
            message_id: nil,
            sender: sender,
            sender_type: .human,
            content: content,
            color: nil,
            type: .message,
            seq: nil,
            created_at: ISO8601DateFormatter().string(from: Date()),
            status: .sending,
            localId: localId
        )
        messages.append(optimistic)

        if connectionStatus != .connected {
            offlineQueue.append((localId: localId, sender: sender, content: content))
            return
        }

        await doSend(roomId: roomId, localId: localId, sender: sender, content: content)
    }

    func retryMessage(localId: String) {
        guard let roomId,
              let idx = messages.firstIndex(where: { $0.localId == localId }),
              apiKey != nil else { return }
        messages[idx].status = .sending
        let msg = messages[idx]
        Task {
            await doSend(roomId: roomId, localId: localId, sender: msg.sender, content: msg.content)
        }
    }

    // MARK: - Private

    private func doSend(roomId: String, localId: String, sender: String, content: String) async {
        guard let apiKey else { return }
        do {
            let serverMsg = try await withTimeout(seconds: sendTimeout) {
                try await apiSendMessage(roomId: roomId, sender: sender, content: content, apiKey: apiKey)
            }
            updateMessage(localId: localId, id: serverMsg.id, seq: serverMsg.seq, status: .sent, createdAt: serverMsg.created_at)
        } catch {
            updateMessage(localId: localId, status: .failed)
        }
    }

    private func updateMessage(localId: String, id: String? = nil, seq: Int? = nil, status: MessageStatus, createdAt: String? = nil) {
        guard let idx = messages.firstIndex(where: { $0.localId == localId }) else { return }
        if let id { messages[idx] = Message(
            id: id,
            room_id: messages[idx].room_id,
            message_id: messages[idx].message_id,
            sender: messages[idx].sender,
            sender_type: messages[idx].sender_type,
            content: messages[idx].content,
            color: messages[idx].color,
            type: messages[idx].type,
            seq: seq ?? messages[idx].seq,
            created_at: createdAt ?? messages[idx].created_at,
            status: status,
            localId: localId
        )}
        else { messages[idx].status = status }
    }

    private func openSocket() {
        guard let roomId, let apiKey else { return }
        receiveTask?.cancel()
        task?.cancel()

        let url = wsURL(path: "/api/rooms/\(roomId)/ws", apiKey: apiKey)
        let newTask = URLSession.shared.webSocketTask(with: url)
        task = newTask
        newTask.resume()

        receiveTask = Task { [weak self] in
            await self?.receiveLoop(task: newTask)
        }
    }

    private func receiveLoop(task: URLSessionWebSocketTask) async {
        // On connect
        setStatus(.connected)
        backoff = minBackoff
        await catchUp()
        await flushQueue()

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
        guard let data = text.data(using: .utf8) else { return }
        // Try team_info first
        if let teamInfoCandidate = try? JSONDecoder().decode(TeamInfo.self, from: data),
           teamInfoCandidate.type == "team_info" {
            teamInfo = teamInfoCandidate
            return
        }
        guard let msg = try? JSONDecoder().decode(Message.self, from: data),
              !msg.sender.isEmpty, !msg.content.isEmpty else { return }
        if let seq = msg.seq, seq > lastSeq { lastSeq = seq }
        addIncoming(msg)
    }

    private func addIncoming(_ msg: Message) {
        if messages.contains(where: { $0.id == msg.id }) { return }
        // Replace optimistic message if content+sender match
        if let idx = messages.firstIndex(where: { m in
            m.localId != nil && m.status == .sending && m.content == msg.content && m.sender == msg.sender
        }) {
            messages[idx] = Message(
                id: msg.id, room_id: msg.room_id, message_id: msg.message_id,
                sender: msg.sender, sender_type: msg.sender_type,
                content: msg.content, color: msg.color, type: msg.type,
                seq: msg.seq, created_at: msg.created_at,
                status: .sent, localId: messages[idx].localId
            )
        } else {
            messages.append(msg)
        }
    }

    private func scheduleReconnect() {
        let delay = backoff
        backoff = min(backoff * 2, maxBackoff)
        setStatus(delay >= maxBackoff / 2 ? .offline : .reconnecting)
        reconnectTask = Task {
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            openSocket()
        }
    }

    private func setStatus(_ status: ConnectionStatus) {
        reconnectingDebounce?.cancel()
        if status == .reconnecting {
            reconnectingDebounce = Task {
                try? await Task.sleep(for: .milliseconds(500))
                guard !Task.isCancelled else { return }
                connectionStatus = .reconnecting
            }
        } else {
            connectionStatus = status
        }
    }

    private func catchUp() async {
        guard let roomId, let apiKey, lastSeq > 0 else { return }
        let missed = (try? await apiLoadMessagesSince(roomId: roomId, sinceSeq: lastSeq, apiKey: apiKey)) ?? []
        for msg in missed {
            if let seq = msg.seq, seq > lastSeq { lastSeq = seq }
            addIncoming(msg)
        }
    }

    private func flushQueue() async {
        let queue = offlineQueue
        offlineQueue.removeAll()
        guard let roomId else { return }
        for item in queue {
            await doSend(roomId: roomId, localId: item.localId, sender: item.sender, content: item.content)
        }
    }
}

// MARK: - Timeout helper

private func withTimeout<T: Sendable>(seconds: TimeInterval, operation: @escaping () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(for: .seconds(seconds))
            throw URLError(.timedOut)
        }
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}
