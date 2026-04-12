import Foundation
import Capacitor

@objc(NativeHttpUploadPlugin)
public class NativeHttpUploadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeHttpUploadPlugin"
    public let jsName = "NativeHttpUpload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "upload", returnType: CAPPluginReturnPromise),
    ]

    @objc func upload(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString) else {
            call.reject("Missing or invalid URL")
            return
        }

        let method = call.getString("method") ?? "PUT"
        let headers = call.getObject("headers") ?? [:]

        var bodyData: Data? = nil
        if let base64Body = call.getString("body"), !base64Body.isEmpty {
            bodyData = Data(base64Encoded: base64Body)
        }

        print("[NativeHttp] \(method) \(urlString) (\(bodyData?.count ?? 0) bytes)")

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = bodyData

        for (key, value) in headers {
            if let str = value as? String {
                request.addValue(str, forHTTPHeaderField: key)
            }
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("[NativeHttp] Error: \(error.localizedDescription)")
                call.reject("Upload failed: \(error.localizedDescription)")
                return
            }

            let httpResponse = response as? HTTPURLResponse
            let status = httpResponse?.statusCode ?? 0
            let responseBody = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""

            print("[NativeHttp] Response: \(status)")

            call.resolve([
                "status": status,
                "data": responseBody,
            ])
        }.resume()
    }
}
