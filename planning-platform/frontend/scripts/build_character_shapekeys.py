"""
build_character_v9.py — KindHabit Game-Quality Shape Key Generator (v9.1)
Blender 5.0.1 | Headless Python script

Creates 7 expression morph targets on the KindHabit character:
  eyeBlinkLeft, eyeBlinkRight    — eye blink (visible crease)
  eyeSquintLeft, eyeSquintRight  — happy/squint eyes (anime ^^)
  eyeWideLeft, eyeWideRight      — surprised/shocked eyes
  cheekPuff                      — cute puffy cheeks

v9.1 FIX: Changed from proportional to FIXED displacement approach.
  - Blink now creates a clear visible crease (~15% of head height)
  - Squint creates a visible half-close
  - Wide creates visible eye widening
  - CheekPuff uses larger displacement

Usage:
  blender --background --python /tmp/build_character_v9.py
"""

import bpy
import math
from mathutils import Vector

# ============================================================
# CONFIGURATION
# ============================================================
BASE_DIR = '/Users/harby/0_workspace/PEERNINE/착한습관/kindhabit-fe/public/models'
GLB_INPUT = f'{BASE_DIR}/kindhabit_character_base.glb'
GLB_OUTPUT = f'{BASE_DIR}/kindhabit_character.glb'
BLEND_OUTPUT = f'{BASE_DIR}/kindhabit_character.blend'

# -- Eye Centers (refined from analysis) --
LEFT_EYE_CENTER = Vector((0.104, -0.171, 0.298))
RIGHT_EYE_CENTER = Vector((-0.108, -0.170, 0.299))

# -- Eye Deformation Parameters (v9.1: FIXED displacement) --
EYE_EFFECT_RADIUS = 0.075    # Search radius for affected vertices
EYE_SIGMA = 0.040            # Gaussian falloff
BLINK_DISP_Z = 0.045         # Fixed Z displacement for blink (15% of head height)
BLINK_INWARD = 0.006         # Push into head at crease
UPPER_WEIGHT = 0.78          # Upper lid does 78%
LOWER_WEIGHT = 0.22          # Lower lid does 22%
SQUINT_DISP_Z = 0.025        # Squint displacement (half of blink)
SQUINT_NARROW_X = 0.000      # Horizontal narrowing REMOVED (unnatural on texture eyes)
WIDE_DISP_Z = 0.018          # Wide displacement (opposite direction)

# -- Eye Spacing Adjustment --
EYE_INWARD_SHIFT = 0.012     # How much to shift each eye inward (X axis)
EYE_SHIFT_RADIUS = 0.090     # Larger radius for smooth falloff
EYE_SHIFT_SIGMA = 0.055      # Smooth gaussian falloff

# -- Cheek Parameters --
CHEEK_LEFT_CENTER = Vector((0.095, -0.150, 0.225))
CHEEK_RIGHT_CENTER = Vector((-0.095, -0.150, 0.225))
CHEEK_EFFECT_RADIUS = 0.070
CHEEK_SIGMA = 0.045
CHEEK_PUFF_AMOUNT = 0.025    # Larger puff displacement

# -- Head center (for radial push) --
HEAD_CENTER = Vector((0.0, 0.0, 0.350))


# ============================================================
# HELPERS
# ============================================================
def gaussian(dist, sigma):
    return math.exp(-(dist * dist) / (2.0 * sigma * sigma))


def find_eye_vertices(mesh, eye_center, effect_radius):
    results = []
    for i, v in enumerate(mesh.vertices):
        dist = (v.co - eye_center).length
        if dist < effect_radius:
            results.append((i, dist))
    return results


def find_cheek_vertices(mesh, cheek_center, effect_radius):
    results = []
    for i, v in enumerate(mesh.vertices):
        if v.co.y > -0.08:
            continue
        dist = (v.co - cheek_center).length
        if dist < effect_radius:
            results.append((i, dist))
    return results


def create_blink_shape_key(obj, name, eye_center, eye_verts,
                           disp_z, inward, sigma, upper_w, lower_w):
    """Create blink with FIXED displacement amount for visible effect."""
    sk = obj.shape_key_add(name=name)
    sk.slider_min = 0.0
    sk.slider_max = 1.0
    sk.value = 0.0
    basis = obj.data.shape_keys.key_blocks['Basis']

    for vi, dist in eye_verts:
        co = basis.data[vi].co
        dz = co.z - eye_center.z
        falloff = gaussian(dist, sigma)

        # Direction: above center→down, below center→up
        if dz > 0:
            # Upper lid: fixed downward displacement
            displacement_z = -disp_z * falloff * upper_w
        else:
            # Lower lid: fixed upward displacement
            displacement_z = disp_z * falloff * lower_w

        # Inward push to create crease, not a bump
        displacement_y = inward * falloff

        sk.data[vi].co = Vector((
            co.x,
            co.y + displacement_y,
            co.z + displacement_z
        ))

    return sk


def create_squint_shape_key(obj, name, eye_center, eye_verts,
                            disp_z, narrow_x, sigma):
    """Create happy squint (partial close + narrowing + cheek raise)."""
    sk = obj.shape_key_add(name=name)
    sk.slider_min = 0.0
    sk.slider_max = 1.0
    sk.value = 0.0
    basis = obj.data.shape_keys.key_blocks['Basis']

    for vi, dist in eye_verts:
        co = basis.data[vi].co
        dz = co.z - eye_center.z
        dx = co.x - eye_center.x
        falloff = gaussian(dist, sigma)

        # Partial close with happy curve
        if dz > 0:
            displacement_z = -disp_z * falloff * 0.70  # Upper comes down
        else:
            displacement_z = disp_z * falloff * 0.40   # Lower comes up a bit more (cheek raise)

        # Horizontal narrowing
        displacement_x = 0.0
        if abs(dx) > 0.005:
            displacement_x = -math.copysign(narrow_x * falloff, dx)

        # Inward push
        displacement_y = 0.003 * falloff

        sk.data[vi].co = Vector((
            co.x + displacement_x,
            co.y + displacement_y,
            co.z + displacement_z
        ))

    return sk


def create_wide_shape_key(obj, name, eye_center, eye_verts,
                          disp_z, sigma):
    """Create wide/surprised eye (expand outward from center)."""
    sk = obj.shape_key_add(name=name)
    sk.slider_min = 0.0
    sk.slider_max = 1.0
    sk.value = 0.0
    basis = obj.data.shape_keys.key_blocks['Basis']

    for vi, dist in eye_verts:
        co = basis.data[vi].co
        dz = co.z - eye_center.z
        falloff = gaussian(dist, sigma)

        # Expand: opposite of blink
        if dz > 0:
            displacement_z = disp_z * falloff * 0.70  # Upper goes up
        else:
            displacement_z = -disp_z * falloff * 0.30  # Lower goes down slightly

        # Slight outward push (toward viewer)
        displacement_y = -0.003 * falloff

        sk.data[vi].co = Vector((
            co.x,
            co.y + displacement_y,
            co.z + displacement_z
        ))

    return sk


def create_cheek_puff_shape_key(obj, name, left_verts, right_verts,
                                puff_amount, sigma, head_center):
    """Create cheek puff (both cheeks inflate outward)."""
    sk = obj.shape_key_add(name=name)
    sk.slider_min = 0.0
    sk.slider_max = 1.0
    sk.value = 0.0
    basis = obj.data.shape_keys.key_blocks['Basis']

    for vi, dist in left_verts + right_verts:
        co = basis.data[vi].co
        falloff = gaussian(dist, sigma)

        # Radial push outward from head center
        direction = (co - head_center).normalized()
        push = puff_amount * falloff

        sk.data[vi].co = Vector((
            co.x + direction.x * push,
            co.y + direction.y * push * 1.2,  # More forward push
            co.z + direction.z * push * 0.4    # Less vertical
        ))

    return sk


# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "=" * 60)
    print("KindHabit Shape Key Generator v9.1 (FIXED DISPLACEMENT)")
    print("=" * 60)

    # Step 1: Import
    print("\n[1/8] Importing GLB...")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB_INPUT)

    # Step 2: Clean
    print("[2/8] Cleaning scene...")
    for obj in list(bpy.data.objects):
        if obj.name not in ('KindHabit_Body', 'KindHabit_Armature'):
            bpy.data.objects.remove(obj, do_unlink=True)

    body = bpy.data.objects.get('KindHabit_Body')
    if not body:
        print("ERROR: KindHabit_Body not found!")
        return
    print(f"  Found: {body.name} ({len(body.data.vertices)} verts)")

    # Step 2.5: Merge close vertices to seal micro-gaps from Draco decompression
    print("[2.5/8] Merging close vertices (seal micro-gaps)...")
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0015)
    bpy.ops.mesh.dissolve_degenerate(threshold=0.0001)
    bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f"  ✓ Vertices merged, degenerate dissolved, loose deleted ({len(body.data.vertices)} verts)")

    # Step 3: Clear shape keys FIRST (needed before modifier apply)
    print("[3/8] Clearing existing shape keys...")
    if body.data.shape_keys:
        for kb in reversed(list(body.data.shape_keys.key_blocks)):
            body.shape_key_remove(kb)

    # Step 3.5: Narrow eye spacing — shift eye vertices inward
    print("[3.5/8] Adjusting eye spacing...")
    mesh = body.data
    eye_shifted = 0
    for i, v in enumerate(mesh.vertices):
        for eye_center in [LEFT_EYE_CENTER, RIGHT_EYE_CENTER]:
            dist = (v.co - eye_center).length
            if dist < EYE_SHIFT_RADIUS:
                falloff = gaussian(dist, EYE_SHIFT_SIGMA)
                # Shift inward: left eye → negative X, right eye → positive X
                sign = -1.0 if eye_center.x > 0 else 1.0
                v.co.x += sign * EYE_INWARD_SHIFT * falloff
                eye_shifted += 1
                break
    # Also shift eye centers for shape key alignment
    LEFT_EYE_CENTER_ADJ = Vector((LEFT_EYE_CENTER.x - EYE_INWARD_SHIFT, LEFT_EYE_CENTER.y, LEFT_EYE_CENTER.z))
    RIGHT_EYE_CENTER_ADJ = Vector((RIGHT_EYE_CENTER.x + EYE_INWARD_SHIFT, RIGHT_EYE_CENTER.y, RIGHT_EYE_CENTER.z))
    print(f"  ✓ Shifted {eye_shifted} verts inward by {EYE_INWARD_SHIFT:.3f}")
    print(f"  Eye gap: {abs(LEFT_EYE_CENTER.x) + abs(RIGHT_EYE_CENTER.x):.3f} → {abs(LEFT_EYE_CENTER_ADJ.x) + abs(RIGHT_EYE_CENTER_ADJ.x):.3f}")

    # Step 4: Find eye vertices (using adjusted centers)
    print("[4/8] Finding eye vertices...")
    left_eye = find_eye_vertices(mesh, LEFT_EYE_CENTER_ADJ, EYE_EFFECT_RADIUS)
    right_eye = find_eye_vertices(mesh, RIGHT_EYE_CENTER_ADJ, EYE_EFFECT_RADIUS)
    print(f"  Left eye: {len(left_eye)} verts")
    print(f"  Right eye: {len(right_eye)} verts")

    # Step 5: Find cheek vertices
    print("[5/8] Finding cheek vertices...")
    left_cheek = find_cheek_vertices(mesh, CHEEK_LEFT_CENTER, CHEEK_EFFECT_RADIUS)
    right_cheek = find_cheek_vertices(mesh, CHEEK_RIGHT_CENTER, CHEEK_EFFECT_RADIUS)
    print(f"  Left cheek: {len(left_cheek)} verts, Right cheek: {len(right_cheek)} verts")

    # Step 6: Create Shape Keys
    print("[6/8] Creating shape keys (FIXED displacement)...")
    body.shape_key_add(name='Basis')
    print("  ✓ Basis")

    create_blink_shape_key(body, 'eyeBlinkLeft', LEFT_EYE_CENTER_ADJ, left_eye,
                           BLINK_DISP_Z, BLINK_INWARD, EYE_SIGMA, UPPER_WEIGHT, LOWER_WEIGHT)
    print("  ✓ eyeBlinkLeft")

    create_blink_shape_key(body, 'eyeBlinkRight', RIGHT_EYE_CENTER_ADJ, right_eye,
                           BLINK_DISP_Z, BLINK_INWARD, EYE_SIGMA, UPPER_WEIGHT, LOWER_WEIGHT)
    print("  ✓ eyeBlinkRight")

    create_squint_shape_key(body, 'eyeSquintLeft', LEFT_EYE_CENTER_ADJ, left_eye,
                            SQUINT_DISP_Z, SQUINT_NARROW_X, EYE_SIGMA)
    print("  ✓ eyeSquintLeft")

    create_squint_shape_key(body, 'eyeSquintRight', RIGHT_EYE_CENTER_ADJ, right_eye,
                            SQUINT_DISP_Z, SQUINT_NARROW_X, EYE_SIGMA)
    print("  ✓ eyeSquintRight")

    create_wide_shape_key(body, 'eyeWideLeft', LEFT_EYE_CENTER_ADJ, left_eye,
                          WIDE_DISP_Z, EYE_SIGMA)
    print("  ✓ eyeWideLeft")

    create_wide_shape_key(body, 'eyeWideRight', RIGHT_EYE_CENTER_ADJ, right_eye,
                          WIDE_DISP_Z, EYE_SIGMA)
    print("  ✓ eyeWideRight")

    create_cheek_puff_shape_key(body, 'cheekPuff', left_cheek, right_cheek,
                                CHEEK_PUFF_AMOUNT, CHEEK_SIGMA, HEAD_CENTER)
    print("  ✓ cheekPuff")

    # Step 7: Smooth shading
    print("[7/8] Smooth shading...")
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.shade_smooth()

    # Step 8: Export
    print("[8/8] Exporting...")
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUTPUT)
    print(f"  ✓ .blend saved")

    try:
        bpy.ops.export_scene.gltf(
            filepath=GLB_OUTPUT,
            export_format='GLB',
            export_normals=True,
            export_morph=True,
            export_morph_normal=False,
            export_animations=True,
            export_texcoords=True,
            export_draco_mesh_compression_enable=False,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(
            filepath=GLB_OUTPUT,
            export_format='GLB',
            export_normals=True,
            export_morph=True,
            export_morph_normal=False,
            export_animations=True,
            export_texcoords=True,
        )
    print(f"  ✓ GLB saved")

    # Verify
    import os
    glb_size = os.path.getsize(GLB_OUTPUT) / (1024 * 1024)
    basis = body.data.shape_keys.key_blocks['Basis']

    print("\n" + "=" * 60)
    print("BUILD COMPLETE v9.1")
    print("=" * 60)
    print(f"  Shape Keys: {len(body.data.shape_keys.key_blocks)}")
    print(f"  GLB size: {glb_size:.2f} MB")

    for kb in body.data.shape_keys.key_blocks:
        if kb.name == 'Basis':
            continue
        max_d = 0
        affected = 0
        for i in range(len(kb.data)):
            d = (kb.data[i].co - basis.data[i].co).length
            if d > 0.0001:
                affected += 1
                max_d = max(max_d, d)
        print(f"  {kb.name:20s} | {affected:5d} verts | max disp: {max_d:.4f} ({max_d/0.30*100:.1f}% head)")

    print("=" * 60)


if __name__ == '__main__':
    main()
