'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { fromDatabase, type Building, type Category } from '../lib/buildings';

declare global { interface Window { naver:any; __naverMapReady?:()=>void } }

const categoryMeta:Record<Category,{label:string;color:string}> = {
  personal:{label:'개인',color:'#e35555'}, management:{label:'자산운용사',color:'#3277cf'}, corporate:{label:'기타 법인',color:'#e4aa2b'},
};
const escapeHtml = (value:string) => value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char] || char));
const formatArea = (value:number) => value ? `${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(value)}평` : '확인 필요';

export default function Home() {
  const [buildings,setBuildings] = useState<Building[]>([]);
  const [query,setQuery] = useState('');
  const [enabled,setEnabled] = useState<Record<Category,boolean>>({personal:true,management:true,corporate:true});
  const [selected,setSelected] = useState<Building|null>(null);
  const [status,setStatus] = useState('데이터를 불러오는 중');
  const [missingKey,setMissingKey] = useState(true);
  const [detailPosition,setDetailPosition] = useState<{left:number;top:number;maxHeight:number}|null>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLElement>(null);
  const lastPointer = useRef<{x:number;y:number}|null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Map<number,{point:any;label:any}>>(new Map());

  useEffect(()=>{
    const load=async()=>{
      const supabase=getSupabaseClient();
      if(supabase){
        const {data,error}=await supabase.from('buildings').select('*').eq('is_public',true).order('id');
        if(!error&&data?.length){setBuildings(data.map(fromDatabase));setStatus('지도 연결 준비 중');return}
      }
      try{const response=await fetch('./buildings.json');const data=await response.json() as Building[];setBuildings(data);setStatus(supabase?'초기 데이터 표시 중':'지도 연결 준비 중')}catch{setStatus('데이터를 불러오지 못했습니다')}
    };
    load();
  },[]);

  const filtered = useMemo(()=>buildings.filter(b=>enabled[b.category] && (!query.trim() || `${b.name} ${b.address} ${b.owner}`.toLowerCase().includes(query.trim().toLowerCase()))),[buildings,enabled,query]);
  const counts = useMemo(()=>buildings.reduce((acc,b)=>({...acc,[b.category]:acc[b.category]+1}),{personal:0,management:0,corporate:0}),[buildings]);

  const positionDetailNear=(pointer:{x:number;y:number}|null)=>{
    const area=mapAreaRef.current;
    if(!area||!pointer){setDetailPosition(null);return}
    const width=Math.min(390,area.clientWidth-36),gap=16,margin=18;
    let left=pointer.x+gap;
    if(left+width>area.clientWidth-margin)left=pointer.x-width-gap;
    left=Math.max(margin,Math.min(left,area.clientWidth-width-margin));
    const top=Math.max(margin,Math.min(pointer.y+gap,area.clientHeight-margin-150));
    setDetailPosition({left,top,maxHeight:Math.max(150,area.clientHeight-top-margin)});
  };
  const showBuilding=(building:Building,nearPointer=true)=>{
    setSelected(building);
    positionDetailNear(nearPointer?lastPointer.current:null);
  };

  useEffect(()=>{
    if(!buildings.length || !mapNode.current) return;
    const clientId = window.MBCPLUS_MAP_CONFIG?.naverClientId?.trim();
    setMissingKey(!clientId);
    if(!clientId){ setStatus('네이버 지도 API 키 입력 필요'); return; }
    const init = () => {
      if(mapRef.current || !mapNode.current) return;
      const naver = window.naver;
      const map = new naver.maps.Map(mapNode.current,{center:new naver.maps.LatLng(37.5035,127.041),zoom:14,zoomControl:true,zoomControlOptions:{position:naver.maps.Position.RIGHT_CENTER},mapDataControl:false,scaleControl:false});
      mapRef.current=map; setStatus('주소 좌표 확인 중');
      const cached:Record<string,{lat:number;lng:number}> = JSON.parse(localStorage.getItem('mbcplus-geocode-v1') || '{}');
      Promise.all(buildings.map(building=>new Promise<Building>(resolve=>{
        if(building.lat && building.lng) return resolve(building);
        if(cached[building.address]) return resolve({...building,...cached[building.address]});
        naver.maps.Service.geocode({address:building.address},(code:any,response:any)=>{
          const hit=response?.result?.items?.[0];
          if(code===naver.maps.Service.Status.OK && hit?.point){
            const coords={lat:Number(hit.point.y),lng:Number(hit.point.x)}; cached[building.address]=coords; resolve({...building,...coords});
          } else resolve(building);
        });
      }))).then(located=>{
        localStorage.setItem('mbcplus-geocode-v1',JSON.stringify(cached)); setBuildings(located); setStatus(`${located.filter(b=>b.lat&&b.lng).length}개 자산 표시 중`);
      });
    };
    if(window.naver?.maps?.Service) init(); else { window.__naverMapReady=init; const script=document.createElement('script'); script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder&callback=__naverMapReady`; script.async=true; script.onerror=()=>setStatus('네이버 지도를 연결하지 못했습니다'); document.head.appendChild(script); }
  },[buildings.length]);

  const focusBuilding=(building:Building)=>{
    const markers=markerRefs.current.get(building.id);
    if(markers&&mapRef.current){
      if(focusTimer.current)clearTimeout(focusTimer.current);
      setSelected(null);
      setDetailPosition(null);
      const position=markers.point.getPosition();
      if(typeof mapRef.current.morph==='function')mapRef.current.morph(position,17,{duration:550,easing:'easeOutCubic'});
      else mapRef.current.panTo(position,{duration:550,easing:'easeOutCubic'});
      focusTimer.current=setTimeout(()=>{
        const area=mapAreaRef.current;
        setSelected(building);
        positionDetailNear(area?{x:area.clientWidth/2,y:area.clientHeight/2}:null);
      },620);
      return;
    }
    showBuilding(building,false);
  };

  useEffect(()=>{
    const map=mapRef.current; if(!map || !window.naver) return;
    markerRefs.current.forEach(markers=>{markers.point?.setMap(null);markers.label?.setMap(null)}); markerRefs.current.clear();
    filtered.filter(b=>b.lat&&b.lng).forEach(building=>{
      const meta=categoryMeta[building.category];
      const position=new window.naver.maps.LatLng(building.lat,building.lng);
      const label=new window.naver.maps.Marker({map,position,clickable:false,icon:{content:`<div class="naver-label"><span>${escapeHtml(building.name.replace(/\n/g,' '))}</span></div>`,anchor:new window.naver.maps.Point(-12,18)}});
      const point=new window.naver.maps.Marker({map,position,title:building.name,clickable:true,zIndex:200,icon:{path:window.naver.maps.SymbolPath.CIRCLE,radius:7,fillColor:meta.color,fillOpacity:1,strokeColor:'#ffffff',strokeWeight:3}});
      window.naver.maps.Event.addListener(point,'click',()=>focusBuilding(building)); markerRefs.current.set(building.id,{point,label});
    });
  },[filtered]);
  const toggle=(category:Category)=>setEnabled(v=>({...v,[category]:!v[category]}));

  return <main className="app-shell" onPointerDownCapture={event=>{
    const target=event.target;
    if(selected&&target instanceof Element&&!target.closest('.detail-card')&&!target.closest('.asset-list-scroll>button'))setSelected(null);
  }}>
    <aside className="sidebar">
      <div className="search-wrap">
        <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="건물명 또는 주소 검색"/><button onClick={()=>setQuery('')} aria-label="검색어 지우기">{query?'×':''}</button></label>
      </div>
      <div className="legend">{(['personal','management','corporate'] as Category[]).map(category=><button className={enabled[category]?'':'off'} key={category} onClick={()=>toggle(category)}><i className="dot" style={{background:categoryMeta[category].color,color:categoryMeta[category].color}}/>{categoryMeta[category].label}<b>{counts[category]}</b></button>)}</div>
      <div className="asset-list"><div className="asset-list-head"><span>{query?'검색 결과':'자산 목록'}</span><b>{filtered.length}</b></div><div className="asset-list-scroll">{filtered.map(b=><button className={selected?.id===b.id?'active':''} key={b.id} onClick={()=>focusBuilding(b)} aria-label={`${b.name} 지도에서 보기`}><i style={{background:categoryMeta[b.category].color}}/><span><strong>{b.name}</strong><small>{b.address}</small></span><em>›</em></button>)}{!filtered.length&&<p>일치하는 자산이 없습니다.</p>}</div></div>
      <footer>데이터 기준 2026. 08. 31.</footer>
    </aside>
    <section className="map-area" ref={mapAreaRef} onPointerDownCapture={event=>{const rect=event.currentTarget.getBoundingClientRect();lastPointer.current={x:event.clientX-rect.left,y:event.clientY-rect.top}}} aria-label="오피스 자산 지도">
      <div className="map-fallback"><span>SEOUL</span><i/><b>Gangnam · Seocho</b></div><div id="map" ref={mapNode}/>
      <div className="map-status"><i/>{status}</div>
      {missingKey && buildings.length>0 && <div className="setup-card"><span>MAP SETUP</span><strong>네이버 지도 연결이 필요합니다</strong><p><code>public/config.js</code>에 발급받은 Client ID를 입력하면 48개 주소가 자동으로 지도에 표시됩니다.</p></div>}
      {selected&&<article className="detail-card" style={detailPosition?{left:detailPosition.left,top:detailPosition.top,maxHeight:detailPosition.maxHeight,right:'auto',bottom:'auto'}:undefined}>
        <button className="close" onClick={()=>setSelected(null)} aria-label="상세 닫기">×</button><div className="detail-type"><i style={{background:categoryMeta[selected.category].color}}/>{categoryMeta[selected.category].label}</div><h2>{selected.name}</h2><p className="address">{selected.address}</p>
        <dl><div><dt>소유주</dt><dd>{selected.owner}</dd></div><div><dt>대지면적</dt><dd>{formatArea(selected.landArea)}</dd></div><div><dt>연면적</dt><dd>{formatArea(selected.floorArea)}</dd></div><div><dt>사용승인</dt><dd>{selected.approvalDate}</dd></div></dl>
        {selected.note&&<div className="note"><span>NOTE</span><p>{selected.note}</p></div>}
      </article>}
    </section>
  </main>;
}
