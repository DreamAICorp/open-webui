"""Hermes agents are resources distinct from the LLM model catalog."""
import os,re,json,secrets
from datetime import timedelta
from fastapi import Request
from open_webui.models.users import Users
from open_webui.utils.auth import create_token
from typing import Literal
import httpx
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from open_webui.utils.auth import get_verified_user

router=APIRouter()
# Canonical company agent catalog is owned by the external cockpit.
from pathlib import Path
_catalog=json.loads(Path(os.environ['HERMES_ROSTER_FILE']).read_text())
GROUPS={a['id']:a['group'] for a in _catalog}
ROSTER={a['id']:(a['name'],a['role']) for a in _catalog}

def credentials():
 values=os.getenv('HERMES_PROFILE_KEYS','').split(';')
 if len(values)!=len(ROSTER) or not all(values):raise HTTPException(503,'La connexion au runtime Hermès est indisponible.')
 return dict(zip(ROSTER,values,strict=True))

def base(agent):return os.getenv('HERMES_UI_BASE_URL','http://hermes-sandbox-hermes-1:8642').rstrip('/')+'/p/'+agent

@router.get('/agents')
async def agents(user=Depends(get_verified_user)):
 credentials()
 return {'agents':[{'id':id,'name':name,'role':role,'kind':'persistent_profile','group':GROUPS[id]} for id,(name,role) in ROSTER.items()]}

class ChatRequest(BaseModel):
 agent:str
 model:str=Field(min_length=1,max_length=200)
 source:Literal['plan','free']
 chat_id:str=Field(min_length=1,max_length=120)
 messages:list[dict]=Field(min_length=1,max_length=100)

@router.post('/chat')
async def chat(body:ChatRequest,user=Depends(get_verified_user)):
 if body.agent not in ROSTER:raise HTTPException(404,'Agent inconnu.')
 if not re.fullmatch(r'[A-Za-z0-9_.:/-]+',body.model):raise HTTPException(400,'Identifiant LLM invalide.')
 provider='openai-codex' if body.source=='plan' else os.getenv('HERMES_FREE_PROVIDER','')
 if not provider:raise HTTPException(409,'Le fournisseur de LLM gratuits doit être raccordé à Hermès avant utilisation. Aucun modèle payant ne sera utilisé à sa place.')
 messages=[{'role':m['role'],'content':m.get('content','')} for m in body.messages if m.get('role') in ('user','assistant') and isinstance(m.get('content',''),str)]
 if not messages or messages[-1]['role']!='user':raise HTTPException(400,'Un message utilisateur final est nécessaire.')
 data={'model':body.model,'provider':provider,'messages':messages,'stream':False,'metadata':{'user_id':user.id,'chat_id':body.chat_id,'hermes_profile':body.agent}}
 try:
  async with httpx.AsyncClient(timeout=httpx.Timeout(600,connect=10)) as client:
   response=await client.post(base(body.agent)+'/v1/chat/completions',headers={'Authorization':'Bearer '+credentials()[body.agent]},json=data)
 except httpx.HTTPError:raise HTTPException(502,'Le runtime Hermès ne répond pas.')
 if response.status_code>=400:
  raise HTTPException(response.status_code,'Le runtime Hermès a refusé cet appel LLM. Vérifie le fournisseur, le modèle et les limites de concurrence.')
 result=response.json()
 return {'agent':body.agent,'llm':{'model':body.model,'provider':provider,'source':body.source},'response':result}


class EmbedRequest(BaseModel):
 email: str = Field(min_length=3,max_length=320)

@router.post('/embed-session')
async def embed_session(body:EmbedRequest,request:Request):
 expected=os.getenv('HERMES_COCKPIT_CONNECTOR_KEY','')
 supplied=request.headers.get('x-cockpit-connector-key','')
 if not expected or not secrets.compare_digest(expected,supplied):raise HTTPException(401,'Connector authentication required.')
 user=await Users.get_user_by_email(body.email.strip().lower())
 if not user or user.role not in ('admin','user'):raise HTTPException(403,'Account activation required.')
 return {'token':create_token({'id':user.id},expires_delta=timedelta(minutes=15))}
