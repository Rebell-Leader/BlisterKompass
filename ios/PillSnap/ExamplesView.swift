import SwiftUI
import PhotosUI

/// Which examples to show: plan codes, pack codes or pill photos.
enum ExampleKind: String, Identifiable, Decodable {
    case plan, pack, photo
    var id: String { rawValue }
    var title: String {
        switch self {
        case .plan: "Beispielpläne"
        case .pack: "Beispielpackungen"
        case .photo: "Beispielfotos"
        }
    }
}

/// Real example files bundled with the app (Examples/): Medikationsplan Data Matrix
/// codes, securPharm pack codes and real pill photos (NLM). Nothing is drawn.
struct ExampleFile: Decodable, Identifiable {
    let file: String
    let kind: ExampleKind
    let caption: String
    var id: String { file }

    var image: UIImage? {
        let name = (file as NSString).deletingPathExtension, ext = (file as NSString).pathExtension
        return Bundle.main.url(forResource: name, withExtension: ext).flatMap { UIImage(contentsOfFile: $0.path) }
    }

    static let all: [ExampleFile] = {
        guard let url = Bundle.main.url(forResource: "examples", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([ExampleFile].self, from: data)) ?? []
    }()
}

struct ExamplesView: View {
    let kind: ExampleKind
    let onPick: (UIImage) -> Void
    let onCancel: () -> Void
    @State private var libraryItem: PhotosPickerItem?

    private var files: [ExampleFile] { ExampleFile.all.filter { $0.kind == kind } }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Abbrechen", action: onCancel).font(.title3.weight(.semibold))
                Spacer()
                Text(kind.title).font(.title2.bold())
                Spacer()
                // The phone's own photo library is one tap away.
                PhotosPicker(selection: $libraryItem, matching: .images) {
                    Image(systemName: "photo.stack").font(.title2).padding(.leading, 20)
                }
                .accessibilityLabel("Eigene Fotos")
            }
            .padding(.horizontal, 16).padding(.vertical, 12)

            FitOrScroll {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(files) { f in
                        if let img = f.image {
                            Button { onPick(img) } label: {
                                VStack(spacing: 8) {
                                    Image(uiImage: img).resizable().interpolation(f.kind == .photo ? .medium : .none)
                                        .scaledToFit()
                                        .frame(maxWidth: .infinity).frame(height: 130)
                                        .background(Color.white)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                    Text(f.caption).font(.callout.weight(.semibold)).multilineTextAlignment(.center)
                                        .lineLimit(2).minimumScaleFactor(0.7)
                                }
                                .padding(10)
                                .frame(maxWidth: .infinity)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(f.caption)
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .onChange(of: libraryItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) { onPick(img) }
                libraryItem = nil
            }
        }
    }
}
