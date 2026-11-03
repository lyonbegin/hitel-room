import Foundation

/// Pure, testable native tel: URL parser for carrier short codes and
/// conventional mobile/international telephone numbers.
enum HitelCarrierDialURL {
    static func make(_ raw: String) -> URL? {
        let compact = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        var value = ""
        for (index, character) in compact.enumerated() {
            if character == "+", index == 0 {
                value.append("+")
            } else if let number = character.wholeNumberValue, number >= 0, number <= 9 {
                // Converts Unicode fullwidth or Korean-input digits to ASCII.
                value.append(String(number))
            } else if character == "-" || character == "(" || character == ")" ||
                      character == " " || character == "." || character == "\u{00A0}" {
                continue
            } else {
                return nil
            }
        }
        let digits = value.hasPrefix("+") ? String(value.dropFirst()) : value
        guard digits.count >= 2, digits.count <= 24,
              digits.allSatisfy({ $0 >= "0" && $0 <= "9" }) else { return nil }
        return URL(string: "tel:" + value)
    }

    static func isKnownShortCode(_ raw: String) -> Bool {
        guard let url = make(raw) else { return false }
        return ["tel:100", "tel:112", "tel:119", "tel:114"].contains(url.absoluteString)
    }
}
