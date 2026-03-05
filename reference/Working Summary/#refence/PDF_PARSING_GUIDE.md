# D&D Beyond PDF Parsing Diagnostic Guide

## Issues We're Facing
- No character name, class, race, or background being extracted
- Only ability scores and combat stats are null
- Speed defaults to 30ft (fallback value)
- Field labels like "ABILITY" are being picked up instead of actual data

## Step 1: Check PDF Structure
Import your PDF and check the browser console (F12 → Console tab). Look for:

```
[PDF Parser] === RAW PDF CONTENT (ALL ITEMS) ===
Page 1 (XXX items):
[0] "..." @ (x:123, y:456)
[1] "..." @ (x:234, y:567)
```

### Key Questions:
1. **How many items are in the PDF?** (if < 50, PDF might be image-based)
2. **Can you see actual character data?** (name, class, ability scores as numbers)
3. **Do you see repeating patterns?** (field labels, then values)

## Step 2: Identify Common Issues

### Issue A: PDF is Image-Based (OCR Required)
**Symptom:** Very few items, mostly gibberish
**Solution:** D&D Beyond's default export is usually text-based, but older versions or certain exports might be images
**Fix:** Use a proper OCR library or export as text from D&D Beyond

### Issue B: PDF Has Different Structure
**Symptom:** You see character data in console but it's in unexpected positions
**Solution:** D&D Beyond changed PDF format, or there are multiple page types
**Fix:** Share console output so we can see actual data structure

### Issue C: Text is Unreadable (Encoding/Font Issues)
**Symptom:** Items show as empty strings or special characters
**Solution:** PDF might use custom fonts or be corrupted
**Fix:** Try exporting fresh from D&D Beyond

## Step 3: What to Look For in Console

### Good Sign:
```
[0] "Aragorn" @ (x:150, y:750)
[1] "Fighter" @ (x:300, y:730)
[2] "5" @ (x:400, y:730)
[3] "Human" @ (x:150, y:700)
[4] "Strength" @ (x:150, y:650)
[5] "18" @ (x:300, y:650)
```

### Bad Sign:
```
[0] "CLASS & LEVEL" @ (x:150, y:750)
[1] "BACKGROUND" @ (x:300, y:730)
[2] "ABILITY" @ (x:400, y:700)
(... mostly field labels, no actual values ...)
```

## Step 4: References & Resources

### D&D Beyond Resources
- **Official D&D Beyond:** https://www.dndbeyond.com/
- **API Docs:** D&D Beyond has an unofficial API but it requires authentication
- **PDF Export Settings:** Check if D&D Beyond has options for "text-based" vs "image-based" export

### PDF.js Library
- **Documentation:** https://mozilla.github.io/pdf.js/
- **Text Extraction:** We're using `getTextContent()` which works well for text-based PDFs
- **Known Limitations:** Can struggle with complex layouts, multi-column text, rotated text

### Alternative Parsing Libraries
- **pdfminer** (Python) - More robust for complex PDFs
- **PyPDF2** - Python PDF toolkit
- **tabula-py** - Specifically for table extraction

### D&D Character Data Standards
- **5e SRD:** https://5e.tools/
- **Character Sheet Format:** Standard D&D 5e sheets have consistent field positions
- **JSON Export:** D&D Beyond can output JSON directly (check export options)

## Step 5: Practical Next Steps

### Option A: Dump Raw PDF (Recommended First Step)
1. Open browser devtools (F12)
2. Go to Console tab
3. Import your PDF
4. **Copy the console output** showing all raw items
5. Share it with me - I'll see exactly what data exists

### Option B: Check PDF Type
Open the PDF with a text editor or:
```powershell
# Check if PDF is searchable (text-based)
Get-Content "chain_warden.pdf" | Select-String "Fighter" -List
```
If you get results, it's text-based. If nothing, it's image-based.

### Option C: Export Alternatives from D&D Beyond
- Try exporting as **JSON** instead of PDF (if available)
- Check export settings for "Include all data" or similar
- Try "Print to PDF" instead of direct export

### Option D: Manual Fallback
If PDF parsing proves unreliable:
- Create a simple character import form (name, class, level, race, etc.)
- Let users enter data manually or copy-paste from D&D Beyond
- Use PDF export as supplementary (for artwork, background story)

## Step 6: Actual Detection Logic

Once we see the raw data, we can:
1. Identify where character data actually is
2. Find the correct positional relationships (which fields are horizontally/vertically aligned)
3. Build pattern matching based on ACTUAL structure, not assumptions

## Quick Diagnostic Command

When you import a PDF, watch for this in console:
```javascript
// Check if PDF has any readable text
if (pages[0].items.filter(i => i.str.length > 2).length < 10) {
  console.warn('PDF appears to be mostly empty - possibly image-based');
}

// Check for any numbers (ability scores, AC, HP)
const numbers = pages[0].items.filter(i => /^\d+$/.test(i.str));
console.log('Found numbers:', numbers.map(n => n.str).join(', '));
```

## Next Action
Run the import now with the updated code, check the console for the RAW PDF CONTENT section, and share what you see. That will tell us exactly what we're working with.
