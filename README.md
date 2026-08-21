![header](https://github.com/ai03-2725/yet-another-keyboard-builder/blob/main/public/opengraph.jpg)

# YAKB CAD Helper

Helper tooling for **3D-printed mechanical keyboards** that use **hotswap sockets**.

This project is a fork of [ai03’s plate generator (YAKB)](https://github.com/ai03-2725/yet-another-keyboard-builder): accurate client-side plate generation (KLE in → DXF/SVG out), plus stamp layers aimed at printed builds.

## What it’s for

- Generate MX switch plates and related cutouts from KLE data  
- Export extra stamp layers (for example MX hotswap socket patterns) for multi-layer 3D-print workflows  
- **MX** hotswap fits today (**tight** / **better fit**)  
- **Kailh Choc** support is planned  

Not just a generic plate tool — it’s specifically to make **hotswap + 3D-printed keyboard** CAD generation easier.

## Features

- Accurate plate generation (most calculations via [decimal.js](https://github.com/MikeMcl/decimal.js/))  
- Multiple switch / stabilizer cutout types  
- Fillet radius, unit size, and kerf controls  
- Output preview; export DXF or SVG  
- Optional **other plate parts** (stamps) with separate downloads  
- Entirely client-side  

## Upstream

Based on [ai03-2725/yet-another-keyboard-builder](https://github.com/ai03-2725/yet-another-keyboard-builder). See their CONTRIBUTING.md for cutout contribution guidelines on the original project.

Kailh Choc hotswap socket dimensions are from [koktoh/keyswitch_model](https://github.com/koktoh/keyswitch_model) ([socket/step/choc.step](https://github.com/koktoh/keyswitch_model/blob/master/socket/step/choc.step)).
