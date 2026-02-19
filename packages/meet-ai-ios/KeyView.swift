import SwiftUI

// MARK: - Key Generation API

private struct GenerateKeyResponse: Decodable {
    let api_key: String
}

private func apiGenerateKey() async throws -> String {
    var req = URLRequest(url: URL(string: "https://meet-ai.cc/api/keys")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let (data, res) = try await URLSession.shared.data(for: req)
    guard let http = res as? HTTPURLResponse, (200...201).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    return try JSONDecoder().decode(GenerateKeyResponse.self, from: data).api_key
}

// MARK: - KeyEntryView (Unauthenticated — onboarding)

struct KeyEntryView: View {
    @Environment(AppState.self) private var appState
    @State private var keyText = ""
    @State private var errorMessage: String?
    @State private var isConnecting = false
    @State private var isGenerating = false

    var body: some View {
        Form {
            Section {
                VStack(spacing: 8) {
                    Text("meet-ai")
                        .font(.largeTitle.bold())
                        .frame(maxWidth: .infinity)

                    Text("Real-time chat for agent teams")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
                .listRowBackground(Color.clear)
                .padding(.vertical, 12)
            }

            Section {
                TextField("Paste API key (mai_...)", text: $keyText)
                    .textContentType(.password)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .font(.system(.body, design: .monospaced))
                    .disabled(isConnecting || isGenerating)
                    .onSubmit { Task { await connect() } }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }

            Section {
                Button {
                    Task { await connect() }
                } label: {
                    if isConnecting {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Connecting...")
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        Text("Connect")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(keyText.isEmpty || isConnecting || isGenerating)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            Section {
                Button {
                    Task { await generate() }
                } label: {
                    if isGenerating {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Generating...")
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        Text("Generate New Key")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(isConnecting || isGenerating)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            } footer: {
                Text("Free forever. No credit card.")
                    .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("API Key")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func connect() async {
        let trimmed = keyText.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("mai_") else {
            errorMessage = "Key must start with mai_"
            return
        }
        errorMessage = nil
        isConnecting = true
        defer { isConnecting = false }

        do {
            try await appState.login(key: trimmed)
        } catch {
            errorMessage = "Could not connect. Check your API key."
        }
    }

    private func generate() async {
        errorMessage = nil
        isGenerating = true
        defer { isGenerating = false }

        do {
            let newKey = try await apiGenerateKey()
            keyText = newKey
            // Auto-connect with the new key
            try await appState.login(key: newKey)
        } catch {
            errorMessage = "Failed to generate key. Try again."
        }
    }
}

// MARK: - KeyManagementView (Authenticated — settings sheet)

struct KeyManagementView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var revealed = false
    @State private var copied = false
    @State private var showSignOutConfirm = false

    private var maskedKey: String {
        guard let key = appState.apiKey, key.count >= 8 else { return "mai_****" }
        return String(key.prefix(8)) + "..." + String(key.suffix(4))
    }

    private var displayKey: String {
        if revealed {
            return appState.apiKey ?? ""
        }
        return maskedKey
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("API Key") {
                    HStack {
                        Text(displayKey)
                            .font(.system(.body, design: .monospaced))
                            .lineLimit(1)

                        Spacer()

                        Button {
                            revealed.toggle()
                        } label: {
                            Image(systemName: revealed ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)

                        Button {
                            if let key = appState.apiKey {
                                UIPasteboard.general.string = key
                                copied = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                    copied = false
                                }
                            }
                        } label: {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                                .foregroundStyle(copied ? .green : .secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        showSignOutConfirm = true
                    }
                }
            }
            .navigationTitle("API Key")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Sign out?",
                isPresented: $showSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    appState.logout()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need your API key to sign back in.")
            }
        }
    }
}
