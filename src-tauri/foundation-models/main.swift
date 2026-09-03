import Foundation
import FoundationModels

struct ArticleRequest: Decodable {
    let id: String
    let locale: String
    let instructions: String
    let prompt: String
}

struct ArticleResponse: Encodable {
    let id: String
    let ok: Bool
    let body: String?
    let engineVersion: String?
    let error: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case ok
        case body
        case engineVersion
        case error
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(ok, forKey: .ok)
        try container.encode(body, forKey: .body)
        try container.encode(engineVersion, forKey: .engineVersion)
        try container.encode(error, forKey: .error)
    }
}

struct ModelProbeResponse: Encodable {
    let available: Bool
    let availability: String
    let supportsJapanese: Bool
    let contextSize: Int
}

enum FoundationModelsSidecarError: LocalizedError {
    case unavailable(String)
    case unsupportedLocale(String)

    var errorDescription: String? {
        switch self {
        case .unavailable(let reason):
            return "Apple Foundation Modelsを利用できません: \(reason)"
        case .unsupportedLocale(let locale):
            return "Apple Foundation Modelsは言語「\(locale)」に対応していません。"
        }
    }
}

@available(macOS 26.0, *)
func availabilityError(for model: SystemLanguageModel) -> FoundationModelsSidecarError? {
    switch model.availability {
    case .available:
        return nil
    case .unavailable(let reason):
        return .unavailable(String(describing: reason))
    }
}

@available(macOS 26.0, *)
func probeModel() -> ModelProbeResponse {
    let model = SystemLanguageModel.default
    return ModelProbeResponse(
        available: model.isAvailable,
        availability: String(describing: model.availability),
        supportsJapanese: model.supportsLocale(Locale(identifier: "ja-JP")),
        contextSize: model.contextSize
    )
}

@available(macOS 26.0, *)
func generateArticle(request: ArticleRequest) async throws -> ArticleResponse {
    let model = SystemLanguageModel.default
    if let error = availabilityError(for: model) {
        throw error
    }

    let locale = Locale(identifier: request.locale)
    guard model.supportsLocale(locale) else {
        throw FoundationModelsSidecarError.unsupportedLocale(request.locale)
    }

    let localeInstructions = [
        request.instructions,
        "The person's locale is \(locale.identifier).",
        "You MUST respond in Japanese.",
    ].joined(separator: "\n")
    let session = LanguageModelSession(
        model: model,
        instructions: localeInstructions
    )
    let options = GenerationOptions(sampling: .greedy)
    let response = try await session.respond(to: request.prompt, options: options)
    let body = response.content.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)

    return ArticleResponse(
        id: request.id,
        ok: true,
        body: body,
        engineVersion: "FoundationModels/SystemLanguageModel",
        error: nil
    )
}

@available(macOS 26.0, *)
func writeJSON<T: Encodable>(_ value: T) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

@available(macOS 26.0, *)
func runServer() async throws {
    for try await line in FileHandle.standardInput.bytes.lines {
        guard let data = line.data(using: .utf8) else { continue }

        do {
            let request = try JSONDecoder().decode(ArticleRequest.self, from: data)
            do {
                let response = try await generateArticle(request: request)
                try writeJSON(response)
            } catch {
                try writeJSON(
                    ArticleResponse(
                        id: request.id,
                        ok: false,
                        body: nil,
                        engineVersion: nil,
                        error: "\(error.localizedDescription) [\(String(reflecting: error))]"
                    )
                )
            }
        } catch {
            fputs("リクエストを読み取れませんでした: \(error.localizedDescription)\n", stderr)
        }
    }
}

@main
struct FoundationModelsMain {
    static func main() async {
        do {
            if CommandLine.arguments.contains("--check") {
                try await writeJSON(probeModel())
                return
            }
            try await runServer()
        } catch {
            fputs("\(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }
}
