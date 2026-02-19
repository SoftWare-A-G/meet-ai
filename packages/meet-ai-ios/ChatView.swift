import SwiftUI

// MARK: - Grouped render items

private enum RenderItem: Identifiable {
    case message(Message)
    case logGroup([Message])

    var id: String {
        switch self {
        case .message(let m): return m.localId ?? m.id
        case .logGroup(let logs): return "lg-\(logs.first?.id ?? UUID().uuidString)"
        }
    }
}

// MARK: - Grouping logic (mirrors Expo groupMessages)

private func groupMessages(_ messages: [Message]) -> [RenderItem] {
    var childLogs: [String: [Message]] = [:]
    var standalone: [Message] = []

    for msg in messages {
        if msg.type == .log, let parentId = msg.message_id {
            childLogs[parentId, default: []].append(msg)
        } else {
            standalone.append(msg)
        }
    }

    var items: [RenderItem] = []
    var logBuffer: [Message] = []

    func flushLogs() {
        if !logBuffer.isEmpty {
            items.append(.logGroup(logBuffer))
            logBuffer = []
        }
    }

    for msg in standalone {
        if msg.type == .log {
            logBuffer.append(msg)
        } else if msg.sender_type == .human {
            flushLogs()
            items.append(.message(msg))
        } else {
            flushLogs()
            if msg.sender != "hook" {
                items.append(.message(msg))
            }
            if let children = childLogs[msg.id], !children.isEmpty {
                items.append(.logGroup(children))
            }
        }
    }
    flushLogs()
    return items
}

// MARK: - Connection status bar

private struct ConnectionStatusBar: View {
    let status: ConnectionStatus

    var body: some View {
        if status != .connected {
            HStack(spacing: 6) {
                if status == .reconnecting {
                    ProgressView().scaleEffect(0.6).tint(.white)
                }
                Text(status == .reconnecting ? "Reconnecting…" : "Offline")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(status == .reconnecting ? Color(hex: "#eab308") : Color(hex: "#ef4444"))
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

// MARK: - New messages pill

private struct NewMessagesPill: View {
    let count: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Label("\(count) new message\(count == 1 ? "" : "s")", systemImage: "arrow.down")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color(hex: "#3b82f6"), in: Capsule())
                .shadow(radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

// MARK: - Chat input bar

private struct ChatInputBar: View {
    let onSend: (String) -> Void
    @State private var text = ""

    var body: some View {
        HStack(spacing: 10) {
            TextField("Message…", text: $text, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 20))

            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(
                        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? AnyShapeStyle(.secondary)
                            : AnyShapeStyle(Color(hex: "#3b82f6"))
                    )
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.bar)
    }

    @MainActor
    private func send() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // Clear synchronously on the main thread BEFORE any async work so the
        // TextField empties immediately regardless of when the send Task runs.
        text = ""
        Task { @MainActor in
            onSend(trimmed)
        }
    }
}

// MARK: - Chat view

struct ChatView: View {
    let room: Room

    @Environment(AppState.self) private var appState
    @State private var ws = RoomWebSocketManager()
    @State private var allMessages: [Message] = []
    @State private var initialLoading = true
    @State private var visibleCount = 50
    @State private var loadingOlder = false
    @State private var newMsgCount = 0
    @State private var isNearBottom = true
    @State private var showAgents = false

    private var mergedMessages: [Message] {
        var merged = allMessages
        for wsMsg in ws.messages {
            if let localId = wsMsg.localId {
                // Locally sent message: match by localId and replace or append
                if !merged.contains(where: { $0.id == wsMsg.id || $0.localId == localId }) {
                    merged.append(wsMsg)
                } else if let idx = merged.firstIndex(where: { $0.localId == localId }) {
                    merged[idx] = wsMsg
                }
            } else {
                // Incoming server-pushed message (no localId): add if not already present
                if !merged.contains(where: { $0.id == wsMsg.id }) {
                    merged.append(wsMsg)
                }
            }
        }
        return merged.sorted { $0.created_at < $1.created_at }
    }

    private var visibleMessages: [Message] {
        let all = mergedMessages
        let start = max(0, all.count - visibleCount)
        return Array(all[start...])
    }

    private var hasOlderMessages: Bool { visibleCount < mergedMessages.count }
    private var groupedItems: [RenderItem] { groupMessages(visibleMessages) }

    var body: some View {
        VStack(spacing: 0) {
            withAnimation {
                ConnectionStatusBar(status: ws.connectionStatus)
            }

            ZStack(alignment: .bottom) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 8) {
                            if hasOlderMessages {
                                loadOlderButton
                            }
                            if loadingOlder {
                                HStack(spacing: 6) {
                                    ProgressView()
                                    Text("Loading older…")
                                        .font(.system(size: 13))
                                        .foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                            }

                            ForEach(groupedItems) { item in
                                switch item {
                                case .message(let msg):
                                    MessageBubbleView(msg: msg) { localId in
                                        ws.retryMessage(localId: localId)
                                    }
                                    .padding(.horizontal, 16)
                                case .logGroup(let logs):
                                    LogGroupView(logs: logs)
                                        .padding(.bottom, 4)
                                }
                            }

                            Color.clear.frame(height: 1).id("bottom")
                        }
                        .padding(.vertical, 16)
                    }
                    .safeAreaInset(edge: .bottom, spacing: 0) {
                        ChatInputBar { text in
                            Task { await ws.sendOptimistic(sender: "Mobile User", content: text) }
                        }
                    }
                    .defaultScrollAnchor(.bottom)
                    .onScrollGeometryChange(for: Bool.self) { geo in
                        let dist = geo.contentSize.height - geo.contentOffset.y - geo.containerSize.height
                        return dist < 150
                    } action: { _, nearBottom in
                        isNearBottom = nearBottom
                        if nearBottom { newMsgCount = 0 }
                    }
                    .onChange(of: groupedItems.count) { old, new in
                        let added = new - old
                        guard added > 0, old > 0 else { return }
                        if isNearBottom {
                            withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                            newMsgCount = 0
                        } else {
                            newMsgCount += added
                        }
                    }
                    .onChange(of: initialLoading) { _, done in
                        if !done { proxy.scrollTo("bottom", anchor: .bottom) }
                    }
                }

                if newMsgCount > 0 {
                    NewMessagesPill(count: newMsgCount) { newMsgCount = 0 }
                        .padding(.bottom, 8)
                }
            }
        }
        .navigationTitle(room.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAgents = true } label: {
                    Image(systemName: "person.2")
                        .foregroundStyle(.secondary)
                }
                .accessibilityLabel("View agents")
            }
        }
        .navigationDestination(isPresented: $showAgents) {
            AgentsView(teamInfo: ws.teamInfo)
        }
        .task {
            guard let apiKey = appState.apiKey else { return }
            async let msgs = apiLoadMessages(roomId: room.id, apiKey: apiKey)
            async let logs = apiLoadLogs(roomId: room.id, apiKey: apiKey)
            let fetched = await ((try? msgs) ?? [], (try? logs) ?? [])
            allMessages = (fetched.0 + fetched.1).sorted { $0.created_at < $1.created_at }
            initialLoading = false
            ws.connect(roomId: room.id, apiKey: apiKey)
        }
        .onDisappear { ws.disconnect() }
    }

    private var loadOlderButton: some View {
        Button {
            guard !loadingOlder else { return }
            loadingOlder = true
            Task {
                try? await Task.sleep(for: .milliseconds(300))
                visibleCount = min(visibleCount + 50, mergedMessages.count)
                loadingOlder = false
            }
        } label: {
            Text("Load older messages")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#3b82f6"))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
    }
}
