"use client";

import { useEffect } from "react";

export default function LocalStatsMigration(){
  useEffect(()=>{
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index); if(!key?.startsWith("tcf-lab:stats:"))continue;
      const marker=`${key}:postgres-imported`; if(localStorage.getItem(marker))continue;
      try{
        const itemStats=JSON.parse(localStorage.getItem(key)??"{}").itemStats??{};
        const collectionId=key.slice("tcf-lab:stats:".length);
        fetch("/api/user/import-local-stats",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({collectionId,itemStats})}).then(response=>{if(response.ok)localStorage.setItem(marker,new Date().toISOString());});
      }catch{/* Corrupt legacy state remains local and is ignored. */}
    }
  },[]);
  return null;
}
