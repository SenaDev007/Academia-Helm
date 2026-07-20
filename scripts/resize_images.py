"""Resize images to smaller dimensions to avoid timeout."""
import os
from PIL import Image

SRC_DIR = "/home/z/my-project/scripts/pdf_images_small"
DST_DIR = "/home/z/my-project/scripts/pdf_images_tiny"
os.makedirs(DST_DIR, exist_ok=True)

MAX_LONG_SIDE = 900  # px - even smaller

for sub in os.listdir(SRC_DIR):
    src_sub = os.path.join(SRC_DIR, sub)
    dst_sub = os.path.join(DST_DIR, sub)
    os.makedirs(dst_sub, exist_ok=True)
    if not os.path.isdir(src_sub):
        continue
    for f in sorted(os.listdir(src_sub)):
        if not f.endswith(".png"):
            continue
        img = Image.open(os.path.join(src_sub, f))
        if img.mode == "RGBA":
            img = img.convert("RGB")
        w, h = img.size
        scale = min(1.0, MAX_LONG_SIDE / max(w, h))
        if scale < 1.0:
            img = img.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
        # Save as JPEG to reduce size further
        out_path = os.path.join(dst_sub, f.replace(".png", ".jpg"))
        img.save(out_path, "JPEG", quality=80, optimize=True)
        print(f"saved {out_path} ({img.size[0]}x{img.size[1]}, {os.path.getsize(out_path)//1024}KB)")

print("DONE")
