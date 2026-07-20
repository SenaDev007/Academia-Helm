"""Convert each uploaded PDF to PNG images for visual analysis."""
import os
import sys
import pypdfium2 as pdfium

UPLOAD_DIR = "/home/z/my-project/upload"
OUTPUT_DIR = "/home/z/my-project/scripts/pdf_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TARGET_PDFS = [
    "cahier journal.pdf",
    "Fiche mathématiques.pdf",
    "Fiche français.pdf",
    "Fiche EST.pdf",
    "Fiche Éducation Sociale.pdf",
    "Fiche EA.pdf",
    "Registre d appel.pdf",
    "Tableau de relevé mensuels pour l année scolaire.pdf",
]

for pdf_name in TARGET_PDFS:
    pdf_path = os.path.join(UPLOAD_DIR, pdf_name)
    if not os.path.exists(pdf_path):
        print(f"MISSING: {pdf_path}")
        continue
    safe_name = pdf_name.replace(" ", "_").replace(".pdf", "")
    out_subdir = os.path.join(OUTPUT_DIR, safe_name)
    os.makedirs(out_subdir, exist_ok=True)
    try:
        pdf = pdfium.PdfDocument(pdf_path)
        print(f"\n=== {pdf_name} : {len(pdf)} pages ===")
        for i, page in enumerate(pdf):
            pil_image = page.render(scale=2.0).to_pil()
            out_path = os.path.join(out_subdir, f"page_{i+1}.png")
            pil_image.save(out_path)
            print(f"  saved {out_path}")
        pdf.close()
    except Exception as e:
        print(f"ERROR on {pdf_name}: {e}")

print("\nDONE")
