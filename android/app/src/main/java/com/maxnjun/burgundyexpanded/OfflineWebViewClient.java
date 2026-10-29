package com.maxnjun.burgundyexpanded;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Map;

/** Next exports multiple HTML pages; Capacitor otherwise returns home on reload. */
public class OfflineWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;
    public OfflineWebViewClient(Bridge bridge) { super(bridge); this.bridge = bridge; }

    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String path = uri.getPath();
        if (request.isForMainFrame() && "GET".equals(request.getMethod())
                && Uri.parse(bridge.getLocalUrl()).getAuthority().equals(uri.getAuthority())
                && path != null && path.matches("/(online|updates|monastery-gallery)/?")) {
            Uri localPage = uri.buildUpon().path(path.replaceAll("/$", "") + "/index.html").build();
            // Retain Capacitor's native-bridge injection and response security.
            return super.shouldInterceptRequest(view, new WebResourceRequest() {
                public Uri getUrl() { return localPage; }
                public boolean isForMainFrame() { return request.isForMainFrame(); }
                public boolean isRedirect() { return request.isRedirect(); }
                public boolean hasGesture() { return request.hasGesture(); }
                public String getMethod() { return request.getMethod(); }
                public Map<String, String> getRequestHeaders() { return request.getRequestHeaders(); }
            });
        }
        return super.shouldInterceptRequest(view, request);
    }
}
