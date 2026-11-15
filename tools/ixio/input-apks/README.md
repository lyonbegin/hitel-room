# 익시오 APK 업로드 위치

GitHub 웹 브라우저 업로드 제한(파일당 25MiB) 때문에 99MB XAPK와 30MB APK는 아래 **GitHub Release** 화면에 드래그하여 올리시면 됩니다.

https://github.com/lyonbegin/hitel-room/releases/tag/ixio-input-20261115

"Edit release" → "Attach binaries" → 파일 두 개 선택 → "Update release"

파일 이름:
- `익시오_01.33.01.xapk`
- `익시오 통화녹음_02.02.00.apk`

이 폴더는 Git을 통한 직접 업로드 경로로도 사용할 수 있습니다. 분석용 Actions 워크플로가 **폴더 또는 Release 자산에서** 두 파일을 불러와 원본 SHA-256 검증 후 설치합니다.

원본 파일 해시:
- 익시오 메인 XAPK: `4ec4793327930e72589c1d47e552e1e77f97ccf77db71c63c701934f2337a3fc`
- 익시오 녹음 APK: `3cf822dda33eeef28ec3b85cb5872182371c92d07ed100e3a0fab71fbf1a37d7`
