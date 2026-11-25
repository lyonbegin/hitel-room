# R7 original native path restoration and independent local PDF storage

The tree is restored to the original R7 commit 0278f5cad2a5b9fe4463af49fcb051c36113f1f0. The later automatic WebView button discovery, attachment listener replacement and external MediaStore save are removed. Original viewer, native file handling, entitlement and cleanup are unchanged.

LocalStudyCache.java adds a separate storage component for documents explicitly selected through Android ACTION_OPEN_DOCUMENT. It writes to the application's private getFilesDir()/local_study_pdf, checks the PDF signature, caps storage per file, uses atomic writes, and can reopen an imported document without internet access. It does not use the native viewer's temporary files or alter retention or access restrictions. It is not yet wired to a UI, viewer toggle, or the original native viewer. No claim of a working app feature or signed APK is made.

The existing build branch and signing key are left unchanged. This is a source-only branch. The free-reading viewer's protected temporary files must not be treated as independently authorized offline documents.
