import AVFoundation
import Foundation
import Speech

struct TranscriptSegment: Codable {
    let startMs: Int
    let endMs: Int
    let text: String
}

struct SpeechResponse: Codable {
    let language: String
    let segments: [TranscriptSegment]
    let engineVersion: String
}

enum SpeechSidecarError: LocalizedError {
    case missingAudioPath
    case unavailable
    case unsupportedLocale(String, [String])
    case emptyAudio

    var errorDescription: String? {
        switch self {
        case .missingAudioPath:
            return "文字起こし対象の音声ファイルが指定されていません。"
        case .unavailable:
            return "このMacではApple SpeechTranscriberを利用できません。"
        case .unsupportedLocale(let locale, let supportedLocales):
            let supported = supportedLocales.isEmpty ? "なし" : supportedLocales.joined(separator: ", ")
            return "Apple SpeechTranscriberは言語「\(locale)」に対応していません。対応言語: \(supported)"
        case .emptyAudio:
            return "音声ファイルに解析できる音声がありません。"
        }
    }
}

@available(macOS 26.0, *)
func requestedLocale(from value: String) -> Locale {
    switch value.lowercased() {
    case "ja", "ja-jp", "jpn":
        return Locale(identifier: "ja-JP")
    case "en", "en-us", "eng":
        return Locale(identifier: "en-US")
    default:
        return value == "auto" ? Locale.current : Locale(identifier: value)
    }
}

@available(macOS 26.0, *)
func ensureAssets(for modules: [any SpeechModule]) async throws {
    fputs("progress=5%\n", stderr)
    guard let installationRequest = try await AssetInventory.assetInstallationRequest(
        supporting: modules
    ) else {
        return
    }

    try await installationRequest.downloadAndInstall()
}

@available(macOS 26.0, *)
func collectSegments<Results: AsyncSequence>(
    results: Results,
    textForResult: @escaping (Results.Element) -> AttributedString
) async throws -> [TranscriptSegment] where Results.Element: SpeechModuleResult {
    var segments: [TranscriptSegment] = []
    for try await result in results {
        guard result.isFinal else { continue }
        let text = String(textForResult(result).characters)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { continue }

        let startSeconds = max(0, CMTimeGetSeconds(result.range.start))
        let endSeconds = max(startSeconds, CMTimeGetSeconds(result.range.end))
        guard startSeconds.isFinite, endSeconds.isFinite else { continue }

        segments.append(
            TranscriptSegment(
                startMs: Int((startSeconds * 1000).rounded()),
                endMs: Int((endSeconds * 1000).rounded()),
                text: text
            )
        )
    }
    return segments
}

@available(macOS 26.0, *)
func analyzeFile<Results: AsyncSequence>(
    file: AVAudioFile,
    analyzer: SpeechAnalyzer,
    results: Results,
    textForResult: @escaping (Results.Element) -> AttributedString
) async throws -> [TranscriptSegment] where Results.Element: SpeechModuleResult {
    let resultTask = Task<[TranscriptSegment], Error> {
        try await collectSegments(results: results, textForResult: textForResult)
    }

    do {
        guard let lastSampleTime = try await analyzer.analyzeSequence(from: file) else {
            await analyzer.cancelAndFinishNow()
            _ = try await resultTask.value
            throw SpeechSidecarError.emptyAudio
        }
        try await analyzer.finalizeAndFinish(through: lastSampleTime)
        return try await resultTask.value
    } catch {
        resultTask.cancel()
        throw error
    }
}

@available(macOS 26.0, *)
func transcribe(audioPath: String, languageValue: String) async throws -> SpeechResponse {
    let requested = requestedLocale(from: languageValue)
    let file = try AVAudioFile(forReading: URL(fileURLWithPath: audioPath))
    guard file.length > 0 else {
        throw SpeechSidecarError.emptyAudio
    }

    if SpeechTranscriber.isAvailable,
       let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requested) {
        let transcriber = SpeechTranscriber(
            locale: locale,
            preset: .timeIndexedTranscriptionWithAlternatives
        )
        try await ensureAssets(for: [transcriber])
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let segments = try await analyzeFile(
            file: file,
            analyzer: analyzer,
            results: transcriber.results,
            textForResult: { $0.text }
        )
        fputs("progress=100%\n", stderr)
        return SpeechResponse(
            language: locale.identifier,
            segments: segments,
            engineVersion: "SpeechTranscriber/timeIndexedTranscriptionWithAlternatives"
        )
    }

    guard let locale = await DictationTranscriber.supportedLocale(equivalentTo: requested) else {
        let supportedLocales = await SpeechTranscriber.supportedLocales.map(\.identifier)
        throw SpeechSidecarError.unsupportedLocale(requested.identifier, supportedLocales)
    }
    let transcriber = DictationTranscriber(locale: locale, preset: .timeIndexedLongDictation)
    try await ensureAssets(for: [transcriber])
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    let segments = try await analyzeFile(
        file: file,
        analyzer: analyzer,
        results: transcriber.results,
        textForResult: { $0.text }
    )
    fputs("progress=100%\n", stderr)
    return SpeechResponse(
        language: locale.identifier,
        segments: segments,
        engineVersion: "DictationTranscriber/timeIndexedLongDictation"
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

@main
struct SpeechTranscriberMain {
    static func main() async {
        guard CommandLine.arguments.count >= 2 else {
            fputs("\(SpeechSidecarError.missingAudioPath.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }

        let audioPath = CommandLine.arguments[1]
        let language = CommandLine.arguments.count >= 3 ? CommandLine.arguments[2] : "auto"

        do {
            try await writeJSON(transcribe(audioPath: audioPath, languageValue: language))
        } catch {
            fputs("\(error.localizedDescription)\n", stderr)
            exit(EXIT_FAILURE)
        }
    }
}
