import Foundation
import Vision

struct Point: Codable {
    let x: Double
    let y: Double
}

struct TextBlock: Codable {
    let text: String
    let confidence: Double
    let polygon: [Point]
}

struct OcrResponse: Codable {
    let rawText: String
    let blocks: [TextBlock]
    let engineVersion: String
}

enum VisionOcrError: LocalizedError {
    case missingImagePath
    case imageCouldNotBeLoaded(String)
    case noSupportedLanguages
    case recognitionFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingImagePath:
            return "画像パスが指定されていません。"
        case .imageCouldNotBeLoaded(let path):
            return "OCR対象の画像を読み込めませんでした: \(path)"
        case .noSupportedLanguages:
            return "このmacOS環境で利用できるOCR言語がありません。"
        case .recognitionFailed(let message):
            return "Apple Visionの文字認識に失敗しました: \(message)"
        }
    }
}

func requestedLanguages(from value: String) -> [String] {
    value.split(separator: "+").compactMap { language in
        switch language.lowercased() {
        case "ja", "ja-jp", "jpn":
            return "ja-JP"
        case "en", "en-us", "eng":
            return "en-US"
        default:
            return nil
        }
    }
}

func topLeftPolygon(for box: CGRect) -> [Point] {
    let minX = Double(box.minX)
    let maxX = Double(box.maxX)
    let minY = 1 - Double(box.maxY)
    let maxY = 1 - Double(box.minY)

    return [
        Point(x: minX, y: minY),
        Point(x: maxX, y: minY),
        Point(x: maxX, y: maxY),
        Point(x: minX, y: maxY),
    ]
}

func recognize(imagePath: String, languageValue: String) throws -> OcrResponse {
    let imageURL = URL(fileURLWithPath: imagePath)
    guard FileManager.default.fileExists(atPath: imagePath) else {
        throw VisionOcrError.imageCouldNotBeLoaded(imagePath)
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    let revision = VNRecognizeTextRequest.currentRevision
    request.revision = revision
    let supportedLanguages = try VNRecognizeTextRequest.supportedRecognitionLanguages(
        for: .accurate,
        revision: revision
    )
    let requested = requestedLanguages(from: languageValue)
    let languages = requested.filter { supportedLanguages.contains($0) }
    guard !languages.isEmpty else {
        throw VisionOcrError.noSupportedLanguages
    }
    request.recognitionLanguages = languages

    let handler = VNImageRequestHandler(url: imageURL, options: [:])
    do {
        try handler.perform([request])
    } catch {
        let nsError = error as NSError
        throw VisionOcrError.recognitionFailed(
            "\(error.localizedDescription) (domain=\(nsError.domain), code=\(nsError.code), revision=\(revision))"
        )
    }

    let blocks = (request.results ?? []).compactMap { observation -> TextBlock? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }

        return TextBlock(
            text: text,
            confidence: Double(candidate.confidence),
            polygon: topLeftPolygon(for: observation.boundingBox)
        )
    }.sorted { first, second in
        let firstY = first.polygon.first?.y ?? 0
        let secondY = second.polygon.first?.y ?? 0
        if abs(firstY - secondY) > 0.02 {
            return firstY < secondY
        }

        let firstX = first.polygon.first?.x ?? 0
        let secondX = second.polygon.first?.x ?? 0
        return firstX < secondX
    }

    return OcrResponse(
        rawText: blocks.map(\.text).joined(separator: "\n"),
        blocks: blocks,
        engineVersion: "apple-vision-revision-\(revision)"
    )
}

func writeJSON<T: Encodable>(_ value: T) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    guard let output = String(data: data, encoding: .utf8) else {
        throw VisionOcrError.recognitionFailed("JSON出力をUTF-8へ変換できませんでした")
    }
    print(output)
}

do {
    guard CommandLine.arguments.count >= 2 else {
        throw VisionOcrError.missingImagePath
    }

    let imagePath = CommandLine.arguments[1]
    let languageValue = CommandLine.arguments.count >= 3 ? CommandLine.arguments[2] : "ja+en"
    try writeJSON(recognize(imagePath: imagePath, languageValue: languageValue))
} catch {
    FileHandle.standardError.write(
        Data("\(error.localizedDescription)\n".utf8)
    )
    exit(EXIT_FAILURE)
}
