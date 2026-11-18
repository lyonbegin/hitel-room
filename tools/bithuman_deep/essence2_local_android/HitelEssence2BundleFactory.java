package ai.bithuman.flutter;

import ai.bithuman.elevate.Essence2ModelStore;
import java.io.File;

/**
 * JVM ABI bridge to the ORIGINAL Essence2ModelStore.Bundle constructor.
 *
 * The upstream SDK marks its three-parameter Kotlin constructor 'internal'
 * in Kotlin metadata, although the actual JVM method is public, as verified
 * by javap on the unmodified published Android SDK 0.9.5 classes.jar.
 * Java can call that published JVM constructor without reflection, bytecode
 * replacement, or changes to the original native SDK.
 */
public final class HitelEssence2BundleFactory {
    private HitelEssence2BundleFactory() {}

    public static Essence2ModelStore.Bundle fromVerifiedOriginalAndroidFiles(
            String code, File directory, int donorCount) {
        if (code == null || code.isEmpty() || directory == null || donorCount <= 0) {
            throw new IllegalArgumentException("Invalid verified Android model bundle");
        }
        if (!directory.isDirectory()) {
            throw new IllegalArgumentException("Original Android bundle directory missing");
        }
        return new Essence2ModelStore.Bundle(code, directory, donorCount);
    }
}
