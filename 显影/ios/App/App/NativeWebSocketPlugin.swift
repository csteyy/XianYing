import Foundation
import Capacitor

@objc(NativeWebSocketPlugin)
public class NativeWebSocketPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionWebSocketDelegate {
    public let identifier = "NativeWebSocketPlugin"
    public let jsName = "NativeWebSocket"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
    ]

    private var task: URLSessionWebSocketTask?
    private var urlSession: URLSession?

    @objc func connect(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString) else {
            call.reject("Invalid or missing URL")
            return
        }

        disconnect()

        let headers = call.getObject("headers") ?? [:]
        print("[NativeWS] Connecting to: \(urlString)")
        print("[NativeWS] Headers: \(headers.keys.joined(separator: ", "))")

        var request = URLRequest(url: url)
        for (key, value) in headers {
            if let str = value as? String {
                request.addValue(str, forHTTPHeaderField: key)
            }
        }

        urlSession = URLSession(
            configuration: .default,
            delegate: self,
            delegateQueue: OperationQueue.main
        )
        task = urlSession?.webSocketTask(with: request)
        task?.resume()
        startReceiving()
        call.resolve()
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"),
              let data = Data(base64Encoded: base64) else {
            call.reject("Invalid or missing data (expected base64)")
            return
        }

        task?.send(.data(data)) { error in
            if let error = error {
                call.reject("Send failed: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        disconnect()
        call.resolve()
    }

    private func disconnect() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
    }

    private func startReceiving() {
        task?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    self.notifyListeners("message", data: ["data": data.base64EncodedString()])
                case .string(let text):
                    self.notifyListeners("message", data: ["text": text])
                @unknown default:
                    break
                }
                self.startReceiving()
            case .failure(let error):
                self.notifyListeners("error", data: ["message": error.localizedDescription])
            }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        notifyListeners("open", data: [:])
    }

    public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let reasonStr = reason.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        notifyListeners("close", data: ["code": closeCode.rawValue, "reason": reasonStr])
    }

    // MARK: - URLSessionTaskDelegate

    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        if let error = error {
            print("[NativeWS] Task completed with error: \(error.localizedDescription)")
            notifyListeners("error", data: ["message": error.localizedDescription])
        }
    }
}
