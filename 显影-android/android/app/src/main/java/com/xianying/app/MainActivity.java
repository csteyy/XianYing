package com.xianying.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeHttpUploadPlugin.class);
        registerPlugin(NativeWebSocketPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
