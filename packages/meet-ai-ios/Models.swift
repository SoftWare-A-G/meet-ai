import Foundation

// MARK: - Room

struct Room: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let created_at: String
}

// MARK: - Message

enum MessageStatus: String, Codable {
    case sending, sent, failed
}

struct Message: Identifiable, Codable, Equatable {
    let id: String
    let room_id: String
    let message_id: String?
    let sender: String
    let sender_type: SenderType
    let content: String
    let color: String?
    let type: MessageType
    let seq: Int?
    let created_at: String
    var status: MessageStatus?
    var localId: String?

    enum SenderType: String, Codable {
        case human, agent
    }

    enum MessageType: String, Codable {
        case message, log
    }
}

// MARK: - Connection

enum ConnectionStatus {
    case connected, reconnecting, offline
}

// MARK: - Team

struct TeamMember: Codable, Identifiable, Equatable {
    var id: String { name }
    let name: String
    let color: String
    let role: String
    let model: String?
    let status: TeamMemberStatus
    let joinedAt: Int?

    enum TeamMemberStatus: String, Codable {
        case active, inactive
    }
}

struct TeamInfo: Codable, Equatable {
    let team_name: String
    let members: [TeamMember]
    let type: String?
}

// MARK: - Lobby

struct LobbyEvent: Codable {
    let type: String
    let id: String
    let name: String
}
