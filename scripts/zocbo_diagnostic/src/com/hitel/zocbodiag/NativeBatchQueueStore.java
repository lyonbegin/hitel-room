package com.hitel.zocbodiag;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/** Durable queue for a single account. Import and recovery must occur while the pool is stopped. */
public final class NativeBatchQueueStore extends SQLiteOpenHelper implements NativeFiveWorkerPool.Store {
    private final String owner;
    public NativeBatchQueueStore(Context context, String accountId) {
        super(context.getApplicationContext(), "hitel_native_batch_v1.db", null, 1);
        if (accountId == null || accountId.trim().isEmpty()) throw new IllegalArgumentException("account required");
        owner = accountId;
    }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE jobs (seq INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, exam TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'QUEUED', detail TEXT NOT NULL DEFAULT '', UNIQUE(owner,exam))");
        db.execSQL("CREATE INDEX jobs_queue ON jobs(owner,state,seq)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("migration required");
    }
    public synchronized long importJsonl(InputStream input) throws Exception {
        if (input == null) throw new IllegalArgumentException("input");
        SQLiteDatabase db = getWritableDatabase();
        long inserted = 0;
        int lines = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            db.beginTransaction();
            try {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().isEmpty()) continue;
                    JSONObject response = new JSONObject(line).optJSONObject("response");
                    JSONArray list = response == null ? null : response.optJSONArray("list");
                    if (list != null) for (int i = 0; i < list.length(); ++i) {
                        JSONObject row = list.optJSONObject(i);
                        String id = row == null ? "" : row.optString("expapr_no", "");
                        if (!id.matches("[1-9][0-9]{0,9}")) continue;
                        try { Integer.parseInt(id); } catch (NumberFormatException e) { continue; }
                        ContentValues v = new ContentValues();
                        v.put("owner", owner); v.put("exam", id); v.put("state", "QUEUED");
                        if (db.insertWithOnConflict("jobs", null, v, SQLiteDatabase.CONFLICT_IGNORE) != -1) ++inserted;
                    }
                    if (++lines % 200 == 0) {
                        db.setTransactionSuccessful(); db.endTransaction(); db.beginTransaction();
                    }
                }
                db.setTransactionSuccessful();
            } finally { if (db.inTransaction()) db.endTransaction(); }
        }
        return inserted;
    }
    @Override public synchronized String claim() {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            String id = null;
            try (Cursor c = db.rawQuery("SELECT exam FROM jobs WHERE owner=? AND state='QUEUED' ORDER BY seq LIMIT 1", new String[]{owner})) {
                if (c.moveToFirst()) id = c.getString(0);
            }
            if (id != null) {
                ContentValues v = new ContentValues(); v.put("state", "RUNNING");
                if (db.update("jobs", v, "owner=? AND exam=? AND state='QUEUED'", new String[]{owner,id}) != 1)
                    throw new IllegalStateException("claim changed");
            }
            db.setTransactionSuccessful();
            return id;
        } finally { db.endTransaction(); }
    }
    @Override public synchronized void complete(String id, NativeFiveWorkerPool.Result result, String detail) {
        ContentValues v = new ContentValues(); v.put("state", result.name()); v.put("detail", detail == null ? "" : detail);
        if (getWritableDatabase().update("jobs", v, "owner=? AND exam=? AND state='RUNNING'", new String[]{owner,id}) != 1)
            throw new IllegalStateException("completion changed");
    }
    /** After process restart: mark interrupted work for explicit reconciliation, not blind replay. */
    public synchronized int recoverInterrupted() {
        ContentValues v = new ContentValues(); v.put("state", "INTERRUPTED"); v.put("detail", "PROCESS_RESTART");
        return getWritableDatabase().update("jobs", v, "owner=? AND state='RUNNING'", new String[]{owner});
    }
    public synchronized long count(String state) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM jobs WHERE owner=? AND state=?", new String[]{owner,state})) {
            return c.moveToFirst() ? c.getLong(0) : 0;
        }
    }
}
