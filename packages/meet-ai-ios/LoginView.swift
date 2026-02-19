import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var key = ""
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Header
            VStack(spacing: 8) {
                Text("meet-ai")
                    .font(.system(size: 36, weight: .bold))
                Text("Enter your API key to connect")
                    .font(.system(size: 16))
                    .foregroundStyle(.secondary)
            }

            Spacer().frame(height: 40)

            // Form
            VStack(spacing: 12) {
                TextField("mai_...", text: $key)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(.secondary.opacity(0.2), lineWidth: 1)
                    )
                    .disabled(loading)
                    .onSubmit { Task { await handleConnect() } }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#ef4444"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                }

                Button {
                    Task { await handleConnect() }
                } label: {
                    Group {
                        if loading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Connect")
                                .font(.system(size: 16, weight: .semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                }
                .foregroundStyle(.white)
                .background(Color(hex: "#3c87f7"), in: RoundedRectangle(cornerRadius: 12))
                .disabled(loading || key.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(loading || key.trimmingCharacters(in: .whitespaces).isEmpty ? 0.6 : 1.0)
            }
            .padding(.horizontal, 24)

            Spacer()
        }
    }

    private func handleConnect() async {
        let trimmed = key.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("mai_") else {
            errorMessage = "API key must start with mai_"
            return
        }
        errorMessage = nil
        loading = true
        defer { loading = false }
        do {
            try await appState.login(key: trimmed)
        } catch {
            errorMessage = "Could not connect. Check your API key."
        }
    }
}
