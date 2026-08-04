(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PinballLayout = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const BASE_WIDTH = 400;
    const BASE_HEIGHT = 700;
    const RAIL_THICKNESS = 14;
    const GUIDE_THICKNESS = 12;

    // Playfield rails in base units. The plunger lane occupies the strip to the
    // right of the right rail, so the playfield is NOT centred on the canvas.
    // Everything in the lower third mirrors about the rails, never about
    // width / 2 — otherwise the right outlane lands inside the shooter lane.
    const RAIL_LEFT = 20;
    const RAIL_RIGHT = 350;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function scales(width, height) {
        return {
            x: value => value * (width / BASE_WIDTH),
            y: value => value * (height / BASE_HEIGHT)
        };
    }

    function playfield(width, height) {
        const { x } = scales(width, height);
        const leftRail = x(RAIL_LEFT);
        const rightRail = x(RAIL_RIGHT);
        return {
            leftRail,
            rightRail,
            innerLeft: leftRail + RAIL_THICKNESS / 2,
            innerRight: rightRail - RAIL_THICKNESS / 2,
            centerX: (leftRail + rightRail) / 2,
            railThickness: RAIL_THICKNESS
        };
    }

    // Offset a guide path perpendicular to its direction of travel. `sign` is
    // -1 on the left side (push outboard, toward the rail) and +1 on the right.
    // Offsetting rather than hand-placing keeps the outlane a constant width
    // down its whole length, the way a real wire guide does.
    function offsetPath(points, distance, sign) {
        return points.map((point, index) => {
            const prev = points[Math.max(0, index - 1)];
            const next = points[Math.min(points.length - 1, index + 1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 1;
            return {
                x: point.x + sign * (dy / length) * distance,
                y: point.y - sign * (dx / length) * distance
            };
        });
    }

    function flipperPlacement(width, height, side, baseY = 0) {
        const { x, y } = scales(width, height);
        const field = playfield(width, height);
        const isLeft = side === 'left';
        const bodyOffset = x(50);
        const bodyX = field.centerX + (isLeft ? -bodyOffset : bodyOffset);
        const bodyY = baseY + height - y(65);
        const pivotX = bodyX + (isLeft ? -25 : 25);
        return { side, bodyX, bodyY, pivotX, pivotY: bodyY };
    }

    // Offset the guide outboard to make the outlane's outer edge, then snap the
    // head onto the rail so the two meet without a seam the ball could squeeze
    // through. Only used when a template doesn't author the wall itself.
    function deriveOutlaneWall(guide, distance, field) {
        const path = offsetPath(guide, distance, -1);
        path[0] = { x: field.leftRail, y: path[0].y };
        return path;
    }

    // The flipper end, built from a template's editable `lower` block. Real
    // tables split the lower third into an outlane hugging the rail and an
    // inlane that feeds the flipper. The divider between them is a
    // free-standing return guide: it starts at a rubber post level with the top
    // of the slingshot and finishes inboard of the flipper pivot. It
    // deliberately never touches the rail — that clear channel IS the outlane,
    // and closing it is what stopped the ball ever draining down the side the
    // way it does on a real machine.
    //
    // Both lanes discharge OVER the flipper. The side orbits empty straight
    // into this channel, so a guide tip that stopped short of the pivot — and
    // an outlane wall that stopped short of it too — dumped every orbit ball
    // into the gutter beside the bat with nothing the player could do. The
    // guide tip now lands the inlane feed on the bat, and the outlane wall ends
    // hard against the pivot cap so the outer lane lands on its outer end. The
    // gap between the flipper tips is the drain.
    //
    // Only the LEFT side is authored. Everything right is mirrored here, so a
    // hand edit or an editor drag can never leave the two sides out of step.
    function lowerAssembly(lower, width, height, baseY = 0) {
        const { x, y } = scales(width, height);
        const field = playfield(width, height);
        const guideThickness = lower.guideThickness || GUIDE_THICKNESS;
        const railThickness = lower.railThickness || RAIL_THICKNESS;
        const toWorld = point => ({ x: x(point[0]), y: baseY + y(point[1]) });
        const mirror = point => ({ x: 2 * field.centerX - point.x, y: point.y });

        const bodyX = x(lower.flipper.x);
        const bodyY = baseY + y(lower.flipper.y);
        const left = { side: 'left', bodyX, bodyY, pivotX: bodyX - 25, pivotY: bodyY };
        const right = {
            side: 'right',
            bodyX: 2 * field.centerX - bodyX,
            bodyY,
            pivotX: 2 * field.centerX - left.pivotX,
            pivotY: bodyY
        };

        const leftGuide = lower.returnGuide.map(toWorld);
        const rightGuide = leftGuide.map(mirror);

        // The outlane's outer wall is its own spline, so it can be shaped by
        // hand independently of the guide. A template that omits it falls back
        // to one offset from the guide at outlaneWidth, which is how all the
        // built-in boards were originally authored.
        const outlaneWidth = x(lower.outlaneWidth);
        const leftOutlaneWall = lower.outlaneWall
            ? lower.outlaneWall.map(toWorld)
            : deriveOutlaneWall(leftGuide, outlaneWidth + guideThickness, field);
        const rightOutlaneWall = leftOutlaneWall.map(mirror);

        const leftSling = toWorld([lower.sling.x, lower.sling.y]);

        return {
            left,
            right,
            leftGuide,
            rightGuide,
            leftOutlaneWall,
            rightOutlaneWall,
            leftPost: { x: leftGuide[0].x, y: leftGuide[0].y },
            rightPost: { x: rightGuide[0].x, y: rightGuide[0].y },
            leftSling,
            rightSling: mirror(leftSling),
            outlaneWidth,
            guideThickness,
            railThickness,
            // Where the outlane wall branches off the rail.
            railEndY: leftOutlaneWall[0].y,
            playfield: field
        };
    }

    // The built-in geometry, kept here so the layout module stays testable on
    // its own. src/pinball-templates.js ships the same numbers as an editable
    // `lower` block; this is the fallback when a template omits one.
    const DEFAULT_LOWER = {
        outlaneWidth: 20,
        guideThickness: GUIDE_THICKNESS,
        railThickness: RAIL_THICKNESS,
        flipper: { x: 135, y: 635 },
        sling: { x: 95.33, y: 520 },
        returnGuide: [[48.67, 468], [56, 537], [81.33, 586], [130, 618]]
    };

    function flipperAssembly(width, height, baseY = 0, lower = DEFAULT_LOWER) {
        return lowerAssembly(lower, width, height, baseY);
    }

    function climbFloorForY(y, height) {
        if (y >= 0) return 0;
        return Math.max(0, Math.floor(-y / height + 1));
    }

    function resolveClimbBoundary({
        width,
        height,
        currentFloor,
        position,
        velocity,
        gateBreached,
        ballRadius = 10
    }) {
        const floor = Math.max(0, Math.floor(currentFloor || 0));
        const candidate = climbFloorForY(position.y, height);
        if (candidate <= floor) {
            return {
                floor: candidate,
                corrected: false,
                blocked: false,
                position,
                velocity,
                reason: candidate < floor ? 'descending' : 'same-floor'
            };
        }

        const { x, y } = scales(width, height);
        const baseY = -floor * height;
        const exitLeft = x(20) + ballRadius;
        const exitRight = width - x(50) - ballRadius;
        const insideCeilingExit = position.x >= exitLeft && position.x <= exitRight;

        if (!gateBreached || !insideCeilingExit) {
            return {
                floor,
                corrected: true,
                blocked: true,
                position: {
                    x: clamp(position.x, exitLeft, exitRight),
                    y: baseY + y(48)
                },
                velocity: {
                    x: velocity.x * 0.4,
                    y: Math.abs(velocity.y) * 0.55 + 2.5
                },
                reason: gateBreached ? 'outside-ceiling-exit' : 'sealed-ceiling'
            };
        }

        const nextFloor = floor + 1;
        if (candidate > nextFloor) {
            const nextBaseY = -nextFloor * height;
            return {
                floor: nextFloor,
                corrected: true,
                blocked: false,
                position: {
                    x: clamp(position.x, exitLeft, exitRight),
                    y: nextBaseY + y(45)
                },
                velocity: {
                    x: velocity.x * 0.5,
                    y: Math.abs(velocity.y) * 0.3 + 2
                },
                reason: 'single-floor-step'
            };
        }

        return {
            floor: nextFloor,
            corrected: false,
            blocked: false,
            position,
            velocity,
            reason: 'ceiling-breached'
        };
    }

    function resolveSideBoundary({
        position,
        velocity,
        minX,
        maxX
    }) {
        const x = clamp(position.x, minX, maxX);
        if (x === position.x) {
            return {
                corrected: false,
                position,
                velocity,
                reason: 'inside-side-rails'
            };
        }

        const hitLeft = position.x < minX;
        return {
            corrected: true,
            position: { x, y: position.y },
            velocity: {
                x: hitLeft ? Math.abs(velocity.x) : -Math.abs(velocity.x),
                y: velocity.y
            },
            reason: hitLeft ? 'left-side-rail' : 'right-side-rail'
        };
    }

    // Matter integrates force as (force / mass) * delta^2, so gravity supplies
    // gravity.y * gravity.scale * delta^2 pixels per step, per step. Inverting
    // that gives the exact speed a plunge needs to carry the ball a given rise.
    // Deriving it beats a tuned constant: the old fixed force let a short tap
    // launch at roughly a third of the speed needed to clear the shooter lane,
    // so the ball dribbled back down and the plunge had to be repeated.
    function plungeSpeed({
        rise,
        power = 0,
        gravityY = 0.8,
        gravityScale = 0.001,
        stepMs = 1000 / 60,
        margin = 1.16,
        range = 0.55
    }) {
        const accel = gravityY * gravityScale * stepMs * stepMs;
        // `margin` covers air friction over the length of the lane, so the
        // weakest possible plunge still crests the top instead of stalling.
        const exitSpeed = Math.sqrt(2 * accel * Math.max(1, rise)) * margin;
        return exitSpeed * (1 + range * clamp(power, 0, 1));
    }

    return {
        BASE_WIDTH,
        BASE_HEIGHT,
        RAIL_THICKNESS,
        GUIDE_THICKNESS,
        scales,
        playfield,
        offsetPath,
        flipperPlacement,
        flipperAssembly,
        lowerAssembly,
        DEFAULT_LOWER,
        climbFloorForY,
        resolveClimbBoundary,
        resolveSideBoundary,
        plungeSpeed
    };
}));
