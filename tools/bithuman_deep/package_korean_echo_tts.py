#!/usr/bin/env python3
"""Pin and package official Korean model and Android runtime during CI assembly."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request
import zipfile

MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-mimic3-ko_KO-kss_low.tar.bz2'
AAR_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.26/sherpa-onnx-static-link-onnxruntime-1.12.26.aar'


def package(app, plugin, report):
    assets = app / 'assets'
    assets.mkdir(exist_ok=True)
    raw = urllib.request.urlopen(MODEL_URL, timeout=120).read()
    source = tarfile.open(fileobj=io.BytesIO(raw), mode='r:bz2')
    members = [m for m in source.getmembers() if m.isfile()]
    model = next(m for m in members if m.name.endswith('.onnx') and '.int8.' not in m.name)
    root = model.name.rsplit('/', 1)[0] + '/'
    records = {}
    with zipfile.ZipFile(assets / 'hitel_ko_tts.zip', 'w', zipfile.ZIP_DEFLATED) as output:
        for member in members:
            if not member.name.startswith(root):
                continue
            relative = member.name[len(root):]
            if relative.startswith('/') or '..' in Path(relative).parts:
                raise ValueError('Unsafe official archive member')
            data = source.extractfile(member).read()
            records[relative] = hashlib.sha256(data).hexdigest()
            output.writestr(relative, data)
        assert 'tokens.txt' in records and any(n.startswith('espeak-ng-data/') for n in records)
        output.writestr('hitel-model.json', json.dumps({'model': model.name[len(root):]}))
    aar = urllib.request.urlopen(AAR_URL, timeout=120).read()
    original = zipfile.ZipFile(io.BytesIO(aar))
    native = [n for n in original.namelist() if n.startswith('jni/') and n.endswith('.so')]
    assert any('arm64-v8a/libsherpa-onnx-jni.so' in n for n in native), native
    maven = app / 'android/local-sdk-maven/ai/hitel/local/sherpa-onnx/1.12.26'
    maven.mkdir(parents=True, exist_ok=True)
    # Use the avatar's existing C++ runtime once; keep sherpa/ONNX statically linked.
    with zipfile.ZipFile(maven / 'sherpa-onnx-1.12.26.aar', 'w') as output:
        for name in original.namelist():
            if name.endswith('/libc++_shared.so'):
                continue
            output.writestr(name, original.read(name))
    (maven / 'sherpa-onnx-1.12.26.pom').write_text(
        '<project><modelVersion>4.0.0</modelVersion><groupId>ai.hitel.local</groupId>'
        '<artifactId>sherpa-onnx</artifactId><version>1.12.26</version><packaging>aar</packaging></project>')
    build = app / 'android/build.gradle.kts'
    s = build.read_text()
    anchor = 'content { includeGroup("ai.hitel.reassembled") }'
    assert s.count(anchor) == 1
    build.write_text(s.replace(anchor,
        'content { includeGroup("ai.hitel.reassembled"); includeGroup("ai.hitel.local") }'))
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        'model_url': MODEL_URL, 'model_archive_sha256': hashlib.sha256(raw).hexdigest(),
        'model_members_sha256': records, 'aar_url': AAR_URL,
        'aar_sha256': hashlib.sha256(aar).hexdigest(), 'aar_native_members': native,
    }, indent=2) + '\n')
    print('PASS_KOREAN_TTS_MODEL_AND_STATIC_ONNX_ANDROID_AAR_PACKAGED')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    for name in ('app', 'plugin', 'report'):
        p.add_argument('--' + name, type=Path, required=True)
    a = p.parse_args()
    package(a.app, a.plugin, a.report)
