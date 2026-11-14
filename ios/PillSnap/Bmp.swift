import SwiftUI
import Vision
import ZXingCpp

/// Reads the 2D code of a Bundeseinheitlicher Medikationsplan from a photo.
/// Real plans (and our demo sheets) carry an ISO/IEC 16022 Data Matrix code with
/// the plan as ISO-8859-1 XML.
///
/// Decoder: zxing-cpp (CPU only – works on every iPhone and in the simulator),
/// Apple Vision as a second opinion on devices.
enum CodeReader {
    enum Found { case plan(String), pack(PackCode) }

    /// A medication plan (BMP XML) or a medicine pack in the photo: the securPharm Data Matrix of
    /// prescription packs, or the striped PZN barcode (Code 39) that non-prescription packs like Aspirin carry.
    static func scan(_ image: UIImage) async -> Found? {
        await Task.detached(priority: .userInitiated) { () -> Found? in
            guard let cg = image.normalizedCGImage(maxSide: 2400) else { return nil }
            let texts = zxing(cg) + vision(cg)
            if let plan = texts.first(where: { $0.contains("<MP") }) { return .plan(plan) }
            if let pack = texts.lazy.compactMap(PackCode.parse).first { return .pack(pack) }
            return nil
        }.value
    }

    /// No code decoded on a pack → the printed "PZN 12345678", read by Apple Vision OCR (rule: `PackCode.fromText`).
    /// Upright first, then turned a quarter either way, then upside down.
    static func readPrintedPZN(_ image: UIImage) async -> PackCode? {
        await Task.detached(priority: .userInitiated) { () -> PackCode? in
            guard let cg = image.normalizedCGImage(maxSide: 2400) else { return nil }
            for orientation in [CGImagePropertyOrientation.up, .right, .left, .down] {
                // .accurate can fail where no Neural Engine is available (e.g. simulator) → .fast.
                for level in [VNRequestTextRecognitionLevel.accurate, .fast] {
                    let req = VNRecognizeTextRequest()
                    req.recognitionLevel = level
                    req.usesLanguageCorrection = false
                    do { try VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:]).perform([req]) } catch {
                        print("BlisterKompass pack OCR failed: \(error)")
                        continue
                    }
                    let text = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
                    if let code = PackCode.fromText(text) { return code }
                    break
                }
            }
            return nil
        }.value
    }

    private static func zxing(_ cg: CGImage) -> [String] {
        let options = ZXIReaderOptions()
        options.formats = [ZXIFormat.DATA_MATRIX, .QR_CODE, .AZTEC, .PDF_417, .CODE_39].map { NSNumber(value: $0.rawValue) }
        options.tryHarder = true
        options.tryRotate = true
        let results = (try? ZXIBarcodeReader(options: options).read(cg)) ?? []
        // BMP payload bytes are ISO-8859-1; pack codes are ASCII. Keep the HRI text too (GS1).
        return results.flatMap { [String(data: $0.bytes, encoding: .isoLatin1), $0.text].compactMap { $0 } }
    }

    private static func vision(_ cg: CGImage) -> [String] {
        let req = VNDetectBarcodesRequest()
        req.symbologies = [.dataMatrix, .qr, .aztec, .pdf417, .code39]
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        return (req.results ?? []).compactMap(\.payloadStringValue)
    }
}
