package com.hitel.zocbodiag;

import java.io.File;
import java.io.InputStream;
import java.io.IOException;

/** Connect only to a trusted, independently authorized offline document source.
 * The renderer adapter must be invoked on its required thread by the host.
 */
public final class OfflinePdfController {
    public interface Renderer {
        void open(File file, String title) throws IOException;
    }
    private final OfflinePdfStore store;
    public OfflinePdfController(OfflinePdfStore store) { this.store = store; }
    public void received(OfflinePdfStore.Grant grant, InputStream pdf, boolean viewerEnabled,
                         long now, Renderer renderer) throws IOException {
        OfflinePdfStore.Document d = store.save(grant, pdf, now);
        if (viewerEnabled) renderer.open(d.pdf, d.title);
    }
    public void reopen(String account, String id, long now, Renderer renderer) throws IOException {
        OfflinePdfStore.Document d = store.open(account, id, now);
        renderer.open(d.pdf, d.title);
    }
}
