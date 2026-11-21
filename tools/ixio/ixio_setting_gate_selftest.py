#!/usr/bin/env python3
"""Generate an emulator-only runtime test for every original singleton destination."""
from pathlib import Path
import argparse, json, re

ROOT = 'Lcom/lguplus/aicallagent/navigation/SettingDestination;'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--smali18', type=Path, required=True)
    p.add_argument('--java', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    a = p.parse_args(); names = []
    directory = a.smali18 / 'com/lguplus/aicallagent/navigation'
    for path in sorted(directory.glob('SettingDestination$*.smali')):
        src = path.read_text(encoding='utf-8')
        if '.super ' + ROOT not in src:
            continue
        desc = re.search(r'(?m)^\.class[^\n]* (L[^;]+;)', src)
        if not desc:
            continue
        if re.search(r'(?m)^\.field[^\n]*\bstatic\b[^\n]* INSTANCE:' + re.escape(desc[1]) + r'\s*$', src):
            names.append(desc[1][1:-1].replace('/', '.'))
    if len(names) < 2:
        raise RuntimeError('Expected multiple original singleton settings destinations')
    literals = ',\n            '.join(json.dumps(n) for n in names)
    source = '''package com.lguplus.aicallagent.hitelqa;
import android.os.Build;
import java.lang.reflect.Method;
public final class GateSelfTest {
    private static boolean ran;
    private static int verified;
    public static synchronized void run() {
        if (!("ranchu".equals(Build.HARDWARE) || "goldfish".equals(Build.HARDWARE))) return;
        if (ran) {
            if (verified > 0) DiagTrace.fixedTag("IXIO_GATE_SELFTEST", "ALL_SETTING_PREDICATES_SELFTEST_VERIFIED=" + verified);
            return;
        }
        ran = true;
        try {
            Class<?> destination = Class.forName("com.lguplus.aicallagent.navigation.SettingDestination");
            Class<?> gate = Class.forName("com.lguplus.aicallagent.hitelqa.ModelCatalogQaTrace");
            Method method = gate.getMethod("blockingVasError", boolean.class, destination);
            String[] names = new String[] {
            __DESTINATIONS__
            };
            for (String name : names) {
                Object value = Class.forName(name).getField("INSTANCE").get(null);
                if (!Boolean.FALSE.equals(method.invoke(null, Boolean.TRUE, value)))
                    throw new IllegalStateException("Original VAS error still blocks " + name);
                if (!Boolean.FALSE.equals(method.invoke(null, Boolean.FALSE, value)))
                    throw new IllegalStateException("Non-error predicate changed " + name);
            }
            if (!Boolean.TRUE.equals(method.invoke(null, Boolean.TRUE, null)))
                throw new IllegalStateException("Null-destination behavior changed");
            verified = names.length;
            DiagTrace.fixedTag("IXIO_GATE_SELFTEST", "ALL_SETTING_PREDICATES_SELFTEST_VERIFIED=" + verified);
        } catch (Throwable error) {
            DiagTrace.fixedTag("IXIO_GATE_SELFTEST", "ALL_SETTING_PREDICATES_SELFTEST_FAILED=" + error.getClass().getSimpleName());
        }
    }
}
'''.replace('__DESTINATIONS__', literals)
    a.java.parent.mkdir(parents=True, exist_ok=True)
    a.java.write_text(source, encoding='utf-8')
    a.report.write_text(json.dumps({'emulator_only': True, 'singleton_count': len(names),
        'destinations': names, 'app_state_changed': False,
        'tests_only_compiled_predicate_return_values': True}, indent=2), encoding='utf-8')
    print('ORIGINAL_SETTING_PREDICATE_RUNTIME_TEST_CASES', len(names), flush=True)

if __name__ == '__main__':
    main()
