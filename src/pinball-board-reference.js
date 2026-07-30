(function (global) {
    'use strict';

    // Layout research library for the procedural board builder. This deliberately
    // records mechanical ideas only; no artwork, geometry, names, or branded
    // presentation is copied into the generated tables.
    const studiedTables = [
        {
            id: '2001', year: 1971, archetype: 'drop-gauntlet',
            mechanics: ['two 5-bank drop-target arrays', 'five top kick-out holes', 'open rebound field'],
            lesson: 'Long target banks create a readable ladder when each completion opens a higher-value exit.',
            source: 'https://www.ipdb.org/machine.cgi?id=2'
        },
        {
            id: 'flash-gordon', year: 1981, archetype: 'split-level',
            mechanics: ['upper playfield', 'two access ramps', 'inline targets', 'third flipper'],
            lesson: 'A long field stays legible when a mid-table ramp clearly changes elevation and objective.',
            source: 'https://www.ipdb.org/machine.cgi?id=871'
        },
        {
            id: 'haunted-house', year: 1982, archetype: 'multi-level',
            mechanics: ['three playfields', 'eight flippers', 'trap door', 'secret passage'],
            lesson: 'Side passages feel important when they visibly route the ball to another play space.',
            source: 'https://www.ipdb.org/machine.cgi?id=1154'
        },
        {
            id: 'black-knight-2000', year: 1989, archetype: 'split-level',
            mechanics: ['skyway ramp', 'upper loop', 'vertical up-kicker', 'magna-save'],
            lesson: 'Pair a fast route upstairs with a separate rescue mechanic near the outlane.',
            source: 'https://www.ipdb.org/machine.cgi?id=311'
        },
        {
            id: 'funhouse', year: 1990, archetype: 'scoop-mission',
            mechanics: ['upper loop trapdoor', 'diverted ramp return', 'three cellar holes', 'target bank'],
            lesson: 'A central character shot works best when loops and targets visibly prepare it.',
            source: 'https://www.ipdb.org/machine.cgi?id=966'
        },
        {
            id: 'the-addams-family', year: 1992, archetype: 'magnet-chaos',
            mechanics: ['two ramps', 'rotating target bank', 'kick-out holes', 'playfield magnets'],
            lesson: 'Controlled flow shots can frame one intentionally chaotic center-field mechanic.',
            source: 'https://www.ipdb.org/machine.cgi?id=20'
        },
        {
            id: 'the-getaway', year: 1992, archetype: 'orbit-speed',
            mechanics: ['two major orbits', 'upper speed loop', 'supercharger', 'ordered target bank'],
            lesson: 'Repeated orbit shots become a progression system when they build toward a visible loop payoff.',
            source: 'https://www.ipdb.org/machine.cgi?id=1000'
        },
        {
            id: 'twilight-zone', year: 1993, archetype: 'widebody-toybox',
            mechanics: ['two ramps', 'dual left inlanes', 'magnet loop', 'magnet mini-playfield'],
            lesson: 'Dense tables remain readable when shots form a fan and special devices occupy distinct zones.',
            source: 'https://www.ipdb.org/machine.cgi?id=2684'
        },
        {
            id: 'white-water', year: 1993, archetype: 'ramp-mountain',
            mechanics: ['stacked ramps', 'upper playfield', 'whirlpool shot', 'return wireforms'],
            lesson: 'Vertical travel feels earned when successive ramps climb through clearly separated tiers.',
            source: 'https://www.ipdb.org/machine.cgi?id=2768'
        },
        {
            id: 'indiana-jones', year: 1993, archetype: 'upper-mini-field',
            mechanics: ['Path of Adventure mini-playfield', 'three ramps', 'center lock', 'mode scoop'],
            lesson: 'A mini-field is most effective when several main-field shots qualify or feed it.',
            source: 'https://www.ipdb.org/machine.cgi?id=1267'
        },
        {
            id: 'attack-from-mars', year: 1995, archetype: 'central-bash-fan',
            mechanics: ['central saucer bash target', 'radial shot fan', 'drop-target shield', 'two ramps'],
            lesson: 'A strong center bash shot gives a symmetrical fan layout an instantly understood objective.',
            source: 'https://www.ipdb.org/machine.cgi?id=3781'
        },
        {
            id: 'theatre-of-magic', year: 1995, archetype: 'central-bash-flow',
            mechanics: ['rotating trunk', 'two ramps', 'inner loop', 'scoop'],
            lesson: 'A center toy should change state while side ramps preserve flow around it.',
            source: 'https://www.ipdb.org/machine.cgi?id=2845'
        },
        {
            id: 'medieval-madness', year: 1997, archetype: 'central-bash-fan',
            mechanics: ['castle bash shot', 'two ramps', 'catapult', 'pop-up targets'],
            lesson: 'Layered center defenses plus symmetric side routes produce clear short- and long-term goals.',
            source: 'https://www.ipdb.org/machine.cgi?id=4036'
        },
        {
            id: 'cirqus-voltaire', year: 1997, archetype: 'loop-bash',
            mechanics: ['central ringmaster target', 'high wireform loop', 'side scoop', 'moving targets'],
            lesson: 'A dominant vertical loop can make an unusually long board feel fast instead of empty.',
            source: 'https://www.ipdb.org/machine.cgi?id=4059'
        },
        {
            id: 'no-good-gofers', year: 1997, archetype: 'ramp-bash',
            mechanics: ['crossing ramps', 'pop-up bash targets', 'captive ball', 'orbit shots'],
            lesson: 'Put reactive targets beside ramp entrances so misses still produce playful consequences.',
            source: 'https://www.ipdb.org/machine.cgi?id=4338'
        },
        {
            id: 'space-cadet', year: 1995, archetype: 'mission-lanes',
            mechanics: ['launch ramp', 'fuel and hyperspace chutes', 'three wormhole kickers', 'mission targets'],
            lesson: 'Named side lanes and kickers turn spatial navigation into a mission-selection system.',
            source: 'https://gamefaqs.gamespot.com/pc/563047-3d-pinball-space-cadet/faqs/46514'
        },
        {
            id: 'genesis', year: 1986, archetype: 'symmetric-flow',
            mechanics: ['mirrored ramps', 'two orbits', 'vari-target', 'center drop bank'],
            lesson: 'Symmetry supports learnability while a center bank supplies precision play.',
            source: 'https://www.ipdb.org/machine.cgi?id=1001'
        },
        {
            id: 'rollergames', year: 1990, archetype: 'upper-flipper-combo',
            mechanics: ['upper flipper', 'magnet-assisted wall shot', 'multiple target banks', 'ramp return'],
            lesson: 'An upper flipper needs a deliberate feed and at least two meaningful follow-up shots.',
            source: 'https://www.ipdb.org/machine.cgi?id=2006'
        },
        {
            id: 'diner', year: 1990, archetype: 'drop-ramp-ladder',
            mechanics: ['two ramps', 'multiple drop banks', 'saucer lane', 'pop-bumper nest'],
            lesson: 'Alternating drop banks and ramps naturally moves attention up and across a long playfield.',
            source: 'https://www.ipdb.org/machine.cgi?id=676'
        },
        {
            id: 'deadpool', year: 2018, archetype: 'target-gated-bash',
            mechanics: ['3-bank drop shield', 'ball lock', 'bash target', 'dual ramps'],
            lesson: 'A bank directly guarding a payoff shot makes target progression physically obvious.',
            source: 'https://www.sternpinball.com/game/deadpool/'
        },
        {
            id: 'jurassic-park', year: 2019, archetype: 'route-network',
            mechanics: ['four ramps', 'three flippers', 'gated lock', 'horizontal spinner'],
            lesson: 'A route network benefits from distinct shot silhouettes and a central navigation target.',
            source: 'https://wp.sternpinball.com/game/jurassic-park/'
        },
        {
            id: 'godzilla', year: 2021, archetype: 'transforming-mechs',
            mechanics: ['collapsing building lock', 'breakaway bridge ramp', 'rotating target bank', 'jump ramp'],
            lesson: 'Transforming a familiar shot after completion makes one area support several rule phases.',
            source: 'https://www.sternpinball.com/game/godzilla/'
        },
        {
            id: 'foo-fighters', year: 2023, archetype: 'upper-loop-network',
            mechanics: ['two-loop upper playfield', 'diverter', 'stand-up bank', 'hidden jackpot target'],
            lesson: 'An upper area earns its footprint when entry, looping, and exit each advance different goals.',
            source: 'https://sternpinball.com/game/foo-fighters/'
        },
        {
            id: 'jaws', year: 2024, archetype: 'moving-target-field',
            mechanics: ['upper boat playfield', 'moving fin target', 'bash toy', 'side drop bank'],
            lesson: 'Moving targets add timing while fixed side banks provide dependable progress.',
            source: 'https://sternpinball.com/game/jaws/'
        }
    ];

    const archetypes = {
        'drop-gauntlet': 'Sequential target banks that open or improve a protected shot.',
        'split-level': 'Ramp-fed upper region with a dedicated return and secondary flipper.',
        'mission-lanes': 'Rollover lanes, named chutes, and kickers that select objectives.',
        'central-bash-fan': 'A readable center objective surrounded by six to ten fan-shaped shots.',
        'orbit-speed': 'Long left/right orbits, spinners, loops, and combo-friendly returns.',
        'ramp-mountain': 'Successive vertical ramps and returns that create a climb.',
        'target-gated-bash': 'A drop bank physically protects a lock, scoop, or bash payoff.',
        'upper-loop-network': 'A compact upper field with multiple loops and a controlled exit.',
        'magnet-chaos': 'Predictable outer flow framing a deliberately disruptive center zone.',
        'route-network': 'Distinct ramps and lanes form a navigable set of branching routes.'
    };

    // Normalized recipes are original layouts synthesized from the research
    // above. They are consumed by createReferenceBoardFeatures() in index.html.
    const profiles = {
        Classic: {
            topLaneCount: 5,
            references: ['attack-from-mars', 'medieval-madness', 'deadpool', 'space-cadet'],
            guides: [
                [[0.13, 0.72], [0.115, 0.64], [0.115, 0.46], [0.14, 0.34]],
                [[0.74, 0.72], [0.80, 0.63], [0.80, 0.45], [0.75, 0.34]]
            ],
            bonusLanes: [[0.13, 0.28, -0.08], [0.82, 0.29, 0.08], [0.50, 0.55, 0]],
            dropBanks: [
                { id: 'forge-left', x: 0.13, y: 0.48, count: 4, axis: 'vertical', spacing: 0.030, angle: -0.08 },
                { id: 'forge-right', x: 0.79, y: 0.58, count: 3, axis: 'vertical', spacing: 0.034, angle: 0.08 }
            ],
            spinners: [[0.18, 0.39], [0.74, 0.40]],
            ramps: [[0.25, 0.58, -0.42], [0.70, 0.50, 0.42]],
            standups: [[0.39, 0.69, -0.12], [0.50, 0.71, 0], [0.61, 0.69, 0.12]]
        },
        Vortex: {
            topLaneCount: 4,
            references: ['the-getaway', 'twilight-zone', 'cirqus-voltaire', 'rollergames'],
            guides: [
                [[0.12, 0.75], [0.07, 0.58], [0.12, 0.41], [0.27, 0.30]],
                [[0.75, 0.73], [0.81, 0.56], [0.77, 0.38], [0.62, 0.27]]
            ],
            bonusLanes: [[0.12, 0.25, -0.14], [0.82, 0.25, 0.14], [0.22, 0.61, -0.22], [0.70, 0.61, 0.22]],
            dropBanks: [
                { id: 'vortex-left', x: 0.16, y: 0.50, count: 3, axis: 'vertical', spacing: 0.037, angle: -0.18 },
                { id: 'vortex-right', x: 0.77, y: 0.48, count: 3, axis: 'vertical', spacing: 0.037, angle: 0.18 }
            ],
            spinners: [[0.11, 0.36], [0.82, 0.36], [0.50, 0.62]],
            ramps: [[0.27, 0.67, -0.48], [0.68, 0.67, 0.48]],
            standups: [[0.42, 0.78, -0.08], [0.52, 0.79, 0.08]]
        },
        Diamond: {
            topLaneCount: 5,
            references: ['genesis', 'diner', '2001', 'jurassic-park'],
            guides: [
                [[0.15, 0.72], [0.20, 0.60], [0.31, 0.52], [0.38, 0.43]],
                [[0.73, 0.72], [0.68, 0.60], [0.59, 0.52], [0.54, 0.43]]
            ],
            bonusLanes: [[0.14, 0.31, -0.16], [0.79, 0.31, 0.16], [0.30, 0.56, -0.24], [0.64, 0.56, 0.24]],
            dropBanks: [
                { id: 'prism-upper', x: 0.36, y: 0.38, count: 4, axis: 'horizontal', spacing: 0.085, angle: 0 },
                { id: 'prism-left', x: 0.14, y: 0.63, count: 3, axis: 'vertical', spacing: 0.034, angle: -0.12 },
                { id: 'prism-right', x: 0.79, y: 0.63, count: 3, axis: 'vertical', spacing: 0.034, angle: 0.12 }
            ],
            spinners: [[0.20, 0.43], [0.73, 0.43]],
            ramps: [[0.27, 0.72, -0.38], [0.66, 0.72, 0.38]],
            standups: [[0.44, 0.61, -0.12], [0.50, 0.64, 0], [0.56, 0.61, 0.12]]
        },
        Castle: {
            topLaneCount: 4,
            references: ['medieval-madness', 'flash-gordon', 'black-knight-2000', 'godzilla'],
            guides: [
                [[0.12, 0.73], [0.115, 0.57], [0.18, 0.43], [0.34, 0.33]],
                [[0.76, 0.73], [0.80, 0.57], [0.72, 0.43], [0.58, 0.33]]
            ],
            bonusLanes: [[0.12, 0.28, -0.12], [0.81, 0.28, 0.12], [0.18, 0.68, -0.18], [0.74, 0.68, 0.18]],
            dropBanks: [
                { id: 'gate-center', x: 0.37, y: 0.49, count: 5, axis: 'horizontal', spacing: 0.065, angle: 0 },
                { id: 'tower-left', x: 0.13, y: 0.54, count: 3, axis: 'vertical', spacing: 0.035, angle: -0.10 },
                { id: 'tower-right', x: 0.79, y: 0.54, count: 3, axis: 'vertical', spacing: 0.035, angle: 0.10 }
            ],
            spinners: [[0.20, 0.37], [0.72, 0.37]],
            ramps: [[0.25, 0.64, -0.46], [0.68, 0.64, 0.46]],
            standups: [[0.43, 0.73, -0.10], [0.50, 0.75, 0], [0.57, 0.73, 0.10]]
        },
        Wave: {
            topLaneCount: 5,
            references: ['white-water', 'no-good-gofers', 'foo-fighters', 'jaws'],
            guides: [
                [[0.11, 0.74], [0.115, 0.62], [0.16, 0.49], [0.31, 0.40]],
                [[0.77, 0.74], [0.81, 0.59], [0.73, 0.45], [0.58, 0.35]]
            ],
            bonusLanes: [[0.12, 0.25, -0.16], [0.82, 0.27, 0.16], [0.17, 0.57, -0.20], [0.75, 0.58, 0.20]],
            dropBanks: [
                { id: 'current-left', x: 0.14, y: 0.44, count: 4, axis: 'vertical', spacing: 0.031, angle: -0.16 },
                { id: 'current-right', x: 0.78, y: 0.61, count: 4, axis: 'vertical', spacing: 0.031, angle: 0.16 }
            ],
            spinners: [[0.20, 0.34], [0.73, 0.42], [0.50, 0.66]],
            ramps: [[0.28, 0.70, -0.52], [0.67, 0.58, 0.44]],
            standups: [[0.40, 0.77, -0.12], [0.50, 0.79, 0], [0.60, 0.77, 0.12]]
        }
    };

    function profileFor(levelName) {
        return profiles[levelName] || profiles.Classic;
    }

    global.PinballBoardReference = Object.freeze({
        version: 1,
        studiedTables: Object.freeze(studiedTables),
        archetypes: Object.freeze(archetypes),
        profiles: Object.freeze(profiles),
        profileFor,
        studyCount: studiedTables.length
    });
})(window);
