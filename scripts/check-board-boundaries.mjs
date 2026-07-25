import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const layout = require('../src/pinball-layout.js');
const width = 600;
const height = 1720;
const assembly = layout.flipperAssembly(width, height);

for (let i = 0; i < assembly.leftGuide.length; i++) {
    const left = assembly.leftGuide[i];
    const right = assembly.rightGuide[i];
    assert.equal(left.x + right.x, width, `guide point ${i} must mirror horizontally`);
    assert.equal(left.y, right.y, `guide point ${i} must share a vertical coordinate`);
}

assert.equal(assembly.left.bodyX + assembly.right.bodyX, width, 'flipper bodies must mirror');
assert.equal(assembly.left.pivotX + assembly.right.pivotX, width, 'flipper pivots must mirror');
assert.equal(assembly.leftSling.x + assembly.rightSling.x, width, 'slingshots must mirror');
assert.equal(
    assembly.left.pivotX - assembly.leftGuide.at(-1).x,
    assembly.rightGuide.at(-1).x - assembly.right.pivotX,
    'guide tips must have equal pivot clearance'
);

const sealedCenter = layout.resolveClimbBoundary({
    width,
    height,
    currentFloor: 0,
    position: { x: width / 2, y: -40 },
    velocity: { x: 1, y: -35 },
    gateBreached: false
});
assert.equal(sealedCenter.floor, 0);
assert.equal(sealedCenter.blocked, true);
assert.ok(sealedCenter.position.y > 0);
assert.ok(sealedCenter.velocity.y > 0);

const sealedPlunger = layout.resolveClimbBoundary({
    width,
    height,
    currentFloor: 0,
    position: { x: width - 20, y: -300 },
    velocity: { x: 0, y: -50 },
    gateBreached: false
});
assert.equal(sealedPlunger.floor, 0);
assert.equal(sealedPlunger.reason, 'sealed-ceiling');
assert.ok(sealedPlunger.position.x < width - 70);

const breachedCenter = layout.resolveClimbBoundary({
    width,
    height,
    currentFloor: 0,
    position: { x: width / 2, y: -40 },
    velocity: { x: 0, y: -24 },
    gateBreached: true
});
assert.equal(breachedCenter.floor, 1);
assert.equal(breachedCenter.corrected, false);

const plungerBypass = layout.resolveClimbBoundary({
    width,
    height,
    currentFloor: 0,
    position: { x: width - 20, y: -40 },
    velocity: { x: 0, y: -24 },
    gateBreached: true
});
assert.equal(plungerBypass.floor, 0);
assert.equal(plungerBypass.reason, 'outside-ceiling-exit');

const multiFloorShot = layout.resolveClimbBoundary({
    width,
    height,
    currentFloor: 0,
    position: { x: width / 2, y: -height * 2.3 },
    velocity: { x: 4, y: -120 },
    gateBreached: true
});
assert.equal(multiFloorShot.floor, 1);
assert.equal(multiFloorShot.reason, 'single-floor-step');
assert.ok(layout.climbFloorForY(multiFloorShot.position.y, height) === 1);

const descending = layout.resolveClimbBoundary({
    width,
    height,
    currentFloor: 1,
    position: { x: width / 2, y: 12 },
    velocity: { x: 0, y: 18 },
    gateBreached: false
});
assert.equal(descending.floor, 0);
assert.equal(descending.reason, 'descending');

for (let x = -100; x <= width + 100; x += 20) {
    for (const speed of [-20, -60, -140]) {
        const sealedSweep = layout.resolveClimbBoundary({
            width,
            height,
            currentFloor: 0,
            position: { x, y: -height * 2.5 },
            velocity: { x: 3, y: speed },
            gateBreached: false
        });
        assert.equal(sealedSweep.floor, 0, `sealed sweep escaped at x=${x}, vy=${speed}`);

        const openSweep = layout.resolveClimbBoundary({
            width,
            height,
            currentFloor: 0,
            position: { x, y: -height * 2.5 },
            velocity: { x: 3, y: speed },
            gateBreached: true
        });
        assert.ok(openSweep.floor <= 1, `open sweep skipped a floor at x=${x}, vy=${speed}`);
    }
}

assert.ok(layout.launchScale(height) < height / 860, 'launch force must not scale linearly with length');
assert.ok(layout.launchScale(height) > 1, 'long boards still need a stronger launch');

console.log('boundary sweep passed: mirrored flipper geometry + 252 climb cases');
