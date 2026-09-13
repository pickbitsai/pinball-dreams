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
        let pending=null,lastReport=-1,locked=null;
        const membershipListeners=new Set();
        const online=()=>host.navigator?.onLine!==false;
        const bounded=promise=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Level service timeout')),4000);Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(t));});
        const source={levels,get length(){return levels.length;},isActive:()=>bridge.isActive(),
            onMembershipRequired(fn){membershipListeners.add(fn);return()=>membershipListeners.delete(fn);},
            canPlayInfinite(){return !!(host.PickBits?.levels?.canPlayInfinite?.()??host.PickBits?.isAdFree?.());},
            get lockedNext(){return online()&&bridge.isActive()&&bridge.isReady()&&!source.canPlayInfinite()?locked:null;},
            join(){return Promise.resolve().then(()=>{
                const sdk=host.PickBits;if(!bridge.isActive()||!bridge.isReady()||!sdk)throw new Error('SDK unavailable');
                if(sdk.isAuthenticated?.())return sdk.startArcadePass();
                const redirect=new URL(host.location.href);redirect.searchParams.delete('pb_token');redirect.searchParams.set('pb_intent','arcade-pass');
                return sdk.promptSignup({redirect:redirect.href});
            });},
            refresh(){
                if(pending)return pending;
                if(!online()||!bridge.isActive()||!bridge.isReady()||!host.PickBits?.levels?.list){locked=null;return Promise.resolve([]);}
                pending=(async()=>{
                    const added=[];locked=null;
                    try {for(let page=0;page<10;page++) {
                        const after=levels.length-1,rows=await bounded(host.PickBits.levels.list('pinball',{after,limit:100}));
                        if(!Array.isArray(rows))break;
                        for(const row of [...rows].sort((a,b)=>a.level_index-b.level_index)) {
                            if((row.game_slug!=null&&row.game_slug!=='pinball')||(row.status!=null&&row.status!=='live')||!Number.isSafeInteger(row.level_index)||row.level_index!==levels.length)continue;
                            try{const level=specToFloor(row.spec,row);levels.push(level);added.push(level);}catch{/* Keep the contiguous playable prefix. */}
                        }
                        if(rows.length<100||after===levels.length-1)break;
                    }
                    if(levels.length===builtinCount&&host.PickBits.levels.peek&&!source.canPlayInfinite()) {
                        const rows=await bounded(host.PickBits.levels.peek('pinball',{after:builtinCount-1,limit:1}));
                        const row=Array.isArray(rows)&&rows.find(r=>r?.level_index===builtinCount&&['llm','human'].includes(r.author_kind));
                        if(row)locked={level_index:row.level_index,title:row.title,credited_name:row.credited_name,author_kind:row.author_kind};
                    }
                    }catch{/* Local 20-floor Climb remains available offline. */}
                    return added;
                })().finally(()=>{pending=null;});return pending;
            },
            async complete(index){
                if(!online()||!bridge.isActive()||index!==levels.length-1)return false;
                if(bridge.isReady()&&host.PickBits?.levels?.reportFrontier&&lastReport!==index) {
                    try{await bounded(host.PickBits.levels.reportFrontier('pinball',index));lastReport=index;}catch(error){
                        if(error?.code==='membership_required') {
                            lastReport=index;for(const fn of membershipListeners)try{fn();}catch{/* Isolate UI. */}
                        }
                    }
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
            credit(floor){const row=levels[floor];return ['llm','human'].includes(row?.author_kind)?`Edge forged by ${row.credited_name||'Explorer'}`:'';}
        };
        host.addEventListener?.('pickbits:ready',()=>source.refresh());void source.refresh();return source;
    }
const MEMBERSHIP_COPY='Members play beyond the built-ins';
const MEMBERSHIP_TOAST=`${MEMBERSHIP_COPY} · Join Arcade Pass $5/mo`;

// Metadata stays out of the playable level array. This dialog owns only the offer.
function createMembershipCard({source,unit,document:doc=globalThis.document}) {
    let dialog=null;
    const close=()=>{if(dialog){dialog.close();dialog.remove();dialog=null;}};
    return {close,
        show(onDismiss){
            const row=source.lockedNext;if(!row||!doc)return false;
            close();dialog=doc.createElement('dialog');dialog.className='infinite-locked-card';
            dialog.setAttribute('aria-label',`Locked ${unit.toLowerCase()}`);
            dialog.style.cssText='margin:auto;overflow-wrap:anywhere;box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border:2px solid #71e2ca;border-radius:18px;background:#10242b;color:#fff2d6;padding:28px;font:18px/1.5 system-ui;text-align:center;box-shadow:0 0 0 100vmax #000a';
            const add=(tag,text)=>{const el=doc.createElement(tag);el.textContent=text;if(tag==='p'||tag==='h2')el.style.margin='12px 0';dialog.append(el);return el;};
            add('p',`🔒 ${unit} ${row.level_index+1}`);
            add('h2',row.title||'The next forged level');
            add('p',`forged by ${row.credited_name||'the arcade'}`);
            add('p',MEMBERSHIP_COPY);add('p','Arcade Pass $5/mo · Infinite levels');
            const join=add('button','Join'),dismiss=add('button','Not now');
            for(const button of [join,dismiss]) {button.type='button';button.style.cssText='padding:12px 20px;margin:6px;border:1px solid #71e2ca;border-radius:8px;background:#183e43;color:#fff;font:inherit;cursor:pointer';}
            const status=add('p','');status.setAttribute('role','status');
            join.addEventListener('click',async()=>{
                join.disabled=true;
                try{await source.join();}catch{status.textContent='Arcade Pass unavailable. Try again soon.';}
                finally{join.disabled=false;}
            });
            const leave=()=>{close();onDismiss();};
            dismiss.addEventListener('click',leave);
            dialog.addEventListener('cancel',event=>{event.preventDefault();leave();});
            doc.body.append(dialog);dialog.showModal();join.focus();return true;
        }
    };
}

    return {create,specToFloor,createMembershipCard,MEMBERSHIP_TOAST};
});
