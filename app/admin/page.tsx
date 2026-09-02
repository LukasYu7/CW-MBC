'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabase';
import { fromDatabase, toDatabase, type Building, type Category } from '../../lib/buildings';

const emptyBuilding:Partial<Building>={name:'',address:'',owner:'',landArea:0,floorArea:0,approvalDate:'',note:'',category:'corporate',lat:null,lng:null,isPublic:true};
const categoryLabel:Record<Category,string>={personal:'개인 소유',management:'자산운용사',corporate:'기타 법인'};

export default function AdminPage(){
  const [session,setSession]=useState<Session|null>(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [checking,setChecking]=useState(true);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');
  const [buildings,setBuildings]=useState<Building[]>([]);
  const [query,setQuery]=useState('');
  const [editing,setEditing]=useState<Partial<Building>|null>(null);
  const [supabase,setSupabase]=useState<SupabaseClient|null>(null);
  const [clientReady,setClientReady]=useState(false);

  useEffect(()=>{setSupabase(getSupabaseClient());setClientReady(true)},[]);

  const loadBuildings=async()=>{
    if(!supabase)return;
    const {data,error}=await supabase.from('buildings').select('*').order('id');
    if(error){setMessage(`목록을 불러오지 못했습니다: ${error.message}`);return}
    setBuildings((data??[]).map(fromDatabase));
  };

  useEffect(()=>{
    if(!supabase){setChecking(false);return}
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
    return()=>listener.subscription.unsubscribe();
  },[supabase]);

  useEffect(()=>{
    const verify=async()=>{
      if(!supabase||!session){setIsAdmin(false);setChecking(false);return}
      setChecking(true);
      const {data,error}=await supabase.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();
      const allowed=!error&&Boolean(data);
      setIsAdmin(allowed);setChecking(false);
      if(allowed)await loadBuildings();else setMessage('이 계정에는 관리자 권한이 없습니다.');
    };
    verify();
  },[session]);

  const filtered=useMemo(()=>buildings.filter(item=>!query.trim()||`${item.name} ${item.address} ${item.owner}`.toLowerCase().includes(query.toLowerCase())),[buildings,query]);

  const login=async(event:React.FormEvent)=>{event.preventDefault();if(!supabase)return;setMessage('로그인 중…');const {error}=await supabase.auth.signInWithPassword({email,password});setMessage(error?error.message:'')};
  const logout=async()=>{await supabase?.auth.signOut();setBuildings([]);setEditing(null);setMessage('')};
  const save=async(event:React.FormEvent)=>{event.preventDefault();if(!supabase||!editing)return;setMessage('저장 중…');const payload=toDatabase(editing);const result=editing.id?await supabase.from('buildings').update(payload).eq('id',editing.id):await supabase.from('buildings').insert(payload);if(result.error){setMessage(result.error.message);return}setEditing(null);setMessage('저장했습니다.');await loadBuildings()};
  const remove=async(item:Building)=>{if(!supabase||!confirm(`“${item.name}”을 삭제할까요?`))return;const {error}=await supabase.from('buildings').delete().eq('id',item.id);if(error){setMessage(error.message);return}setMessage('삭제했습니다.');await loadBuildings()};
  const importInitial=async()=>{if(!supabase||buildings.length)return;setMessage('초기 데이터를 등록하는 중…');const response=await fetch('../buildings.json');const items=await response.json() as Building[];const {error}=await supabase.from('buildings').insert(items.map(item=>toDatabase({...item,isPublic:true})));if(error){setMessage(error.message);return}setMessage('48개 초기 데이터를 등록했습니다.');await loadBuildings()};

  if(!clientReady)return <main className="admin-setup"><div><p>관리자 화면을 준비하는 중입니다…</p></div></main>;
  if(!supabase)return <main className="admin-setup"><div><span>ADMIN SETUP</span><h1>Supabase 연결이 필요합니다</h1><p><code>public/config.js</code>에 프로젝트 URL과 Publishable Key를 입력하면 관리자 화면이 활성화됩니다.</p><a href="../">지도로 돌아가기</a></div></main>;
  if(checking)return <main className="admin-setup"><div><p>관리자 권한을 확인하는 중입니다…</p></div></main>;
  if(!session)return <main className="admin-login"><form onSubmit={login}><span>OFFICE MAP ADMIN</span><h1>관리자 로그인</h1><label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{message&&<p>{message}</p>}<button type="submit">로그인</button><a href="../">공개 지도로 돌아가기</a></form></main>;
  if(!isAdmin)return <main className="admin-setup"><div><h1>권한이 없습니다</h1><p>{message}</p><button onClick={logout}>로그아웃</button></div></main>;

  return <main className="admin-page">
    <header><div><span>OFFICE MAP</span><h1>자산 목록 관리</h1></div><nav><a href="../" target="_blank">공개 지도 보기</a><button onClick={logout}>로그아웃</button></nav></header>
    <section className="admin-toolbar"><label>⌕<input placeholder="건물명, 주소, 소유주 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><div><span>{filtered.length}개 자산</span><button onClick={()=>setEditing({...emptyBuilding})}>+ 자산 추가</button></div></section>
    {message&&<div className="admin-message">{message}</div>}
    {!buildings.length&&<section className="empty-data"><h2>등록된 자산이 없습니다</h2><p>기존 엑셀에서 변환한 48개 자산을 한 번에 등록할 수 있습니다.</p><button onClick={importInitial}>초기 48개 데이터 등록</button></section>}
    {!!buildings.length&&<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>상태</th><th>건물명</th><th>주소</th><th>소유주</th><th>구분</th><th>수정</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><i className={item.isPublic?'published':'hidden'}/>{item.isPublic?'공개':'비공개'}</td><td><strong>{item.name}</strong></td><td>{item.address}</td><td>{item.owner}</td><td>{categoryLabel[item.category]}</td><td><button onClick={()=>setEditing({...item})}>편집</button><button className="delete" onClick={()=>remove(item)}>삭제</button></td></tr>)}</tbody></table></div>}
    {editing&&<div className="editor-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setEditing(null)}}><form className="editor" onSubmit={save}><header><div><span>{editing.id?'EDIT ASSET':'NEW ASSET'}</span><h2>{editing.id?'자산 정보 수정':'자산 추가'}</h2></div><button type="button" onClick={()=>setEditing(null)}>×</button></header><div className="editor-grid">
      <label className="wide">건물명<input value={editing.name??''} onChange={e=>setEditing({...editing,name:e.target.value})} required/></label>
      <label className="wide">주소<input value={editing.address??''} onChange={e=>setEditing({...editing,address:e.target.value})} required/></label>
      <label>소유주<input value={editing.owner??''} onChange={e=>setEditing({...editing,owner:e.target.value})} required/></label>
      <label>구분<select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value as Category})}><option value="personal">개인 소유</option><option value="management">자산운용사</option><option value="corporate">기타 법인</option></select></label>
      <label>대지면적(평)<input type="number" step="0.01" value={editing.landArea??0} onChange={e=>setEditing({...editing,landArea:Number(e.target.value)})}/></label>
      <label>연면적(평)<input type="number" step="0.01" value={editing.floorArea??0} onChange={e=>setEditing({...editing,floorArea:Number(e.target.value)})}/></label>
      <label>사용승인일<input type="date" value={editing.approvalDate??''} onChange={e=>setEditing({...editing,approvalDate:e.target.value})}/></label>
      <label className="check"><input type="checkbox" checked={editing.isPublic??true} onChange={e=>setEditing({...editing,isPublic:e.target.checked})}/>공개 지도에 표시</label>
      <label>위도<input type="number" step="any" value={editing.lat??''} onChange={e=>setEditing({...editing,lat:e.target.value?Number(e.target.value):null})}/></label>
      <label>경도<input type="number" step="any" value={editing.lng??''} onChange={e=>setEditing({...editing,lng:e.target.value?Number(e.target.value):null})}/></label>
      <label className="wide">비고<textarea rows={5} value={editing.note??''} onChange={e=>setEditing({...editing,note:e.target.value})}/></label>
    </div><footer><button type="button" onClick={()=>setEditing(null)}>취소</button><button type="submit">저장</button></footer></form></div>}
  </main>;
}
