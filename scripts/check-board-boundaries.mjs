import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const layout = require('../src/pinball-layout.js');
globalThis.window = globalThis.window || {};
require('../src/pinball-board-reference.js');
const boards = globalThis.window.PinballBoardReference;
const templates = require('../src/pinball-templates.js');
const width = 600;
const height = 1720;
const assembly = layout.flipperAssembly(width, height);
const field = assembly.playfield;
const ballRadius = 10;

// The shooter lane eats the right edge of the canvas, so the playfield is not
// centred on it. Everything in the lower third mirrors about the rails.
const axis = 2 * field.centerX;
assert.ok(axis < width, 'playfield centre must sit left of the canvas centre');

const mirroredPaths = [
    ['guide', assembly.leftGuide, assembly.rightGuide],
    ['outlane wall', assembly.leftOutlaneWall, assembly.rightOutlaneWall]
];
for (const [name, leftPath, rightPath] of mirroredPaths) {
    assert.equal(leftPath.length, rightPath.length, `${name} paths must have equal length`);
    for (let i = 0; i < leftPath.length; i++) {
        assert.equal(leftPath[i].x + rightPath[i].x, axis, `${name} point ${i} must mirror horizontally`);
        assert.equal(leftPath[i].y, rightPath[i].y, `${name} point ${i} must share a vertical coordinate`);
    }
}

assert.equal(assembly.left.bodyX + assembly.right.bodyX, axis, 'flipper bodies must mirror');
assert.equal(assembly.left.pivotX + assembly.right.pivotX, axis, 'flipper pivots must mirror');
assert.equal(assembly.leftSling.x + assembly.rightSling.x, axis, 'slingshots must mirror');
assert.equal(
    assembly.left.pivotX - assembly.leftGuide.at(-1).x,
    assembly.rightGuide.at(-1).x - assembly.right.pivotX,
    'guide tips must have equal pivot clearance'
);

// Both flippers must have the same room to work in, measured from the rail
// they actually sit behind — not from the canvas edge.
assert.equal(
    assembly.left.pivotX - field.innerLeft,
    field.innerRight - assembly.right.pivotX,
    'flippers must be centred on the playfield, not the canvas'
);

// The return guide must never touch the rail: that clear channel is the
// outlane, and a real one is a little over one ball wide.
const outlaneClear = assembly.leftGuide[0].x - assembly.guideThickness / 2 - field.innerLeft;
assert.ok(
    outlaneClear >= ballRadius * 2 * 1.2 && outlaneClear <= ballRadius * 2 * 1.9,
    `left outlane must stay open at roughly 1.2-1.9 ball widths, got ${outlaneClear.toFixed(1)}px`
);
assert.equal(
    field.innerRight - (assembly.rightGuide[0].x + assembly.guideThickness / 2),
    outlaneClear,
    'both outlanes must be the same width'
);

// The outlane wall branches off the rail rather than replacing it — the right
// rail is also the shooter lane divider, so it has to keep running past the
// branch or the ball leaks out of the plunger lane.
assert.equal(assembly.leftOutlaneWall[0].x, field.leftRail, 'left outlane wall must start on the rail');
assert.equal(assembly.rightOutlaneWall[0].x, field.rightRail, 'right outlane wall must start on the rail');
assert.equal(assembly.railEndY, assembly.leftOutlaneWall[0].y, 'the branch point must be reported as railEndY');

// The outlane has to stay a channel the whole way down, never pinching shut
// on the ball and never opening up into the drain early.
for (let i = 1; i < assembly.leftGuide.length; i++) {
    const guide = assembly.leftGuide[i];
    const wall = assembly.leftOutlaneWall[i];
    const gap = Math.hypot(guide.x - wall.x, guide.y - wall.y)
        - assembly.guideThickness / 2 - assembly.railThickness / 2;
    assert.ok(
        gap >= ballRadius * 2 * 1.1,
        `outlane pinches to ${gap.toFixed(1)}px at guide point ${i}`
    );
}

// The inlane has to hand the ball to the flipper, not past it. The guide tip
// sits ABOVE the pivot rather than beside it, so the opening between them runs
// diagonally: measuring it horizontally read 4px when the real hole was 22px,
// and the ball escaped around the outside of the flipper through a gap the
// test called sealed. layout.feedClearance walks the blade's whole swing.
//
// It models both bodies as sharp-cornered rectangles, which reads about 3px
// tighter than the chamfered blade really is, so the upper bound carries a
// margin — a clearance this says is 16px could be 19px in the engine.
const geometry = layout.flipperGeometry(width);
const feedMargin = 4;
const feedGap = layout.feedClearance(templates.LOWER, width, height);
assert.ok(
    feedGap > 0,
    `the return guide fouls the flipper blade by ${(-feedGap).toFixed(1)}px — the flipper cannot swing`
);
assert.ok(
    feedGap <= ballRadius * 2 - feedMargin,
    `the gap between the guide tip and the flipper is ${feedGap.toFixed(1)}px — the ball is ` +
    `${ballRadius * 2}px and will slip through it and around the outside of the flipper`
);

// The blade is drawn in base-grid pixels and has to be scaled onto the real
// board like everything else. Leaving it at a fixed pixel size while the pivots
// moved out with the board opened the centre drain to over five ball widths,
// which is what made almost every ball drain straight down the middle.
assert.ok(
    geometry.length > layout.FLIPPER.length,
    'the flipper blade must scale with the board, not stay at its base-grid size'
);
assert.equal(
    geometry.reach, geometry.length / 2 + geometry.pivotOffset,
    'the flipper reaches from its pivot to the far tip'
);

// The slingshot has to leave an inlane between itself and the return guide.
const slingRadius = 30;
const inlaneClear = (assembly.leftSling.x - slingRadius)
    - (assembly.leftGuide[0].x + assembly.guideThickness / 2);
assert.ok(
    inlaneClear >= ballRadius * 2 * 1.1,
    `left inlane must stay open for the ball, got ${inlaneClear.toFixed(1)}px`
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

const leftRail = layout.resolveSideBoundary({
    position: { x: -80, y: -height },
    velocity: { x: -35, y: -8 },
    minX: 47,
    maxX: 573
});
assert.equal(leftRail.corrected, true);
assert.equal(leftRail.reason, 'left-side-rail');
assert.equal(leftRail.position.x, 47);
assert.ok(leftRail.velocity.x > 0);

const rightRail = layout.resolveSideBoundary({
    position: { x: width + 80, y: -height },
    velocity: { x: 35, y: -8 },
    minX: 47,
    maxX: 573
});
assert.equal(rightRail.corrected, true);
assert.equal(rightRail.reason, 'right-side-rail');
assert.equal(rightRail.position.x, 573);
assert.ok(rightRail.velocity.x < 0);

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

// A side guide must either hug the rail or stand off far enough to be a real
// orbit lane. Anything in between is a slot too narrow for the ball to roll
// into but wide enough for the side-rail safety clamp to shove it into, which
// wedges the ball against the rail with nothing able to free it.
const guideThickness = 8;
for (const name of ['Classic', 'Vortex', 'Diamond', 'Castle', 'Wave']) {
    const profile = boards.profileFor(name);
    profile.guides.forEach((path, gi) => path.forEach(([gx], pi) => {
        const px = gx * width;
        const onLeft = px < width / 2;
        const clearance = onLeft
            ? (px - guideThickness / 2) - field.innerLeft
            : field.innerRight - (px + guideThickness / 2);
        assert.ok(
            clearance <= 2 || clearance >= ballRadius * 2 * 1.15,
            `${name} guide ${gi}.${pi} leaves a ${clearance.toFixed(1)}px slot beside the rail — ` +
            'either flush it against the rail or open it to a full lane'
        );
    }));
}

// Every table template has to survive a hand edit: the grid is the contract
// between src/pinball-templates.js, editor.html and the builder in index.html,
// so a part dragged off the playfield or a flipper end that breaks its own
// outlane must fail here rather than in someone's game.
const PART_KEYS = {
    wall: ['points', 'thickness', 'role'],
    bumper: ['x', 'y', 'r'],
    drop: ['x', 'y', 'w', 'h'],
    standup: ['x', 'y', 'w', 'h'],
    spinner: ['x', 'y', 'r'],
    ramp: ['x', 'y', 'w', 'h'],
    lane: ['x', 'y', 'w', 'h'],
    rollover: ['x', 'y', 'w', 'h'],
    powertarget: ['x', 'y', 'w', 'h'],
    missionramp: ['x', 'y', 'w', 'h'],
    scoop: ['x', 'y', 'r'],
    zone: ['x', 'y', 'r']
};

for (const name of Object.keys(templates.TEMPLATES)) {
    const template = templates.templateFor(name);
    const where = point => `${name}: point [${point}]`;

    const inGrid = ([gx, gy]) => gx >= -20 && gx <= templates.GRID_WIDTH + 20
        && gy >= -20 && gy <= templates.GRID_HEIGHT + 20;

    template.cabinet.forEach(part => part.points.forEach(p =>
        assert.ok(inGrid(p), `${where(p)} in the cabinet is off the grid`)));

    template.parts.forEach((part, i) => {
        const required = PART_KEYS[part.type];
        assert.ok(required, `${name} part ${i} has unknown type "${part.type}"`);
        required.forEach(key => assert.ok(part[key] !== undefined,
            `${name} part ${i} (${part.type}) is missing "${key}"`));
        if (part.type === 'wall') {
            assert.ok(part.points.length >= 2, `${name} part ${i} is a wall with fewer than 2 points`);
            part.points.forEach(p => assert.ok(inGrid(p), `${where(p)} is off the grid`));
        } else {
            assert.ok(inGrid([part.x, part.y]), `${where([part.x, part.y])} (${part.type}) is off the grid`);
        }
    });

    // The flipper end still has to hold its own shape after any edit.
    const built = layout.lowerAssembly(template.lower, width, height);

    // returnGuide and outlaneWall are independent splines now, so nothing stops
    // a hand edit from walking one into the other. Measure the real clearance
    // from every guide point to the outlane wall as a path — the two can carry
    // different point counts, so pairing them by index would not survive.
    const clearanceToPath = (point, path) => {
        let best = Infinity;
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const lengthSq = dx * dx + dy * dy;
            const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
            best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
        }
        return best;
    };
    built.leftGuide.forEach((point, i) => {
        const gap = clearanceToPath(point, built.leftOutlaneWall)
            - built.guideThickness / 2 - built.railThickness / 2;
        assert.ok(
            gap >= ballRadius * 2 * 1.1,
            `${name}: the outlane pinches to ${gap.toFixed(1)}px at guide point ${i} — the ball would jam`
        );
    });

    const clear = built.leftGuide[0].x - built.guideThickness / 2 - built.playfield.innerLeft;
    assert.ok(
        clear >= ballRadius * 2 * 1.1,
        `${name}: the outlane closes to ${clear.toFixed(1)}px — the ball can no longer drain down the side`
    );
    const feed = layout.feedClearance(template.lower, width, height);
    assert.ok(
        feed > 0,
        `${name}: the return guide fouls the flipper blade by ${(-feed).toFixed(1)}px`
    );
    assert.ok(
        feed <= ballRadius * 2 - feedMargin,
        `${name}: the guide tip leaves a ${feed.toFixed(1)}px opening beside the flipper — ` +
        'the ball escapes through it and around the outside of the blade'
    );

    // The hole between the resting flipper tips is the drain the player cannot
    // defend. A real machine leaves about two ball widths there; much wider and
    // the table plays itself into the gutter, much narrower and a ball coming
    // down the middle can never get through at all.
    //
    // This only means anything while the blades actually stay at restAngle,
    // which is what driveFlipper()'s clamp in index.html enforces. Without it
    // they swung to ±80° on a device dropping frames and this gap doubled.
    const centre = built.centerDrain / (ballRadius * 2);
    assert.ok(
        centre >= 2 && centre <= 3.2,
        `${name}: the centre drain is ${centre.toFixed(1)} ball widths between the flipper tips — ` +
        'keep it between 2 and 3.2 or the board drains down the middle'
    );
    assert.equal(
        built.leftGuide[0].x + built.rightGuide[0].x,
        2 * built.playfield.centerX,
        `${name}: the flipper end stopped mirroring`
    );
}

// A plunge is only useful if it clears the shooter lane. Simulate the rise
// under Matter's own integration at both ends of the plunger's travel: the
// weakest launch must still crest the top of the lane, or the ball dribbles
// back down and the player has to plunge again.
const stepMs = 1000 / 60;
const laneRise = height - height * (60 / layout.BASE_HEIGHT) - height * (50 / layout.BASE_HEIGHT);
const gravityPerStep = 0.8 * 0.001 * stepMs * stepMs;

for (const power of [0, 0.35, 1]) {
    const speed = layout.plungeSpeed({ rise: laneRise, power, stepMs });
    let velocity = speed;
    let travelled = 0;
    let steps = 0;
    while (velocity > 0 && steps < 10000) {
        velocity *= 1 - 0.0005;   // frictionAir, as the ball body applies it
        velocity -= gravityPerStep;
        if (velocity > 0) travelled += velocity;
        steps++;
    }
    assert.ok(
        travelled > laneRise,
        `plunge at power ${power} stalls ${Math.round(laneRise - travelled)}px short of the lane top`
    );
}

assert.ok(
    layout.plungeSpeed({ rise: laneRise, power: 1 }) > layout.plungeSpeed({ rise: laneRise, power: 0 }),
    'the plunger must still reward a longer pull'
);

console.log('boundary sweep passed: playfield-centred flipper geometry + open outlanes + lane-clearing plunge + two-sided rail guards + 252 climb cases');
