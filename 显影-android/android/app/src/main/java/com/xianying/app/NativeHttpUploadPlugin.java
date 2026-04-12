package com.xianying.app;

import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;

@CapacitorPlugin(name = "NativeHttpUpload")
public class NativeHttpUploadPlugin extends Plugin {
    private static final String TAG = "NativeHttp";

    @PluginMethod
    public void upload(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing or invalid URL");
            return;
        }

        String method = call.getString("method", "PUT");
        JSObject headers = call.getObject("headers", new JSObject());
        String base64Body = call.getString("body", "");

        byte[] bodyData = null;
        if (base64Body != null && !base64Body.isEmpty()) {
            bodyData = Base64.decode(base64Body, Base64.DEFAULT);
        }

        Log.d(TAG, method + " " + urlString + " (" + (bodyData != null ? bodyData.length : 0) + " bytes)");

        final byte[] finalBody = bodyData;
        new Thread(() -> {
            try {
                URL url = new URL(urlString);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);

                if (headers != null) {
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        String value = headers.getString(key);
                        if (value != null) {
                            conn.setRequestProperty(key, value);
                        }
                    }
                }

                if (finalBody != null && finalBody.length > 0) {
                    conn.setDoOutput(true);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(finalBody);
                    }
                }

                int status = conn.getResponseCode();
                InputStream is = (status >= 200 && status < 300) ?
                        conn.getInputStream() : conn.getErrorStream();

                String responseBody = "";
                if (is != null) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = is.read(buf)) != -1) {
                        baos.write(buf, 0, n);
                    }
                    responseBody = baos.toString("UTF-8");
                    is.close();
                }

                conn.disconnect();
                Log.d(TAG, "Response: " + status);

                JSObject result = new JSObject();
                result.put("status", status);
                result.put("data", responseBody);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Error: " + e.getMessage());
                call.reject("Upload failed: " + e.getMessage());
            }
        }).start();
    }
}
