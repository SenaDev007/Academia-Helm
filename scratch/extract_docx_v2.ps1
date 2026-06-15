$path = 'd:\Projet YEHI OR Tech\Academia Hub Web\academia-helm-portails.docx'
if (-not (Test-Path $path)) { Write-Error "File not found"; exit }
$temp = Join-Path $env:TEMP (New-Guid).ToString()
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($path, $temp)
    $xmlPath = Join-Path $temp 'word/document.xml'
    if (Test-Path $xmlPath) {
        $xml = [xml](Get-Content $xmlPath)
        $text = ($xml.GetElementsByTagName("w:t") | ForEach-Object { $_."#text" }) -join " "
        Write-Output $text
    } else {
        Write-Error "word/document.xml not found in docx"
    }
} finally {
    Remove-Item -Path $temp -Recurse -Force
}
