import bpy
import json
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_DIR = os.path.join(ROOT, "assets", "3d")
ROBLOX_DIR = os.path.join(OUTPUT_DIR, "roblox")
PREVIEW_PATH = os.path.join(OUTPUT_DIR, "neon-pinball-kit-preview.png")
BLEND_PATH = os.path.join(OUTPUT_DIR, "neon-pinball-kit.blend")
GLB_PATH = os.path.join(OUTPUT_DIR, "neon-pinball-kit.glb")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ROBLOX_DIR, exist_ok=True)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name, base, metallic=0.0, roughness=0.35, emission=None, strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*base, alpha)
    mat.surface_render_method = "DITHERED" if alpha < 1.0 else "DITHERED"
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.use_transparency_overlap = False
    return mat


def parent(child, root):
    child.parent = root
    child.matrix_parent_inverse = root.matrix_world.inverted()


def add_empty(name, location):
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "CIRCLE"
    root.empty_display_size = 0.4
    root.location = location
    bpy.context.collection.objects.link(root)
    return root


def smooth(object_):
    if object_.type != "MESH":
        return
    for polygon in object_.data.polygons:
        polygon.use_smooth = True


def add_cylinder(name, radius, depth, location, mat, root, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    parent(obj, root)
    return obj


def add_uv_sphere(name, radius, location, mat, root):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    parent(obj, root)
    return obj


def add_torus(name, major_radius, minor_radius, location, mat, root, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth(obj)
    parent(obj, root)
    return obj


def add_beveled_cube(name, dimensions, location, mat, root, bevel=0.12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Precision bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 5
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    smooth(obj)
    parent(obj, root)
    return obj


def add_curve_tube(name, points, bevel_depth, mat, root):
    curve_data = bpy.data.curves.new(name + "Curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 16
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = 5
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    parent(obj, root)
    return obj


def build_bumper(materials, location):
    root = add_empty("Bumper", location)
    x, y, z = location
    add_cylinder("Bumper_Base", 0.62, 0.16, (x, y, z + 0.08), materials["dark"], root)
    add_cylinder("Bumper_Chrome", 0.54, 0.18, (x, y, z + 0.22), materials["chrome"], root)
    add_torus("Bumper_CyanRing", 0.46, 0.055, (x, y, z + 0.34), materials["cyan"], root)
    add_torus("Bumper_PinkCrown", 0.35, 0.07, (x, y, z + 0.42), materials["pink"], root)
    add_cylinder("Bumper_Cap", 0.29, 0.16, (x, y, z + 0.42), materials["glass"], root)
    add_uv_sphere("Bumper_Light", 0.11, (x, y, z + 0.54), materials["white"], root)
    add_torus("Bumper_Glow", 0.39, 0.11, (x, y, z + 0.42), materials["pink_glow"], root)
    return root


def build_flipper(materials, location):
    root = add_empty("Flipper", location)
    x, y, z = location
    add_beveled_cube("Flipper_Body", (1.72, 0.44, 0.28), (x + 0.08, y, z + 0.18), materials["pink_metal"], root, 0.19)
    add_beveled_cube("Flipper_Inlay", (1.39, 0.18, 0.075), (x + 0.1, y, z + 0.36), materials["pink"], root, 0.075)
    add_cylinder("Flipper_Pivot", 0.27, 0.34, (x - 0.67, y, z + 0.17), materials["chrome"], root)
    add_torus("Flipper_PivotGlow", 0.2, 0.045, (x - 0.67, y, z + 0.36), materials["cyan"], root)
    add_uv_sphere("Flipper_Tip", 0.23, (x + 0.88, y, z + 0.19), materials["pink_metal"], root)
    return root


def build_post(materials, location):
    root = add_empty("RailPost", location)
    x, y, z = location
    add_cylinder("Post_Base", 0.31, 0.09, (x, y, z + 0.045), materials["dark"], root)
    add_torus("Post_BaseGlow", 0.25, 0.04, (x, y, z + 0.1), materials["cyan"], root)
    add_cylinder("Post_Stem", 0.13, 0.62, (x, y, z + 0.4), materials["chrome"], root)
    add_torus("Post_MidRing", 0.17, 0.04, (x, y, z + 0.4), materials["pink"], root)
    add_cylinder("Post_Cap", 0.2, 0.12, (x, y, z + 0.74), materials["dark"], root)
    add_uv_sphere("Post_Light", 0.09, (x, y, z + 0.84), materials["cyan"], root)
    return root


def build_reactor(materials, location):
    root = add_empty("Reactor", location)
    x, y, z = location
    add_cylinder("Reactor_Base", 0.92, 0.17, (x, y, z + 0.085), materials["dark"], root, 64)
    add_torus("Reactor_OuterCyan", 0.77, 0.07, (x, y, z + 0.18), materials["cyan"], root)
    add_cylinder("Reactor_Deck", 0.66, 0.2, (x, y, z + 0.25), materials["chrome"], root, 64)
    add_torus("Reactor_PinkRing", 0.52, 0.065, (x, y, z + 0.38), materials["pink"], root)
    add_cylinder("Reactor_CoreHousing", 0.38, 0.28, (x, y, z + 0.4), materials["dark"], root, 64)
    add_uv_sphere("Reactor_Core", 0.24, (x, y, z + 0.59), materials["amber"], root)
    add_torus("Reactor_CoreGlow", 0.29, 0.095, (x, y, z + 0.51), materials["amber_glow"], root)
    for index in range(8):
        angle = index * math.tau / 8
        add_cylinder(
            f"Reactor_Node_{index + 1:02d}",
            0.055,
            0.13,
            (x + math.cos(angle) * 0.73, y + math.sin(angle) * 0.73, z + 0.24),
            materials["amber"],
            root,
            24,
        )
    return root


def build_ramp(materials, location):
    root = add_empty("Ramp", location)
    x, y, z = location
    add_beveled_cube("Ramp_Base", (1.75, 2.4, 0.11), (x, y, z + 0.18), materials["dark"], root, 0.08)
    path_left = [
        (x - 0.72, y - 1.05, z + 0.34),
        (x - 0.82, y - 0.25, z + 0.52),
        (x - 0.58, y + 0.65, z + 0.88),
        (x - 0.34, y + 1.08, z + 1.16),
    ]
    path_right = [(px + 1.16, py, pz) for px, py, pz in path_left]
    add_curve_tube("Ramp_LeftRail", path_left, 0.07, materials["pink"], root)
    add_curve_tube("Ramp_RightRail", path_right, 0.07, materials["cyan"], root)
    for index, amount in enumerate((0.18, 0.44, 0.7, 0.94)):
        y_pos = y - 1.05 + amount * 2.15
        z_pos = z + 0.28 + amount * 0.74
        rung = add_beveled_cube(
            f"Ramp_Light_{index + 1:02d}",
            (1.15, 0.06, 0.045),
            (x, y_pos, z_pos),
            materials["amber"] if index % 2 else materials["cyan"],
            root,
            0.025,
        )
        rung.rotation_euler.x = math.radians(18)
    return root


def build_spinner(materials, location):
    root = add_empty("Spinner", location)
    x, y, z = location
    add_cylinder("Spinner_Post", 0.09, 0.62, (x, y, z + 0.31), materials["chrome"], root)
    add_torus("Spinner_Ring", 0.38, 0.055, (x, y, z + 0.44), materials["cyan"], root, (math.pi / 2, 0, 0))
    for index, angle in enumerate((0, math.pi / 2)):
        blade = add_beveled_cube(
            f"Spinner_Blade_{index + 1}",
            (0.82, 0.12, 0.08),
            (x, y, z + 0.44),
            materials["pink"] if index == 0 else materials["amber"],
            root,
            0.05,
        )
        blade.rotation_euler.z = angle
    add_uv_sphere("Spinner_Hub", 0.13, (x, y, z + 0.44), materials["white"], root)
    return root


def root_with_children(root):
    objects = [root]
    pending = list(root.children)
    while pending:
        item = pending.pop()
        objects.append(item)
        pending.extend(item.children)
    return objects


def select_root(root):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in root_with_children(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(path, selected=False):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=selected,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )


def export_fbx(path):
    try:
        bpy.ops.export_scene.fbx(
            filepath=path,
            use_selection=True,
            apply_unit_scale=True,
            apply_scale_options="FBX_SCALE_ALL",
            axis_forward="-Z",
            axis_up="Y",
            bake_space_transform=False,
            add_leaf_bones=False,
            path_mode="AUTO",
        )
    except Exception as error:
        print(f"FBX export skipped for {path}: {error}")


def look_at(object_, target):
    direction = Vector(target) - object_.location
    object_.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_preview(materials):
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.04))
    floor = bpy.context.object
    floor.name = "PreviewFloor"
    floor.data.materials.append(materials["floor"])

    bpy.ops.object.light_add(type="AREA", location=(-4, -4, 7))
    key = bpy.context.object
    key.name = "CyanKey"
    key.data.energy = 1100
    key.data.color = (0.08, 0.6, 1.0)
    key.data.shape = "DISK"
    key.data.size = 5.0
    look_at(key, (0, 0, 0))

    bpy.ops.object.light_add(type="AREA", location=(5, 1, 5))
    rim = bpy.context.object
    rim.name = "PinkRim"
    rim.data.energy = 1300
    rim.data.color = (1.0, 0.03, 0.45)
    rim.data.size = 4.0
    look_at(rim, (0, 0, 0.4))

    bpy.ops.object.light_add(type="POINT", location=(0, -1, 4))
    warm = bpy.context.object
    warm.name = "AmberFill"
    warm.data.energy = 480
    warm.data.color = (1.0, 0.24, 0.03)

    bpy.ops.object.camera_add(location=(7.8, -9.5, 6.4))
    camera = bpy.context.object
    camera.name = "KitPreviewCamera"
    camera.data.lens = 56
    look_at(camera, (0, 0, 0.45))

    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW_PATH
    scene.render.film_transparent = False
    scene.world.color = (0.001, 0.003, 0.01)
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)


reset_scene()

materials = {
    "dark": material("Obsidian Metal", (0.012, 0.02, 0.05), metallic=0.88, roughness=0.22),
    "chrome": material("Midnight Chrome", (0.07, 0.12, 0.2), metallic=0.98, roughness=0.12),
    "pink_metal": material("Pink Anodized Metal", (0.38, 0.015, 0.19), metallic=0.82, roughness=0.2),
    "cyan": material("Electric Cyan", (0.01, 0.36, 0.7), metallic=0.15, roughness=0.2, emission=(0.03, 0.64, 1.0), strength=8.0),
    "pink": material("Hot Magenta", (0.72, 0.01, 0.29), metallic=0.12, roughness=0.2, emission=(1.0, 0.025, 0.48), strength=9.0),
    "amber": material("Reactor Amber", (0.9, 0.18, 0.015), metallic=0.1, roughness=0.18, emission=(1.0, 0.22, 0.025), strength=10.0),
    "white": material("Arc Light", (0.85, 0.95, 1.0), metallic=0.0, roughness=0.12, emission=(0.75, 0.94, 1.0), strength=12.0),
    "glass": material("Smoked Glass", (0.03, 0.08, 0.14), metallic=0.15, roughness=0.08, alpha=0.72),
    "pink_glow": material("Pink Glow Shell", (0.8, 0.01, 0.28), emission=(1.0, 0.01, 0.4), strength=5.0, alpha=0.28),
    "amber_glow": material("Amber Glow Shell", (0.92, 0.14, 0.01), emission=(1.0, 0.18, 0.01), strength=5.0, alpha=0.3),
    "floor": material("Preview Floor", (0.003, 0.006, 0.018), metallic=0.72, roughness=0.28),
}

roots = [
    build_bumper(materials, (-5.2, 0.0, 0.0)),
    build_flipper(materials, (-2.8, 0.0, 0.0)),
    build_post(materials, (-0.6, 0.0, 0.0)),
    build_reactor(materials, (1.7, 0.0, 0.0)),
    build_ramp(materials, (4.6, 0.0, 0.0)),
    build_spinner(materials, (7.0, 0.0, 0.0)),
]

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
export_glb(GLB_PATH, selected=False)

manifest = {
    "name": "PickBits Neon Pinball Kit",
    "version": 1,
    "source": os.path.relpath(BLEND_PATH, ROOT).replace("\\", "/"),
    "browser": os.path.relpath(GLB_PATH, ROOT).replace("\\", "/"),
    "coordinateSystem": "Blender Z-up source; glTF/FBX exported Y-up",
    "units": "meters; browser uses 1 model unit per 50 Matter.js pixels",
    "assets": [],
}

for root in roots:
    original_location = root.location.copy()
    root.location = (0, 0, 0)
    select_root(root)
    safe_name = root.name.lower().replace(" ", "-")
    individual_glb = os.path.join(OUTPUT_DIR, safe_name + ".glb")
    individual_fbx = os.path.join(ROBLOX_DIR, safe_name + ".fbx")
    export_glb(individual_glb, selected=True)
    export_fbx(individual_fbx)
    root.location = original_location
    manifest["assets"].append(
        {
            "name": root.name,
            "node": root.name,
            "glb": os.path.relpath(individual_glb, ROOT).replace("\\", "/"),
            "fbx": os.path.relpath(individual_fbx, ROOT).replace("\\", "/"),
        }
    )

with open(os.path.join(OUTPUT_DIR, "manifest.json"), "w", encoding="utf-8") as manifest_file:
    json.dump(manifest, manifest_file, indent=2)
    manifest_file.write("\n")

build_preview(materials)

print(json.dumps({
    "blend": BLEND_PATH,
    "glb": GLB_PATH,
    "preview": PREVIEW_PATH,
    "parts": [root.name for root in roots],
}, indent=2))
