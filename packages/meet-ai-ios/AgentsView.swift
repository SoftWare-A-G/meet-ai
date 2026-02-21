import SwiftUI

struct AgentsView: View {
    let teamInfo: TeamInfo?

    var body: some View {
        Group {
            if let teamInfo {
                List {
                    if !teamInfo.team_name.isEmpty {
                        Section {
                            EmptyView()
                        } header: {
                            Text(teamInfo.team_name)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(.primary)
                                .textCase(nil)
                        }
                    }

                    Section {
                        ForEach(teamInfo.members) { member in
                            AgentRowView(member: member)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            } else {
                ContentUnavailableView(
                    "No Agents",
                    systemImage: "person.2.slash",
                    description: Text("No agents have joined this room yet.")
                )
            }
        }
        .navigationTitle("Agents")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AgentRowView: View {
    let member: TeamMember

    private var color: Color { Color(hex: member.color) }
    private var isActive: Bool { member.status == .active }

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(color)
                    .frame(width: 40, height: 40)
                Text(String(member.name.prefix(1)).uppercased())
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(member.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(color)
                        .lineLimit(1)

                    Circle()
                        .fill(isActive ? Color(hex: "#22c55e") : Color.secondary)
                        .frame(width: 8, height: 8)
                }

                Text(member.role)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                if let model = member.model, !model.isEmpty {
                    Text(model)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .opacity(0.7)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(member.name), \(member.role), \(isActive ? "active" : "inactive")")
    }
}
