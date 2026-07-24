# PickBits Neon Pinball 3D Kit

This is the shared visual kit for the browser game and the Roblox `Tilt Rider`
prototype.

## Source of truth

- `neon-pinball-kit.blend` contains the authored collection.
- `neon-pinball-kit.glb` contains every named model used by the browser runtime.
- The sibling GLB files contain one model each.
- `roblox/*.fbx` contains the same individual models for Roblox Studio's 3D
  Importer.
- `manifest.json` maps stable model names to both delivery formats.

The modeled parts are:

- `Bumper`
- `Flipper`
- `RailPost`
- `Reactor`
- `Ramp`
- `Spinner`

## Regenerate

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' `
  --background `
  --python 'scripts\blender\build_neon_pinball_kit.py'
```

The generator creates the Blender source, combined GLB, individual GLBs, Roblox
FBXs, manifest, and preview from one dimensional specification.

## Runtime contract

The web renderer uses one Blender meter as one Three.js unit and maps 50
Matter.js pixels to one model unit. Physics bodies remain authoritative. The
modeled objects are synchronized visual shells, so their topology can be
improved without changing gameplay.

For Roblox, keep the existing invisible or low-visibility primitive Parts as
authoritative collision. Import the FBX models as visual children, disable
collision/query/touch on their MeshParts, set them Massless, and weld moving
visuals to their physics Parts.

The Roblox 3D Importer supports FBX and glTF hierarchies:
https://create.roblox.com/docs/studio/importer

## Meshy additions

Meshy output is best reserved for non-collision hero pieces such as a cabinet
backbox, skyline buildings, or a table mascot. Add those as new named roots in
the Blender source, retopologize as needed, and keep all gameplay walls, lanes,
ramps, and targets dimensionally generated.
