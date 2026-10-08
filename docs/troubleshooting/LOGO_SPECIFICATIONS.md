# Logo Specifications for WhatsApp SaaS Platform

## 1. Landing Page Header (Top Navigation)
- **Display Size**: 40px × 40px
- **Source Size**: 80px × 80px (2x for retina displays)
- **Aspect Ratio**: 1:1 (Square)
- **Format**: PNG with transparent background
- **File Location**: `client/public/logo-header.png`
- **Usage**: Top navigation bar on landing page

## 2. Sidebar Header (Where "WhatsApp API" text shows)
- **Display Size**: 32px height × auto width
- **Source Size Options**:
  - **Horizontal Logo**: 128px × 32px (4:1 ratio) - Recommended
  - **Square Logo**: 64px × 64px (1:1 ratio)
- **Format**: PNG with transparent background
- **File Location**: `client/public/logo.png`
- **Usage**: Sidebar header in authenticated pages

## File Recommendations

### For Landing Page Header:
- **File Name**: `logo-header.png`
- **Dimensions**: 80px × 80px
- **Format**: PNG-24 with transparency
- **Max File Size**: < 30KB
- **Background**: Transparent

### For Sidebar Header:
- **File Name**: `logo.png`
- **Dimensions**: 
  - Horizontal: 128px × 32px (or 256px × 64px for 2x)
  - Square: 64px × 64px (or 128px × 128px for 2x)
- **Format**: PNG-24 with transparency
- **Max File Size**: < 25KB
- **Background**: Transparent

## Quick Reference

| Location | Display | Source (1x) | Source (2x) | File Name |
|----------|---------|-------------|-------------|-----------|
| Landing Header | 40×40px | 40×40px | 80×80px | `logo-header.png` |
| Sidebar Header | 32px h | 64×64px | 128×128px | `logo.png` |
| Sidebar Header (Horizontal) | 32px h | 128×32px | 256×64px | `logo.png` |

## Design Tips

1. **Keep it simple**: Logos should be recognizable at small sizes
2. **High contrast**: Ensure logo is visible on both light and dark backgrounds
3. **Test on both themes**: Your app supports light/dark mode
4. **Optimize file size**: Use tools like TinyPNG to compress without quality loss
5. **Vector option**: Consider SVG format for scalability (if supported)

## Implementation Notes

- Landing page logo is currently using an icon placeholder (`MessageSquare` icon)
- Sidebar logo is commented out in the code - uncomment to use
- Both locations support transparent backgrounds
- Logos should work well with the primary theme color

