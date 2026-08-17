const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = "007890";
const DATA = path.join(__dirname, "data.json");

app.use(express.json({limit:"15mb"}));
app.use(express.urlencoded({extended:true, limit:"15mb"}));
app.use(express.static(path.join(__dirname,"public")));

let db = { ads: [], chats: [], messages: [], reports: [], next:{ad:1,chat:1,message:1,report:1} };
try { if (fs.existsSync(DATA)) db=JSON.parse(fs.readFileSync(DATA,"utf8")); } catch(e) {}
function save(){ fs.writeFileSync(DATA, JSON.stringify(db,null,2)); }
function admin(req,res,next){ if(req.headers["x-admin-code"]!==ADMIN_CODE) return res.status(401).json({error:"Code admin incorrect"}); next(); }
function id(x){return Number(x)}

app.get("/api/ads",(req,res)=>res.json(db.ads.filter(a=>!a.deleted).sort((a,b)=>b.id-a.id)));

app.post("/api/ads",(req,res)=>{
  const {ownerName,name,description,wanted,photoData}=req.body;
  if(!ownerName||!name||!description||!wanted) return res.status(400).json({error:"Remplis tous les champs"});
  const ad={id:db.next.ad++,ownerName:String(ownerName),name:String(name),description:String(description),wanted:String(wanted),photoData:photoData||null,certified:false,deleted:false,createdAt:new Date().toISOString()};
  db.ads.push(ad); save(); res.json(ad);
});

app.post("/api/chats",(req,res)=>{
  const ad=db.ads.find(a=>a.id===id(req.body.adId)&&!a.deleted);
  const player=String(req.body.playerName||"").trim();
  if(!ad||!player) return res.status(400).json({error:"Annonce ou pseudo introuvable"});
  let chat=db.chats.find(c=>c.adId===ad.id&&c.buyerName===player&&c.status==="open");
  if(!chat){chat={id:db.next.chat++,adId:ad.id,buyerName:player,sellerName:ad.ownerName,status:"open",rating:null,ratingComment:"",createdAt:new Date().toISOString()};db.chats.push(chat);save();}
  res.json(chat);
});

app.get("/api/chats",(req,res)=>{
  const p=String(req.query.player||"").trim();
  res.json(db.chats.filter(c=>c.buyerName===p||c.sellerName===p).sort((a,b)=>b.id-a.id).map(c=>({...c,adName:(db.ads.find(a=>a.id===c.adId)||{}).name||"Annonce supprimée"})));
});

app.get("/api/chats/:chatId",(req,res)=>{
  const c=db.chats.find(x=>x.id===id(req.params.chatId));
  if(!c) return res.status(404).json({error:"Chat introuvable"});
  res.json({chat:c,messages:db.messages.filter(m=>m.chatId===c.id)});
});

app.post("/api/chats/:chatId/messages",(req,res)=>{
  const c=db.chats.find(x=>x.id===id(req.params.chatId));
  const sender=String(req.body.senderName||"").trim(), text=String(req.body.text||"").trim();
  if(!c||c.status!=="open") return res.status(400).json({error:"Ce chat est clôturé"});
  if(!sender||!text) return res.status(400).json({error:"Message vide"});
  const m={id:db.next.message++,chatId:c.id,senderName:sender,text,createdAt:new Date().toISOString()};
  db.messages.push(m);save();res.json(m);
});

app.post("/api/chats/:chatId/close",(req,res)=>{
  const c=db.chats.find(x=>x.id===id(req.params.chatId));
  if(!c)return res.status(404).json({error:"Chat introuvable"});
  c.status="closed";c.closedAt=new Date().toISOString();save();res.json(c);
});

app.post("/api/chats/:chatId/rate",(req,res)=>{
  const c=db.chats.find(x=>x.id===id(req.params.chatId)), n=Number(req.body.rating);
  if(!c||c.status!=="closed"||!Number.isInteger(n)||n<1||n>5||c.rating) return res.status(400).json({error:"Impossible de noter ce chat"});
  c.rating=n;c.ratingComment=String(req.body.comment||"");save();res.json(c);
});

app.post("/api/reports",(req,res)=>{
  const reason=String(req.body.reason||"").trim();
  if(!reason)return res.status(400).json({error:"Écris une raison"});
  const r={id:db.next.report++,adId:req.body.adId? id(req.body.adId):null,chatId:req.body.chatId?id(req.body.chatId):null,reporterName:String(req.body.reporterName||"Joueur"),reason,createdAt:new Date().toISOString()};
  db.reports.push(r);save();res.json(r);
});

app.get("/api/admin/summary",admin,(req,res)=>res.json({ads:db.ads.filter(a=>!a.deleted).length,chats:db.chats.length,messages:db.messages.length,reports:db.reports.length}));
app.get("/api/admin/ads",admin,(req,res)=>res.json(db.ads));
app.get("/api/admin/reports",admin,(req,res)=>res.json(db.reports));
app.post("/api/admin/ads/:id/certify",admin,(req,res)=>{const a=db.ads.find(x=>x.id===id(req.params.id));if(!a)return res.status(404).json({error:"Annonce introuvable"});a.certified=true;save();res.json(a)});
app.delete("/api/admin/ads/:id",admin,(req,res)=>{const a=db.ads.find(x=>x.id===id(req.params.id));if(!a)return res.status(404).json({error:"Annonce introuvable"});a.deleted=true;save();res.json({ok:true})});
app.delete("/api/admin/reports/:id",admin,(req,res)=>{db.reports=db.reports.filter(x=>x.id!==id(req.params.id));save();res.json({ok:true})});

app.listen(PORT,()=>console.log("Brainrot Trade démarré sur le port "+PORT));
