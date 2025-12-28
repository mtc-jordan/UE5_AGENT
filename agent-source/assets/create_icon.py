from PIL import Image, ImageDraw

# Create main icon (256x256)
size = 256
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw a rounded rectangle background
margin = 20
draw.rounded_rectangle(
    [margin, margin, size - margin, size - margin],
    radius=40,
    fill=(233, 69, 96, 255)  # Accent color
)

# Draw UE5 text
draw.text((size//2 - 50, size//2 - 30), "UE5", fill=(255, 255, 255, 255))
draw.text((size//2 - 30, size//2 + 10), "AI", fill=(255, 255, 255, 255))

img.save('icon.png')

# Create tray icon (32x32)
tray_size = 32
tray_img = Image.new('RGBA', (tray_size, tray_size), (0, 0, 0, 0))
tray_draw = ImageDraw.Draw(tray_img)

# Simple colored circle for tray
tray_draw.ellipse([2, 2, tray_size-2, tray_size-2], fill=(233, 69, 96, 255))

tray_img.save('tray-icon.png')

print("Icons created successfully!")
