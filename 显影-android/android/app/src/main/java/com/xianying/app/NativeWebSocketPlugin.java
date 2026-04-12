package com.xianying.app;

import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Iterator;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "NativeWebSocket")
public class NativeWebSocketPlugin extends Plugin {
    private static final String TAG = "NativeWS";

    private OkHttpClient client;
    private WebSocket webSocket;

    @PluginMethod
    public void connect(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Invalid or missing URL");
            return;
        }

        disconnect();

        JSObject headers = call.getObject("headers", new JSObject());
        Log.d(TAG, "Connecting to: " + urlString);

        Request.Builder builder = new Request.Builder().url(urlString);
        if (headers != null) {
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String value = headers.getString(key);
                if (value != null) {
                    builder.addHeader(key, value);
                }
            }
        }

        client = new OkHttpClient.Builder()
                .retryOnConnectionFailure(false)
                .build();

        webSocket = client.newWebSocket(builder.build(), new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "Connected");
                JSObject data = new JSObject();
                notifyListeners("open", data);
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                JSObject data = new JSObject();
                data.put("text", text);
                notifyListeners("message", data);
            }

            @Override
            public void onMessage(WebSocket ws, ByteString bytes) {
                JSObject data = new JSObject();
                data.put("data", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
                notifyListeners("message", data);
            }

            @Override
            public void onClosing(WebSocket ws, int code, String reason) {
                ws.close(code, reason);
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "Closed: " + code + " " + reason);
                JSObject data = new JSObject();
                data.put("code", code);
                data.put("reason", reason);
                notifyListeners("close", data);
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                Log.e(TAG, "Error: " + t.getMessage());
                JSObject data = new JSObject();
                data.put("message", t.getMessage() != null ? t.getMessage() : "WebSocket error");
                notifyListeners("error", data);
            }
        });

        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        String base64 = call.getString("data");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Invalid or missing data (expected base64)");
            return;
        }

        if (webSocket == null) {
            call.reject("WebSocket not connected");
            return;
        }

        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        boolean ok = webSocket.send(ByteString.of(bytes));
        if (ok) {
            call.resolve();
        } else {
            call.reject("Send failed");
        }
    }

    @PluginMethod
    public void close(PluginCall call) {
        disconnect();
        call.resolve();
    }

    private void disconnect() {
        if (webSocket != null) {
            try {
                webSocket.close(1000, null);
            } catch (Exception ignored) {}
            webSocket = null;
        }
        if (client != null) {
            client.dispatcher().executorService().shutdown();
            client = null;
        }
    }
}
