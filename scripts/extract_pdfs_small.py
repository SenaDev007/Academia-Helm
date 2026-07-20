"""Re-render PDFs at smaller scale to fit vision model limits."""
import os
import pypdfium2 as pdfium
from PIL import Image

UPLOAD_DIR = "/home/z/my-project/upload"
OUTPUT_DIR = "/home/z/my-project/scripts/pdf_images_small"
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

MAX_LONG_SIDE = 1400  # px

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
            # Render at scale 1.5 first
            pil_image = page.render(scale=1.5).to_pil()
            # Resize to ensure long side <= 1400px
            w, h = pil_image.size
            scale = min(1.0, MAX_LONG_SIDE / max(w, h))
            if scale < 1.0:
                pil_image = pil_image.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
            out_path = os.path.join(out_subdir, f"page_{i+1}.png")
            # Save as JPEG quality 85 to reduce size
            if pil_image.mode == "RGBA":
                pil_image = pil_image.convert("RGB")
            pil_image.save(out_path, "PNG", optimize=True)
            print(f"  saved {out_path} ({pil_image.size[0]}x{pil_image.size[1]})")
        pdf.close()
    except Exception as e:
        print(f"ERROR on {pdf_name}: {e}")

print("\nDONE")
