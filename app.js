(() => {
  "use strict";

  const MAGIC = Uint8Array.from([0x44,0x30,0x30,0x31,0,0,0,0]);
  const AES_KEY_HEX = "5ceb9d0aebb95ac0270b0af6753dfc0ee3e68bb69479020f2430e2ea002bd4c9";
  const DRAFT_KEY = "mcd-save-editor-draft-v1";
  const MAX_LOG = 120;

  const FILTERS = [
    ["All","All"],["MeleeWeapons","Melee"],["RangedWeapons","Ranged"],["Armor","Armor"],["Artifacts","Artifacts"],["Enchanted","Enchanted"]
  ];
  const SLOTS = [
    ["MeleeGear","Melee Gear","MeleeWeapons"],["ArmorGear","Armor Gear","Armor"],["RangedGear","Ranged Gear","RangedWeapons"],
    ["HotbarSlot1","Hotbar 1","Artifacts"],["HotbarSlot2","Hotbar 2","Artifacts"],["HotbarSlot3","Hotbar 3","Artifacts"]
  ];
  const DEFAULT_TYPE = {MeleeWeapons:"Sword",Armor:"ArchersStrappings",RangedWeapons:"Bow",Artifacts:"FireworksArrowItem"};
  const IMG = {MeleeWeapons:"assets/images/MeleeWeapons.png",RangedWeapons:"assets/images/RangedWeapons.png",Armor:"assets/images/Armor.png",Artifacts:"assets/images/Artifacts.png",Unknown:"assets/images/Unknown.png"};
  const CURRENCY = [
    ["Emerald","Emeralds","assets/images/Emerald.png"],
    ["Gold","Gold","assets/images/Gold.png"],
    ["EyeOfEnder","Eye of Ender","assets/images/EyeOfEnder.png"]
  ];
  const POWERFUL = new Set(["Backstabber","FinalShout","Chilling","Protection","PotionThirstMelee","PotionThirstRanged","GravityPulse","CriticalHit","Exploding","RadianceMelee","GravityMelee","Shockwave","Swirling","Gravity","TempoTheft","ChainReaction","RadianceRanged","ShockWeb","VoidTouchedMelee","VoidTouchedRanged","MultiCharge","DeathBarter","FireFocus","LightningFocus","MultiDodge","PoisonFocus","SoulFocus"]);

  const state = {
    sourceName:"",sourceMode:"unknown",decodeStatus:"Awaiting file",profile:null,original:null,dirty:false,
    sourceBytes:null,sourceMime:"application/octet-stream",backupDownloaded:false,
    riskyUnlocked:false,riskyTouched:false,
    tab:"inventory",invFilter:"All",chestFilter:"All",selectedToken:"",logs:[],
    categories:{},
    catalog:{items:{All:new Set(),MeleeWeapons:new Set([DEFAULT_TYPE.MeleeWeapons]),RangedWeapons:new Set([DEFAULT_TYPE.RangedWeapons]),Armor:new Set([DEFAULT_TYPE.Armor]),Artifacts:new Set([DEFAULT_TYPE.Artifacts])},ench:new Set(["Unset"]),armor:new Set(["AllyDamageBoost"])}
  };

  const d = id => document.getElementById(id);
  const dom = {
    fileInput:d("fileInput"),browseButton:d("browseButton"),dropZone:d("dropZone"),backupButton:d("backupButton"),riskyToggleButton:d("riskyToggleButton"),exportDatButton:d("exportDatButton"),exportJsonButton:d("exportJsonButton"),revertButton:d("revertButton"),loadDraftButton:d("loadDraftButton"),clearDraftButton:d("clearDraftButton"),
    statusInput:d("statusInput"),statusMode:d("statusMode"),statusDecode:d("statusDecode"),statusProfile:d("statusProfile"),metaDirty:d("metaDirty"),
    riskState:d("riskState"),exportGuard:d("exportGuard"),
    summaryGrid:d("summaryGrid"),currencyRow:d("currencyRow"),characterRow:d("characterRow"),unlockPortalButton:d("unlockPortalButton"),remainingPointsInventory:d("remainingPointsInventory"),remainingPointsChest:d("remainingPointsChest"),
    inventoryFilterRow:d("inventoryFilterRow"),chestFilterRow:d("chestFilterRow"),inventoryList:d("inventoryList"),chestList:d("chestList"),inventoryCount:d("inventoryCount"),chestCount:d("chestCount"),equipmentGrid:d("equipmentGrid"),
    progressStatsRows:d("progressStatsRows"),mobKillsRows:d("mobKillsRows"),
    itemEditor:d("itemEditor"),selectedLocationLabel:d("selectedLocationLabel"),logPanel:d("logPanel"),
    rawJsonArea:d("rawJsonArea"),rawRefreshButton:d("rawRefreshButton"),rawApplyButton:d("rawApplyButton"),
    tabInventoryButton:d("tabInventoryButton"),tabChestButton:d("tabChestButton"),tabStatsButton:d("tabStatsButton"),tabRawButton:d("tabRawButton"),
    inventoryPanel:d("inventoryPanel"),chestPanel:d("chestPanel"),statsPanel:d("statsPanel"),rawPanel:d("rawPanel"),
    modalBackdrop:d("modalBackdrop"),modalTitle:d("modalTitle"),modalCloseButton:d("modalCloseButton"),modalSearchInput:d("modalSearchInput"),modalCustomInput:d("modalCustomInput"),modalUseCustomButton:d("modalUseCustomButton"),modalList:d("modalList"),modalCount:d("modalCount")
  };

  const modal = {open:false,options:[],onSelect:null,search:""};

  bind();
  renderAll();
  log("Ready","Drop a .dat or .json save file to begin.");

  function bind(){
    dom.browseButton.addEventListener("click",()=>dom.fileInput.click());
    dom.fileInput.addEventListener("change",async e=>{const f=e.target.files?.[0];if(f)await openFile(f);dom.fileInput.value="";});
    ["dragenter","dragover"].forEach(t=>dom.dropZone.addEventListener(t,e=>{e.preventDefault();dom.dropZone.classList.add("dragover");}));
    ["dragleave","drop"].forEach(t=>dom.dropZone.addEventListener(t,e=>{e.preventDefault();dom.dropZone.classList.remove("dragover");}));
    dom.dropZone.addEventListener("drop",async e=>{const f=e.dataTransfer?.files?.[0];if(f)await openFile(f);});

    dom.exportDatButton.addEventListener("click",()=>safe(()=>exportSave("dat")));
    dom.exportJsonButton.addEventListener("click",()=>safe(()=>exportSave("json")));
    dom.backupButton.addEventListener("click",()=>safe(downloadBackup));
    dom.riskyToggleButton.addEventListener("click",toggleRiskyMode);
    dom.revertButton.addEventListener("click",()=>{if(!state.original)return;state.profile=clone(state.original);normalizeProfile(state.profile);rebuildCatalog();state.selectedToken="";setDirty(false);log("Reverted","Restored values from loaded file.");renderAll();});
    dom.loadDraftButton.addEventListener("click",loadDraft);
    dom.clearDraftButton.addEventListener("click",()=>{localStorage.removeItem(DRAFT_KEY);log("Draft","Local draft cleared.");});

    dom.tabInventoryButton.addEventListener("click",()=>setTab("inventory"));
    dom.tabChestButton.addEventListener("click",()=>setTab("chest"));
    dom.tabStatsButton.addEventListener("click",()=>setTab("stats"));
    dom.tabRawButton.addEventListener("click",()=>setTab("raw"));

    dom.rawRefreshButton.addEventListener("click",()=>{if(!state.profile)return;dom.rawJsonArea.value=serialize(state.profile);log("Raw JSON","Refreshed from current state.");});
    dom.rawApplyButton.addEventListener("click",()=>{if(!dom.rawJsonArea.value.trim())return;safe(()=>{state.profile=JSON.parse(dom.rawJsonArea.value);normalizeProfile(state.profile);rebuildCatalog();setDirty(true);markRiskyTouched("Raw JSON applied. Verify IDs before export.");log("Raw JSON","Applied JSON to profile.");renderAll();});});

    dom.inventoryFilterRow.addEventListener("click",e=>{const f=e.target.closest("button")?.dataset.filter;if(!f)return;state.invFilter=f;renderFilters();renderInventory();});
    dom.chestFilterRow.addEventListener("click",e=>{const f=e.target.closest("button")?.dataset.filter;if(!f)return;state.chestFilter=f;renderFilters();renderChest();});

    dom.inventoryList.addEventListener("click",e=>listClick(e,"inventory"));
    dom.chestList.addEventListener("click",e=>listClick(e,"chest"));
    dom.equipmentGrid.addEventListener("click",equipClick);

    dom.currencyRow.addEventListener("change",e=>{if(!(e.target instanceof HTMLInputElement)||!state.profile)return;const t=e.target.dataset.type;if(!t)return;const v=Number(e.target.value);if(!Number.isFinite(v)||v<0)return;setCurrency(t,Math.floor(v));setDirty(true);renderSummary();renderPoints();});
    dom.currencyRow.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.dataset.action!=="add-currency")return;setCurrency(b.dataset.type,0);setDirty(true);renderCurrencies();renderSummary();});

    dom.characterRow.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||!state.profile)return;const a=b.dataset.action;if(a!=="level-up"&&a!=="level-down")return;const cur=level();const next=a==="level-up"?cur+1:Math.max(1,cur-1);state.profile.xp=xpForLevel(next);setDirty(true);log("Level","Character level set to "+next+".");renderSummary();renderCharacter();renderPoints();});
    dom.characterRow.addEventListener("change",e=>{if(!(e.target instanceof HTMLInputElement)||!state.profile||e.target.dataset.role!=="char-level")return;const v=Number(e.target.value);if(!Number.isFinite(v))return;const lv=Math.max(1,Math.floor(v));state.profile.xp=xpForLevel(lv);setDirty(true);log("Level","Character level set to "+lv+".");renderSummary();renderCharacter();renderPoints();});    dom.unlockPortalButton.addEventListener("click",()=>{if(!state.profile)return;const map=state.profile.strongholdProgress||{};Object.keys(map).forEach(k=>{if(k.endsWith("Unlocked"))map[k]=true;});state.profile.strongholdProgress=map;setDirty(true);log("Unlock Portal","Set all *_Unlocked keys to true.");renderCurrencies();});

    dom.progressStatsRows.addEventListener("change",e=>editStat(e,"progressStatCounters"));
    dom.mobKillsRows.addEventListener("change",e=>editStat(e,"mob_kills"));

    dom.itemEditor.addEventListener("click",itemEditorClick);
    dom.itemEditor.addEventListener("change",itemEditorChange);

    dom.modalCloseButton.addEventListener("click",closeModal);
    dom.modalBackdrop.addEventListener("click",e=>{if(e.target===dom.modalBackdrop)closeModal();});
    dom.modalSearchInput.addEventListener("input",()=>{modal.search=dom.modalSearchInput.value||"";renderModal();});
    dom.modalUseCustomButton.addEventListener("click",()=>{const v=(dom.modalCustomInput.value||"").trim();if(!v||typeof modal.onSelect!=="function")return;modal.onSelect(v);closeModal();});
    dom.modalList.addEventListener("click",e=>{const b=e.target.closest("button[data-id]");if(!b||typeof modal.onSelect!=="function")return;modal.onSelect(b.dataset.id);closeModal();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.open)closeModal();});
  }
  function safe(fn){try{fn();}catch(e){log("Error",String(e));}}

  function listClick(e,location){
    const b=e.target.closest("button"); if(!b)return;
    if(b.dataset.action==="add"){addItem(location,b.dataset.filter||"All");return;}
    const token=b.dataset.token; if(!token)return;
    state.selectedToken=token; renderItemEditor(); renderInventory(); renderChest();
  }

  function equipClick(e){
    const b=e.target.closest("button"); if(!b)return;
    const slot=b.dataset.slot; if(!slot)return;
    if(b.dataset.action==="add"){addEquipped(slot); return;}
    if(b.dataset.action==="select"){
      const item=findSlot(slot); if(!item)return;
      state.selectedToken=token("inventory",item,state.profile.items.indexOf(item));
      renderItemEditor(); renderEquipment(); renderInventory();
    }
  }

  async function openFile(file){
    const bytes=new Uint8Array(await file.arrayBuffer());
    parseBytes(bytes,file.name);
    log("File loaded",`${file.name} (${bytes.length.toLocaleString()} bytes)`);
    renderAll();
  }

  function parseBytes(bytes,name){
    if(!bytes?.length) throw new Error("Input file is empty.");
    let txt="",mode="json";
    if(isDat(bytes)){
      mode="dat";
      txt=sanitize(new TextDecoder("utf-8",{fatal:false}).decode(decryptDat(bytes)));
      state.decodeStatus="Decrypted .dat with AES-ECB";
    }else{
      txt=sanitize(new TextDecoder("utf-8",{fatal:false}).decode(bytes));
      state.decodeStatus="Parsed text JSON payload";
    }
    state.profile=JSON.parse(txt);
    normalizeProfile(state.profile);
    state.original=clone(state.profile);
    state.sourceName=name||"character.dat";
    state.sourceMode=mode;
    state.sourceBytes=new Uint8Array(bytes);
    state.sourceMime=mode==="dat"?"application/octet-stream":"application/json";
    state.backupDownloaded=false;
    state.riskyTouched=false;
    state.riskyUnlocked=false;
    state.selectedToken="";
    rebuildCatalog();
    setDirty(false);
  }

  function isDat(bytes){
    if(bytes.length < MAGIC.length) return false;
    for(let i=0;i<MAGIC.length;i+=1) if(bytes[i]!==MAGIC[i]) return false;
    return true;
  }

  function decryptDat(bytes){
    needCrypto();
    const cipher=toWord(bytes.slice(MAGIC.length));
    const key=CryptoJS.enc.Hex.parse(AES_KEY_HEX);
    const dec=CryptoJS.AES.decrypt({ciphertext:cipher},key,{mode:CryptoJS.mode.ECB,padding:CryptoJS.pad.ZeroPadding});
    let out=fromWord(dec); const z=out.indexOf(0); if(z>=0) out=out.slice(0,z); return out;
  }

  function encryptDat(profile){
    needCrypto();
    const key=CryptoJS.enc.Hex.parse(AES_KEY_HEX);
    const plain=toWord(new TextEncoder().encode(serialize(profile)));
    const enc=CryptoJS.AES.encrypt(plain,key,{mode:CryptoJS.mode.ECB,padding:CryptoJS.pad.ZeroPadding}).ciphertext;
    const b=fromWord(enc); const out=new Uint8Array(MAGIC.length+b.length); out.set(MAGIC,0); out.set(b,MAGIC.length); return out;
  }

  function sanitize(text){
    const s=String(text||"").replace(/[\u0000-\u001F\u007F-\u009F]/g,"");
    let c=0,start=false,end=-1;
    for(let i=0;i<s.length;i+=1){const ch=s[i]; if(ch==="{"){c+=1;start=true;} else if(ch==="}"){c-=1; if(start&&c===0){end=i;break;}}}
    if(end<0) return s.trim(); const first=s.indexOf("{"); return first<0 ? s.trim() : s.slice(first,end+1);
  }

  function normalizeProfile(p){
    if(!p||typeof p!=="object") throw new Error("Profile payload is invalid.");
    if(!Array.isArray(p.items)) p.items=[];
    if(!Array.isArray(p.storageChestItems)) p.storageChestItems=[];
    if(!Array.isArray(p.currency)) p.currency=[];
    if(!p.progressStatCounters||typeof p.progressStatCounters!=="object") p.progressStatCounters={};
    if(!p.mob_kills||typeof p.mob_kills!=="object") p.mob_kills={};
    if(!p.strongholdProgress||typeof p.strongholdProgress!=="object") p.strongholdProgress={};
    p.items=p.items.map(normItem); p.storageChestItems=p.storageChestItems.map(normItem);
    p.currency=p.currency.filter(c=>c&&typeof c.type==="string").map(c=>({type:c.type,count:Number.isFinite(Number(c.count))?Math.max(0,Math.floor(Number(c.count))):0}));
    if(!Number.isFinite(Number(p.xp))) p.xp=0;
    if(!Number.isFinite(Number(p.totalGearPower))) p.totalGearPower=0;
  }

  function normItem(i){
    const o=i&&typeof i==="object"?i:{};
    o.type=typeof o.type==="string"&&o.type.trim()?o.type:"Sword";
    o.power=Number.isFinite(Number(o.power))?Number(o.power):1;
    o.rarity=rarity(o.rarity);
    o.inventoryIndex=Number.isFinite(Number(o.inventoryIndex))?Math.floor(Number(o.inventoryIndex)):null;
    o.equipmentSlot=typeof o.equipmentSlot==="string"&&o.equipmentSlot.trim()?o.equipmentSlot:null;
    o.markedNew=!!o.markedNew; o.upgraded=!!o.upgraded; o.gifted=!!o.gifted;
    if(!Array.isArray(o.enchantments)) o.enchantments=[];
    o.enchantments=o.enchantments.map(normEnch);
    o.netheriteEnchant=o.netheriteEnchant&&typeof o.netheriteEnchant==="object"?normEnch(o.netheriteEnchant):null;
    if(!Array.isArray(o.armorproperties)) o.armorproperties=[];
    o.armorproperties=o.armorproperties.filter(a=>a&&typeof a.id==="string").map(a=>({id:a.id,rarity:rarity(a.rarity)}));
    return o;
  }

  function normEnch(e){
    const o=e&&typeof e==="object"?e:{}; o.id=typeof o.id==="string"&&o.id.trim()?o.id:"Unset"; o.level=clamp(Math.floor(Number(o.level)||0),0,3); return o;
  }

  function rarity(v){return (v==="Common"||v==="Rare"||v==="Unique")?v:"Common";}

  function rebuildCatalog(){
    state.catalog.items={All:new Set(),MeleeWeapons:new Set([DEFAULT_TYPE.MeleeWeapons]),RangedWeapons:new Set([DEFAULT_TYPE.RangedWeapons]),Armor:new Set([DEFAULT_TYPE.Armor]),Artifacts:new Set([DEFAULT_TYPE.Artifacts])};
    state.catalog.ench=new Set(["Unset",...POWERFUL]);
    state.catalog.armor=new Set(["AllyDamageBoost"]);
    state.categories={};
    if(!state.profile) return;
    for(const item of [...state.profile.items,...state.profile.storageChestItems]){
      const cat=classify(item); remember(item.type,cat);
      for(const e of item.enchantments||[]) state.catalog.ench.add(e.id);
      if(item.netheriteEnchant?.id) state.catalog.ench.add(item.netheriteEnchant.id);
      for(const a of item.armorproperties||[]) state.catalog.armor.add(a.id);
    }
  }
  function renderAll(){
    renderStatus(); renderTabs(); renderSummary(); renderFilters(); renderCurrencies(); renderCharacter(); renderEquipment(); renderInventory(); renderChest(); renderPoints(); renderStats(); renderItemEditor(); renderRaw(); renderLog();
    const loaded=!!state.profile;
    const blocked = state.riskyTouched && !state.backupDownloaded;
    dom.exportDatButton.disabled=!loaded || blocked;
    dom.exportJsonButton.disabled=!loaded || blocked;
    dom.revertButton.disabled=!loaded;
    dom.backupButton.disabled=!loaded || !state.sourceBytes;
    dom.riskState.textContent = `Risky IDs: ${state.riskyUnlocked ? "Unlocked" : "Locked"}`;
    dom.riskState.title = state.riskyUnlocked
      ? "Internal IDs are editable. Wrong values can corrupt saves."
      : "Internal IDs are read-only until you explicitly unlock risky editing.";
    dom.riskyToggleButton.textContent = state.riskyUnlocked ? "Lock Risky ID Editing" : "Enable Risky ID Editing";
    dom.exportGuard.classList.toggle("hidden", !blocked);
  }

  function renderStatus(){
    dom.statusInput.textContent=state.sourceName||"No file loaded";
    dom.statusMode.textContent=state.sourceMode||"Unknown";
    dom.statusDecode.textContent=state.decodeStatus||"-";
    dom.statusProfile.textContent=state.profile?`Parsed. Character level ${level()}`:"Not parsed";
    dom.metaDirty.textContent=`Dirty: ${state.dirty?"Yes":"No"}`;
  }

  function renderTabs(){
    const m={inventory:[dom.tabInventoryButton,dom.inventoryPanel],chest:[dom.tabChestButton,dom.chestPanel],stats:[dom.tabStatsButton,dom.statsPanel],raw:[dom.tabRawButton,dom.rawPanel]};
    Object.keys(m).forEach(k=>{const [b,p]=m[k];const a=k===state.tab;b.classList.toggle("active",a);p.classList.toggle("active",a);});
  }

  function setTab(t){state.tab=t; renderTabs(); if(t==="raw") renderRaw();}

  function renderSummary(){
    if(!state.profile){dom.summaryGrid.innerHTML='<div class="metric"><div class="label">Status</div><div class="value">Load a save to start.</div></div>';return;}
    const inv=state.profile.items.filter(i=>!i.equipmentSlot).length, chest=state.profile.storageChestItems.length, eq=state.profile.items.filter(i=>!!i.equipmentSlot).length;
    const rows=[["Character Level",level()],["XP",Number(state.profile.xp||0).toLocaleString()],["Computed Power",charPower().toString()],["Equipped Slots",`${eq}/6`],["Inventory",`${inv}/300`],["Chest",`${chest}`],["Emeralds",currencyCount("Emerald").toLocaleString()],["Gold",currencyCount("Gold").toLocaleString()],["Eye Of Ender",currencyCount("EyeOfEnder").toLocaleString()],["Enchant Points",remainPoints().toString()],["Progress Stats",Object.keys(state.profile.progressStatCounters||{}).length.toString()],["Mob Kills",Object.keys(state.profile.mob_kills||{}).length.toString()]];
    dom.summaryGrid.innerHTML=rows.map(([k,v])=>`<div class="metric"><div class="label">${esc(k)}</div><div class="value">${esc(v)}</div></div>`).join("");
  }

  function renderFilters(){
    dom.inventoryFilterRow.innerHTML=FILTERS.map(([id,label])=>`<button class="${state.invFilter===id?"tab-btn active":"tab-btn"}" data-filter="${id}">${esc(label)}</button>`).join("");
    dom.chestFilterRow.innerHTML=FILTERS.map(([id,label])=>`<button class="${state.chestFilter===id?"tab-btn active":"tab-btn"}" data-filter="${id}">${esc(label)}</button>`).join("");
  }

  function renderCurrencies(){
    if(!state.profile){dom.currencyRow.innerHTML=""; dom.unlockPortalButton.classList.add("hidden"); return;}
    dom.currencyRow.innerHTML=CURRENCY.map(([type,label,img])=>{const c=currency(type); if(c) return `<div class="currency"><img src="${img}" alt=""><span>${esc(label)}</span><input type="number" min="0" step="1" data-type="${type}" value="${c.count}"></div>`; return `<div class="currency"><img src="${img}" alt=""><span>${esc(label)}</span><button class="secondary" data-action="add-currency" data-type="${type}">Add</button></div>`;}).join("");
    dom.unlockPortalButton.classList.toggle("hidden",portalUnlocked());
  }

  function renderCharacter(){
    if(!state.profile){dom.characterRow.innerHTML="";return;}
    const lv=level();
    dom.characterRow.innerHTML=`<span class="chip">Character Level</span><button class="secondary" data-action="level-down">-</button><input type="number" min="1" step="1" data-role="char-level" value="${lv}" style="width:110px;"><button class="secondary" data-action="level-up">+</button><span class="chip">Computed Power: ${charPower()}</span>`;
  }
  function renderEquipment(){
    if(!state.profile){dom.equipmentGrid.innerHTML='<div class="small-note">Load a profile to edit equipment slots.</div>'; return;}
    dom.equipmentGrid.innerHTML=SLOTS.map(([slot,label])=>{const item=findSlot(slot); if(!item) return `<div class="slot-card"><div class="slot-title">${esc(label)}</div><div class="slot-content small-note">No item equipped</div><button data-action="add" data-slot="${slot}">Add Default</button></div>`; return `<div class="slot-card"><div class="slot-title">${esc(label)}</div><div class="slot-content"><strong>${esc(pretty(item.type))}</strong><br><span class="small-note">Lvl ${itemLevel(item.power)} · ${esc(item.rarity)}</span></div><button data-action="select" data-slot="${slot}">Select</button></div>`;}).join("");
  }

  function renderInventory(){
    if(!state.profile){dom.inventoryList.innerHTML=""; dom.inventoryCount.textContent="Items: 0/300"; return;}
    const all=state.profile.items.filter(i=>!i.equipmentSlot), items=all.filter(i=>match(i,state.invFilter));
    dom.inventoryCount.textContent=`Items: ${all.length}/300`;
    const cards=items.map(i=>itemCard(i,"inventory",state.profile.items.indexOf(i)));
    if(state.invFilter!=="All"&&state.invFilter!=="Enchanted") cards.push(`<button class="item-card" data-action="add" data-filter="${state.invFilter}"><div class="name">+ Add ${esc(labelOf(state.invFilter))} Item</div><div class="meta">Creates a default item entry.</div></button>`);
    dom.inventoryList.innerHTML=cards.join("");
  }

  function renderChest(){
    if(!state.profile){dom.chestList.innerHTML=""; dom.chestCount.textContent="Items: 0"; return;}
    const all=state.profile.storageChestItems, items=all.filter(i=>match(i,state.chestFilter));
    dom.chestCount.textContent=`Items: ${all.length}`;
    const cards=items.map(i=>itemCard(i,"chest",all.indexOf(i)));
    if(state.chestFilter!=="All"&&state.chestFilter!=="Enchanted") cards.push(`<button class="item-card" data-action="add" data-filter="${state.chestFilter}"><div class="name">+ Add ${esc(labelOf(state.chestFilter))} Item</div><div class="meta">Creates a default item entry.</div></button>`);
    dom.chestList.innerHTML=cards.join("");
  }

  function itemCard(item,loc,index){
    const t=token(loc,item,index), active=state.selectedToken===t?"active":"", cat=classify(item), img=IMG[cat]||IMG.Unknown, lvl=itemLevel(item.power), pts=itemPoints(item);
    return `<button class="item-card ${active}" data-token="${t}"><img src="${img}" alt=""><div class="name">${esc(pretty(item.type))}</div><div class="meta">Lvl ${lvl} · ${esc(item.rarity)}${pts>0?` · ${pts} pts`:""}</div></button>`;
  }

  function renderPoints(){const p=state.profile?remainPoints():0; dom.remainingPointsInventory.textContent=`Remaining Enchantment Points: ${p}`; dom.remainingPointsChest.textContent=`Remaining Enchantment Points: ${p}`;}

  function renderStats(){
    if(!state.profile){const empty='<div class="table-row" style="grid-template-columns:minmax(180px,1fr) 130px;"><div class="small-note">No profile loaded.</div><div></div></div>'; dom.progressStatsRows.innerHTML=empty; dom.mobKillsRows.innerHTML=empty; return;}
    dom.progressStatsRows.innerHTML=statRows(state.profile.progressStatCounters);
    dom.mobKillsRows.innerHTML=statRows(state.profile.mob_kills);
  }

  function statRows(map){
    const entries=Object.entries(map||{}).sort((a,b)=>a[0].localeCompare(b[0]));
    if(!entries.length) return '<div class="table-row" style="grid-template-columns:minmax(180px,1fr) 130px;"><div class="small-note">No entries.</div><div></div></div>';
    return entries.map(([k,v])=>`<div class="table-row" style="grid-template-columns:minmax(180px,1fr) 130px;"><div>${esc(k)}</div><input type="number" step="1" data-key="${escA(k)}" value="${Number(v)}"></div>`).join("");
  }

  function renderItemEditor(){
    const sel=selected();
    if(!sel){dom.itemEditor.innerHTML='<p class="small-note">Select an item from Inventory or Chest to edit details.</p>'; dom.selectedLocationLabel.textContent='Location: -'; return;}
    const {item,location}=sel, art=classify(item)==="Artifacts", armor=classify(item)==="Armor", moveTo=location==="inventory"?"chest":"inventory", moveText=location==="inventory"?"Move To Chest":"Move To Inventory";
    const riskyLocked = !state.riskyUnlocked;
    const riskyAttr = riskyLocked ? "disabled" : "";
    dom.selectedLocationLabel.textContent=`Location: ${location==="inventory"?"Inventory":"Chest"}`;

    const ench=(item.enchantments||[]).map((e,i)=>`<div class="ench-row"><div class="edit-row"><input type="text" data-role="enchant-id" data-index="${i}" value="${escA(e.id)}" title="Risky internal enchantment ID." ${riskyAttr}><button class="secondary" data-action="pick-enchant" data-index="${i}" title="Risky internal enchantment ID picker." ${riskyAttr}>Pick</button></div><input type="number" min="0" max="3" step="1" data-role="enchant-level" data-index="${i}" value="${Number(e.level||0)}"><div class="edit-row"><span class="chip">Cost ${enchCost(e,!!item.netheriteEnchant)}</span><button class="danger" data-action="remove-enchant" data-index="${i}">Remove</button></div></div>`).join("") || '<p class="small-note">No enchantment entries yet.</p>';

    const armorRows=(item.armorproperties||[]).map((a,i)=>`<div class="prop-row"><div class="edit-row"><input type="text" data-role="armor-id" data-index="${i}" value="${escA(a.id)}" title="Risky internal armor property ID." ${riskyAttr}><button class="secondary" data-action="pick-armor" data-index="${i}" title="Risky internal armor property picker." ${riskyAttr}>Pick</button></div><select data-role="armor-rarity" data-index="${i}">${rarityOpts(a.rarity)}</select><button class="danger" data-action="remove-armor" data-index="${i}">Remove</button></div>`).join("") || '<p class="small-note">No armor properties.</p>';

    dom.itemEditor.innerHTML=`<div class="chips"><span class="chip">ID: ${esc(item.type)}</span><span class="chip">InventoryIndex: ${item.inventoryIndex==null?"-":item.inventoryIndex}</span><span class="chip">EquipmentSlot: ${esc(item.equipmentSlot||"None")}</span><span class="chip">${state.riskyUnlocked?"Risky ID editing enabled":"Risky ID editing locked"}</span></div><p class="small-note">Helper: IDs (Type, enchant IDs, armor property IDs) are internal values. Wrong values can corrupt saves.</p><div class="grid-2"><div class="field"><label>Item Type</label><div class="edit-row"><input type="text" data-role="item-type" value="${escA(item.type)}" title="Risky internal item type ID." ${riskyAttr}><button class="secondary" data-action="pick-item-type" title="Risky internal item type picker." ${riskyAttr}>Pick</button></div></div><div class="field"><label>Rarity</label><select data-role="rarity">${rarityOpts(item.rarity)}</select></div></div><div class="grid-2"><div class="field"><label>Power Level</label><div class="edit-row"><button class="secondary" data-action="level-down">-</button><input type="number" min="0" step="1" data-role="power-level" value="${itemLevel(item.power)}"><button class="secondary" data-action="level-up">+</button></div></div><div class="field"><label>Raw Power</label><input type="number" min="0" step="0.00001" data-role="raw-power" value="${Number(item.power)}"></div></div><div class="grid-3"><label><input type="checkbox" data-role="flag-marked" ${item.markedNew?"checked":""}> Marked New</label><label><input type="checkbox" data-role="flag-upgraded" ${item.upgraded?"checked":""}> Upgraded</label><label><input type="checkbox" data-role="flag-gifted" ${item.gifted?"checked":""}> Gifted</label></div><div class="button-row"><button data-action="duplicate">Duplicate</button><button class="danger" data-action="delete">Delete</button><button class="secondary" data-action="move" data-destination="${moveTo}">${moveText}</button></div>${armor?`<div class="subpanel"><div class="section-head"><h3>Armor Properties</h3></div>${armorRows}<button class="secondary" data-action="add-armor">Add Armor Property</button></div>`:""}${!art?`<div class="subpanel"><div class="section-head"><h3>Gilded / Netherite</h3></div><label><input type="checkbox" data-role="toggle-gilded" ${item.netheriteEnchant?"checked":""}> Gilded Item</label>${item.netheriteEnchant?`<div class="grid-2"><div class="field"><label>Netherite Enchantment</label><div class="edit-row"><input type="text" data-role="netherite-id" value="${escA(item.netheriteEnchant.id)}" title="Risky internal netherite enchantment ID." ${riskyAttr}><button class="secondary" data-action="pick-netherite" title="Risky internal netherite picker." ${riskyAttr}>Pick</button></div></div><div class="field"><label>Tier</label><div class="edit-row"><input type="number" min="0" max="3" step="1" data-role="netherite-level" value="${Number(item.netheriteEnchant.level||0)}"><button class="danger" data-action="remove-netherite">Remove</button></div></div></div>`:'<p class="small-note">Enable gilded to add a netherite enchantment.</p>'}</div><div class="subpanel"><div class="section-head"><h3>Enchantments</h3><span class="small-note">Desktop parity: add slots in groups of 3</span></div>${ench}<button class="secondary" data-action="add-enchant-slot">Add Enchantment Slot (+3)</button></div>`:""}`;
  }

  function rarityOpts(current){return ["Common","Rare","Unique"].map(r=>`<option value="${r}" ${current===r?"selected":""}>${r}</option>`).join("");}
  function renderRaw(){if(state.tab!=="raw")return; dom.rawJsonArea.value=state.profile?serialize(state.profile):"";}
  function renderLog(){dom.logPanel.innerHTML=state.logs.map(e=>`<div class="log-entry">${esc(e.t)}<small>${esc(e.d)}</small></div>`).join("");}
  function itemEditorClick(e){
    if(!state.profile) return;
    const b=e.target.closest("button"); if(!b)return;
    const sel=selected(); if(!sel)return;
    const item=sel.item, loc=sel.location, a=b.dataset.action;
    if(!a)return;
    if(a==="duplicate"){const c=clone(item); c.equipmentSlot=null; c.inventoryIndex=null; addItem(loc,classify(c),c); return;}
    if(a==="delete"){removeSelected(); return;}
    if(a==="move"){const dst=b.dataset.destination; if(dst==="inventory"||dst==="chest") moveSelected(dst); return;}
    if(a==="level-up"){item.power=power(itemLevel(item.power)+1); changed("Increased item level"); return;}
    if(a==="level-down"){item.power=power(Math.max(0,itemLevel(item.power)-1)); changed("Decreased item level"); return;}
    if(a==="pick-item-type"){if(!state.riskyUnlocked){log("Risky IDs","Unlock risky ID editing to change item type IDs."); return;} openModal("Select Item Type",itemOptions(classify(item)),v=>{item.type=v; remember(item.type,classify(item)); markRiskyTouched("Item type ID changed."); changed("Item type changed");}); return;}
    if(a==="add-armor"){item.armorproperties=item.armorproperties||[]; item.armorproperties.push({id:"AllyDamageBoost",rarity:"Common"}); state.catalog.armor.add("AllyDamageBoost"); changed("Armor property added"); return;}
    if(a==="remove-armor"){const i=Number(b.dataset.index); if(!Number.isFinite(i))return; item.armorproperties.splice(i,1); changed("Armor property removed"); return;}
    if(a==="pick-armor"){if(!state.riskyUnlocked){log("Risky IDs","Unlock risky ID editing to change armor property IDs."); return;} const i=Number(b.dataset.index); if(!Number.isFinite(i))return; openModal("Select Armor Property",armorOptions(),v=>{if(!item.armorproperties[i])return; item.armorproperties[i].id=v; state.catalog.armor.add(v); markRiskyTouched("Armor property ID changed."); changed("Armor property changed");}); return;}
    if(a==="add-enchant-slot"){item.enchantments=item.enchantments||[]; if(item.enchantments.length<9){item.enchantments.push({id:"Unset",level:0},{id:"Unset",level:0},{id:"Unset",level:0}); item.enchantments=item.enchantments.slice(0,9); changed("Added enchantment slot block (+3)");} return;}
    if(a==="remove-enchant"){const i=Number(b.dataset.index); if(!Number.isFinite(i))return; item.enchantments.splice(i,1); changed("Enchantment removed"); return;}
    if(a==="pick-enchant"){if(!state.riskyUnlocked){log("Risky IDs","Unlock risky ID editing to change enchantment IDs."); return;} const i=Number(b.dataset.index); if(!Number.isFinite(i))return; openModal("Select Enchantment",enchOptions(),v=>{if(!item.enchantments[i])return; item.enchantments[i].id=v; state.catalog.ench.add(v); markRiskyTouched("Enchantment ID changed."); changed("Enchantment changed");}); return;}
    if(a==="pick-netherite"){if(!state.riskyUnlocked){log("Risky IDs","Unlock risky ID editing to change netherite IDs."); return;} openModal("Select Netherite Enchantment",enchOptions(),v=>{if(!item.netheriteEnchant)item.netheriteEnchant={id:v,level:0}; item.netheriteEnchant.id=v; state.catalog.ench.add(v); markRiskyTouched("Netherite enchantment ID changed."); changed("Netherite enchantment changed");}); return;}
    if(a==="remove-netherite"){item.netheriteEnchant=null; changed("Removed netherite enchantment"); return;}
  }

  function itemEditorChange(e){
    if(!state.profile) return;
    const sel=selected(); if(!sel)return;
    const item=sel.item, t=e.target; if(!(t instanceof HTMLInputElement||t instanceof HTMLSelectElement)) return;
    const r=t.dataset.role; if(!r)return;
    if(r==="item-type"){if(!state.riskyUnlocked){t.value=item.type; log("Risky IDs","Unlock risky ID editing to change item type IDs."); return;} item.type=t.value.trim()||item.type; remember(item.type,classify(item)); markRiskyTouched("Item type ID changed."); return changed("Updated item type");}
    if(r==="rarity"){item.rarity=rarity(t.value); return changed("Updated rarity");}
    if(r==="power-level"){const v=Number(t.value); if(!Number.isFinite(v))return; item.power=power(Math.max(0,Math.floor(v))); return changed("Updated item level");}
    if(r==="raw-power"){const v=Number(t.value); if(!Number.isFinite(v)||v<0)return; item.power=v; return changed("Updated raw power");}
    if(r==="flag-marked"){item.markedNew=t.checked; return changed("Updated Marked New");}
    if(r==="flag-upgraded"){item.upgraded=t.checked; return changed("Updated Upgraded");}
    if(r==="flag-gifted"){item.gifted=t.checked; return changed("Updated Gifted");}
    if(r==="toggle-gilded"){item.netheriteEnchant=t.checked?(item.netheriteEnchant||{id:"Unset",level:0}):null; return changed("Updated gilded state");}
    if(r==="netherite-id"){if(!state.riskyUnlocked){t.value=item.netheriteEnchant?.id||"Unset"; log("Risky IDs","Unlock risky ID editing to change netherite IDs."); return;} if(!item.netheriteEnchant)item.netheriteEnchant={id:"Unset",level:0}; item.netheriteEnchant.id=t.value.trim()||"Unset"; state.catalog.ench.add(item.netheriteEnchant.id); markRiskyTouched("Netherite enchantment ID changed."); return changed("Updated netherite id");}
    if(r==="netherite-level"){if(!item.netheriteEnchant)item.netheriteEnchant={id:"Unset",level:0}; const v=Number(t.value); if(!Number.isFinite(v))return; item.netheriteEnchant.level=clamp(Math.floor(v),0,3); return changed("Updated netherite level");}
    if(r==="enchant-id"){if(!state.riskyUnlocked){const i0=Number(t.dataset.index); if(Number.isFinite(i0)&&item.enchantments[i0]) t.value=item.enchantments[i0].id; log("Risky IDs","Unlock risky ID editing to change enchantment IDs."); return;} const i=Number(t.dataset.index); if(!Number.isFinite(i)||!item.enchantments[i])return; item.enchantments[i].id=t.value.trim()||"Unset"; state.catalog.ench.add(item.enchantments[i].id); markRiskyTouched("Enchantment ID changed."); return changed("Updated enchantment id");}
    if(r==="enchant-level"){const i=Number(t.dataset.index); if(!Number.isFinite(i)||!item.enchantments[i])return; const v=Number(t.value); if(!Number.isFinite(v))return; item.enchantments[i].level=clamp(Math.floor(v),0,3); return changed("Updated enchantment level");}
    if(r==="armor-id"){if(!state.riskyUnlocked){const i0=Number(t.dataset.index); if(Number.isFinite(i0)&&item.armorproperties[i0]) t.value=item.armorproperties[i0].id; log("Risky IDs","Unlock risky ID editing to change armor property IDs."); return;} const i=Number(t.dataset.index); if(!Number.isFinite(i)||!item.armorproperties[i])return; item.armorproperties[i].id=t.value.trim()||"AllyDamageBoost"; state.catalog.armor.add(item.armorproperties[i].id); markRiskyTouched("Armor property ID changed."); return changed("Updated armor property id");}
    if(r==="armor-rarity"){const i=Number(t.dataset.index); if(!Number.isFinite(i)||!item.armorproperties[i])return; item.armorproperties[i].rarity=rarity(t.value); return changed("Updated armor property rarity");}
  }

  function changed(msg){normalizeProfile(state.profile); setDirty(true); rebuildCatalog(); renderSummary(); renderEquipment(); renderInventory(); renderChest(); renderPoints(); renderItemEditor(); if(state.tab==="raw") renderRaw(); if(msg) log("Item edit",msg);}

  function addEquipped(slot){const m=SLOTS.find(s=>s[0]===slot); if(!m||!state.profile)return; const item=normItem({type:DEFAULT_TYPE[m[2]],power:1,rarity:"Common",markedNew:true,upgraded:false,gifted:false,equipmentSlot:slot,inventoryIndex:null,enchantments:[],netheriteEnchant:null,armorproperties:[]}); state.profile.items=state.profile.items.filter(i=>i.equipmentSlot!==slot); item.inventoryIndex=nextIndex(state.profile.items); state.profile.items.push(item); remember(item.type,m[2]); state.selectedToken=token("inventory",item,state.profile.items.length-1); setDirty(true); log("Equipped item",`Added default ${m[1]} item.`); renderAll();}
  function addItem(loc,filter,provided){if(!state.profile)return;const list=loc==="chest"?state.profile.storageChestItems:state.profile.items; const f=DEFAULT_TYPE[filter]?filter:"MeleeWeapons"; const item=provided?normItem(clone(provided)):normItem({type:DEFAULT_TYPE[f],power:1,rarity:"Common",markedNew:true,upgraded:false,gifted:false,equipmentSlot:null,inventoryIndex:null,enchantments:[],netheriteEnchant:null,armorproperties:[]}); item.inventoryIndex=nextIndex(list); list.push(item); remember(item.type,f); state.selectedToken=token(loc,item,list.length-1); setDirty(true); log("Item added",`${pretty(item.type)} added to ${loc}.`); renderAll();}
  function removeSelected(){const sel=selected(); if(!sel||!state.profile)return; const list=sel.location==="chest"?state.profile.storageChestItems:state.profile.items; const it=list[sel.index]; list.splice(sel.index,1); state.selectedToken=""; setDirty(true); log("Item removed",`${pretty(it.type)} removed from ${sel.location}.`); renderAll();}
  function moveSelected(dst){const sel=selected(); if(!sel||!state.profile)return; const src=sel.location==="chest"?state.profile.storageChestItems:state.profile.items; const out=dst==="chest"?state.profile.storageChestItems:state.profile.items; const [it]=src.splice(sel.index,1); it.inventoryIndex=nextIndex(out); out.push(it); state.selectedToken=token(dst,it,out.length-1); setDirty(true); log("Item moved",`${pretty(it.type)} moved to ${dst}.`); renderAll();}
  function selected(){if(!state.profile||!state.selectedToken)return null; const [loc,id]=state.selectedToken.split(":"); const list=loc==="chest"?state.profile.storageChestItems:state.profile.items; let idx=list.findIndex(i=>Number(i.inventoryIndex)===Number(id)); if(idx<0&&Number.isFinite(Number(id))) idx=Math.floor(Number(id)); if(idx<0||idx>=list.length)return null; return {location:loc,index:idx,item:list[idx]};}
  function findSlot(slot){return state.profile?.items.find(i=>i.equipmentSlot===slot)||null;}
  function nextIndex(list){const nums=list.map(i=>Number(i.inventoryIndex)).filter(Number.isFinite); return nums.length?Math.max(...nums)+1:0;}
  function token(loc,item,fallback){const k=item?.inventoryIndex; return Number.isFinite(Number(k))?`${loc}:${Math.floor(Number(k))}`:`${loc}:${fallback}`;}

  function match(item,filter){if(filter==="All")return true; if(filter==="Enchanted")return itemPoints(item)>0; return classify(item)===filter;}
  function classify(item){const type=item?.type||""; if(item?.equipmentSlot){const slot=SLOTS.find(s=>s[0]===item.equipmentSlot); if(slot){remember(type,slot[2]); return slot[2];}} if(state.categories[type]) return state.categories[type]; const c=infer(type); remember(type,c); return c;}
  function infer(type){const t=String(type||"").toLowerCase(); if(!t)return"MeleeWeapons"; if(/(armor|robe|mail|vest|strappings|plate|cloak|raiment|battle|ghost|tunic|coat)/.test(t))return"Armor"; if(/(bow|crossbow|quiver|shot|harpoon|arrow)/.test(t))return"RangedWeapons"; if(/(item|potion|totem|artifact|satchel|seed|gong|beacon|feather|mushroom|soul|medallion|amulet|fireworks|harvester|book|tome|bomb)/.test(t))return"Artifacts"; return"MeleeWeapons";}
  function remember(type,cat){if(!type)return; state.categories[type]=cat; if(!state.catalog.items[cat]) state.catalog.items[cat]=new Set(); state.catalog.items[cat].add(type); state.catalog.items.All.add(type);}

  function editStat(e,sec){if(!(e.target instanceof HTMLInputElement)||!state.profile)return; const key=e.target.dataset.key;if(!key)return; const v=Number(e.target.value); if(!Number.isFinite(v))return; state.profile[sec][key]=Math.max(0,Math.floor(v)); setDirty(true);}

  function openModal(title,options,onSelect){modal.open=true;modal.options=options||[];modal.onSelect=onSelect;modal.search="";dom.modalTitle.textContent=title;dom.modalSearchInput.value="";dom.modalCustomInput.value="";dom.modalBackdrop.classList.add("open");dom.modalBackdrop.setAttribute("aria-hidden","false");renderModal();dom.modalSearchInput.focus();}
  function closeModal(){modal.open=false;modal.options=[];modal.onSelect=null;modal.search="";dom.modalBackdrop.classList.remove("open");dom.modalBackdrop.setAttribute("aria-hidden","true");}
  function renderModal(){const s=modal.search.trim().toLowerCase(); const rows=modal.options.filter(o=>!s||o.id.toLowerCase().includes(s)||String(o.title||"").toLowerCase().includes(s)||String(o.subtitle||"").toLowerCase().includes(s)); dom.modalCount.textContent=`${rows.length} options`; dom.modalList.innerHTML=rows.length?rows.map(o=>`<button class="modal-item" data-id="${escA(o.id)}"><strong>${esc(o.title||o.id)}</strong><span class="id">${esc(o.id)}</span><span class="small-note">${esc(o.subtitle||"")}</span></button>`).join(""):'<div class="small-note">No matching results.</div>';}
  function itemOptions(filter){const set=new Set(state.catalog.items[filter]||[]); for(const v of state.catalog.items.All||[]) set.add(v); return [...set].sort((a,b)=>a.localeCompare(b)).map(id=>({id,title:pretty(id),subtitle:classify({type:id})}));}
  function enchOptions(){return [...state.catalog.ench].sort((a,b)=>a.localeCompare(b)).map(id=>({id,title:prettyEnch(id),subtitle:POWERFUL.has(id)?"Powerful":"Common"}));}
  function armorOptions(){return [...state.catalog.armor].sort((a,b)=>a.localeCompare(b)).map(id=>({id,title:pretty(id),subtitle:"Armor property"}));}

  function setDirty(v){state.dirty=!!v; renderStatus(); saveDraft();}
  function saveDraft(){if(!state.profile)return; try{localStorage.setItem(DRAFT_KEY,JSON.stringify({sourceName:state.sourceName,sourceMode:state.sourceMode,savedAt:new Date().toISOString(),profile:state.profile}));}catch{}}
  function loadDraft(){const raw=localStorage.getItem(DRAFT_KEY); if(!raw){log("Draft","No saved draft found."); return;} safe(()=>{const d=JSON.parse(raw); if(!d?.profile) throw new Error("Draft payload missing profile"); state.profile=d.profile; normalizeProfile(state.profile); state.original=clone(state.profile); state.sourceName=d.sourceName||"draft.dat"; state.sourceMode=d.sourceMode||"json"; state.decodeStatus="Loaded from local draft"; state.sourceBytes=null; state.sourceMime="application/json"; state.backupDownloaded=false; state.riskyTouched=false; state.riskyUnlocked=false; rebuildCatalog(); setDirty(true); log("Draft loaded","Restored local browser draft."); renderAll();});}

  function toggleRiskyMode(){
    if(!state.profile) return;
    if(state.riskyUnlocked){
      state.riskyUnlocked=false;
      log("Risky IDs","Internal ID fields were locked.");
      renderItemEditor();
      renderAll();
      return;
    }
    const ok = window.confirm("Risky ID editing can corrupt saves. Back up first. Enable anyway?");
    if(!ok) return;
    state.riskyUnlocked=true;
    log("Risky IDs","Internal ID fields are now editable.");
    renderItemEditor();
    renderAll();
  }

  function markRiskyTouched(reason){
    state.riskyTouched=true;
    if(reason) log("Risky ID edit",reason);
    renderAll();
  }

  function downloadBackup(){
    if(!state.sourceBytes || !state.sourceName) return;
    const ext = state.sourceMode==="dat"?".dat":".json";
    const base = state.sourceName.replace(/\.[^.]+$/,"");
    download(`${base}_backup_original${ext}`, new Blob([state.sourceBytes], {type: state.sourceMime || "application/octet-stream"}));
    state.backupDownloaded=true;
    log("Backup","Downloaded original source backup.");
    renderAll();
  }

  function exportSave(fmt){if(!state.profile)return; const p=clone(state.profile); normalizeProfile(p); p.totalGearPower=charPowerFor(p); const base=(state.sourceName||"character").replace(/\.[^.]+$/,""); if(fmt==="json"){download(`${base}_edited.json`,new Blob([serialize(p)],{type:"application/json"})); log("Exported","Downloaded edited .json file."); return;} if(fmt==="dat"){download(`${base}_edited.dat`,new Blob([encryptDat(p)],{type:"application/octet-stream"})); log("Exported","Downloaded edited encrypted .dat file.");}}
  function download(name,blob){const u=URL.createObjectURL(blob),a=document.createElement("a"); a.href=u;a.download=name;a.click(); URL.revokeObjectURL(u);}

  function currency(type){return state.profile?.currency.find(c=>c.type===type)||null;}
  function currencyCount(type){const c=currency(type); return c?Number(c.count||0):0;}
  function setCurrency(type,v){if(!state.profile)return; const n=Math.max(0,Math.floor(Number(v)||0)); const c=currency(type); if(c)c.count=n; else state.profile.currency.unshift({type,count:n});}

  function level(){return state.profile?levelForXp(Number(state.profile.xp||0)):0;}
  function levelForXp(xp){return Math.floor((1/30)*(Math.sqrt(3*xp+100)+20));}
  function xpForLevel(lv){const n=Math.max(1,Math.floor(Number(lv)||1)); return 100*(n-1)*(3*n-1);}
  function itemLevel(powerVal){const p=Number(powerVal||0); return p<=0?0:Math.floor((Math.max(1,p)-1+0.00001)*10)+1;}
  function power(levelVal){const lv=Math.max(0,Math.floor(Number(levelVal)||0)); return lv<=0?0:((Math.max(1,lv)-1)/10)+1+0.00001;}
  function charPower(){return state.profile?charPowerFor(state.profile):0;}
  function charPowerFor(p){const get=s=>p.items.find(i=>i.equipmentSlot===s); const m=Number(get("MeleeGear")?.power||0),a=Number(get("ArmorGear")?.power||0),r=Number(get("RangedGear")?.power||0),s1=Number(get("HotbarSlot1")?.power||0),s2=Number(get("HotbarSlot2")?.power||0),s3=Number(get("HotbarSlot3")?.power||0); return itemLevel((m+a+r)/4 + (s1+s2+s3)/12);}
  function enchCost(e,g){const lv=clamp(Math.floor(Number(e?.level||0)),0,3); const base=POWERFUL.has(e?.id)?(lv===0?0:(lv*(lv+3))/2):(lv===0?0:(lv*(lv+1))/2); return g?base+lv:base;}
  function itemPoints(item){let t=0; for(const e of item?.enchantments||[]) t+=enchCost(e,!!item.netheriteEnchant); return t;}
  function remainPoints(){if(!state.profile)return 0; let used=1; for(const i of [...state.profile.items,...state.profile.storageChestItems]) used+=itemPoints(i); return level()-used;}
  function portalUnlocked(){if(!state.profile?.strongholdProgress)return true; const e=Object.entries(state.profile.strongholdProgress).filter(([k])=>k.endsWith("Unlocked")); return !e.length||e.every(([,v])=>!!v);}

  function serialize(v){return JSON.stringify(v,null,2);}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function pretty(v){return String(v||"Unknown").replace(/_/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/\s+/g," ").trim();}
  function prettyEnch(v){if(!v||v==="Unset")return"Unset"; return `${pretty(v)}${POWERFUL.has(v)?" (Powerful)":""}`;}
  function labelOf(id){return FILTERS.find(f=>f[0]===id)?.[1]||id;}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
  function escA(v){return esc(v).replaceAll("`","&#96;");}
  function log(t,d=""){state.logs.unshift({t,d:d||""}); state.logs=state.logs.slice(0,MAX_LOG); renderLog();}
  function needCrypto(){if(typeof CryptoJS==="undefined") throw new Error("CryptoJS failed to load. Reload and try again.");}
  function toWord(u8){const w=[]; for(let i=0;i<u8.length;i+=1) w[i>>>2]|=u8[i]<<(24-(i%4)*8); return CryptoJS.lib.WordArray.create(w,u8.length);}
  function fromWord(wa){const w=wa.words,s=wa.sigBytes,u=new Uint8Array(s); for(let i=0;i<s;i+=1) u[i]=(w[i>>>2]>>>(24-(i%4)*8))&0xff; return u;}
})();
