---
name: convert-skins
description: Convert Thetis SDR skins from C:\projecten\thetis skins\ into Zeus CSS themes. Copies Console.png / picDisplay.png / button / slider images, generates :root[data-theme] CSS blocks, and wires up all four TypeScript + C# registration points. Run without args to convert every un-converted skin folder, or pass a skin folder name to target a single skin.
---

# /convert-skins — Thetis → Zeus skin pipeline

Converts one or more Thetis skins into fully-wired Zeus CSS themes. A skin is
"converted" when its theme ID already appears in `tokens.css`; anything else is
treated as new.

## Source / dest layout

```
C:\projecten\thetis skins\<SkinFolder>\          ← Thetis source root
    <ConsoleSubfolder>\                           ← name varies (Console, console, or nested)
        Console.png  /  console.png               ← full console background
        picDisplay.png                            ← panadapter display background
        chkNB-0.png   → btn-inactive.png          ← inactive button state
        chkNB-1.png   → btn-active.png            ← active button state
        chkMOX-1.png  → btn-active-tx.png         ← TX-active button state
        ptbAF-back.png → slider-track.png         ← range slider track
        ptbAF-head.png → slider-thumb.png         ← range slider thumb

zeus-web/public/themes/<theme-id>/               ← Zeus dest (7 files per skin)
zeus-web/src/styles/tokens.css                   ← CSS theme blocks + tactile selectors
zeus-web/src/state/theme-store.ts                ← ThemeId union type
zeus-web/src/api/themeSettings.ts                ← ThemeIdRaw union type
zeus-web/src/components/ThemeSettingsPanel.tsx   ← THEME_OPTIONS array
Zeus.Server.Hosting/ThemeSettingsStore.cs        ← NormalizeTheme C# switch
```

## Skin folder → console subfolder mapping

Many skins have the button/image files in a `Console/` or `console/` subfolder
directly under the skin folder. N2MDX skins have an extra nesting level:

```
n2mdx-tron\n2mdx-Tron\Console\
n2mdx-kiss_2\n2mdx-kiss 2\Console\          ← note the space in the inner folder name
n2mdx-world_maps\N2MDX-3DSDR\Console\
```

**Discovery algorithm:**
1. Check `<SkinFolder>\Console\` and `<SkinFolder>\console\` first (direct).
2. If not found, list one-level subdirectories, then check `<subdir>\Console\`
   for each. Use the first one that contains `chkNB-0.png`.
3. If still not found, skip with a warning — do not guess.

## Already-converted check

Read `zeus-web/src/styles/tokens.css`. Any theme ID that already has a
`:root[data-theme="<id>"]` block is skipped silently. Only truly new skins
are processed.

## Theme ID derivation

Strip the skin folder name to a lowercase ASCII slug used as the CSS theme ID:

| Skin folder name         | Theme ID     |
|--------------------------|--------------|
| OE3IDE-AnanSmart         | anansmart    |
| OE3IDE-XMAS              | xmas         |
| W1AEX High Visual        | highvisual   |
| IK3VIG Special           | ik3vig       |
| N2MDX HL2 16k Ultra      | n2mdxhl2     |
| N2MDX_MICS_01            | n2mdxmics    |
| RZ1ZR                    | rz1zr        |
| n2mdx-alienpred          | alienpred    |
| n2mdx-apache             | apache       |
| n2mdx-circuit            | circuit      |
| n2mdx-joker              | joker        |
| n2mdx-kiss               | kiss         |
| n2mdx-kiss_2             | kiss2        |
| n2mdx-ledzep             | ledzep       |
| n2mdx-maiden             | maiden       |
| n2mdx-metallica          | metallica    |
| n2mdx-nascar             | nascar       |
| n2mdx-riddler            | riddler      |
| n2mdx-startrek           | n2mdxst      |
| n2mdx-starwars           | starwars     |
| n2mdx-terminator         | terminator   |
| n2mdx-tron               | tron         |
| n2mdx-warriors           | warriors     |
| n2mdx-world_maps         | worldmaps    |

For new/unknown folders not in the table above, derive the ID by:
lowercasing, removing `n2mdx-` / `OE3IDE-` / `W1AEX ` prefixes, stripping
spaces/underscores/hyphens, truncating to 12 chars.

## Step 1 — Copy image assets (PowerShell)

For each new skin, create `zeus-web/public/themes/<id>/` and copy:

```powershell
Add-Type -AssemblyName System.Drawing

function Copy-SkinAssets($consoleDir, $destDir) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    $src = if (Test-Path "$consoleDir\Console.png") {"$consoleDir\Console.png"}
           else {"$consoleDir\console.png"}
    if (Test-Path $src) { Copy-Item $src "$destDir\Console.png" -Force }

    if (Test-Path "$consoleDir\picDisplay.png") {
        Copy-Item "$consoleDir\picDisplay.png" "$destDir\picDisplay.png" -Force
    }

    if (Test-Path "$consoleDir\chkNB-0.png")    { Copy-Item "$consoleDir\chkNB-0.png"    "$destDir\btn-inactive.png"  -Force }
    if (Test-Path "$consoleDir\chkNB-1.png")    { Copy-Item "$consoleDir\chkNB-1.png"    "$destDir\btn-active.png"    -Force }
    if (Test-Path "$consoleDir\chkMOX-1.png")   { Copy-Item "$consoleDir\chkMOX-1.png"   "$destDir\btn-active-tx.png" -Force }
    if (Test-Path "$consoleDir\ptbAF-back.png") { Copy-Item "$consoleDir\ptbAF-back.png" "$destDir\slider-track.png"  -Force }
    if (Test-Path "$consoleDir\ptbAF-head.png") { Copy-Item "$consoleDir\ptbAF-head.png" "$destDir\slider-thumb.png"  -Force }
}
```

## Step 2 — Extract colors (PowerShell + System.Drawing)

```powershell
Add-Type -AssemblyName System.Drawing

function Get-ChassisBg($consolePath) {
    # Sample bottom 35% of image (chassis area below the display panel)
    $bmp = New-Object System.Drawing.Bitmap $consolePath
    $rnd = New-Object System.Random 42
    $r=0;$g=0;$b=0;$c=0
    for ($i=0; $i -lt 80; $i++) {
        $x=[int](($rnd.NextDouble()*0.9+0.05)*$bmp.Width)
        $y=[int](($rnd.NextDouble()*0.30+0.65)*$bmp.Height)
        $px=$bmp.GetPixel([Math]::Min($x,$bmp.Width-1),[Math]::Min($y,$bmp.Height-1))
        $r+=$px.R; $g+=$px.G; $b+=$px.B; $c++
    }
    $bmp.Dispose()
    return "#{0:X2}{1:X2}{2:X2}" -f ([int]($r/$c)),([int]($g/$c)),([int]($b/$c))
}

function Get-AccentColor($consolePath) {
    # Most saturated pixel in the full image (finds the dominant hue)
    $bmp = New-Object System.Drawing.Bitmap $consolePath
    $rnd = New-Object System.Random 42
    $bestSat=0; $best=$null
    for ($i=0; $i -lt 400; $i++) {
        $x=[int]($rnd.NextDouble()*$bmp.Width); $y=[int]($rnd.NextDouble()*$bmp.Height)
        if ($x -lt $bmp.Width -and $y -lt $bmp.Height) {
            $px=$bmp.GetPixel($x,$y)
            $s=$px.GetSaturation(); $br=$px.GetBrightness()
            if ($s -gt $bestSat -and $br -gt 0.15 -and $br -lt 0.92) { $bestSat=$s; $best=$px }
        }
    }
    $bmp.Dispose()
    if ($null -eq $best -or $bestSat -lt 0.12) { return "#4A90D9" }  # fallback blue
    return "#{0:X2}{1:X2}{2:X2}" -f $best.R,$best.G,$best.B
}
```

## Step 3 — Generate CSS theme block

Color math helpers (implement in PowerShell):

```
Scale(hex, f)     → clamp(0..255) each RGB channel × f
Add(hex, v)       → clamp(0..255) each RGB channel + v
MixHex(h1,h2,t)  → linear interpolate h1→h2 at position t (0=h1, 1=h2)
HexToRGBA(hex,a)  → "rgba(r,g,b,a)"
Lum(hex)          → 0.299*(R/255) + 0.587*(G/255) + 0.114*(B/255)
```

**Surface hierarchy** from `$chassis` (luminance `L = Lum($chassis)`):

| Token        | L < 0.05           | L 0.05–0.2          | L 0.2–0.4           | L > 0.4             |
|--------------|--------------------|---------------------|---------------------|---------------------|
| `--bg-0`     | chassis            | chassis             | chassis             | chassis             |
| `--bg-1`     | Add(chassis,12)    | Scale(chassis,1.4)  | Scale(chassis,1.25) | Scale(chassis,1.15) |
| `--bg-2`     | Add(chassis,22)    | Scale(chassis,1.8)  | Scale(chassis,1.55) | Scale(chassis,1.30) |
| `--bg-3`     | Add(chassis,32)    | Scale(chassis,2.2)  | Scale(chassis,1.85) | Scale(chassis,1.45) |
| `--bg-inset` | chassis            | Scale(chassis,0.7)  | Scale(chassis,0.60) | Scale(chassis,0.50) |
| `--bg-meter` | chassis            | Scale(chassis,0.5)  | Scale(chassis,0.45) | Scale(chassis,0.38) |

**Lines:** `--line = MixHex(bg1,accent,0.15)`, `--line-soft = MixHex(bg0,accent,0.08)`,
`--line-strong = MixHex(bg2,accent,0.20)`

**Foreground:** L < 0.3 → white-on-dark (`#FFFFFF`/`#CCCCCC`/`#8A8A90`).
L ≥ 0.3 → dark-on-light (`#0A0A0C`/`#2A2A30`/`#555560`).

**Full CSS block** (exact structure — do not omit any token):

```css
:root[data-theme="<id>"] {
  --bg-app:       <bg0>; --bg-workspace: <bg0>;
  --bg-0:         <bg0>; --bg-1: <bg1>; --bg-2: <bg2>; --bg-3: <bg3>;
  --bg-inset:     <bg-inset>; --bg-meter: <bg-meter>;
  --spec-bg:      url('/themes/<id>/picDisplay.png') no-repeat center / cover <bg-inset>;
  --btn-inactive-img:  url('/themes/<id>/btn-inactive.png');
  --btn-active-img:    url('/themes/<id>/btn-active.png');
  --btn-active-tx-img: url('/themes/<id>/btn-active-tx.png');
  --slider-track-img:  url('/themes/<id>/slider-track.png');
  --slider-thumb-img:  url('/themes/<id>/slider-thumb.png');
  --line: <line>; --line-soft: <line-soft>; --line-strong: <line-strong>;
  --panel-head-top: <bg1>; --panel-head-bot: <bg1>;
  --panel-border: <line>; --panel-hl-top: rgba(255,255,255,0.04);
  --panel-top: <bg1>; --panel-bot: <bg1>; --panel-edge: <line>;
  --btn-top: <bg2>; --btn-bot: <bg1>; --btn-hl: transparent;
  --btn-edge: <line-strong>; --btn-text: <fg1>;
  --btn-active-top: <accent>; --btn-active-bot: Scale(accent,0.65); --btn-active-text:#ffffff;
  --fg-0: <fg0>; --fg-1: <fg1>; --fg-2: <fg2>;
  --accent: <accent>; --accent-bright: Add(accent,40);
  --accent-soft: HexToRGBA(accent,0.12); --accent-line: HexToRGBA(accent,0.45);
  --tx: <tx>; --tx-soft: HexToRGBA(tx,0.18);
  --vfo-led-color: <accent>;
  --vfo-led-glow:  HexToRGBA(accent,0.50);
  --vfo-led-dim:   HexToRGBA(accent,0.10);
}
:root[data-theme="<id>"] .freq-digits { color: var(--vfo-led-color) !important; }
:root[data-theme="<id>"] .freq-digits .digit.leading { color: var(--vfo-led-dim) !important; }
:root[data-theme="<id>"] .freq-digits .sep { color: var(--vfo-led-dim) !important; }
:root[data-theme="<id>"] body {
  background-image: url('/themes/<id>/Console.png');
  background-size: cover; background-position: center; background-repeat: no-repeat;
}
```

## Step 4 — Insert CSS into tokens.css

`tokens.css` uses **CRLF** line endings on Windows. Preserve them.

Insert all new CSS blocks before the `/* ===…=== Base resets` comment:

```powershell
$tokensCss = [System.IO.File]::ReadAllText($tokensPath, [System.Text.Encoding]::UTF8)
# Find "Base resets" — look for the comment block by searching for the text
$idx = $tokensCss.IndexOf("Base resets") - 60   # back up to the /* ===== start
if ($idx -lt 0) { throw "Cannot find insertion point in tokens.css" }
$newCss = $newCss.Replace("`r`n","`n").Replace("`n","`r`n")
$updated = $tokensCss.Substring(0,$idx) + $newCss + "`r`n" + $tokensCss.Substring($idx)
[System.IO.File]::WriteAllText($tokensPath, $updated, [System.Text.Encoding]::UTF8)
```

## Step 5 — Update TACTILE SKINS selectors in tokens.css

Find the last skin ID already in the tactile selectors (look for the last
`:root[data-theme="..."] .btn {` before the `{` line). Prepend each new skin's
selectors to all **8 selector groups**:

1. `.btn` group
2. `.btn:hover` group
3. `.btn.active` group
4. `.btn.tx.active` + `.btn.tx-btn.tx` group
5. `input[type="range"]::-webkit-slider-runnable-track` group
6. `input[type="range"]::-webkit-slider-thumb` group
7. `input[type="range"]::-moz-range-track` group
8. `input[type="range"]::-moz-range-thumb` group

For each group, find the anchor line (the last existing skin's selector line
immediately before the `{`) and prepend the new selector lines above it.

After adding all skins, the new "last" anchor for future runs will be the
last skin just added — not `"startrek"`. Re-read the file to detect this
before the next conversion run.

## Step 6 — Update TypeScript union types

Add each new ID to both union types (append before the closing `;`):

- `zeus-web/src/state/theme-store.ts` → `export type ThemeId = ...`
- `zeus-web/src/api/themeSettings.ts` → `export type ThemeIdRaw = ...`

## Step 7 — Update ThemeSettingsPanel.tsx

Append one entry per new skin to the `THEME_OPTIONS` array (before `];`):

```typescript
  {
    id: '<id>',
    label: '<Human-readable label>',
    blurb: '<One sentence describing the visual identity>',
    swatch: '<chassis bg0 hex>',
  },
```

## Step 8 — Update ThemeSettingsStore.cs

Add new IDs to the `NormalizeTheme` switch (C# `or`-chained pattern):

```csharp
"dark" or "light" or /* ...existing... */ or "<new-id-1>" or "<new-id-2>" => raw,
```

## Step 9 — Verify

```bash
cd zeus-web && npx tsc -b --noEmit
```

Zero `ThemeId`/`ThemeIdRaw` errors expected. Pre-existing unrelated errors are
acceptable. Also confirm new theme folders exist: `ls zeus-web/public/themes/`.

## Step 10 — Stage and commit

Stage only skin-related files (do NOT commit `.codegraph/` or unrelated
working-tree changes like `LeftLayoutBar.tsx` or `layout.css`):

```bash
git add Zeus.Server.Hosting/ThemeSettingsStore.cs \
        zeus-web/src/api/themeSettings.ts \
        zeus-web/src/components/ThemeSettingsPanel.tsx \
        zeus-web/src/state/theme-store.ts \
        zeus-web/src/styles/tokens.css \
        zeus-web/public/themes/<id1> zeus-web/public/themes/<id2> ...
git commit -m "feat: convert and integrate N new Thetis skins into the Zeus theme engine"
```

## Do NOT

- Do **not** modify existing dark/light/classic CSS blocks — only append new ones.
- Do **not** alter `layout.css`, `all-panels.css`, or any component file.
- Do **not** commit `.codegraph/` or unrelated staged changes.
- Do **not** assume Console.png is always 1024×600 — sample by fraction, not fixed coords.
- Do **not** use raw hex in CSS where an existing token variable would work (but
  the new `:root[data-theme]` blocks themselves use raw hex — that is correct).
