import zipfile
import xml.etree.ElementTree as ET
import os

def docx_to_text(path):
    try:
        with zipfile.ZipFile(path, 'r') as zip_ref:
            xml_content = zip_ref.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            # Namespace for wordprocessingML
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text = []
            for paragraph in tree.findall('.//w:p', ns):
                texts = paragraph.findall('.//w:t', ns)
                if texts:
                    text.append(''.join([t.text for t in texts]))
            
            return '\n'.join(text)
    except Exception as e:
        return f"Error: {e}"

file_path = r'd:\Projet YEHI OR Tech\Academia Hub Web\academia-helm-portails.docx'
if os.path.exists(file_path):
    print(docx_to_text(file_path))
else:
    print(f"File not found: {file_path}")
