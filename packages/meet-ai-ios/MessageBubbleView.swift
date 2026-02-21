import SwiftUI

// MARK: - Time formatting

private func timeAgo(_ dateStr: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: dateStr)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: dateStr)
    }
    guard let date else { return "" }
    let seconds = Int(-date.timeIntervalSinceNow)
    if seconds < 60 { return "just now" }
    let minutes = seconds / 60
    if minutes < 60 { return "\(minutes)m ago" }
    let hours = minutes / 60
    if hours < 24 { return "\(hours)h ago" }
    return "\(hours / 24)d ago"
}

private func shortTime(_ dateStr: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: dateStr)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: dateStr)
    }
    guard let date else { return "" }
    let df = DateFormatter()
    df.dateFormat = "HH:mm"
    return df.string(from: date)
}

// MARK: - Message bubble

struct MessageBubbleView: View {
    let msg: Message
    var onRetry: ((String) -> Void)? = nil

    private var color: Color { senderColor(color: msg.color, sender: msg.sender) }
    private var isAgent: Bool { msg.sender_type == .agent }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            // Avatar
            ZStack {
                Circle()
                    .fill(color)
                    .frame(width: 32, height: 32)
                Text(String(msg.sender.prefix(1)).uppercased())
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 3) {
                // Header
                HStack(spacing: 6) {
                    Text(msg.sender)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(color)

                    if isAgent {
                        Text("agent")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color(hex: "#3b82f6"))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Color(hex: "#3b82f6").opacity(0.15), in: RoundedRectangle(cornerRadius: 4))
                    }

                    Text(shortTime(msg.created_at))
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)

                    if msg.sender_type == .human, let status = msg.status {
                        StatusIndicator(status: status, localId: msg.localId, onRetry: onRetry)
                    }
                }

                // Content
                MarkdownText(msg.content)
                    .font(.system(size: 15))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .opacity(msg.status == .failed ? 0.7 : 1.0)
        .padding(.vertical, 4)
    }
}

// MARK: - Markdown text

private struct MarkdownText: View {
    let raw: String

    init(_ raw: String) {
        self.raw = raw
    }

    var body: some View {
        if let attributed = try? AttributedString(
            markdown: raw,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed)
                .textSelection(.enabled)
        } else {
            Text(raw)
                .textSelection(.enabled)
        }
    }
}

// MARK: - Status indicator

private struct StatusIndicator: View {
    let status: MessageStatus
    let localId: String?
    var onRetry: ((String) -> Void)?

    var body: some View {
        switch status {
        case .sending:
            ProgressView()
                .scaleEffect(0.6)
        case .sent:
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color(hex: "#22c55e"))
        case .failed:
            Button {
                if let localId { onRetry?(localId) }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                    Text("Retry")
                        .font(.system(size: 10, weight: .semibold))
                }
                .foregroundStyle(Color(hex: "#ef4444"))
            }
        }
    }
}

// MARK: - Log group

struct LogGroupView: View {
    let logs: [Message]
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: expanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Text("\(logs.count) log\(logs.count == 1 ? "" : "s")")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 12)
                .background(.secondary.opacity(0.08), in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.leading, 42)

            if expanded {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(logs) { log in
                        HStack(alignment: .top, spacing: 8) {
                            Text("›")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(senderColor(color: log.color, sender: log.sender))
                                .frame(width: 12)
                            Text(log.content)
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                                .textSelection(.enabled)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 2)
                    }
                }
                .padding(.vertical, 6)
                .padding(.leading, 42)
                .background(.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
                .padding(.horizontal, 16)
                .padding(.top, 4)
            }
        }
    }
}
