$docxPath = 'd:\Projet YEHI OR Tech\Academia Hub Web\academia-helm-portails.docx'
$outputPath = 'd:\Projet YEHI OR Tech\Academia Hub Web\scratch\portails_text.txt'
$tempDir = 'd:\Projet YEHI OR Tech\Academia Hub Web\scratch\docx_temp'

if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($docxPath, $tempDir)
    
    $xmlPath = Join-Path $tempDir 'word/document.xml'
    if (Test-Path $xmlPath) {
        $xml = [xml](Get-Content $xmlPath)
        $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
        $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        
        $nodes = $xml.SelectNodes('//w:t', $ns)
        $text = ""
        foreach ($node in $nodes) {
            $text += $node.InnerText + " "
        }
        $text | Out-File -FilePath $outputPath -Encoding utf8
        Write-Output "Text extracted to $outputPath"
    } else {
        Write-Error "word/document.xml not found"
    }
} finally {
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
}
