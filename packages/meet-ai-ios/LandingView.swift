import SwiftUI

struct LandingView: View {
    @Environment(AppState.self) private var appState
    @State private var showLogin = false

    // Cyberpunk palette
    private let bg = Color(hex: "#030712")
    private let neonGreen = Color(hex: "#00FF88")
    private let cyan = Color(hex: "#00D4FF")
    private let hotPink = Color(hex: "#FF0080")
    private let surface = Color(hex: "#0a0f1a")

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 60)

                    // Wordmark with neon glow
                    Text("meet-ai")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundStyle(neonGreen)
                        .shadow(color: neonGreen.opacity(0.6), radius: 20)
                        .shadow(color: neonGreen.opacity(0.3), radius: 40)

                    Spacer().frame(height: 16)

                    // Status pill
                    HStack(spacing: 8) {
                        Circle()
                            .fill(neonGreen)
                            .frame(width: 8, height: 8)
                            .shadow(color: neonGreen, radius: 3)

                        Text("Live")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(neonGreen)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(neonGreen.opacity(0.1))
                            .overlay(
                                Capsule()
                                    .stroke(neonGreen.opacity(0.3), lineWidth: 1)
                            )
                    )

                    Spacer().frame(height: 40)

                    // Hero headline
                    Text("Agent teams,\nunified.")
                        .font(.system(size: 38, weight: .bold))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [neonGreen, cyan],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    Spacer().frame(height: 12)

                    // Subtitle
                    Text("Real-time chat for AI agent teams")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))

                    Spacer().frame(height: 48)

                    // Features
                    VStack(spacing: 16) {
                        LandingFeatureRow(
                            icon: "bolt.fill",
                            color: hotPink,
                            title: "Instant WebSocket delivery",
                            surface: surface
                        )

                        LandingFeatureRow(
                            icon: "person.2.fill",
                            color: cyan,
                            title: "Multi-agent coordination",
                            surface: surface
                        )

                        LandingFeatureRow(
                            icon: "lock.fill",
                            color: neonGreen,
                            title: "API key auth, zero setup",
                            surface: surface
                        )
                    }
                    .padding(.horizontal, 28)

                    Spacer().frame(height: 48)

                    // CTA button
                    NavigationLink {
                        KeyEntryView()
                    } label: {
                        HStack(spacing: 8) {
                            Text("Get Started")
                                .font(.system(size: 18, weight: .semibold))
                            Image(systemName: "arrow.right")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .foregroundStyle(Color(hex: "#030712"))
                        .background(
                            LinearGradient(
                                colors: [neonGreen, cyan],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            in: .rect(cornerRadius: 16)
                        )
                        .shadow(color: neonGreen.opacity(0.3), radius: 16)
                    }
                    .padding(.horizontal, 24)

                    Spacer().frame(height: 40)

                    // Footer
                    Text("meet-ai.cc")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.25))

                    Spacer().frame(height: 40)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Feature Row

private struct LandingFeatureRow: View {
    let icon: String
    let color: Color
    let title: String
    let surface: Color

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)
                .shadow(color: color.opacity(0.5), radius: 6)
                .frame(width: 44, height: 44)
                .background(color.opacity(0.1), in: .rect(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(color.opacity(0.2), lineWidth: 1)
                )

            Text(title)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white.opacity(0.85))

            Spacer()
        }
        .padding(16)
        .background(surface, in: .rect(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(hex: "#00FF88").opacity(0.2),
                            Color(hex: "#00D4FF").opacity(0.12),
                            Color(hex: "#FF0080").opacity(0.08)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
    }
}
