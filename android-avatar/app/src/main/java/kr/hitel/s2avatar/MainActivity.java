package kr.hitel.s2avatar;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

/** Secure local-only Android shell for the DH_live mini face renderer. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int PICK_AVATAR_ZIP = 2001;
    private static final int PICK_WAV = 2002;
    private static final int AUDIO_PERMISSION_CODE = 2003;
    private static final long MAX_FILE_BYTES = 100L * 1024L * 1024L;
    private static final long MAX_TOTAL_BYTES = 120L * 1024L * 1024L;

    private WebView page;
    private File avatarDir;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingAudioPermission;

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        avatarDir = new File(getFilesDir(), "avatar/current");
        if (!avatarDir.exists() && !avatarDir.mkdirs()) throw new IllegalStateException("Cannot initialize avatar directory");

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/avatar/", new WebViewAssetLoader.InternalStoragePathHandler(this, avatarDir))
            .build();

        page = new WebView(this);
        WebSettings settings = page.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        page.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && "appassets.androidplatform.net".equals(url.getHost())) return false;
                if ("about".equals(url.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception e) {
                    Log.w("HITEL-AVATAR", "Cannot open URL", e);
                }
                return true;
            }
        });

        page.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                Log.d("HITEL-AVATAR", message.message() + " @" + message.lineNumber());
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!"https".equals(request.getOrigin().getScheme()) ||
                        !"appassets.androidplatform.net".equals(request.getOrigin().getHost()) ||
                        !contains(request.getResources(), PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        request.deny();
                        return;
                    }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingAudioPermission = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_CODE);
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingAudioPermission == request) pendingAudioPermission = null;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("audio/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/wav", "audio/x-wav", "audio/wave"});
                startActivityForResult(intent, PICK_WAV);
                return true;
            }
        });

        page.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void importAvatarZip() {
                runOnUiThread(() -> {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/zip");
                    startActivityForResult(intent, PICK_AVATAR_ZIP);
                });
            }
            @JavascriptInterface
            public boolean hasAvatar() {
                return new File(avatarDir, "01.mp4").isFile() &&
                    new File(avatarDir, "combined_data.json.gz").isFile();
            }
        }, "HitelAndroid");

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        setContentView(page);
        page.loadUrl(ORIGIN + "/assets/index.html");
    }

    private static boolean contains(String[] values, String expected) {
        for (String v : values) if (expected.equals(v)) return true;
        return false;
    }

    @SuppressWarnings("deprecation")
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_WAV) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(
                    resultCode == RESULT_OK && data != null && data.getData() != null
                        ? new Uri[]{data.getData()} : null
                );
                fileCallback = null;
            }
            return;
        }
        if (requestCode == PICK_AVATAR_ZIP && resultCode == RESULT_OK && data != null && data.getData() != null) {
            final Uri uri = data.getData();
            new Thread(() -> {
                try {
                    importZip(uri);
                    reportImport(true, "아바타 팩 설치 완료");
                } catch (Exception e) {
                    Log.e("HITEL-AVATAR", "Avatar ZIP import failed", e);
                    reportImport(false, e.getMessage() == null ? "ZIP 압축 파일 오류" : e.getMessage());
                }
            }, "avatar-zip-import").start();
        }
    }

    private void reportImport(boolean success, String message) {
        runOnUiThread(() -> page.evaluateJavascript(
            "window.hitelAvatarImported(" + (success ? "true" : "false") + "," + JSONObject.quote(message) + ")", null));
    }

    private void importZip(Uri uri) throws IOException {
        File staging = new File(getFilesDir(), "avatar/staging");
        deleteTree(staging);
        if (!staging.mkdirs()) throw new IOException("Cannot create staging directory");
        Set<String> found = new HashSet<>();
        long total = 0L;
        try {
            InputStream input = getContentResolver().openInputStream(uri);
            if (input == null) throw new IOException("ZIP 파일을 열 수 없습니다.");
            try (ZipInputStream zip = new ZipInputStream(input)) {
                ZipEntry entry;
                byte[] buffer = new byte[8192];
                while ((entry = zip.getNextEntry()) != null) {
                    String path = entry.getName();
                    if (!entry.isDirectory() && ("01.mp4".equals(path) || "combined_data.json.gz".equals(path))) {
                        if (!found.add(path)) throw new IOException("중복된 아바타 파일: " + path);
                        long fileSize = 0L;
                        try (FileOutputStream output = new FileOutputStream(new File(staging, path))) {
                            int count;
                            while ((count = zip.read(buffer)) != -1) {
                                fileSize += count;
                                total += count;
                                if (fileSize > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES)
                                    throw new IOException("압축 파일 제한 용량 초과");
                                output.write(buffer, 0, count);
                            }
                        }
                    }
                    zip.closeEntry();
                }
            }
            if (!(found.contains("01.mp4") && found.contains("combined_data.json.gz")) ||
                new File(staging, "01.mp4").length() == 0L ||
                new File(staging, "combined_data.json.gz").length() == 0L) {
                throw new IOException("ZIP 최상위에 01.mp4 및 combined_data.json.gz 파일이 모두 필요합니다.");
            }
            File previous = new File(getFilesDir(), "avatar/previous");
            deleteTree(previous);
            if (avatarDir.exists() && !avatarDir.renameTo(previous)) {
                throw new IOException("기존 아바타 이동 실패");
            }
            if (!staging.renameTo(avatarDir)) {
                if (previous.exists() && !previous.renameTo(avatarDir))
                    Log.e("HITEL-AVATAR", "Failed to restore the previous avatar");
                throw new IOException("새 아바타 저장 실패");
            }
            deleteTree(previous);
        } finally {
            deleteTree(staging);
        }
    }

    private static void deleteTree(File file) {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        if (!file.delete()) Log.w("HITEL-AVATAR", "Could not remove: " + file.getName());
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != AUDIO_PERMISSION_CODE) return;
        PermissionRequest pending = pendingAudioPermission;
        pendingAudioPermission = null;
        if (pending == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED)
            pending.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else pending.deny();
    }

    @Override public void onPause() { page.onPause(); super.onPause(); }
    @Override public void onResume() { super.onResume(); page.onResume(); }
    @Override public void onDestroy() {
        if (pendingAudioPermission != null) pendingAudioPermission.deny();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (page != null) page.destroy();
        super.onDestroy();
    }
}
