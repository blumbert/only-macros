import ExpoModulesCore
import ImageIO
import UIKit
import Vision

/// Reads the text off a photo with Apple's Vision framework. Everything runs on
/// the device: Vision needs no network, so the app still collects no data.
public class LabelTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LabelText")

    /// Resolves to one entry per line of text Vision found, each with its box
    /// in 0-1 coordinates measured from the top-left of the upright photo.
    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      let path = uri.hasPrefix("file://") ? String(uri.dropFirst("file://".count)) : uri
      guard let image = UIImage(contentsOfFile: path), let cgImage = image.cgImage else {
        promise.reject("ERR_LABEL_IMAGE", "Couldn't open that photo.")
        return
      }

      // Vision can report a failure both to the completion handler and by
      // throwing from perform(); settle the promise only once. Both happen on
      // the queue below, one after the other, so a plain flag is enough.
      var settled = false
      let fail = { (message: String) in
        if settled { return }
        settled = true
        promise.reject("ERR_LABEL_VISION", message)
      }

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          fail(error.localizedDescription)
          return
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        let lines: [[String: Any]] = observations.compactMap { observation in
          guard let candidate = observation.topCandidates(1).first else { return nil }
          // Vision's origin is bottom-left; flip it so y grows down the label.
          let box = observation.boundingBox
          return [
            "text": candidate.string,
            "x": Double(box.minX),
            "y": Double(1 - box.maxY),
            "width": Double(box.width),
            "height": Double(box.height),
          ]
        }
        if settled { return }
        settled = true
        promise.resolve(lines)
      }
      request.recognitionLevel = .accurate
      // Language correction is for prose. On a label it can "fix" a reading
      // like "0g" into a word, and the numbers are the whole point.
      request.usesLanguageCorrection = false

      // A camera photo's pixels are stored sideways with an orientation flag,
      // and `cgImage` drops the flag. Without passing it on, Vision reads the
      // label rotated 90 degrees.
      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: CGImagePropertyOrientation(image.imageOrientation),
        options: [:]
      )
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          fail(error.localizedDescription)
        }
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
