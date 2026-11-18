# Assets

Every third-party file in `public/assets/` is CC0 (public domain dedication).
Everything else in the game is generated at runtime.

## Downloaded (CC0)

| File | What | Author / source | Licence |
| --- | --- | --- | --- |
| `hdri/gym_01_1k.hdr` | Indoor gym HDRI used for image-based lighting | Poly Haven, [gym_01](https://polyhaven.com/a/gym_01) | CC0 |
| `textures/fine_grained_wood_{col,nor_gl,arm}_1k.jpg` | Wood grain under the table paint | Poly Haven, [fine_grained_wood](https://polyhaven.com/a/fine_grained_wood) | CC0 |
| `textures/plywood_{diff,nor_gl,arm}_1k.jpg` | Paddle blade and handle | Poly Haven, [plywood](https://polyhaven.com/a/plywood) | CC0 |
| `textures/rubberized_track_{diff,nor_gl,arm}_1k.jpg` | Paddle rubber pimples and sports floor | Poly Haven, [rubberized_track](https://polyhaven.com/a/rubberized_track) | CC0 |
| `models/robot_expressive.glb` | Rigged, animated robot athlete ("RobotExpressive") | Tomas Laulhe (Quaternius), modified by Don McCurdy; downloaded from the [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive), which lists it as CC0 1.0 | CC0 |

Downloaded 2026-11-17 from `dl.polyhaven.org` and `raw.githubusercontent.com`.
`fine_grained_wood_arm_1k.jpg` is downloaded but not currently referenced.

## Procedural (original, made in code)

- Table, net, posts, arena, stands, light rig, ball and paddle meshes (`src/render/`).
- Table paint and lines, crowd strips, banners, net mesh and ball print (`src/render/textures.ts`, canvas drawn).
- All sound: paddle, table, floor and net impacts, crowd murmur, applause, gasps, UI and jingles (`src/audio/`, Web Audio synthesis).
- Title, logo, UI and opponent names are original to this project.
