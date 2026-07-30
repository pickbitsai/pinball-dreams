// ─────────────────────────────────────────────────────────────────────────────
//  PINBALL TABLE TEMPLATES — hand-edit this file, then reload the game.
//  There is no build step. Editing a number here changes the board.
//
//  COORDINATES are a 400 x 700 grid, independent of the real canvas size.
//    x: 0 ....... 400   (left edge to right edge)
//    y: 0 ....... 700   (top of the board down to the drain)
//    The playfield rails sit at x=20 and x=350. The shooter lane lives to the
//    right of x=350. The playfield centre — what the lower third mirrors
//    about — is x=185, NOT x=200.
//
//  SIZES (r, w, h, thickness) are real pixels and are not scaled by the grid,
//  which matches how the board has always been written.
//
//  PART TYPES
//    wall        points:[[x,y],..] thickness   solid rail or guide
//    bumper      x y r                          pop bumper
//    drop        x y w h angle [bank]           drop target (sinks when hit)
//    standup     x y w h angle                  stand-up target (stays up)
//    spinner     x y r                          spinner (sensor)
//    ramp        x y w h angle                  scoring ramp (sensor)
//    lane        x y w h angle                  bonus rollover lane (sensor)
//    rollover    x y w h lane                   top mission lane (sensor)
//    powertarget x y w h idx                    POWER bank target (drops)
//    missionramp x y w h angle                  starts the table mission
//    scoop       x y r                          POWER core scoop
//    zone        x y r zone                     elemental zone sensor
//
//  role on a wall picks its colour: 'rail' | 'accent' | 'secondary'.
//
//  `lower` is the flipper end. It is written for the LEFT side only and
//  mirrored about x=185, so the two sides can never drift apart. The outlane's
//  outer wall is derived from returnGuide at outlaneWidth, so dragging the
//  guide keeps the outlane the right width automatically.
// ─────────────────────────────────────────────────────────────────────────────
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PinballTemplates = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const GRID_WIDTH = 400;
    const GRID_HEIGHT = 700;
    const PLAYFIELD_CENTER = 185;

    // The cabinet is the same on every table: side rails, the shooter lane and
    // its entrance curve. A table can override it with its own `cabinet`.
    const CABINET = [
      { type: "wall", points: [[20, 50], [20, 592]], thickness: 14, role: "rail" },
      { type: "wall", points: [[350, 100], [350, 592]], thickness: 14, role: "rail" },
      { type: "wall", points: [[350, 20], [380, 45], [392, 70]], thickness: 16, role: "rail" },
      { type: "wall", points: [[392, 90], [392, 710]], thickness: 10, role: "lane" },
      { type: "wall", points: [[358, 590], [358, 700]], thickness: 8, role: "lane" },
      { type: "wall", points: [[355, 690], [395, 690]], thickness: 26, role: "lane" }
    ];

    // The flipper end. Written for the LEFT side only and mirrored about
    // PLAYFIELD_CENTER, so the two sides cannot drift apart. returnGuide and
    // outlaneWall are independent splines — the clear channel between them is the
    // outlane, and check-board-boundaries.mjs fails if an edit closes it. Delete
    // outlaneWall to go back to one auto-offset from the guide at outlaneWidth.
    // A table can override the whole block with its own `lower`.
    const LOWER = {
      outlaneWidth: 20,
      guideThickness: 12,
      railThickness: 14,
      flipper: { x: 135, y: 635 },
      sling: { x: 95.33, y: 520 },
      returnGuide: [[48.67, 468], [53.67, 541], [69.67, 590], [107.33, 625]],
      outlaneWall: [[20, 468.71], [25.82, 542.79], [43.58, 596.21], [83.93, 634.38]]
    };

    const TEMPLATES = {
        Classic: {
            zone: "fire",
            parts: [
              { type: "bumper", x: 120, y: 180, r: 24 },
              { type: "bumper", x: 200, y: 130, r: 28 },
              { type: "bumper", x: 280, y: 180, r: 24 },
              { type: "bumper", x: 160, y: 300, r: 22 },
              { type: "bumper", x: 240, y: 300, r: 22 },
              { type: "wall", points: [[52, 504], [46, 448], [46, 322], [56, 238]], thickness: 8, role: "secondary" },
              { type: "wall", points: [[296, 504], [320, 441], [320, 315], [300, 238]], thickness: 8, role: "secondary" },
              { type: "lane", x: 52, y: 196, w: 40, h: 11, angle: -0.08, score: 180 },
              { type: "lane", x: 328, y: 203, w: 40, h: 11, angle: 0.08, score: 210 },
              { type: "lane", x: 200, y: 385, w: 40, h: 11, angle: 0, score: 240 },
              { type: "drop", x: 52, y: 336, w: 18, h: 32, angle: -0.08, score: 300, idx: 0, bank: "forge-left", bankSize: 4 },
              { type: "drop", x: 52, y: 357, w: 18, h: 32, angle: -0.08, score: 300, idx: 1, bank: "forge-left", bankSize: 4 },
              { type: "drop", x: 52, y: 378, w: 18, h: 32, angle: -0.08, score: 300, idx: 2, bank: "forge-left", bankSize: 4 },
              { type: "drop", x: 52, y: 399, w: 18, h: 32, angle: -0.08, score: 300, idx: 3, bank: "forge-left", bankSize: 4 },
              { type: "drop", x: 316, y: 406, w: 18, h: 32, angle: 0.08, score: 300, idx: 0, bank: "forge-right", bankSize: 3 },
              { type: "drop", x: 316, y: 429.8, w: 18, h: 32, angle: 0.08, score: 300, idx: 1, bank: "forge-right", bankSize: 3 },
              { type: "drop", x: 316, y: 453.6, w: 18, h: 32, angle: 0.08, score: 300, idx: 2, bank: "forge-right", bankSize: 3 },
              { type: "spinner", x: 72, y: 273, r: 13, score: 90, phase: 0 },
              { type: "spinner", x: 296, y: 280, r: 13, score: 110, phase: 1 },
              { type: "ramp", x: 100, y: 406, w: 62, h: 20, angle: -0.42, score: 550 },
              { type: "ramp", x: 280, y: 350, w: 62, h: 20, angle: 0.42, score: 700 },
              { type: "standup", x: 156, y: 483, w: 16, h: 30, angle: -0.12, score: 240 },
              { type: "standup", x: 200, y: 497, w: 16, h: 30, angle: 0, score: 280 },
              { type: "standup", x: 244, y: 483, w: 16, h: 30, angle: 0.12, score: 320 },
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 123.5, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 185, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 246.5, y: 82, w: 42, h: 12, lane: 3 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 4 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 200, y: 250, r: 58, zone: "fire" }
            ]
        },
        Vortex: {
            zone: "ice",
            parts: [
              { type: "bumper", x: 170, y: 230, r: 18 },
              { type: "bumper", x: 228.89, y: 246, r: 24 },
              { type: "bumper", x: 244.48, y: 323, r: 18 },
              { type: "bumper", x: 170, y: 384, r: 24 },
              { type: "bumper", x: 64.34, y: 341, r: 18 },
              { type: "bumper", x: 48.76, y: 210, r: 24 },
              { type: "spinner", x: 170, y: 280, r: 14, score: 75 },
              { type: "wall", points: [[48, 525], [28, 406], [48, 287], [108, 210]], thickness: 8, role: "secondary" },
              { type: "wall", points: [[300, 511], [324, 392], [308, 266], [248, 189]], thickness: 8, role: "secondary" },
              { type: "lane", x: 48, y: 175, w: 40, h: 11, angle: -0.14, score: 180 },
              { type: "lane", x: 328, y: 175, w: 40, h: 11, angle: 0.14, score: 210 },
              { type: "lane", x: 88, y: 427, w: 40, h: 11, angle: -0.22, score: 240 },
              { type: "lane", x: 280, y: 427, w: 40, h: 11, angle: 0.22, score: 270 },
              { type: "drop", x: 64, y: 350, w: 18, h: 32, angle: -0.18, score: 300, idx: 0, bank: "vortex-left", bankSize: 3 },
              { type: "drop", x: 64, y: 375.9, w: 18, h: 32, angle: -0.18, score: 300, idx: 1, bank: "vortex-left", bankSize: 3 },
              { type: "drop", x: 64, y: 401.8, w: 18, h: 32, angle: -0.18, score: 300, idx: 2, bank: "vortex-left", bankSize: 3 },
              { type: "drop", x: 308, y: 336, w: 18, h: 32, angle: 0.18, score: 300, idx: 0, bank: "vortex-right", bankSize: 3 },
              { type: "drop", x: 308, y: 361.9, w: 18, h: 32, angle: 0.18, score: 300, idx: 1, bank: "vortex-right", bankSize: 3 },
              { type: "drop", x: 308, y: 387.8, w: 18, h: 32, angle: 0.18, score: 300, idx: 2, bank: "vortex-right", bankSize: 3 },
              { type: "spinner", x: 44, y: 252, r: 13, score: 90, phase: 0 },
              { type: "spinner", x: 328, y: 252, r: 13, score: 110, phase: 1 },
              { type: "spinner", x: 200, y: 434, r: 13, score: 130, phase: 2 },
              { type: "ramp", x: 108, y: 469, w: 62, h: 20, angle: -0.48, score: 550 },
              { type: "ramp", x: 272, y: 469, w: 62, h: 20, angle: 0.48, score: 700 },
              { type: "standup", x: 168, y: 546, w: 16, h: 30, angle: -0.08, score: 240 },
              { type: "standup", x: 208, y: 553, w: 16, h: 30, angle: 0.08, score: 280 },
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 144, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 226, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 3 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 175, y: 330, r: 62, zone: "ice" }
            ]
        },
        Diamond: {
            zone: "rock",
            parts: [
              { type: "bumper", x: 180, y: 120, r: 24 },
              { type: "bumper", x: 100, y: 200, r: 20 },
              { type: "bumper", x: 260, y: 200, r: 20 },
              { type: "bumper", x: 180, y: 280, r: 24 },
              { type: "bumper", x: 100, y: 360, r: 20 },
              { type: "bumper", x: 260, y: 360, r: 20 },
              { type: "bumper", x: 180, y: 440, r: 24 },
              { type: "wall", points: [[128.3, 196.1], [151.7, 203.9]], thickness: 8, role: "accent" },
              { type: "wall", points: [[208.3, 203.9], [231.7, 196.1]], thickness: 8, role: "accent" },
              { type: "wall", points: [[128.3, 363.9], [151.7, 356.1]], thickness: 8, role: "accent" },
              { type: "wall", points: [[208.3, 356.1], [231.7, 363.9]], thickness: 8, role: "accent" },
              { type: "wall", points: [[60, 504], [80, 420], [124, 364], [152, 301]], thickness: 8, role: "secondary" },
              { type: "wall", points: [[292, 504], [272, 420], [236, 364], [216, 301]], thickness: 8, role: "secondary" },
              { type: "lane", x: 56, y: 217, w: 40, h: 11, angle: -0.16, score: 180 },
              { type: "lane", x: 316, y: 217, w: 40, h: 11, angle: 0.16, score: 210 },
              { type: "lane", x: 120, y: 392, w: 40, h: 11, angle: -0.24, score: 240 },
              { type: "lane", x: 256, y: 392, w: 40, h: 11, angle: 0.24, score: 270 },
              { type: "drop", x: 144, y: 266, w: 18, h: 32, angle: 0, score: 300, idx: 0, bank: "prism-upper", bankSize: 4 },
              { type: "drop", x: 178, y: 266, w: 18, h: 32, angle: 0, score: 300, idx: 1, bank: "prism-upper", bankSize: 4 },
              { type: "drop", x: 212, y: 266, w: 18, h: 32, angle: 0, score: 300, idx: 2, bank: "prism-upper", bankSize: 4 },
              { type: "drop", x: 246, y: 266, w: 18, h: 32, angle: 0, score: 300, idx: 3, bank: "prism-upper", bankSize: 4 },
              { type: "drop", x: 56, y: 441, w: 18, h: 32, angle: -0.12, score: 300, idx: 0, bank: "prism-left", bankSize: 3 },
              { type: "drop", x: 56, y: 464.8, w: 18, h: 32, angle: -0.12, score: 300, idx: 1, bank: "prism-left", bankSize: 3 },
              { type: "drop", x: 56, y: 488.6, w: 18, h: 32, angle: -0.12, score: 300, idx: 2, bank: "prism-left", bankSize: 3 },
              { type: "drop", x: 316, y: 441, w: 18, h: 32, angle: 0.12, score: 300, idx: 0, bank: "prism-right", bankSize: 3 },
              { type: "drop", x: 316, y: 464.8, w: 18, h: 32, angle: 0.12, score: 300, idx: 1, bank: "prism-right", bankSize: 3 },
              { type: "drop", x: 316, y: 488.6, w: 18, h: 32, angle: 0.12, score: 300, idx: 2, bank: "prism-right", bankSize: 3 },
              { type: "spinner", x: 80, y: 301, r: 13, score: 90, phase: 0 },
              { type: "spinner", x: 292, y: 301, r: 13, score: 110, phase: 1 },
              { type: "ramp", x: 108, y: 504, w: 62, h: 20, angle: -0.38, score: 550 },
              { type: "ramp", x: 264, y: 504, w: 62, h: 20, angle: 0.38, score: 700 },
              { type: "standup", x: 176, y: 427, w: 16, h: 30, angle: -0.12, score: 240 },
              { type: "standup", x: 200, y: 448, w: 16, h: 30, angle: 0, score: 280 },
              { type: "standup", x: 224, y: 427, w: 16, h: 30, angle: 0.12, score: 320 },
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 123.5, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 185, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 246.5, y: 82, w: 42, h: 12, lane: 3 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 4 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 205, y: 385, r: 60, zone: "rock" }
            ]
        },
        Castle: {
            zone: "fire",
            parts: [
              { type: "bumper", x: 90, y: 160, r: 28 },
              { type: "bumper", x: 180, y: 120, r: 32 },
              { type: "bumper", x: 270, y: 160, r: 28 },
              { type: "bumper", x: 135, y: 300, r: 24 },
              { type: "bumper", x: 225, y: 300, r: 24 },
              { type: "bumper", x: 180, y: 420, r: 26 },
              { type: "wall", points: [[61.67, 230], [78.33, 230]], thickness: 10, role: "accent" },
              { type: "wall", points: [[201.67, 230], [218.33, 230]], thickness: 10, role: "accent" },
              { type: "wall", points: [[101.67, 230], [118.33, 230]], thickness: 10, role: "accent" },
              { type: "wall", points: [[241.67, 230], [258.33, 230]], thickness: 10, role: "accent" },
              { type: "wall", points: [[141.67, 230], [158.33, 230]], thickness: 10, role: "accent" },
              { type: "wall", points: [[281.67, 230], [298.33, 230]], thickness: 10, role: "accent" },
              { type: "wall", points: [[180, 177.5], [180, 222.5]], thickness: 12, role: "accent" },
              { type: "drop", x: 100, y: 480, w: 20, h: 36, angle: 0, score: 300, idx: 0 },
              { type: "drop", x: 160, y: 480, w: 20, h: 36, angle: 0, score: 300, idx: 1 },
              { type: "drop", x: 220, y: 480, w: 20, h: 36, angle: 0, score: 300, idx: 2 },
              { type: "drop", x: 280, y: 480, w: 20, h: 36, angle: 0, score: 300, idx: 3 },
              { type: "wall", points: [[48, 511], [46, 399], [72, 301], [136, 231]], thickness: 8, role: "secondary" },
              { type: "wall", points: [[304, 511], [320, 399], [288, 301], [232, 231]], thickness: 8, role: "secondary" },
              { type: "lane", x: 48, y: 196, w: 40, h: 11, angle: -0.12, score: 180 },
              { type: "lane", x: 324, y: 196, w: 40, h: 11, angle: 0.12, score: 210 },
              { type: "lane", x: 72, y: 476, w: 40, h: 11, angle: -0.18, score: 240 },
              { type: "lane", x: 296, y: 476, w: 40, h: 11, angle: 0.18, score: 270 },
              { type: "drop", x: 148, y: 343, w: 18, h: 32, angle: 0, score: 300, idx: 0, bank: "gate-center", bankSize: 5 },
              { type: "drop", x: 174, y: 343, w: 18, h: 32, angle: 0, score: 300, idx: 1, bank: "gate-center", bankSize: 5 },
              { type: "drop", x: 200, y: 343, w: 18, h: 32, angle: 0, score: 300, idx: 2, bank: "gate-center", bankSize: 5 },
              { type: "drop", x: 226, y: 343, w: 18, h: 32, angle: 0, score: 300, idx: 3, bank: "gate-center", bankSize: 5 },
              { type: "drop", x: 252, y: 343, w: 18, h: 32, angle: 0, score: 300, idx: 4, bank: "gate-center", bankSize: 5 },
              { type: "drop", x: 52, y: 378, w: 18, h: 32, angle: -0.1, score: 300, idx: 0, bank: "tower-left", bankSize: 3 },
              { type: "drop", x: 52, y: 402.5, w: 18, h: 32, angle: -0.1, score: 300, idx: 1, bank: "tower-left", bankSize: 3 },
              { type: "drop", x: 52, y: 427, w: 18, h: 32, angle: -0.1, score: 300, idx: 2, bank: "tower-left", bankSize: 3 },
              { type: "drop", x: 316, y: 378, w: 18, h: 32, angle: 0.1, score: 300, idx: 0, bank: "tower-right", bankSize: 3 },
              { type: "drop", x: 316, y: 402.5, w: 18, h: 32, angle: 0.1, score: 300, idx: 1, bank: "tower-right", bankSize: 3 },
              { type: "drop", x: 316, y: 427, w: 18, h: 32, angle: 0.1, score: 300, idx: 2, bank: "tower-right", bankSize: 3 },
              { type: "spinner", x: 80, y: 259, r: 13, score: 90, phase: 0 },
              { type: "spinner", x: 288, y: 259, r: 13, score: 110, phase: 1 },
              { type: "ramp", x: 100, y: 448, w: 62, h: 20, angle: -0.46, score: 550 },
              { type: "ramp", x: 272, y: 448, w: 62, h: 20, angle: 0.46, score: 700 },
              { type: "standup", x: 172, y: 511, w: 16, h: 30, angle: -0.1, score: 240 },
              { type: "standup", x: 200, y: 525, w: 16, h: 30, angle: 0, score: 280 },
              { type: "standup", x: 228, y: 511, w: 16, h: 30, angle: 0.1, score: 320 },
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 144, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 226, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 3 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 200, y: 250, r: 58, zone: "fire" }
            ]
        },
        Wave: {
            zone: "ice",
            parts: [
              { type: "bumper", x: 90, y: 180, r: 22 },
              { type: "bumper", x: 270, y: 220, r: 22 },
              { type: "bumper", x: 130, y: 340, r: 24 },
              { type: "bumper", x: 230, y: 400, r: 24 },
              { type: "bumper", x: 170, y: 480, r: 20 },
              { type: "wall", points: [[70, 270], [110, 250], [150, 270], [190, 250], [230, 270]], thickness: 8, role: "accent" },
              { type: "wall", points: [[140, 430], [180, 410], [220, 430], [260, 410], [300, 430]], thickness: 8, role: "accent" },
              { type: "spinner", x: 150, y: 268, r: 13, score: 75 },
              { type: "spinner", x: 220, y: 428, r: 13, score: 75 },
              { type: "wall", points: [[44, 518], [46, 434], [64, 343], [124, 280]], thickness: 8, role: "secondary" },
              { type: "wall", points: [[308, 518], [324, 413], [292, 315], [232, 245]], thickness: 8, role: "secondary" },
              { type: "lane", x: 48, y: 175, w: 40, h: 11, angle: -0.16, score: 180 },
              { type: "lane", x: 328, y: 189, w: 40, h: 11, angle: 0.16, score: 210 },
              { type: "lane", x: 68, y: 399, w: 40, h: 11, angle: -0.2, score: 240 },
              { type: "lane", x: 300, y: 406, w: 40, h: 11, angle: 0.2, score: 270 },
              { type: "drop", x: 56, y: 308, w: 18, h: 32, angle: -0.16, score: 300, idx: 0, bank: "current-left", bankSize: 4 },
              { type: "drop", x: 56, y: 329.7, w: 18, h: 32, angle: -0.16, score: 300, idx: 1, bank: "current-left", bankSize: 4 },
              { type: "drop", x: 56, y: 351.4, w: 18, h: 32, angle: -0.16, score: 300, idx: 2, bank: "current-left", bankSize: 4 },
              { type: "drop", x: 56, y: 373.1, w: 18, h: 32, angle: -0.16, score: 300, idx: 3, bank: "current-left", bankSize: 4 },
              { type: "drop", x: 312, y: 427, w: 18, h: 32, angle: 0.16, score: 300, idx: 0, bank: "current-right", bankSize: 4 },
              { type: "drop", x: 312, y: 448.7, w: 18, h: 32, angle: 0.16, score: 300, idx: 1, bank: "current-right", bankSize: 4 },
              { type: "drop", x: 312, y: 470.4, w: 18, h: 32, angle: 0.16, score: 300, idx: 2, bank: "current-right", bankSize: 4 },
              { type: "drop", x: 312, y: 492.1, w: 18, h: 32, angle: 0.16, score: 300, idx: 3, bank: "current-right", bankSize: 4 },
              { type: "spinner", x: 80, y: 238, r: 13, score: 90, phase: 0 },
              { type: "spinner", x: 292, y: 294, r: 13, score: 110, phase: 1 },
              { type: "spinner", x: 200, y: 462, r: 13, score: 130, phase: 2 },
              { type: "ramp", x: 112, y: 490, w: 62, h: 20, angle: -0.52, score: 550 },
              { type: "ramp", x: 268, y: 406, w: 62, h: 20, angle: 0.44, score: 700 },
              { type: "standup", x: 160, y: 539, w: 16, h: 30, angle: -0.12, score: 240 },
              { type: "standup", x: 200, y: 553, w: 16, h: 30, angle: 0, score: 280 },
              { type: "standup", x: 240, y: 539, w: 16, h: 30, angle: 0.12, score: 320 },
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 123.5, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 185, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 246.5, y: 82, w: 42, h: 12, lane: 3 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 4 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 175, y: 330, r: 62, zone: "ice" }
            ]
        },
        Custom: {
            zone: "rock",
            // Built at runtime from the in-game table editor.
            custom: true,
            parts: [
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 123.5, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 185, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 246.5, y: 82, w: 42, h: 12, lane: 3 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 4 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 205, y: 385, r: 60, zone: "rock" }
            ]
        },
        Climb: {
            zone: "fire",
            // Climb floors reuse the five rotating board templates above; only the
            // ceiling panels and floor targets are climb-specific.
            climb: true,
            parts: [
              { type: "rollover", x: 62, y: 82, w: 42, h: 12, lane: 0 },
              { type: "rollover", x: 123.5, y: 82, w: 42, h: 12, lane: 1 },
              { type: "rollover", x: 185, y: 82, w: 42, h: 12, lane: 2 },
              { type: "rollover", x: 246.5, y: 82, w: 42, h: 12, lane: 3 },
              { type: "rollover", x: 308, y: 82, w: 42, h: 12, lane: 4 },
              { type: "missionramp", x: 70, y: 340, w: 62, h: 20, angle: -0.46, score: 500 },
              { type: "powertarget", x: 118, y: 458, w: 18, h: 34, score: 350, idx: 0 },
              { type: "powertarget", x: 180, y: 458, w: 18, h: 34, score: 350, idx: 1 },
              { type: "powertarget", x: 242, y: 458, w: 18, h: 34, score: 350, idx: 2 },
              { type: "scoop", x: 305, y: 355, r: 18 },
              { type: "zone", x: 200, y: 250, r: 58, zone: "fire" }
            ]
        }
    };

    // Templates inherit the shared cabinet and flipper end unless they say
    // otherwise, so a change to either lands on every table at once.
    function templateFor(name) {
        const template = TEMPLATES[name] || TEMPLATES.Classic;
        return {
            zone: template.zone,
            custom: !!template.custom,
            climb: !!template.climb,
            cabinet: template.cabinet || CABINET,
            lower: template.lower || LOWER,
            parts: template.parts || []
        };
    }

    // Mirror a base-grid x about the playfield centre.
    function mirrorX(x) {
        return 2 * PLAYFIELD_CENTER - x;
    }

    return {
        GRID_WIDTH,
        GRID_HEIGHT,
        PLAYFIELD_CENTER,
        CABINET,
        LOWER,
        TEMPLATES,
        templateFor,
        mirrorX
    };
}));
