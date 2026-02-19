import SwiftUI

// MARK: - Hex color parsing

extension Color {
    init(hex: String) {
        var hex = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        let scanner = Scanner(string: hex)
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255
        let g = Double((rgb >> 8) & 0xFF) / 255
        let b = Double(rgb & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Hash color from string

private let palette: [Color] = [
    Color(hex: "#ef4444"),
    Color(hex: "#f97316"),
    Color(hex: "#eab308"),
    Color(hex: "#22c55e"),
    Color(hex: "#3b82f6"),
    Color(hex: "#8b5cf6"),
    Color(hex: "#ec4899"),
    Color(hex: "#06b6d4"),
    Color(hex: "#14b8a6"),
    Color(hex: "#f43f5e"),
]

func hashColor(_ string: String) -> Color {
    let hash = string.unicodeScalars.reduce(0) { ($0 &<< 5) &- $0 &+ Int(bitPattern: UInt(truncatingIfNeeded: $1.value)) }
    return palette[abs(hash) % palette.count]
}

func senderColor(color: String?, sender: String) -> Color {
    if let hex = color, !hex.isEmpty {
        return Color(hex: hex)
    }
    return hashColor(sender)
}
