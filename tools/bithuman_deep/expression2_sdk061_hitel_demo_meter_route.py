#!/usr/bin/env python3
"""Expression 2 0.6.1 isolated local debug study: preserve native code and
redirect only the JVM metering base URL to the owned HITEL HTTPS test service.
No use of production bitHuman credentials. Do not distribute as vendor SDK.
"""
import argparse
import io
import json
import zipfile
from pathlib import Path

from expression2_replace_original_meter_api_base_method import TARGET, replace_one_original_method
from expression2_replace_original_api_base_getter import checked_endpoint, repack_zip, sha

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source-aar',type=Path,required=True)
    p.add_argument('--output-aar',type=Path,required=True)
    p.add_argument('--report',type=Path,required=True)
    p.add_argument('--base-url',default='https://hitel-expression2-auth-production.up.railway.app')
    args=p.parse_args()
    endpoint=checked_endpoint(args.base_url,False)
    original=args.source_aar.read_bytes()
    with zipfile.ZipFile(io.BytesIO(original)) as z:
        names=z.namelist()
        original_jar=z.read('classes.jar')
        native=z.read('jni/arm64-v8a/libexpr2jni.so')
        litert=z.read('jni/arm64-v8a/libLiteRt.so')
        with zipfile.ZipFile(io.BytesIO(original_jar)) as j:
            class_names=j.namelist()
            source_class=j.read(TARGET)
    patched_class,details=replace_one_original_method(source_class,endpoint)
    new_jar=repack_zip(original_jar,TARGET,patched_class)
    new_aar=repack_zip(original,'classes.jar',new_jar)
    with zipfile.ZipFile(io.BytesIO(new_aar)) as z:
        assert z.namelist()==names
        assert z.read('jni/arm64-v8a/libexpr2jni.so')==native
        assert z.read('jni/arm64-v8a/libLiteRt.so')==litert
        with zipfile.ZipFile(io.BytesIO(new_jar)) as j:
            assert j.namelist()==class_names
            assert j.read(TARGET)==patched_class
            with zipfile.ZipFile(io.BytesIO(original_jar)) as origjar:
                for n in class_names:
                    if n!=TARGET: assert j.read(n)==origjar.read(n),n
        with zipfile.ZipFile(io.BytesIO(original)) as oz:
            for n in names:
                if n!='classes.jar': assert z.read(n)==oz.read(n),n
    args.output_aar.parent.mkdir(parents=True,exist_ok=True)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.output_aar.write_bytes(new_aar)
    result={
      'input_sdk':'official Maven Expression2 Android 0.6.1',
      'original_aar_sha256':sha(original),
      'test_aar_sha256':sha(new_aar),
      'original_native_sha256':sha(native),
      'native_changed_bytes':0,
      'litert_changed_bytes':0,
      'other_aar_entries_changed':0,
      'other_jar_entries_changed':0,
      'patched_jvm_methods':details['modified_jvm_methods'],
      'sample_only_hitel_https_test_base':endpoint,
      'original_sdk_vendor_entitlement_validated':False,
      'actual_model_frame_generated':False,
      'bytecode_proof':details
    }
    args.report.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print('SDK061_HITEL_TEST_METER_ENDPOINT_ONE_JVM_METHOD_ONLY_PASS')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
