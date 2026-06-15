$path = 'd:\Projet YEHI OR Tech\Academia Hub Web\academia-helm-portails.docx'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)
$zip.Entries | Select-Object FullName
$zip.Dispose()
