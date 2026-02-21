import Foundation

private let baseURL = "https://meet-ai.cc"

enum APIError: Error {
    case httpError(Int)
    case decodingFailed
}

// MARK: - Helpers

private func makeRequest(path: String, apiKey: String, method: String = "GET", body: Data? = nil) -> URLRequest {
    var req = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
    req.httpMethod = method
    req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = body
    return req
}

// MARK: - Rooms

func apiLoadRooms(apiKey: String) async throws -> [Room] {
    let req = makeRequest(path: "/api/rooms", apiKey: apiKey)
    let (data, res) = try await URLSession.shared.data(for: req)
    guard let http = res as? HTTPURLResponse, http.statusCode == 200 else {
        throw APIError.httpError((res as? HTTPURLResponse)?.statusCode ?? 0)
    }
    return try JSONDecoder().decode([Room].self, from: data)
}

// MARK: - Messages

func apiLoadMessages(roomId: String, apiKey: String) async throws -> [Message] {
    let req = makeRequest(path: "/api/rooms/\(roomId)/messages", apiKey: apiKey)
    let (data, res) = try await URLSession.shared.data(for: req)
    guard let http = res as? HTTPURLResponse, http.statusCode == 200 else { return [] }
    return (try? JSONDecoder().decode([Message].self, from: data)) ?? []
}

func apiLoadLogs(roomId: String, apiKey: String) async throws -> [Message] {
    let req = makeRequest(path: "/api/rooms/\(roomId)/logs", apiKey: apiKey)
    let (data, res) = try await URLSession.shared.data(for: req)
    guard let http = res as? HTTPURLResponse, http.statusCode == 200 else { return [] }
    let logs = (try? JSONDecoder().decode([Message].self, from: data)) ?? []
    return logs
}

func apiLoadMessagesSince(roomId: String, sinceSeq: Int, apiKey: String) async throws -> [Message] {
    let req = makeRequest(path: "/api/rooms/\(roomId)/messages?since_seq=\(sinceSeq)", apiKey: apiKey)
    let (data, res) = try await URLSession.shared.data(for: req)
    guard let http = res as? HTTPURLResponse, http.statusCode == 200 else { return [] }
    return (try? JSONDecoder().decode([Message].self, from: data)) ?? []
}

func apiSendMessage(roomId: String, sender: String, content: String, apiKey: String) async throws -> Message {
    let body = try JSONEncoder().encode([
        "sender": sender,
        "content": content,
        "sender_type": "human"
    ])
    let req = makeRequest(path: "/api/rooms/\(roomId)/messages", apiKey: apiKey, method: "POST", body: body)
    let (data, res) = try await URLSession.shared.data(for: req)
    guard let http = res as? HTTPURLResponse, (200...201).contains(http.statusCode) else {
        throw APIError.httpError((res as? HTTPURLResponse)?.statusCode ?? 0)
    }
    return try JSONDecoder().decode(Message.self, from: data)
}

// MARK: - WebSocket URL

func wsURL(path: String, apiKey: String) -> URL {
    let base = baseURL
        .replacingOccurrences(of: "https://", with: "wss://")
        .replacingOccurrences(of: "http://", with: "ws://")
    let encoded = apiKey.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? apiKey
    return URL(string: "\(base)\(path)?token=\(encoded)")!
}
