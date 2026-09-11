(function(root,factory){
    const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PinballLevels=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    function specToFloor(spec,row={}) {
        const types=['wall','bumper','drop','standup','spinner','ramp','lane','rollover','powertarget','missionramp','scoop','zone'];
        if(spec?.v!==1||typeof spec.boardName!=='string'||!['fire','ice','rock'].includes(spec.theme)||!Array.isArray(spec.parts)||spec.parts.length<1||spec.parts.length>64||!['bumper','spinner','target','ramp','lane'].includes(spec.gate?.action)||!Number.isInteger(spec.gate.goal)||spec.gate.goal<3||spec.gate.goal>15)throw new Error('Invalid climb floor');
        for(const part of spec.parts) {
            if(!types.includes(part.type))throw new Error('Unknown part');
            if(part.type==='wall') {
                if(!Array.isArray(part.points)||part.points.length<2||!part.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=400&&p[1]>=0&&p[1]<=700))throw new Error('Invalid wall');
            }else if(![part.x,part.y].every(Number.isFinite)||part.x<0||part.x>400||part.y<0||part.y>700)throw new Error('Invalid part position');
        }
        return {...row,spec:JSON.parse(JSON.stringify(spec))};
    }
    function create({levels:definitions,boards,builtinCount,bridge,templates,host=globalThis}) {
        const levels=Array.from({length:builtinCount},(_,i)=>{
            const level=definitions[boards[i%boards.length]];
            return {level_index:i,author_kind:'seed',spec:{v:1,boardName:level.name,theme:level.zone,parts:templates.templateFor(level.name).parts,
                gate:{action:level.mission.action,goal:Math.max(3,Math.round(level.mission.goal*.5)+Math.floor(i/boards.length))}}};
        });
        let pending=null,lastReport=-1;
        const bounded=promise=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Level service timeout')),4000);Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(t));});
        const source={levels,get length(){return levels.length;},isActive:()=>bridge.isActive(),
            refresh(){
                if(pending)return pending;
                if(!bridge.isActive()||!bridge.isReady()||!host.PickBits?.levels?.list)return Promise.resolve([]);
                pending=(async()=>{
                    const added=[];
                    try {for(let page=0;page<10;page++) {
                        const after=levels.length-1,rows=await bounded(host.PickBits.levels.list('pinball',{after,limit:100}));
                        if(!Array.isArray(rows))break;
                        for(const row of [...rows].sort((a,b)=>a.level_index-b.level_index)) {
                            if(row.game_slug!=='pinball'||row.status!=='live'||row.level_index!==levels.length)continue;
                            try{const level=specToFloor(row.spec,row);levels.push(level);added.push(level);}catch{/* Keep the contiguous playable prefix. */}
                        }
                        if(rows.length<100||after===levels.length-1)break;
                    }}catch{/* Local 20-floor Climb remains available offline. */}
                    return added;
                })().finally(()=>{pending=null;});return pending;
            },
            async complete(index){
                if(!bridge.isActive()||index!==levels.length-1)return false;
                if(bridge.isReady()&&host.PickBits?.levels?.reportFrontier&&lastReport!==index) {
                    try{await bounded(host.PickBits.levels.reportFrontier('pinball',index));lastReport=index;}catch{/* Anonymous players still play. */}
                }
                await source.refresh();return true;
            },
            levelFor(floor){
                const spec=levels[floor]?.spec;
                if(floor<builtinCount||!spec)return definitions[boards[floor%boards.length]];
                const palette=definitions.find(l=>l.zone===spec.theme)||definitions[0];
                return {...palette,name:spec.boardName,zone:spec.theme,mission:{...palette.mission,...spec.gate}};
            },
            templateFor(floor){const spec=levels[floor]?.spec;return floor>=builtinCount&&spec?{...templates.templateFor('Classic'),zone:spec.theme,parts:spec.parts}:null;},
            credit(floor){const row=levels[floor];return row?.author_kind==='llm'?`Edge forged by ${row.credited_name||'Explorer'}`:'';}
        };
        host.addEventListener?.('pickbits:ready',()=>source.refresh());void source.refresh();return source;
    }
    return {create,specToFloor};
});
