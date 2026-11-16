#!/usr/bin/env python3
"""
VFX Processing Utility for Ky Bien (Co Huyen Su)
Inspired by BeanFX & Ky Bien 2.5D Auto-chess standards.

Features:
- Clean black-background luminance / color-distance extraction to transparent RGBA.
- Automatic object bounding-box cropping with safe margin.
- Optional 2-layer split: Color layer (albedo) & Light layer (additive glow).
- Resizing tailored to auto-chess AoE cell dimensions.
- High-efficiency WebP export (< 150 KB).
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image

def extract_alpha(img: Image.Image, thresh: float = 16.0, boost: float = 1.2) -> Image.Image:
    """Extract transparent alpha channel from pure black background."""
    arr = np.array(img.convert('RGBA'), dtype=np.float32)
    max_c = np.max(arr[:, :, :3], axis=2)
    alpha = np.clip((max_c - thresh) / (255.0 - thresh) * 255.0 * boost, 0, 255)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr.astype(np.uint8))

def split_color_and_light(img_rgba: Image.Image, glow_thresh: float = 60.0):
    """
    Split into Color Layer (solid shapes/outlines) and Light Layer (soft additive glow).
    """
    arr = np.array(img_rgba, dtype=np.float32)
    alpha = arr[:, :, 3]
    
    # Color mask: areas with high contrast or solid alpha
    color_arr = np.copy(arr)
    light_arr = np.copy(arr)
    
    # Soft glowing pixels go to light layer
    is_core = alpha > glow_thresh
    
    color_arr[:, :, 3] = np.where(is_core, alpha, 0)
    light_arr[:, :, 3] = np.where(~is_core, alpha, alpha * 0.7)
    
    return Image.fromarray(color_arr.astype(np.uint8)), Image.fromarray(light_arr.astype(np.uint8))

def process_asset(
    input_path: str,
    output_path: str,
    target_width: int = None,
    target_height: int = None,
    split_layers: bool = False,
    thresh: float = 16.0,
    quality: int = 88
):
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    im = Image.open(input_path)
    print(f"Processing '{input_path}' ({im.size}, {im.mode})...")

    # Step 1: Alpha extraction
    im_rgba = extract_alpha(im, thresh=thresh)

    # Step 2: Auto crop bounding box
    bbox = im_rgba.getbbox()
    if bbox:
        im_rgba = im_rgba.crop(bbox)
        print(f"Cropped to bbox {bbox} -> New size: {im_rgba.size}")

    # Step 3: Resize if target dimension specified
    w, h = im_rgba.size
    if target_width and not target_height:
        target_height = int(target_width * h / w)
    elif target_height and not target_width:
        target_width = int(target_height * w / h)

    if target_width and target_height:
        im_rgba = im_rgba.resize((target_width, target_height), Image.Resampling.LANCZOS)
        print(f"Resized to target: ({target_width}, {target_height})")

    # Step 4: Save output
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    if split_layers:
        base, ext = os.path.splitext(output_path)
        color_img, light_img = split_color_and_light(im_rgba)
        
        p_color = f"{base}_color.webp"
        p_light = f"{base}_light.webp"
        color_img.save(p_color, 'WEBP', quality=quality, method=5)
        light_img.save(p_light, 'WEBP', quality=quality, method=5)
        print(f"Saved Color Layer: {p_color} ({os.path.getsize(p_color)/1024:.1f} KB)")
        print(f"Saved Light Layer: {p_light} ({os.path.getsize(p_light)/1024:.1f} KB)")
    else:
        im_rgba.save(output_path, 'WEBP', quality=quality, method=5)
        print(f"Saved WebP Asset: {output_path} ({os.path.getsize(output_path)/1024:.1f} KB)")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Ky Bien VFX Asset Processor")
    parser.add_argument("input", help="Path to input image file (e.g. raw AI output on black background)")
    parser.add_argument("output", help="Path to output webp file")
    parser.add_argument("--width", type=int, default=None, help="Target width in pixels")
    parser.add_argument("--height", type=int, default=None, help="Target height in pixels")
    parser.add_argument("--split", action="store_true", help="Split into _color and _light layers")
    parser.add_argument("--thresh", type=float, default=16.0, help="Black threshold for alpha keying")
    parser.add_argument("--quality", type=int, default=88, help="WebP compression quality (default 88)")

    args = parser.parse_args()
    process_asset(
        args.input,
        args.output,
        target_width=args.width,
        target_height=args.height,
        split_layers=args.split,
        thresh=args.thresh,
        quality=args.quality
    )
