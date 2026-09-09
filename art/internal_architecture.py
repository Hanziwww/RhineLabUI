"""Sharp, thin optical architecture from the 46–51 s views.

Executed inside build_archive.py's scene. Coordinates precede the shared x2
depth bake. Two annular rooms and one continuous connecting sheet; no towers.
"""
glass_body = material('Optical_Glass_Body', (.43, .465, .456), .34, .02, .66)
glass_roof = material('Optical_Glass_Roof', (.61, .635, .624), .29, .01, .72)
glass_edge = material('Optical_Glass_Edge', (.79, .815, .797), .19, .04, .54)
bridge_glass = material('Optical_Bridge_Glass', (.55, .59, .577), .27, .01, .75)
rib_material = material('Optical_Facade_Ribs', (.42, .455, .439), .34, .18)
amber_inlay = material('Amber_Optical_Inlay', (.64, .205, .025), .28, .16)

def lens(name, cx, cz, profile, mat, start=0, end=360):
    return annular_profile(name, cx, cz, profile, mat, 192,
                           math.radians(start), math.radians(end), sharp=True)

bx, bz = -.425, 1.80
sx, sz = 1.125, 2.455

def wall(name, cx, cz, radius, bottom, top, width=.005):
    return lens(name, cx, cz, [
        (radius-width, bottom), (radius, bottom),
        (radius, top), (radius-width, top),
    ], glass_body)

# A glass-walled room with a broad single-plane roof. The top rim has a tiny
# cut chamfer, with an explicit normal break instead of rounded interpolants.
wall('Embedded optical cavity outer wall', bx, bz, .948, .012, -.036)
wall('Embedded optical cavity inner wall', bx, bz, .567, .012, -.062)
lens('Embedded optical cavity lower plate', bx, bz, [
    (.562, .015), (.948, .015), (.948, .010), (.562, .010),
], glass_body)
for start, end in [(1, 89.7), (90.3, 178.4), (180.5, 228), (230, 309), (309.6, 359.7)]:
    lens('Subsurface refractive shoulder roof', bx, bz, [
        (.606, -.056), (.946, -.036), (.951, -.040),
        (.951, -.044), (.611, -.065), (.606, -.061),
    ], glass_roof, start, end)
lens('Inner optical bevel crown', bx, bz, [
    (.557, -.060), (.608, -.060), (.615, -.064),
    (.615, -.070), (.560, -.070), (.557, -.068),
], glass_roof)
# Narrow edge strips follow the architecture; they never become round tubes.
for radius, depth in [(.950, -.043), (.610, -.065), (.558, -.070)]:
    lens('Concentric optical machining cut edge', bx, bz, [
        (radius-.003, depth+.001), (radius+.003, depth+.001),
        (radius+.003, depth-.0012), (radius-.003, depth-.0012),
    ], glass_edge)

# Vertical orange fascia with a thin lower reveal, rather than a swollen band.
lens('Embedded amber annulus outer fascia', bx, bz, [
    (.943, .006), (.962, .006), (.964, .003),
    (.964, -.028), (.961, -.030), (.943, -.030),
], amber_inlay, 230, 364)
lens('Embedded amber annulus lower reveal', bx, bz, [
    (.946, .011), (.969, .011), (.969, .007), (.946, .007),
], amber_inlay, 230, 364)
lens('Embedded amber annulus inner fascia', bx, bz, [
    (.548, -.014), (.570, -.014), (.572, -.016),
    (.572, -.064), (.550, -.064), (.548, -.062),
], amber_inlay, 109, 225)

# Small room: same vocabulary, a flat inner orange ring and a clear vertical bore.
wall('Embedded optical cavity small outer wall', sx, sz, .576, .014, -.039)
wall('Embedded optical cavity small inner wall', sx, sz, .224, .014, -.066)
lens('Embedded optical cavity small lower plate', sx, sz, [
    (.220, .017), (.576, .017), (.576, .012), (.220, .012),
], glass_body)
lens('Subsurface refractive shoulder small roof', sx, sz, [
    (.345, -.054), (.574, -.038), (.580, -.042),
    (.580, -.047), (.349, -.063), (.345, -.060),
], glass_roof)
lens('Embedded amber annulus small inner ledge', sx, sz, [
    (.222, -.014), (.344, -.014), (.347, -.017),
    (.347, -.065), (.225, -.065), (.222, -.062),
], amber_inlay)
lens('Inner optical bevel small bore edge', sx, sz, [
    (.215, -.062), (.226, -.062), (.228, -.064),
    (.228, -.070), (.217, -.070), (.215, -.068),
], glass_edge)
for radius, depth in [(.578, -.046), (.346, -.063)]:
    lens('Concentric optical machining small cut edge', sx, sz, [
        (radius-.003, depth+.001), (radius+.003, depth+.001),
        (radius+.003, depth-.001), (radius-.003, depth-.001),
    ], glass_edge)
for bottom, top in [(.011, .005), (-.010, -.023)]:
    lens('Embedded amber annulus small lower fascia', sx, sz, [
        (.568, bottom), (.584, bottom), (.586, bottom-.002),
        (.586, top), (.568, top),
    ], amber_inlay)

# Fine uprights remain visible THROUGH the translucent walls and roof. No
# bevel modifier is applied: square-cut posts meet the underside of the roof.
for cx, cz, radius, count, depth, height in [
    (bx, bz, .938, 84, -.010, .043),
    (sx, sz, .566, 52, -.012, .045),
]:
    for i in range(count):
        angle = 2*math.pi*i/count
        obj = cube('Embedded optical cavity facade mullion',
                   (cx+radius*math.cos(angle), depth, cz+radius*math.sin(angle)),
                   (.005, height, .006), rib_material, 0)
        obj.rotation_euler.y = -angle

# One wide ribbon, tangent to BOTH roof rings. Its cross-section is flat with
# 0.001-unit cut edges. Width flares gently at the two landings; a shallow arch
# clears the ring roofs while staying comfortably below the cassette cover.
start_angle, end_angle = math.radians(-74), math.radians(215)
p0 = (bx+.82*math.cos(start_angle), bz+.82*math.sin(start_angle))
p3 = (sx+.44*math.cos(end_angle), sz+.44*math.sin(end_angle))
p1 = (p0[0]+.75*(-math.sin(start_angle)), p0[1]+.75*math.cos(start_angle))
p2 = (p3[0]-.44*math.sin(end_angle), p3[1]+.44*math.cos(end_angle))
controls = [p0, p1, p2, p3]
steps = 96
rows = []
for i in range(steps+1):
    t = i/steps
    u = 1-t
    weights = [u**3, 3*u*u*t, 3*u*t*t, t**3]
    x, z = [sum(w*p[axis] for w, p in zip(weights, controls)) for axis in [0, 1]]
    dx, dz = [3*u*u*(p1[axis]-p0[axis])+6*u*t*(p2[axis]-p1[axis])+3*t*t*(p3[axis]-p2[axis]) for axis in [0, 1]]
    length = math.hypot(dx, dz)
    nx, nz = -dz/length, dx/length
    width = .225 + .035*(abs(2*t-1)**4)
    top = -.054*(1-t) - .061*t - .010*math.sin(math.pi*t)**2
    half, bevel, thickness = width/2, .0012, .004
    section = [(-half, top+bevel), (-half+bevel, top),
               (half-bevel, top), (half, top+bevel),
               (half, top+thickness-bevel), (half-bevel, top+thickness),
               (-half+bevel, top+thickness), (-half, top+thickness-bevel)]
    rows.append([(x+w*nx, y, z+w*nz) for w, y in section])

vertices, faces = [], []
# Split vertices at section corners, share them along each longitudinal strip.
# The arch is smooth along the path, with no shading interpolation across its edges.
for side in range(8):
    base = len(vertices)
    for row in rows:
        vertices.extend([row[side], row[(side+1)%8]])
    for i in range(steps):
        a, b = base+2*i, base+2*(i+1)
        faces.append((a, b, b+1, a+1))
for row in [rows[0], list(reversed(rows[-1]))]:
    base = len(vertices); vertices.extend(row)
    faces.append(tuple(range(base, base+8)))
mesh = bpy.data.meshes.new('Optical ribbon continuous bridge')
mesh.from_pydata(vertices, [], faces); mesh.update()
bridge = bpy.data.objects.new('Optical ribbon continuous bridge', mesh)
scene.collection.objects.link(bridge); mesh.materials.append(bridge_glass)
for face in mesh.polygons:
    face.use_smooth = len(face.vertices)==4
# Delicate cut-edge reflections, not independent wires spanning empty space.
for side in [1, 2]:
    path = [(row[side][0], row[side][2]) for row in rows]
    verts, quads = [], []
    for i, row in enumerate(rows):
        outer, inner = row[side], row[0 if side==1 else 3]
        for p in [outer, inner]: verts.append((p[0],p[1]-.0003,p[2]))
    for i in range(steps):
        a=i*2
        face=(a,a+2,a+3,a+1)
        quads.append(tuple(reversed(face)) if side==1 else face)
    edge_mesh=bpy.data.meshes.new('Optical ribbon cut edge')
    edge_mesh.from_pydata(verts,[],quads);edge_mesh.update()
    edge_obj=bpy.data.objects.new('Optical ribbon cut edge',edge_mesh)
    scene.collection.objects.link(edge_obj);edge_mesh.materials.append(glass_edge)
    for p in edge_mesh.polygons:p.use_smooth=True

# Verify the physical constraint before material joins discard object identities.
bpy.context.view_layer.update()
for obj in scene.objects:
    if not obj.name.startswith(('Embedded optical', 'Embedded amber', 'Subsurface refractive',
                                'Inner optical', 'Concentric optical', 'Optical ribbon')):
        continue
    if obj.type!='MESH':continue
    points=[obj.matrix_world @ v.co for v in obj.data.vertices]
    assert all(-.086 < p.y < .019 for p in points), 'Interior exceeds cassette: '+obj.name
print('Optical architecture: sharp sections, one tangent bridge, no towers')
