# PDF Parser Testing Guide

## Overview
The PDF parser has been completely rewritten with a **dual-mode parsing strategy**:
1. **Form Field Extraction** (Primary) - For D&D Beyond fillable PDFs
2. **Text Extraction Fallback** (Secondary) - For other PDF types

For qualifier/defense action-log validation, use the separate checklist:
- [DMG/NEC Qualifier + Defense Log Smoke Checklist](QUALIFIER_SMOKE_CHECKLIST.md)

## Pre-Testing Checklist
- [ ] Parser code has no errors (verified)
- [ ] Dual-mode conditional logic is correct (verified)
- [ ] Data structures properly initialized (verified)
- [ ] JavaScript console will be your best friend

## Testing Steps

### Step 1: Open the Application
1. Open Flyover Flowchart in your browser
2. Open Developer Tools: Press `F12` on Windows
3. Go to the **Console** tab

### Step 2: Import Your D&D Beyond PDF
1. Click the **"Import PDF"** button
2. Select your D&D Beyond character PDF (e.g., `user data/character.pdf`)
3. Watch the console for output

### Step 3: Check Form Field Detection
Look for these console messages:

**SUCCESS (Form Fields Found):**
```
[PDF Parser] Attempting to extract form field data...
[PDF Parser] Found form fields: X
[PDF Parser] Form field values:
  "field_name" = "field_value"
  ...
[PDF Parser] ✓ Successfully extracted form field data
```

**FALLBACK (No Form Fields):**
```
[PDF Parser] Attempting to extract form field data...
[PDF Parser] No form fields found in PDF
[PDF Parser] Attempting text extraction...
[PDF Parser] Extracted X pages from PDF
```

### Step 4: Verify Extracted Data
Check the console for the "Parsed data:" log which should show:

```javascript
Character: {
  name: "Character Name",
  class: "Rogue",
  level: 5,
  race: "Human",
  background: "Criminal"
}
Combat: {
  ac: 15,
  hp: 32,
  profBonus: 2,
  speed: 30
}
Ability Scores: {
  strength: { score: 8, modifier: -1 },
  dexterity: { score: 16, modifier: +3 },
  constitution: { score: 12, modifier: +1 },
  intelligence: { score: 14, modifier: +2 },
  wisdom: { score: 13, modifier: +1 },
  charisma: { score: 10, modifier: 0 }
}
```

### Step 5: Verify localStorage Storage
In the console, run:
```javascript
console.log(localStorage.getItem('char_01'))
```

You should see your character data as JSON.

### Step 6: Verify UI Display
1. The **Character PDF Info** window should display:
   - Character name
   - Class & Level
   - Race & Background
   - AC, HP, Speed, Proficiency Bonus
   - All 6 ability scores with modifiers

### Step 7: Verify Character Applied to Flowchart
1. Check that the flowchart now shows your character's stats
2. Verify abilities are calculated correctly from ability scores

## Troubleshooting

### Issue: Getting field labels as character names
**Cause:** Form field extraction failed, fell back to text extraction  
**Solution:** Check console for form field errors. May need to adjust field name patterns.

### Issue: Character name is "Unknown"
**Cause:** Text extraction didn't find valid character name  
**Solution:** 
1. Check console logs for "Name search" entries
2. May need to rename character in D&D Beyond PDF
3. Use the manual character import form as fallback

### Issue: No ability scores extracted
**Cause:** Form field extraction didn't find ability score fields, OR text extraction couldn't locate them  
**Solution:**
1. If form fields: Check if D&D Beyond uses different field names (log shows actual field names)
2. If text extraction: May need manual entry or PDF structure adjustment

### Issue: Speed stuck at "30 ft"
**Cause:** Speed field not found in form OR text extraction  
**Solution:** Same as above - check console for which parsing method is being used

### Issue: HP showing 0 or null
**Cause:** Hit Points field not extracted properly  
**Solution:** 
1. Verify HP value exists in PDF
2. Check form field names vs fuzzy matching patterns
3. May need to adjust field name detection

## Console Debug Commands

Get the last parsed character:
```javascript
JSON.parse(localStorage.getItem('char_01'))
```

List all temporary characters:
```javascript
JSON.parse(localStorage.getItem('temp_characters'))
```

Clear all temp characters (WARNING - destructive):
```javascript
localStorage.removeItem('temp_characters');
for(let i=1; i<=99; i++) localStorage.removeItem(`char_${String(i).padStart(2,'0')}`);
```

## Expected Parsing Methods

### Form Field Extraction (D&D Beyond)
- **Method:** `parseFormFields()`
- **Indicator:** `parseMethod: 'form_fields'` in metadata
- **Speed:** Fast
- **Accuracy:** High (reads actual form field values)
- **Coverage:** All D&D 5e character fields

### Text Extraction (Other PDFs)
- **Method:** `parseCharacterSection()`, `parseAbilityScores()`, `parseCombatSection()`
- **Indicator:** `parseMethod: 'text_extraction'` in metadata
- **Speed:** Slower (depends on PDF complexity)
- **Accuracy:** Moderate (depends on PDF structure)
- **Coverage:** Basic character info, ability scores, combat stats

## Success Indicators

✅ Character name appears correctly  
✅ Class and level match character sheet  
✅ All ability scores extracted (not null)  
✅ AC shows correct value  
✅ HP shows max value  
✅ Speed shows correct value  
✅ Data stored in localStorage as char_01  
✅ Character applied to flowchart  

## Next Steps If Issues Occur

1. **Check if it's a form field issue:**
   - Console should show actual field names
   - Adjust fuzzy matching patterns in parseFormFields() if needed

2. **Check if it's a text extraction issue:**
   - Look at PDF structure using PDF Inspector tool
   - May need to adjust text parsing logic

3. **Use manual import as temporary workaround:**
   - Open character_import_manual.html
   - Manually enter character data
   - Character will be saved to localStorage

## Contact/Debug Info to Collect

If parser doesn't work, collect:
1. Full console output (take a screenshot)
2. Character PDF itself (optional but helpful)
3. Output of `localStorage.getItem('char_01')`
