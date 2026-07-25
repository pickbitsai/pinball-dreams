(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PinballLayout = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const BASE_WIDTH = 400;
    const BASE_HEIGHT = 700;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function scales(width, height) {
        return {
            x: value => value * (width / BASE_WIDTH),
            y: value => value * (height / BASE_HEIGHT)
        };
    }

    function flipperPlacement(width, height, side, baseY = 0) {
        const { x, y } = scales(width, height);
        const isLeft = side === 'left';
        const bodyOffset = x(50);
        const bodyX = width / 2 + (isLeft ? -bodyOffset : bodyOffset);
        const bodyY = baseY + height - y(65);
        const pivotX = bodyX + (isLeft ? -25 : 25);
        return { side, bodyX, bodyY, pivotX, pivotY: bodyY };
    }

    function flipperAssembly(width, height, baseY = 0) {
        const { x, y } = scales(width, height);
        const left = flipperPlacement(width, height, 'left', baseY);
        const right = flipperPlacement(width, height, 'right', baseY);
        const guideY = {
            start: baseY + y(580),
            mid: baseY + y(600),
            end: left.bodyY - y(10)
        };
        const leftGuide = [
            { x: x(50), y: guideY.start },
            { x: x(70), y: guideY.mid },
            { x: left.pivotX - x(25), y: guideY.end }
        ];
        const rightGuide = leftGuide.map(point => ({
            x: width - point.x,
            y: point.y
        }));
        const slingY = baseY + height - y(180);
        const slingOffset = x(45);

        return {
            left,
            right,
            leftGuide,
            rightGuide,
            leftSling: { x: left.pivotX - slingOffset, y: slingY },
            rightSling: { x: right.pivotX + slingOffset, y: slingY }
        };
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

    function launchScale(height, originalHeight = 860) {
        return Math.sqrt(height / originalHeight);
    }

    return {
        BASE_WIDTH,
        BASE_HEIGHT,
        scales,
        flipperPlacement,
        flipperAssembly,
        climbFloorForY,
        resolveClimbBoundary,
        launchScale
    };
}));
