# Freestyle Simulator

Browser-based 3D freestyle driving game built with Three.js and cannon.js.

**Play:** https://quepanquepun.github.io/quad_simulator_webGL/

## Features

- Vehicle physics with cannon.js `RaycastVehicle`.
- glTF model loaded asynchronously, physics derived from its geometry.
- Procedural environment from extruded 2D profiles.
- Convex-decomposed ramps and loop for collision.
- PBR materials with color, normal and roughness maps.
- Reflections with `CubeCamera` + PMREM, dynamic probe on the loop.
- Single shadow-casting spotlight that follows the vehicle.
- HDR post-processing with bloom and gamma correction.
- Critically damped spring camera with raycast occlusion.
- Dynamic tire marks with per-vertex fading.
- Trick detection from local angular velocity.

## Built with

Three.js r140 · cannon.js 0.6.2
