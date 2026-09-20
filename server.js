import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "CHANGE_ME";
const DB_FILE = path.join(__dirname, "data.json");

app.use(express.json({limit:"20kb"}));
app.use(express.static(path.join(__dirname,"public")));

function readDB(){ if(!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE,"[]"); return JSON.parse(fs.readFileSync(DB_FILE,"utf8")); }
function writeDB(data){ fs.writeFileSync(DB_FILE, JSON.stringify(data,null,2)); }
function makeId(){ return crypto.randomBytes(10).toString("base64url"); }
function clean(v,n){ return String(v ?? "").trim().slice(0,n); }
function requireAdmin(req,res,next){
  const token=req.get("x-admin-token");
  if(!ADMIN_TOKEN || token!==ADMIN_TOKEN) return res.status(401).json({error:"Unauthorized"});
  next();
}

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"Date Time",version:"2.5"}));

app.post("/api/invites",(req,res)=>{
  const data=readDB();
  const invite={
    id:makeId(), name:clean(req.body?.name,80), message:clean(req.body?.message,500),
    status:"sent", createdAt:new Date().toISOString()
  };
  data.push(invite); writeDB(data);
  res.status(201).json({invite,url:`/invite.html?id=${invite.id}`});
});

app.get("/api/invites/:id",(req,res)=>{
  const x=readDB().find(v=>v.id===req.params.id);
  if(!x)return res.status(404).json({error:"Invitation not found"});
  res.json({id:x.id,name:x.name,message:x.message,status:x.status});
});

app.post("/api/invites/:id/response",(req,res)=>{
  const data=readDB(), x=data.find(v=>v.id===req.params.id);
  if(!x)return res.status(404).json({error:"Invitation not found"});
  x.accepted=Boolean(req.body?.accepted);
  x.status=x.accepted?"confirmed":"declined";
  x.dateType=clean(req.body?.dateType,60);
  x.date=clean(req.body?.date,20);
  x.time=clean(req.body?.time,20);
  x.note=clean(req.body?.note,500);
  x.respondedAt=new Date().toISOString();
  writeDB(data);
  res.json({ok:true});
});

app.get("/api/admin/invites",requireAdmin,(_req,res)=>{
  res.json(readDB().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
});

app.listen(PORT,()=>console.log(`Date Time v2.5 on http://localhost:${PORT}`));
