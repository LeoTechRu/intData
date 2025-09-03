const areaMap = new Map();
let areaList = [];

export async function loadAreas(){
  if(areaList.length) return areaList;
  try{
    const r = await fetch('/api/v1/areas', {credentials:'same-origin'});
    areaList = await r.json();
    areaList.forEach(a=>{ areaMap.set(a.id, a.color || '#F1F5F9'); });
  }catch(e){
    areaList = [];
  }
  return areaList;
}

export function getAreaColor(id){
  return areaMap.get(Number(id)) || '#F1F5F9';
}
