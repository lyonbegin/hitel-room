package com.hitel.zocbodiag;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class PaperFreshness {
  private static long httpDate(String value) {
    if (value == null) return -1;
    try {
      SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US);
      format.setTimeZone(TimeZone.getTimeZone("GMT"));
      format.setLenient(false);
      Date date = format.parse(value);
      return date == null ? -1 : date.getTime();
    } catch (Exception e) { return -1; }
  }
  private static long seconds(String value) {
    return Math.min(Integer.MAX_VALUE, Long.parseLong(value.trim().replace("\"", ""))) * 1000L;
  }
  static long deadline(String control, String expires, String date, String age, long now) {
    long dateMs = httpDate(date);
    long elapsed = dateMs < 0 ? 0 : Math.max(0, now - dateMs);
    try {
      if (age != null) elapsed = Math.max(elapsed, seconds(age));
      long ttl = -1;
      for (String directive : control.toLowerCase(Locale.US).split(",")) {
        String[] kv = directive.trim().split("=", 2);
        String key = kv[0].trim();
        if ("no-store".equals(key) || "no-cache".equals(key)) return 0;
        if ("max-age".equals(key)) {
          if (kv.length != 2) return 0;
          long value = seconds(kv[1]);
          if (value < 0 || ttl >= 0) return 0;
          ttl = value;
        }
      }
      if (ttl >= 0) return now + Math.max(0, ttl - elapsed);
      if (expires != null) {
        long end = httpDate(expires);
        return end < 0 ? 0 : now + Math.max(0, end - (dateMs < 0 ? now : dateMs) - elapsed);
      }
      if (control.toLowerCase(Locale.US).contains("must-revalidate")) return 0;
      return Long.MAX_VALUE;
    } catch (RuntimeException e) { return 0; }
  }
}
