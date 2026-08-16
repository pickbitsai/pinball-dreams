(function () {
    'use strict';

    const PX = 50;
    const BOARD_WIDTH = 600;
    const BOARD_HEIGHT = 1720;
    const WORLD_WIDTH = BOARD_WIDTH / PX;
    const WORLD_LENGTH = BOARD_HEIGHT / PX;

    function color(value, fallback) {
        try {
            return new THREE.Color(value || fallback);
        } catch {
            return new THREE.Color(fallback);
        }
    }

    function edgeLengths(body) {
        if (!body.vertices || body.vertices.length < 2) return [0.4, 0.2];
        const a = body.vertices[0];
        const b = body.vertices[1];
        const c = body.vertices[2] || body.vertices[0];
        return [
            Math.hypot(b.x - a.x, b.y - a.y) / PX,
            Math.hypot(c.x - b.x, c.y - b.y) / PX,
        ];
    }

    function disposeObject(object) {
        object.traverse((child) => {
            if (!child.isMesh) return;
            if (child.geometry && !child.userData.sharedGeometry) child.geometry.dispose();
            if (child.material && !child.userData.sharedMaterial) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => material.dispose());
            }
        });
    }

    class NeonPinball3D {
        constructor(options) {
            this.canvas = options.canvas;
            this.assetUrl = options.assetUrl;
            this.backdropUrl = options.backdropUrl;
            this.quality = options.quality === 'mobile' ? 'mobile' : 'high';
            this.mobileQuality = this.quality === 'mobile';
            this.dynamicLights = !this.mobileQuality;
            this.bodyMeshes = new Map();
            this.assetNodes = new Map();
            this.floorKey = '';
            this.elapsed = 0;

            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: !this.mobileQuality,
                alpha: false,
                powerPreference: 'high-performance',
            });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobileQuality ? 1 : 1.5));
            this.renderer.setSize(BOARD_WIDTH, BOARD_HEIGHT, false);
            this.viewportWidth = BOARD_WIDTH;
            this.viewportHeight = BOARD_HEIGHT;
            this.renderer.shadowMap.enabled = !this.mobileQuality;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.12;
            this.canvas.dataset.quality = this.quality;

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x02040b);
            this.scene.fog = new THREE.FogExp2(0x02040b, 0.018);

            this.camera = new THREE.PerspectiveCamera(38, BOARD_WIDTH / BOARD_HEIGHT, 0.1, 140);
            this.camera.position.set(0, WORLD_LENGTH * 0.93, WORLD_LENGTH * 0.91);
            this.camera.lookAt(0, 0, 0.72);

            this.worldRoot = new THREE.Group();
            this.worldRoot.name = 'ProceduralTable';
            this.scene.add(this.worldRoot);

            this.floorRoot = new THREE.Group();
            this.floorRoot.name = 'PlayfieldDecks';
            this.bodyRoot = new THREE.Group();
            this.bodyRoot.name = 'PhysicsModels';
            this.worldRoot.add(this.floorRoot, this.bodyRoot);

            this.materials = this.createMaterials();
            this.createEnvironment();
            this.loadAssets();
        }

        createMaterials() {
            const shared = (material) => {
                material.userData.shared = true;
                return material;
            };
            return {
                obsidian: shared(new THREE.MeshPhysicalMaterial({
                    color: 0x030611,
                    metalness: 0.88,
                    roughness: 0.23,
                    clearcoat: 0.86,
                    clearcoatRoughness: 0.16,
                })),
                chrome: shared(new THREE.MeshPhysicalMaterial({
                    color: 0x183249,
                    metalness: 1,
                    roughness: 0.13,
                    clearcoat: 1,
                })),
                glass: shared(new THREE.MeshPhysicalMaterial({
                    color: 0x071627,
                    metalness: 0.18,
                    roughness: 0.16,
                    transparent: true,
                    opacity: 0.72,
                    clearcoat: 1,
                })),
                ball: shared(new THREE.MeshPhysicalMaterial({
                    color: 0xcff7ff,
                    metalness: 0.94,
                    roughness: 0.08,
                    clearcoat: 1,
                    emissive: 0x173848,
                    emissiveIntensity: 0.52,
                })),
            };
        }

        neonMaterial(value, intensity = 2.6, opacity = 1) {
            const tint = color(value, '#1ac8ff');
            const material = new THREE.MeshStandardMaterial({
                color: tint,
                emissive: tint,
                emissiveIntensity: intensity,
                metalness: 0.22,
                roughness: 0.22,
                transparent: opacity < 1,
                opacity,
            });
            material.userData.neon = true;
            material.toneMapped = false;
            return material;
        }

        createEnvironment() {
            const hemisphere = new THREE.HemisphereLight(0x6edfff, 0x080218, 0.68);
            this.scene.add(hemisphere);

            const key = new THREE.SpotLight(0x24cfff, 4.1, WORLD_LENGTH * 1.7, Math.PI / 5.5, 0.48, 1.1);
            key.position.set(-6.5, 11, 3);
            key.target.position.set(0, 0, -1);
            key.castShadow = !this.mobileQuality;
            key.shadow.mapSize.set(this.mobileQuality ? 512 : 1024, this.mobileQuality ? 512 : 1024);
            this.scene.add(key, key.target);

            if (this.dynamicLights) {
                const pink = new THREE.PointLight(0xff208f, 3.2, 24, 1.4);
                pink.position.set(5.2, 5.5, -2.5);
                const amber = new THREE.PointLight(0xff6d20, 2.3, 17, 1.55);
                amber.position.set(-1.2, 2.8, 4.2);
                this.scene.add(pink, amber);
            }

            const horizon = new THREE.Mesh(
                new THREE.PlaneGeometry(38, 20),
                new THREE.MeshBasicMaterial({
                    color: 0x030713,
                    transparent: true,
                    opacity: 0.82,
                })
            );
            horizon.position.set(0, 3.8, -10.5);
            this.scene.add(horizon);

            if (this.backdropUrl) {
                new THREE.TextureLoader().load(
                    this.backdropUrl,
                    (texture) => {
                        texture.encoding = THREE.sRGBEncoding;
                        const backdrop = new THREE.Mesh(
                            new THREE.PlaneGeometry(34, 19),
                            new THREE.MeshBasicMaterial({
                                map: texture,
                                color: 0x859bc4,
                                transparent: true,
                                opacity: 0.58,
                                depthWrite: false,
                            })
                        );
                        backdrop.position.set(0, 4.3, -10.35);
                        this.scene.add(backdrop);
                    },
                    undefined,
                    () => {}
                );
            }
        }

        resize(width, height) {
            const safeWidth = Math.max(1, Math.floor(width));
            const safeHeight = Math.max(1, Math.floor(height));
            if (safeWidth === this.viewportWidth && safeHeight === this.viewportHeight) return;
            this.viewportWidth = safeWidth;
            this.viewportHeight = safeHeight;
            this.renderer.setSize(safeWidth, safeHeight, false);
            this.camera.aspect = safeWidth / safeHeight;
            this.camera.updateProjectionMatrix();
        }

        loadAssets() {
            if (!window.THREE || !THREE.GLTFLoader || !this.assetUrl) return;
            const loader = new THREE.GLTFLoader();
            loader.load(
                this.assetUrl,
                (gltf) => {
                    ['Bumper', 'Flipper', 'RailPost', 'Reactor', 'Ramp', 'Spinner'].forEach((name) => {
                        const node = gltf.scene.getObjectByName(name);
                        if (node) this.assetNodes.set(name, node);
                    });
                    gltf.scene.traverse((child) => {
                        if (!child.isMesh) return;
                        child.castShadow = !this.mobileQuality;
                        child.receiveShadow = !this.mobileQuality;
                        child.userData.sharedGeometry = true;
                        child.userData.sharedMaterial = true;
                    });
                    this.clearBodyMeshes();
                    this.floorKey = '';
                    this.canvas.dataset.assets = 'ready';
                },
                undefined,
                () => {
                    this.canvas.dataset.assets = 'fallback';
                }
            );
        }

        cloneAsset(name, primaryTint, secondaryTint) {
            const source = this.assetNodes.get(name);
            if (!source) return null;
            const clone = source.clone(true);
            clone.position.set(0, 0, 0);
            clone.rotation.set(0, 0, 0);
            clone.scale.set(1, 1, 1);
            clone.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = !this.mobileQuality;
                child.receiveShadow = !this.mobileQuality;
                child.userData.sharedGeometry = true;
                if (!primaryTint) {
                    child.userData.sharedMaterial = true;
                    return;
                }
                const rethemeMaterial = (sourceMaterial) => {
                    const material = sourceMaterial.clone();
                    const key = `${child.name} ${material.name}`.toLowerCase();
                    const isLuminous = /cyan|pink|amber|glow|inlay|anodized|light|ring|core|tip/.test(key);
                    if (isLuminous) {
                        const chosen = /cyan|pivot|left|cool/.test(key)
                            ? (secondaryTint || primaryTint)
                            : primaryTint;
                        const tint = color(chosen, primaryTint);
                        if (material.color) material.color.copy(tint);
                        if (material.emissive) {
                            material.emissive.copy(tint);
                            material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 2.8);
                        }
                        material.toneMapped = false;
                    }
                    return material;
                };
                child.material = Array.isArray(child.material)
                    ? child.material.map(rethemeMaterial)
                    : rethemeMaterial(child.material);
                child.userData.sharedMaterial = false;
            });
            return clone;
        }

        createDeck(theme, floorIndex) {
            const floor = new THREE.Group();
            floor.name = `Floor_${floorIndex + 1}`;
            floor.position.z = -floorIndex * WORLD_LENGTH;

            const shell = new THREE.Mesh(
                new THREE.BoxGeometry(WORLD_WIDTH + 0.68, 0.5, WORLD_LENGTH + 0.68),
                this.materials.obsidian
            );
            shell.position.y = -0.31;
            shell.receiveShadow = true;
            shell.castShadow = true;
            shell.userData.sharedMaterial = true;
            floor.add(shell);

            const surfaceMaterial = new THREE.MeshPhysicalMaterial({
                color: color(theme.bg, '#040817'),
                metalness: 0.72,
                roughness: 0.3,
                clearcoat: 1,
                clearcoatRoughness: 0.15,
                emissive: color(theme.bg, '#040817'),
                emissiveIntensity: 0.38,
            });
            const surface = new THREE.Mesh(
                new THREE.BoxGeometry(WORLD_WIDTH, 0.14, WORLD_LENGTH),
                surfaceMaterial
            );
            surface.position.y = 0.005;
            surface.receiveShadow = true;
            floor.add(surface);

            const grid = new THREE.GridHelper(
                WORLD_LENGTH - 0.35,
                this.mobileQuality ? 28 : 56,
                color(theme.wall, '#1ac8ff'),
                color(theme.wall, '#1ac8ff')
            );
            grid.scale.x = WORLD_WIDTH / WORLD_LENGTH;
            grid.position.y = 0.086;
            grid.material.transparent = true;
            grid.material.opacity = 0.115;
            grid.material.depthWrite = false;
            floor.add(grid);

            const cyan = this.neonMaterial(theme.wall, 3.3);
            const pink = this.neonMaterial(theme.bumper, 3.6);
            const amber = this.neonMaterial(theme.accent, 3.2);

            const edgeSegments = this.mobileQuality ? 8 : 14;
            const edgeGeometryLong = new THREE.CylinderGeometry(0.055, 0.055, WORLD_LENGTH + 0.1, edgeSegments);
            const edgeGeometryShort = new THREE.CylinderGeometry(0.055, 0.055, WORLD_WIDTH + 0.1, edgeSegments);
            const addEdge = (geometry, material, x, z, rotationZ, rotationX) => {
                const edge = new THREE.Mesh(geometry, material);
                edge.position.set(x, 0.16, z);
                edge.rotation.z = rotationZ || 0;
                edge.rotation.x = rotationX || 0;
                floor.add(edge);
            };
            addEdge(edgeGeometryLong, cyan, -WORLD_WIDTH / 2 - 0.15, 0, 0, Math.PI / 2);
            addEdge(edgeGeometryLong, pink, WORLD_WIDTH / 2 + 0.15, 0, 0, Math.PI / 2);
            addEdge(edgeGeometryShort, amber, 0, -WORLD_LENGTH / 2 - 0.15, Math.PI / 2, 0);

            if (this.dynamicLights) {
                const underGlow = new THREE.PointLight(color(theme.bumper, '#ff2fba'), 2.4, 8, 1.7);
                underGlow.position.set(0, 0.55, WORLD_LENGTH * 0.12);
                floor.add(underGlow);
            }

            const reactor = this.cloneAsset('Reactor', theme.accent, theme.wall);
            if (reactor) {
                reactor.scale.setScalar(0.62);
                reactor.position.set(0, -0.42, -WORLD_LENGTH / 2 + 1.25);
                floor.add(reactor);
            } else {
                const core = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 12, 48), amber);
                core.rotation.x = Math.PI / 2;
                core.position.set(0, 0.12, -WORLD_LENGTH / 2 + 1.25);
                floor.add(core);
            }

            this.floorRoot.add(floor);
        }

        syncDecks(theme, floorCount, floorThemes) {
            const themes = Array.isArray(floorThemes) && floorThemes.length ? floorThemes : [theme];
            const themeKey = themes.map(item => `${item.bg}|${item.wall}|${item.bumper}|${item.accent}`).join('::');
            const key = `${themeKey}|${floorCount}|${this.assetNodes.size}`;
            if (key === this.floorKey) return;
            this.floorKey = key;
            while (this.floorRoot.children.length) {
                const child = this.floorRoot.children.pop();
                disposeObject(child);
            }
            for (let floor = 0; floor < floorCount; floor++) {
                this.createDeck(themes[floor % themes.length] || theme, floor);
            }
        }

        addTube(group, curve, radius, material, segments, radialSegments = 14) {
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(curve, segments, radius, radialSegments, false),
                material
            );
            tube.castShadow = true;
            tube.receiveShadow = true;
            if (material.userData?.shared) tube.userData.sharedMaterial = true;
            group.add(tube);
            return tube;
        }

        addRoundTubeCaps(group, curve, radius, material, segments = 18) {
            [0, 1].forEach((t) => {
                const cap = new THREE.Mesh(
                    new THREE.SphereGeometry(radius, segments, Math.max(10, Math.floor(segments * 0.7))),
                    material
                );
                cap.position.copy(curve.getPoint(t));
                cap.castShadow = true;
                cap.receiveShadow = true;
                if (material.userData?.shared) cap.userData.sharedMaterial = true;
                group.add(cap);
            });
        }

        addRailSupports(group, curve, length) {
            const count = Math.max(2, Math.ceil(length / 1.35) + 1);
            for (let i = 0; i < count; i++) {
                const point = curve.getPointAt(i / (count - 1));
                const post = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.085, 0.11, 0.42, 12),
                    this.materials.obsidian
                );
                post.position.set(point.x, 0.23, point.z);
                post.castShadow = true;
                post.userData.sharedMaterial = true;
                group.add(post);
            }
        }

        createWallPath(body, theme) {
            const wall = body.plugin?.neonWall;
            if (!wall?.root || !Array.isArray(wall.points) || wall.points.length < 2) return null;

            const tint = body.render?.fillStyle || theme.wall;
            const baseRadius = Math.max((wall.thickness || 10) / PX / 2, 0.075);
            const basePoints = wall.points.map(point => new THREE.Vector3(
                (point.x - BOARD_WIDTH / 2) / PX,
                0.26,
                (point.y - BOARD_HEIGHT / 2) / PX
            ));
            const neonPoints = basePoints.map(point => new THREE.Vector3(point.x, 0.5, point.z));
            const curve = basePoints.length === 2
                ? new THREE.LineCurve3(basePoints[0], basePoints[1])
                : new THREE.CatmullRomCurve3(basePoints, false, 'centripetal', 0.32);
            const neonCurve = neonPoints.length === 2
                ? new THREE.LineCurve3(neonPoints[0], neonPoints[1])
                : new THREE.CatmullRomCurve3(neonPoints, false, 'centripetal', 0.32);
            const pathLength = Math.max(curve.getLength(), 0.2);
            const tubularSegments = Math.max(12, Math.ceil(pathLength * 11));
            const group = new THREE.Group();
            const neonMaterial = this.neonMaterial(tint, 1.65);

            this.addTube(group, curve, baseRadius, this.materials.chrome, tubularSegments, 16);
            this.addRoundTubeCaps(group, curve, baseRadius, this.materials.chrome, 20);
            this.addTube(group, neonCurve, 0.075, neonMaterial, tubularSegments, 14);
            this.addRoundTubeCaps(group, neonCurve, 0.075, neonMaterial, 16);
            this.addRailSupports(group, curve, pathLength);

            group.userData.worldSpace = true;
            group.userData.wallPathId = wall.id;
            return group;
        }

        createRail(body, theme) {
            const lengths = edgeLengths(body);
            const railLength = Math.max(lengths[0], lengths[1], 0.18);
            const railWidth = Math.max(Math.min(lengths[0], lengths[1]), 0.11);
            const tint = body.render && body.render.fillStyle ? body.render.fillStyle : theme.wall;
            const group = new THREE.Group();
            const baseRadius = Math.max(railWidth / 2, 0.065);
            const baseCurve = new THREE.LineCurve3(
                new THREE.Vector3(-railLength / 2, 0.26, 0),
                new THREE.Vector3(railLength / 2, 0.26, 0)
            );
            const neonCurve = new THREE.LineCurve3(
                new THREE.Vector3(-railLength / 2, 0.5, 0),
                new THREE.Vector3(railLength / 2, 0.5, 0)
            );
            const tubeSegments = Math.max(8, Math.ceil(railLength * 10));
            const neonMaterial = this.neonMaterial(tint, 1.45);

            this.addTube(group, baseCurve, baseRadius, this.materials.chrome, tubeSegments, 16);
            this.addRoundTubeCaps(group, baseCurve, baseRadius, this.materials.chrome, 18);
            this.addTube(group, neonCurve, 0.075, neonMaterial, tubeSegments, 14);
            this.addRoundTubeCaps(group, neonCurve, 0.075, neonMaterial, 16);
            this.addRailSupports(group, baseCurve, railLength);
            group.userData.rotationOffset = lengths[1] > lengths[0] ? -Math.PI / 2 : 0;
            return group;
        }

        createBumper(body, theme) {
            const group = new THREE.Group();
            const tint = body.render?.fillStyle || theme.bumper;
            const asset = this.cloneAsset('Bumper', tint, theme.wall);
            const desiredRadius = body.circleRadius / PX;
            if (asset) {
                const scale = desiredRadius / 0.62;
                asset.scale.setScalar(scale);
                group.add(asset);
            } else {
                const base = new THREE.Mesh(
                    new THREE.CylinderGeometry(desiredRadius, desiredRadius * 1.08, 0.28, 40),
                    this.materials.chrome
                );
                base.position.y = 0.16;
                base.castShadow = true;
                base.userData.sharedMaterial = true;
                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(desiredRadius * 0.76, desiredRadius * 0.14, 12, 48),
                    this.neonMaterial(theme.bumper, 3.8)
                );
                ring.rotation.x = Math.PI / 2;
                ring.position.y = 0.38;
                group.add(base, ring);
            }
            if (this.dynamicLights) {
                const light = new THREE.PointLight(color(tint, '#ff2fba'), 1.3, 3.3, 1.8);
                light.position.y = 0.66;
                group.add(light);
            }
            group.userData.flashable = true;
            group.userData.baseScale = group.scale.clone();
            return group;
        }

        createFlipper(body, theme) {
            const group = new THREE.Group();
            // The blade scales with the board, so the model has to follow it —
            // the kit is authored against a 60px blade.
            const length = body.plugin?.flipper?.length || 60;
            const fit = length / 60;
            const asset = this.cloneAsset('Flipper', body.render?.fillStyle || theme.accent, theme.wall);
            if (asset) {
                asset.position.x = -0.08 * fit;
                asset.scale.setScalar(0.7 * fit);
                if ((body.label || '').includes('right')) {
                    asset.rotation.y = Math.PI;
                }
                group.add(asset);
            } else {
                const bodyMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1.22 * fit, 0.28 * fit, 0.28 * fit),
                    this.neonMaterial(theme.accent, 2.8)
                );
                bodyMesh.position.y = 0.24;
                bodyMesh.castShadow = true;
                group.add(bodyMesh);
            }
            group.userData.baseScale = group.scale.clone();
            return group;
        }

        createBall(body) {
            const radius = body.circleRadius / PX;
            const group = new THREE.Group();
            const ballMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xcff7ff,
                metalness: 0.94,
                roughness: 0.08,
                clearcoat: 1,
                emissive: 0x173848,
                emissiveIntensity: 0.52,
            });
            const ballMesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, this.mobileQuality ? 20 : 32, this.mobileQuality ? 14 : 24),
                ballMaterial
            );
            ballMesh.position.y = radius + 0.18;
            ballMesh.castShadow = !this.mobileQuality;
            const glow = this.dynamicLights ? new THREE.PointLight(0xa8efff, 1.1, 3.2, 1.7) : null;
            if (glow) glow.position.y = radius + 0.32;

            const fire = new THREE.Group();
            const fireMaterial = this.neonMaterial('#ff5a24', 4.6, 0.9);
            const fireRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.32, radius * 0.11, 10, 36), fireMaterial);
            fireRing.rotation.x = Math.PI / 2;
            fireRing.position.y = radius + 0.18;
            fire.add(fireRing);
            for (let i = 0; i < 7; i++) {
                const ember = new THREE.Mesh(
                    new THREE.TetrahedronGeometry(radius * (0.18 + (i % 3) * 0.04)),
                    fireMaterial
                );
                ember.userData.phase = i / 7 * Math.PI * 2;
                fire.add(ember);
            }

            const ice = new THREE.Group();
            const iceMaterial = this.neonMaterial('#5ee7ff', 3.9, 0.72);
            iceMaterial.wireframe = true;
            const iceShell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.42, 1), iceMaterial);
            iceShell.position.y = radius + 0.18;
            const iceHalo = new THREE.Mesh(
                new THREE.TorusGeometry(radius * 1.55, radius * 0.065, 8, 42),
                this.neonMaterial('#b9f7ff', 4.2, 0.78)
            );
            iceHalo.rotation.x = Math.PI / 2;
            iceHalo.position.y = radius + 0.18;
            ice.add(iceShell, iceHalo);

            const rock = new THREE.Group();
            const rockMaterial = new THREE.MeshStandardMaterial({
                color: 0x9b6337,
                metalness: 0.48,
                roughness: 0.58,
                emissive: 0x5a2508,
                emissiveIntensity: 0.75,
            });
            for (let i = 0; i < 7; i++) {
                const shard = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(radius * (0.2 + (i % 3) * 0.045), 0),
                    rockMaterial
                );
                shard.userData.phase = i / 7 * Math.PI * 2;
                rock.add(shard);
            }
            const rockRing = new THREE.Mesh(
                new THREE.TorusGeometry(radius * 1.34, radius * 0.09, 8, 32),
                this.neonMaterial('#ffc15a', 3.2, 0.8)
            );
            rockRing.rotation.x = Math.PI / 2;
            rockRing.position.y = radius + 0.18;
            rock.add(rockRing);

            fire.visible = false;
            ice.visible = false;
            rock.visible = false;
            group.add(ballMesh, fire, ice, rock);
            if (glow) group.add(glow);
            group.userData.ballFx = { ballMesh, glow, fire, fireRing, ice, iceShell, iceHalo, rock, rockRing, radius, type: 'normal' };
            return group;
        }

        updateBallFx(group, body, powerState) {
            const fx = group.userData.ballFx;
            if (!fx) return;
            const type = powerState?.active || body.plugin?.element || 'normal';
            fx.type = type;
            fx.fire.visible = type === 'fire';
            fx.ice.visible = type === 'ice';
            fx.rock.visible = type === 'rock';

            const palettes = {
                normal: { color: '#d7f6ff', emissive: '#173848', light: '#a8efff' },
                fire: { color: '#ffd27a', emissive: '#ff2400', light: '#ff4a18' },
                ice: { color: '#d9fbff', emissive: '#168dff', light: '#5ee7ff' },
                rock: { color: '#8b5a35', emissive: '#5a2508', light: '#ffc15a' },
            };
            const palette = palettes[type] || palettes.normal;
            fx.ballMesh.material.color.copy(color(palette.color, '#d7f6ff'));
            fx.ballMesh.material.emissive.copy(color(palette.emissive, '#173848'));
            fx.ballMesh.material.emissiveIntensity = type === 'normal' ? 0.52 : 1.3;
            if (fx.glow) {
                fx.glow.color.copy(color(palette.light, '#a8efff'));
                fx.glow.intensity = type === 'normal' ? 1.1 : 2.8;
            }

            const time = this.elapsed;
            if (type === 'fire') {
                fx.fireRing.rotation.z = time * 3.8;
                fx.fire.children.slice(1).forEach((ember, index) => {
                    const phase = ember.userData.phase + time * (2.4 + index * 0.08);
                    const orbit = fx.radius * (1.35 + (index % 2) * 0.3);
                    ember.position.set(
                        Math.cos(phase) * orbit,
                        fx.radius + 0.18 + Math.sin(time * 5 + index) * fx.radius * 0.9,
                        Math.sin(phase) * orbit
                    );
                    ember.rotation.x += 0.08;
                    ember.rotation.y += 0.11;
                });
            } else if (type === 'ice') {
                fx.iceShell.rotation.x = time * 0.8;
                fx.iceShell.rotation.y = time * 1.1;
                fx.iceHalo.rotation.z = -time * 2.1;
                fx.iceHalo.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
            } else if (type === 'rock') {
                fx.rockRing.rotation.z = time * 1.35;
                fx.rock.children.slice(0, 7).forEach((shard, index) => {
                    const phase = shard.userData.phase + time * (0.75 + index * 0.03);
                    const orbit = fx.radius * (1.25 + (index % 3) * 0.18);
                    shard.position.set(
                        Math.cos(phase) * orbit,
                        fx.radius + 0.18 + Math.sin(phase * 1.7) * fx.radius * 0.55,
                        Math.sin(phase) * orbit
                    );
                    shard.rotation.x += 0.025;
                    shard.rotation.y -= 0.035;
                });
            }
        }

        createPost(body, theme) {
            const group = new THREE.Group();
            const asset = this.cloneAsset('RailPost', body.render?.fillStyle || theme.accent, theme.wall);
            if (asset) {
                const scale = Math.max((body.circleRadius || 7) / PX / 0.31, 0.35);
                asset.scale.setScalar(scale);
                group.add(asset);
            } else {
                const post = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.13, 0.58, 16),
                    this.materials.chrome
                );
                post.position.y = 0.29;
                post.castShadow = true;
                post.userData.sharedMaterial = true;
                group.add(post);
            }
            return group;
        }

        createRamp(body, theme) {
            const group = new THREE.Group();
            const asset = this.cloneAsset('Ramp', body.render?.fillStyle || theme.accent, theme.wall);
            if (asset) {
                asset.scale.setScalar(0.72);
                asset.rotation.y = Math.PI;
                group.add(asset);
            } else {
                const ramp = new THREE.Mesh(
                    new THREE.BoxGeometry(1.25, 0.16, 1.65),
                    this.materials.glass
                );
                ramp.rotation.x = -0.16;
                ramp.position.y = 0.26;
                ramp.userData.sharedMaterial = true;
                group.add(ramp);
            }
            return group;
        }

        createSpinner(body, theme) {
            const group = new THREE.Group();
            const asset = this.cloneAsset('Spinner', body.render?.fillStyle || theme.accent, theme.wall);
            if (asset) {
                asset.scale.setScalar(0.72);
                group.add(asset);
            }
            group.userData.spinner = true;
            return group;
        }

        createTarget(body, theme) {
            const lengths = edgeLengths(body);
            const width = Math.max(lengths[0], lengths[1], 0.3);
            const target = new THREE.Mesh(
                new THREE.BoxGeometry(width, 0.65, 0.18),
                this.neonMaterial(body.render?.fillStyle || theme.accent, 2.8)
            );
            target.position.y = 0.34;
            target.castShadow = true;
            const group = new THREE.Group();
            group.add(target);
            return group;
        }

        createZone(body) {
            const type = (body.label || '').replace('zone-', '');
            const palette = { fire: '#ff5a24', ice: '#5ee7ff', rock: '#e2a15a' };
            const tint = palette[type] || '#1ac8ff';
            const radius = Math.max((body.circleRadius || 50) / PX, 0.5);
            const group = new THREE.Group();
            const zoneSegments = this.mobileQuality ? 32 : 64;
            const field = new THREE.Mesh(
                new THREE.CircleGeometry(radius, zoneSegments),
                this.neonMaterial(tint, 0.85, 0.12)
            );
            field.rotation.x = -Math.PI / 2;
            field.position.y = 0.105;
            field.material.depthWrite = false;
            const outer = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.055, this.mobileQuality ? 6 : 10, zoneSegments),
                this.neonMaterial(tint, 3.4, 0.82)
            );
            outer.rotation.x = Math.PI / 2;
            outer.position.y = 0.13;
            const inner = new THREE.Mesh(
                new THREE.TorusGeometry(radius * 0.62, 0.026, this.mobileQuality ? 6 : 8, this.mobileQuality ? 24 : 48),
                this.neonMaterial(tint, 2.4, 0.55)
            );
            inner.rotation.x = Math.PI / 2;
            inner.position.y = 0.135;
            const light = this.dynamicLights
                ? new THREE.PointLight(color(tint, '#1ac8ff'), 1.15, radius * 4.5, 1.8)
                : null;
            if (light) light.position.y = 0.36;
            group.add(field, outer, inner);
            if (light) group.add(light);
            group.userData.zoneFx = { type, outer, inner, light };
            return group;
        }

        createScoop(body, theme) {
            const tint = body.render?.fillStyle || theme.secondary || theme.accent;
            const radius = Math.max((body.circleRadius || 18) / PX, 0.28);
            const group = new THREE.Group();
            const housing = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 1.15, radius * 1.28, 0.18, 36),
                this.materials.obsidian
            );
            housing.position.y = 0.11;
            housing.userData.sharedMaterial = true;
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.065, 10, 40),
                this.neonMaterial(tint, 3.8)
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.23;
            const core = new THREE.Mesh(
                new THREE.CircleGeometry(radius * 0.68, 36),
                new THREE.MeshStandardMaterial({ color: 0x01030a, metalness: 0.8, roughness: 0.25 })
            );
            core.rotation.x = -Math.PI / 2;
            core.position.y = 0.225;
            group.add(housing, ring, core);
            group.userData.scoopFx = ring;
            return group;
        }

        createLaneGate(body, theme) {
            const lengths = edgeLengths(body);
            const width = Math.max(lengths[0], lengths[1], 0.45);
            const tint = body.render?.fillStyle || theme.wall;
            const group = new THREE.Group();
            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(width, 0.075, 0.11),
                this.neonMaterial(tint, 2.8, 0.75)
            );
            bar.position.y = 0.16;
            group.add(bar);
            group.userData.laneFx = bar;
            group.userData.rotationOffset = lengths[1] > lengths[0] ? -Math.PI / 2 : 0;
            return group;
        }

        createPowerCapsule(body, theme) {
            const tint = body.render?.fillStyle || theme.secondary || theme.accent;
            const radius = Math.max((body.circleRadius || 13) / PX, 0.2);
            const group = new THREE.Group();
            const shell = new THREE.Mesh(
                new THREE.IcosahedronGeometry(radius, 1),
                this.neonMaterial(tint, 4.4, 0.9)
            );
            shell.position.y = radius + 0.28;
            const cage = new THREE.Mesh(
                new THREE.IcosahedronGeometry(radius * 1.35, 1),
                this.neonMaterial('#ffffff', 2.4, 0.45)
            );
            cage.material.wireframe = true;
            cage.position.y = radius + 0.28;
            group.add(shell, cage);
            group.userData.capsuleFx = { shell, cage };
            return group;
        }

        createSlingshot(body, theme) {
            const group = new THREE.Group();
            const radius = 0.58;
            const prism = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, 0.32, 3),
                this.neonMaterial(theme.accent, 3.2)
            );
            prism.position.y = 0.2;
            prism.rotation.y = Math.PI / 6;
            prism.castShadow = true;
            group.add(prism);
            return group;
        }

        createBodyMesh(body, theme) {
            if (!body || body.render?.fillStyle === 'transparent') return null;
            const label = body.label || '';
            let group;
            if (body.plugin?.neonWall) group = this.createWallPath(body, theme);
            else if (label === 'ball') group = this.createBall(body);
            else if (label.startsWith('zone-')) group = this.createZone(body, theme);
            else if (label === 'power-scoop') group = this.createScoop(body, theme);
            else if (label === 'mission-lane' || label === 'bonus-lane') group = this.createLaneGate(body, theme);
            else if (label === 'power-capsule') group = this.createPowerCapsule(body, theme);
            else if (label === 'bumper') group = this.createBumper(body, theme);
            else if (label.includes('flipper')) group = this.createFlipper(body, theme);
            else if (label === 'ramp' || label === 'mission-ramp' || label === 'feature-ramp') group = this.createRamp(body, theme);
            else if (label === 'spinner') group = this.createSpinner(body, theme);
            else if (label === 'drop-target' || label === 'floor-panel' || label === 'power-target' || label === 'standup-target') group = this.createTarget(body, theme);
            else if (label === 'slingshot') group = this.createSlingshot(body, theme);
            else if (body.circleRadius) group = this.createPost(body, theme);
            else group = this.createRail(body, theme);
            if (!group) return null;
            group.name = `Body_${body.id}_${label || 'rail'}`;
            group.userData.bodyLabel = label;
            group.userData.baseScale = group.scale.clone();
            this.bodyRoot.add(group);
            return group;
        }

        clearBodyMeshes() {
            this.bodyMeshes.forEach((mesh) => {
                this.bodyRoot.remove(mesh);
                disposeObject(mesh);
            });
            this.bodyMeshes.clear();
        }

        syncBodies(bodies, theme, powerState) {
            const active = new Set();
            bodies.forEach((body) => {
                if (body.render?.fillStyle === 'transparent') return;
                active.add(body.id);
                let mesh = this.bodyMeshes.get(body.id);
                if (!mesh) {
                    mesh = this.createBodyMesh(body, theme);
                    if (!mesh) return;
                    this.bodyMeshes.set(body.id, mesh);
                }
                if (!mesh.userData.worldSpace) {
                    mesh.position.x = (body.position.x - BOARD_WIDTH / 2) / PX;
                    mesh.position.z = (body.position.y - BOARD_HEIGHT / 2) / PX;
                    mesh.rotation.y = -body.angle + (mesh.userData.rotationOffset || 0);
                }

                const base = mesh.userData.baseScale || new THREE.Vector3(1, 1, 1);
                const flash = body.plugin?.isFlashing ? 1.12 : 1;
                mesh.scale.set(base.x * flash, base.y * flash, base.z * flash);

                if (mesh.userData.spinner) mesh.rotation.y += this.elapsed * 2.2;
                if (mesh.userData.bodyLabel === 'ball') this.updateBallFx(mesh, body, powerState);
                if (mesh.userData.zoneFx) {
                    const zoneFx = mesh.userData.zoneFx;
                    const matched = powerState?.active === zoneFx.type && powerState?.zone === zoneFx.type;
                    const pulse = 1 + Math.sin(this.elapsed * (matched ? 7.5 : 3.2)) * (matched ? 0.1 : 0.035);
                    zoneFx.outer.scale.setScalar(pulse);
                    zoneFx.inner.rotation.z = this.elapsed * (matched ? -1.8 : -0.55);
                    if (zoneFx.light) zoneFx.light.intensity = matched ? 3.2 : 1.15;
                }
                if (mesh.userData.scoopFx) {
                    mesh.userData.scoopFx.rotation.z = this.elapsed * (powerState?.armed ? 3.4 : 0.8);
                    mesh.userData.scoopFx.scale.setScalar(
                        powerState?.armed ? 1 + Math.sin(this.elapsed * 7) * 0.12 : 1
                    );
                }
                if (mesh.userData.laneFx) {
                    mesh.userData.laneFx.material.emissiveIntensity = body.plugin?.lit ? 6.5 : 2.8;
                    mesh.userData.laneFx.scale.y = body.plugin?.lit ? 1.8 : 1;
                }
                if (mesh.userData.capsuleFx) {
                    mesh.userData.capsuleFx.shell.rotation.y = this.elapsed * 2.2;
                    mesh.userData.capsuleFx.cage.rotation.x = -this.elapsed * 1.4;
                    mesh.userData.capsuleFx.cage.rotation.y = this.elapsed * 1.1;
                }
            });

            this.bodyMeshes.forEach((mesh, id) => {
                if (active.has(id)) return;
                this.bodyRoot.remove(mesh);
                disposeObject(mesh);
                this.bodyMeshes.delete(id);
            });
        }

        render(state, deltaSeconds) {
            if (!state || !state.level) return;
            this.elapsed += Math.min(Math.max(deltaSeconds || 1 / 60, 1 / 240), 0.08);
            const floorCount = Math.max(1, state.floorCount || 1);
            this.syncDecks(state.level.theme, floorCount, state.floorThemes);
            this.worldRoot.position.z = (state.cameraY || 0) / PX;
            const cameraY = state.cameraY || 0;
            const bodies = this.mobileQuality
                ? (state.bodies || []).filter((body) => {
                    if (body.label === 'ball') return true;
                    const screenY = body.position.y + cameraY;
                    return screenY > -BOARD_HEIGHT * 0.35 && screenY < BOARD_HEIGHT * 1.35;
                })
                : (state.bodies || []);
            this.syncBodies(bodies, state.level.theme, state.powerState);

            const targetCameraX = state.ball
                ? THREE.MathUtils.clamp((state.ball.position.x - BOARD_WIDTH / 2) / PX * 0.08, -0.25, 0.25)
                : 0;
            this.camera.position.x += (targetCameraX - this.camera.position.x) * 0.035;
            this.renderer.render(this.scene, this.camera);
        }
    }

    window.NeonPinball3D = NeonPinball3D;
})();
