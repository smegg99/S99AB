#!/usr/bin/env python3
# scripts/overpass-metrics.py
#
# Writes web/src/assets/fonts/overpass-<subset>-wght-normal.woff2: fontsource's
# Overpass with its vertical metrics shifted and its spacing glyphs taken out of the marks.
# Needs Python 3 with fontTools and brotli. Run from the repository root.

from pathlib import Path

from fontTools.ttLib import TTFont

# WebKit ignores @font-face ascent-override, so the files carry the fix. 200 moves
# the line box's middle to a capital's (cap height 1400).
SHIFT = 200
SUBSETS = ('cyrillic-ext', 'cyrillic', 'vietnamese', 'latin-ext', 'latin')
MARK = 3
BASE = 1
# The mark side of each mark-attachment subtable, as (coverage, records):
# mark-to-base and mark-to-ligature, then mark-to-mark's attaching mark.
MARK_SIDES = (('MarkCoverage', 'MarkArray'), ('Mark1Coverage', 'Mark1Array'))


# Overpass classes U+00B7, the spacing accents and the dnom figures as marks, and
# a shaper gives a mark no advance. A mark with an advance becomes a base.
def spacing_marks(path):
    """The glyphs the font at path calls marks but gives an advance."""
    # A separate font: reading a table makes save recompile it and change its bytes.
    probe = TTFont(path)
    classes = probe['GDEF'].table.GlyphClassDef.classDefs
    advances = probe['hmtx'].metrics
    return sorted(g for g, c in classes.items() if c == MARK and advances[g][0])


def unmark(font, glyphs):
    """Make bases of glyphs: GDEF class 1, and off every lookup's mark side."""
    classes = font['GDEF'].table.GlyphClassDef.classDefs
    for glyph in glyphs:
        classes[glyph] = BASE
    for lookup in font['GPOS'].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, 'ExtSubTable', sub)
            for coverage, records in MARK_SIDES:
                if not hasattr(sub, coverage):
                    continue
                covered = getattr(sub, coverage).glyphs
                array = getattr(sub, records)
                keep = [i for i, g in enumerate(covered) if g not in glyphs]
                getattr(sub, coverage).glyphs = [covered[i] for i in keep]
                array.MarkRecord = [array.MarkRecord[i] for i in keep]
                array.MarkCount = len(keep)


source = Path('node_modules/@fontsource-variable/overpass')
target = Path('web/src/assets/fonts')
target.mkdir(parents=True, exist_ok=True)

for subset in SUBSETS:
    name = f'overpass-{subset}-wght-normal.woff2'
    path = source / 'files' / name
    # No new modified date, so a second run writes the same bytes.
    font = TTFont(path, recalcTimestamp=False)
    spacing = spacing_marks(path)
    hhea, os2 = font['hhea'], font['OS/2']
    hhea.ascent += SHIFT
    hhea.descent += SHIFT
    os2.sTypoAscender += SHIFT
    os2.sTypoDescender += SHIFT
    os2.usWinAscent += SHIFT
    os2.usWinDescent -= SHIFT
    if spacing:
        unmark(font, spacing)
    font.flavor = 'woff2'
    font.save(target / name)
    print(f'{name}: ascent {hhea.ascent}, descent {hhea.descent}, '
          f'no longer marks: {" ".join(spacing) or "none"}')

# OFL 1.1 with no reserved name, so the modified files keep the name.
(target / 'OFL.txt').write_text((source / 'LICENSE').read_text())
