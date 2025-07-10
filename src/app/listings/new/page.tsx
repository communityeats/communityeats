// src/app/listings/new/page.tsx
"use client";
import { useState } from "react";

export default function NewListing() {
  const [title, setT] = useState("");
  const [desc,  setD] = useState("");

  const save = () => {
    // TODO: integrate Firestore + Storage later
    console.log({ title, desc });
  };

  return (
    <div className="max-w-lg space-y-3">
      <h2 className="text-lg font-medium">Create new listing</h2>
      <input className="input" placeholder="Title" onChange={e => setT(e.target.value)} />
      <textarea className="input" placeholder="Description" onChange={e => setD(e.target.value)} />
      <button className="btn w-full" onClick={save}>Save</button>
    </div>
  );
}