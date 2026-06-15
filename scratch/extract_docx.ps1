$path = 'd:\Projet YEHI OR Tech\Academia Hub Web\academia-helm-portails.docx'
$temp = Join-Path $env:TEMP (New-Guid).ToString()
Expand-Archive -Path $path -DestinationPath $temp
$xml = [xml](Get-Content (Join-Path $temp 'word/document.xml'))
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$nodes = $xml.SelectNodes('//w:t', $ns)
$text = ""
foreach ($node in $nodes) {
    $text += $node.InnerText + " "
}
Write-Output $text
Remove-Item -Path $temp -Recurse -Force
