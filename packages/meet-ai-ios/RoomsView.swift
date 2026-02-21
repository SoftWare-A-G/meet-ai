import SwiftUI

struct RoomsView: View {
    @Environment(AppState.self) private var appState
    @State private var rooms: [Room] = []
    @State private var loading = true
    @State private var refreshing = false
    @State private var lobbyWS = LobbyWebSocketManager()
    @State private var errorMessage: String?
    @State private var showKeyManagement = false

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(rooms) { room in
                            NavigationLink(value: room) {
                                RoomRowView(room: room)
                            }
                            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await fetchRooms() }
                    .overlay {
                        if rooms.isEmpty {
                            ContentUnavailableView("No Rooms", systemImage: "bubble.left.and.bubble.right", description: Text("Create a room to get started."))
                        }
                    }
                }
            }
            .navigationTitle("meet-ai")
            .navigationDestination(for: Room.self) { room in
                ChatView(room: room)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showKeyManagement = true
                    } label: {
                        Image(systemName: "key.fill")
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityLabel("API Key Settings")
                }
            }
            .sheet(isPresented: $showKeyManagement) {
                KeyManagementView()
            }
        }
        .task {
            guard let apiKey = appState.apiKey else { return }
            await fetchRooms()
            lobbyWS.connect(apiKey: apiKey) { id, name in
                let newRoom = Room(id: id, name: name, created_at: ISO8601DateFormatter().string(from: Date()))
                if !rooms.contains(where: { $0.id == id }) {
                    rooms.insert(newRoom, at: 0)
                }
            }
        }
        .onDisappear { lobbyWS.disconnect() }
    }

    private func fetchRooms() async {
        guard let apiKey = appState.apiKey else { return }
        do {
            let fetched = try await apiLoadRooms(apiKey: apiKey)
            rooms = fetched.sorted { $0.created_at > $1.created_at }
        } catch {
            errorMessage = "Failed to load rooms"
        }
        loading = false
    }
}

private struct RoomRowView: View {
    let room: Room

    private var dateText: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: room.created_at)
        if date == nil {
            formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: room.created_at)
        }
        guard let date else { return "" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(room.name)
                    .font(.system(size: 16, weight: .medium))
                Text(dateText)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(room.name), created \(dateText)")
    }
}
