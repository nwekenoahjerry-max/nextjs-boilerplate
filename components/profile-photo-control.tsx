"use client";

import { useEffect, useId, useState } from "react";
import styles from "./profile-photo-control.module.css";

type Props={
  photoUrl?:string|null;
  name:string;
  compact?:boolean;
  onChange?:(photoUrl:string|null)=>void;
};

export default function ProfilePhotoControl({photoUrl,name,compact=false,onChange}:Props){
  const inputId=useId();
  const [currentUrl,setCurrentUrl]=useState<string|null>(photoUrl||null);
  const [refresh,setRefresh]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"CM";

  useEffect(()=>{setCurrentUrl(photoUrl||null);},[photoUrl]);

  const upload=async(file:File)=>{
    setError("");setSuccess("");
    if(file.size<1||file.size>3*1024*1024){
      setError("Choose a JPG, PNG or WebP photo of 3 MB or less.");
      return;
    }
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    setBusy(true);
    try{
      const form=new FormData();form.append("file",file);
      const response=await fetch("/api/profile/photo",{method:"POST",credentials:"same-origin",body:form});
      const data=await response.json() as {error?:string;photoUrl?:string};
      if(!response.ok||!data.photoUrl) throw new Error(data.error||"Your photo could not be saved.");
      const next=data.photoUrl+"?v="+Date.now();
      setCurrentUrl(next);setRefresh(value=>value+1);setSuccess("Your profile photo has been saved.");
      onChange?.(next);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Your profile photo could not be saved. Please try again.");
    }finally{setBusy(false);}
  };

  const remove=async()=>{
    setError("");setSuccess("");setBusy(true);
    try{
      const response=await fetch("/api/profile/photo",{method:"DELETE",credentials:"same-origin",headers:{"Accept":"application/json"}});
      const data=await response.json() as {error?:string;removed?:boolean};
      if(!response.ok||!data.removed) throw new Error(data.error||"Your profile photo could not be removed.");
      setCurrentUrl(null);setSuccess("Your profile photo has been removed.");onChange?.(null);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Your profile photo could not be removed. Please try again.");
    }finally{setBusy(false);}
  };

  return <section className={styles.root+(compact?" "+styles.compact:"")} aria-label="Profile photo">
    <div className={styles.avatar} aria-hidden="true">
      {currentUrl?<img key={refresh+currentUrl} src={currentUrl} alt="" loading="lazy"/>:<span>{initials}</span>}
    </div>
    <div className={styles.content}>
      <strong>{currentUrl?"Your profile photo":"Add a profile photo"}</strong>
      <p>One photo for your ClerkMe profile. Only you and your accepted connections can view it.</p>
      <div className={styles.actions}>
        <label className={styles.upload}>
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={event=>{const file=event.currentTarget.files?.[0];if(file)void upload(file);event.currentTarget.value="";}}/>
          {busy?"Saving…":currentUrl?"Change photo":"Upload photo"}
        </label>
        {currentUrl&&<button type="button" className={styles.remove} onClick={()=>void remove()} disabled={busy}>Remove</button>}
      </div>
      <small className={styles.hint}>JPG, PNG or WebP · 3 MB maximum</small>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {success&&<p className={styles.success} role="status">{success}</p>}
    </div>
  </section>;
}
