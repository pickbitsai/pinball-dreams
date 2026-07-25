import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const layout = require('../src/pinball-layout.js');

const width = 600;
const height = 1720;
const targetFloors = 20;
const ballRadius = 10;
const minX = 47;
const maxX = 573;
let cases = 0;
let offBoardErrors = 0;
let currentFloor = 0;

for (let floor = 0; floor < targetFloors; floor++) {
    assert.equal(currentFloor, floor, `autoplay must begin floor ${floor + 1} on the expected board`);

    for (const x of [-160, width / 2, width + 160]) {
        for (const speed of [-24, -90, -220]) {
            const sealed = layout.resolveClimbBoundary({
                width,
                height,
                currentFloor,
                position: { x, y: -(floor + 2.6) * height },
                velocity: { x: speed / 10, y: speed },
                gateBreached: false,
                ballRadius
            });
            assert.equal(sealed.floor, floor, `sealed floor ${floor + 1} escaped at x=${x}, vy=${speed}`);
            assert.equal(sealed.blocked, true);
            cases++;
        }
    }

    if (floor === targetFloors - 1) break;

    // Deliberately overshoot by more than two board lengths. The resolver must
    // still advance only one floor and return the ball to a valid playfield.
    const crossing = layout.resolveClimbBoundary({
        width,
        height,
        currentFloor,
        position: { x: width / 2, y: -(floor + 2.6) * height },
        velocity: { x: 7, y: -220 },
        gateBreached: true,
        ballRadius
    });
    assert.equal(crossing.floor, floor + 1, `floor ${floor + 1} skipped a board`);
    assert.equal(crossing.reason, 'single-floor-step');

    const side = layout.resolveSideBoundary({
        position: crossing.position,
        velocity: crossing.velocity,
        minX,
        maxX
    });
    if (side.corrected) offBoardErrors++;
    assert.equal(side.corrected, false, `autoplay left the side rails after floor ${floor + 1}`);
    assert.ok(side.position.x >= minX && side.position.x <= maxX);

    currentFloor = crossing.floor;
    cases += 2;
}

for (const probe of [
    { x: minX - 200, vx: -40, reason: 'left-side-rail' },
    { x: maxX + 200, vx: 40, reason: 'right-side-rail' }
]) {
    const side = layout.resolveSideBoundary({
        position: { x: probe.x, y: -height * 8 },
        velocity: { x: probe.vx, y: -12 },
        minX,
        maxX
    });
    assert.equal(side.corrected, true);
    assert.equal(side.reason, probe.reason);
    assert.ok(side.position.x >= minX && side.position.x <= maxX);
    assert.ok(probe.reason === 'left-side-rail' ? side.velocity.x >= 0 : side.velocity.x <= 0);
    cases++;
}

assert.equal(currentFloor + 1, targetFloors, 'autoplay must reach the twentieth board');
assert.equal(offBoardErrors, 0, 'autoplay must complete without an off-board correction');

console.log(
    `climb autoplay passed: ${targetFloors} floors, ${cases} boundary cases, ${offBoardErrors} off-board errors`
);
