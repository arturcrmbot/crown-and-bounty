---
name: kings-commission-mapart
description: How to dress and paint Crown & Bounty's maps and battlefields in the spirit of Heroes of Might and Magic II - how HoMM2 composes a map, our art pipeline (Retro Diffusion sheets cut by scripts/mapart.py), the scale table, where each kind of dressing is placed in code, and the critique checklist to run before showing Artur. Use for any change to the map's or the battle's look, new pieces, or a new province.
---

# Map art in HoMM2's spirit

Artur (1 Oct 2026, #178), comparing Aldmoor with HoMM2: ours was "mostly flat empty green with small
dark dots"; HoMM2's is packed, varied and vivid. This is what fixed it, so the next session doesn't
have to learn it again.

## How HoMM2 composes a map

1. **Every place is a little scene.** The watermill sits by a pond ringed with flowers; the sawmill's log
   pile and cart are in its own picture; the castle stands among flower beds. Nothing stands alone on bare
   grass.
2. **Woods are dense and grouped by kind.** A clump of autumn trees, a clump of blue-green firs, a few
   willows: each clump is one look, not a salad. Woods cover a big share of the screen, and their edges
   fray into single trees, bushes and flowers.
3. **Trees are big and bright.** About a tile to a tile and a half tall (32 to 48 px), saturated orange,
   gold, red, teal and green, each with its shadow cast to the lower right.
4. **Water always has an edge.** Reeds at the bank, beds of flowers on the grass beside it, rocks and
   lily pads in it.
5. **The ground is never one sheet.** It rolls: long swells with lit slopes towards the top left and
   shade away, darker swales, worn patches of earth, and rough land of a different colour.
6. **No bare stretch bigger than a few tiles.** Bright objects on darker ground.
7. **Only places are built** (#256). Anything people made that stands apart (a fountain, a pavilion, a
   cart, a woodpile, barrels, bones) can be visited, and anything made that lies on the ground can be
   picked up. The decoration is nature: trees, bushes, flowers, rocks, mounds and water. So a scene round
   a place is flowers, bushes and rocks, with only a house's own garden and fence, and a piece that
   stands for a place or a pickup is never decoration anywhere else. Artur rode to the pavilion by the
   castle, which was the Old King's Hunting Stand's picture, and nothing happened.

The battlefield is the same: grass that rolls, worn paths across it, tufts and flowers, a wall of big
trees along the top cut by the frame, clumps in the corners, and obstacles at battle size.

## Scale table

| Thing | On the map | In battle |
| --- | --- | --- |
| Tile / hex | 32 px | 64 px across, rows 44 apart |
| Tree | 34-46 px tall (`TREE_HEIGHT`) | edge trees 66-74 px wide, firs 42 |
| Bush, tuft, flower | 9-26 px | the map's at 2× |
| Flower bed | 26-50 px wide | same as the map |
| Cottage / hut | 36-52 px (1-1.5 tiles) | |
| Tower, mill | 28-62 px (2-3 tiles tall) | |
| Castle | 120 px (about 4 tiles) | |
| Hill | 36-100 px wide | |
| Person (troop) | 0.6 × battle height | 65 px (`FIGURES` in mapart.py) |

## The pipeline

- **Sheets** are made with Retro Diffusion (`rd_pro__spritesheet`, 256×256, up to 9 reference images,
  about $0.18 a sheet and 10-30 matching pieces), with HoMM2's screens as the style reference. Each sheet
  is objects on one flat grey with a flatter grey shadow. They're kept as they came in
  `art/map/sheets/` and credited in `public/assets/CREDITS.md`. Spend only where it clearly pays.
- **`npm run mapart`** (`scripts/mapart.py`) cuts them: `PIECES` (name: sheet, box, width on the map),
  the bright trees (`GROVES`, `CONIFERS`, cut to a height, their kind found from their colour), the
  troops (`FIGURES`, cut to a battle height), and the seamless grounds (`GROUND`). To find a new sheet's
  boxes, label the non-background, non-shadow components (`layers` gives both masks) and sort them by row.
  `alone=True` keeps only a piece's biggest part and its own shadow (for trees packed close on a sheet).
  Everything snaps to the 256-colour palette (`src/render/palette.ts`); the ground only to the land's
  ramps, so evening light never turns a road red. **The palette is full**: a colour it hasn't got (teal)
  is turned to one it has before snapping (`cool`), never added.
- **It writes** `public/assets/map/*.png`, `public/assets/troops/*-{battle,map}.png` and
  `src/render/mapPieces.ts` (`PIECE_FEET`, `GROVE_TREES`). `src/render/mapArt.ts` loads them.
- **The payday feast** (#191) has its own sheets (`feast-1` to `feast-4`): `FEAST` in mapart.py cuts them at the
  size they were drawn, with no shadow (the feast lays its own, away from its fire), into `public/assets/feast/`, and
  lists them as `FEAST_PIECES`. Its fire is cut without its painted flames: the feast draws its own, behind the logs.

## Where the dressing is placed

- `src/render/dressing.ts`, `dress()`: the woods (one in four of the rules' trees, each its clump's kind
  from slow noise, `PINEWOODS`/`LEAFWOODS`), the frayed wood edge, copses over open country, hills in the
  downs and outcrops on the heath, a scene round every place (`SCENES`, by look or kind: offsets from the
  place's foot), the river's reeds, beds and lily pads, and a last pass that fills any 96 px square left
  bare. It never puts a thing on a road, in the water or on a place, and keeps a `taken` grid so things
  don't pile up. It's drawing only: the rules' walk grid, pathing and rides don't change.
- `src/render/terrain.ts`, `paintedLand` and `rolling`: the ground's patches (worn earth, bare heath) and
  its rolling light, stippled with a hash (not Bayer: an ordered dither reads as a screen-door grid).
- `src/render/adventureScene.ts`, `PAINTED_LOOKS`/`PAINTED_KINDS`: which piece stands for each place.
- `src/render/battleScreen.ts`, `paintedField`: the battlefield.

## Critique checklist (before showing Artur)

Put a crop of ours, at 2×, beside one of his HoMM2 screens at the same pixel scale, and look at:

- [ ] Is any stretch bigger than three tiles bare? (Take a whole-map overview: tile the view with
      `__kc.view` and stitch the screenshots.)
- [ ] Does every place stand in a scene of its own?
- [ ] Is everything built a place or a pickup? Nothing made by hands stands about as decoration.
- [ ] Are the woods dense, in clumps of one look, with frayed edges? No autumn tree alone in a pinewood
      (it reads as a fire).
- [ ] Does the water have an edge everywhere?
- [ ] Does the ground roll, without a visible dither grid or mud-stain blobs?
- [ ] Do the hero and the enemies still read at a glance among it all, standing and riding (film a few
      frames with `__kc.advance`)?
- [ ] Morning's dither (the first part of a day) changes colours: judge at midday (`&movement=100`),
      then check evening (`&movement=40`), night (`&movement=0`), the fog (no `reveal`) and the minimap.
- [ ] The battle: rolling grass, a tree wall at the top below the message strip, obstacles at battle
      scale, troops readable over the flowers.
- [ ] Don't polish one flower. Fix what reads wrong from a step back.
