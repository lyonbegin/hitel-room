# Download all 25 original JavaScript assets referenced by the user's previousExam.asp HTML.
# No credentials, cookies, logins, HAR or API requests are needed.
# PowerShell 5.1+, Windows, read-only HTTP GET only.
$ErrorActionPreference = 'Stop'
$paths = @(
    '/cloudfront/js/app/vendors/jquery-3.7.1.min.js',
    '/cloudfront/js/app/vendors/swiper-bundle.min.js',
    '/cloudfront/js/app/ui.js',
    '/cloudfront/js/app/ui-swiper.js',
    '/js/conf/config.js?20261118170001',
    '/js/common/common.js?20261118170001',
    '/js/common/storage.js?20261118170001',
    '/js/common/appLink.js?20261118170001',
    '/js/common/track.js?20261118170001',
    '/js/common/appPageHijacking.js?20261118170001',
    '/js/common/menu.js?20261118170001',
    '/js/common/openMonth.js?20261118170001',
    '/js/app/include/config.js?20261118170001',
    '/js/member/loginPop.js?20261118170001',
    '/Common/Js/Hierarchy.js?20261118170001',
    '/js/common/comm.js?20261118170001',
    '/js/common/util.js?20261118170001',
    '/js/alarm/push.js?20261118170001',
    '/js/exam/storageBox.js?20261118170001',
    '/Common/ExamDownload/Download_New.js?20261118170001',
    '/js/exam/previousexam.js?20261118170001',
    '/js/exam/examList/common.js?20261118170001',
    '/js/exam/examList/Exam.js?20261118170001',
    '/js/app/include/modal.js?20261118170001',
    '/js/app/include/bottomSheetLayer.js?20261118170001'
)
$folder = Join-Path (Join-Path $env:USERPROFILE 'Downloads') ("zocbo_js_$(Get-Date -Format 'yyyyMMdd_HHmmss')")
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$reports = New-Object 'System.Collections.Generic.List[object]'
foreach ($path in $paths) {
    $destRel = ([Uri]("https://m.zocbo.com"+$path)).AbsolutePath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $dest = Join-Path $folder $destRel
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($dest)) -Force | Out-Null
    $report = [ordered]@{path=$path; saved=$false; url=''; size=0; sha256=''; error=''}
    foreach ($hostname in @('m.zocbo.com','www.zocbo.com')) {
        $url = "https://$hostname$path"
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -TimeoutSec 20 -UseBasicParsing -Headers @{Referer='https://m.zocbo.com/exam/school/previousExam.asp'} -ErrorAction Stop
            $bytes = [IO.File]::ReadAllBytes($dest)
            $head = [Text.Encoding]::UTF8.GetString($bytes,0,[Math]::Min(60,$bytes.Length)).TrimStart().ToLowerInvariant()
            if ($bytes.Length -eq 0 -or $head.StartsWith('<!doctype html') -or $head.StartsWith('<html')) { throw 'Received an HTML page, not JS' }
            $report.saved=$true
            $report.url=$url
            $report.size=$bytes.Length
            $report.sha256=(Get-FileHash -Path $dest -Algorithm SHA256).Hash
            break
        } catch {
            $report.error="$hostname : $($_.Exception.Message)"
            Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
        }
    }
    $reports.Add([pscustomobject]$report)
    Write-Host ("[{0}/{1}] {2}: {3}" -f $reports.Count,$paths.Count, $(if($report.saved){'OK'}else{'FAILED'}),$path)
}
$reports | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $folder 'download_status.json') -Encoding UTF8
$zip="$folder.zip"
Compress-Archive -Path (Join-Path $folder '*') -DestinationPath $zip -Force
Write-Host "Downloaded $(@($reports | Where-Object {$_.saved}).Count) / $($paths.Count) files"
Write-Host "ZIP saved: $zip"
