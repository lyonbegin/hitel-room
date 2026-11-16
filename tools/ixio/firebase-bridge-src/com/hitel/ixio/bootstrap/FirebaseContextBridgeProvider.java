package com.hitel.ixio.bootstrap;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.ContextWrapper;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * Isolated main-app startup test: keep the Android Firebase provider lifecycle,
 * but ensure its Context has a non-null applicationContext before FirebaseApp.
 * Does not patch Firebase SDK, IXIApplication, or AppSealing implementation.
 */
public final class FirebaseContextBridgeProvider extends ContentProvider {
    private static final String TAG = "HITEL_FB_BRIDGE";

    private static final class StableContext extends ContextWrapper {
        StableContext(Context parent) { super(parent); }
        @Override public Context getApplicationContext() { return this; }
    }

    @Override public boolean onCreate() {
        Context providerContext = getContext();
        if (providerContext == null) {
            Log.e(TAG, "PROVIDER_CONTEXT_NULL");
            return false;
        }
        Context appContext = providerContext.getApplicationContext();
        Log.i(TAG, "PROVIDER_CONTEXT=" + providerContext.getClass().getName()
                + " APP_CONTEXT_NULL=" + (appContext == null)
                + " RESOURCES_NULL=" + (providerContext.getResources() == null));
        Context initContext = appContext == null
                ? new StableContext(providerContext)
                : providerContext;
        try {
            Class<?> firebase = Class.forName("com.google.firebase.FirebaseApp");
            Method init = firebase.getMethod("initializeApp", Context.class);
            Object result = init.invoke(null, initContext);
            Log.i(TAG, "FIREBASE_INITIALIZE_RETURNED=" + (result != null));
        } catch (InvocationTargetException e) {
            Throwable target = e.getTargetException();
            Log.e(TAG, "FIREBASE_INITIALIZE_FAILED", target == null ? e : target);
        } catch (Throwable t) {
            Log.e(TAG, "FIREBASE_BRIDGE_FAILED", t);
        }
        // Preserve normal provider startup; IXIApplication.onCreate follows.
        return true;
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection,
                                  String[] selectionArgs, String sortOrder) {
        return null;
    }
    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection,
                                String[] selectionArgs) { return 0; }
}
