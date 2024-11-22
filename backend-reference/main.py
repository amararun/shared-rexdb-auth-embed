from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import httpx
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from typing import Optional

# Enhanced logging setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add these constants at the top of the file
NEON_PROJECT_ID = "withered-sun-35286047"
NEON_HOST = "ep-little-fog-a5i5id2i.us-east-2.aws.neon.tech"
NEON_API_KEY = "mddc0nxq1btjyr1ynqb9f698514ocfcx2oxfnrl9z69be4mfnuwq3m0663lrepbe"
NEON_BRANCH_ID = "br-holy-union-a5o72f5s"

class ProjectCreate(BaseModel):
    project: dict

async def create_database_with_retry(client, url: str, headers: dict, payload: dict, max_retries: int = 3) -> Optional[dict]:
    """Attempt to create database with retry logic"""
    for attempt in range(max_retries):
        try:
            logger.debug(f"Database creation attempt {attempt + 1}/{max_retries}")
            response = await client.post(url, headers=headers, json=payload)
            response_data = response.json()
            
            logger.debug(f"Database creation response: {response_data}")
            
            if response.status_code == 423:  # Locked
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2  # Exponential backoff
                    logger.info(f"Project locked, waiting {wait_time} seconds before retry")
                    await asyncio.sleep(wait_time)
                    continue
            
            response.raise_for_status()
            return response_data
            
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt == max_retries - 1:
                raise
    return None

@app.post("/api/create-neon-db")
async def create_neon_db(request: ProjectCreate):
    logger.debug("Received create database request")
    
    try:
        nickname = request.project.get('name')
        if not nickname or not nickname.strip():
            raise HTTPException(status_code=422, detail="Database nickname cannot be empty")
            
        safe_nickname = "".join(
            c.lower() for c in nickname 
            if c.isalnum() or c in '-_'
        )
        
        owner_name = f"user_{safe_nickname}"
        
        headers = {
            "Authorization": f"Bearer {NEON_API_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            # Create role
            create_role_url = f"https://console.neon.tech/api/v2/projects/{NEON_PROJECT_ID}/branches/{NEON_BRANCH_ID}/roles"
            create_role_payload = {
                "role": {
                    "name": owner_name
                }
            }
            
            logger.debug(f"Creating role: {owner_name}")
            role_response = await client.post(create_role_url, headers=headers, json=create_role_payload)
            logger.debug(f"Role creation response: {role_response.text}")
            
            if role_response.status_code >= 400:
                logger.error(f"Role creation failed: {role_response.status_code} - {role_response.text}")
                raise HTTPException(
                    status_code=role_response.status_code,
                    detail=f"Role creation failed: {role_response.text}"
                )
            
            # Create database with retry
            create_db_url = f"https://console.neon.tech/api/v2/projects/{NEON_PROJECT_ID}/branches/{NEON_BRANCH_ID}/databases"
            create_db_payload = {
                "database": {
                    "name": safe_nickname,
                    "owner_name": owner_name
                }
            }
            
            logger.debug("Attempting database creation")
            db_response = await create_database_with_retry(
                client, 
                create_db_url, 
                headers, 
                create_db_payload
            )
            
            if not db_response:
                raise HTTPException(status_code=500, detail="Failed to create database after retries")
            
            # Get password
            logger.debug(f"Retrieving password for role: {owner_name}")
            password_url = f"https://console.neon.tech/api/v2/projects/{NEON_PROJECT_ID}/branches/{NEON_BRANCH_ID}/roles/{owner_name}/reveal_password"
            
            password_response = await client.get(password_url, headers=headers)
            logger.debug(f"Password retrieval response status: {password_response.status_code}")
            
            if password_response.status_code >= 400:
                logger.error(f"Password retrieval failed: {password_response.status_code} - {password_response.text}")
                raise HTTPException(
                    status_code=password_response.status_code,
                    detail=f"Failed to retrieve password: {password_response.text}"
                )
            
            password_data = password_response.json()
            password = password_data.get("password")
            
            if not password:
                logger.error("No password in response")
                raise HTTPException(status_code=500, detail="Password not found in response")
            
            response_data = {
                "hostname": NEON_HOST,
                "database_name": safe_nickname,
                "database_owner": owner_name,
                "database_owner_password": password,
                "port": 5432,
                "database_type": "postgresql",
                "database_nickname": nickname
            }
            
            logger.debug("Successfully created database and retrieved credentials")
            return response_data
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-neon-db/{project_id}")
async def delete_neon_db(project_id: str):
    neon_api_key = "mddc0nxq1btjyr1ynqb9f698514ocfcx2oxfnrl9z69be4mfnuwq3m0663lrepbe"
    
    print(f"Deleting project: {project_id}")
    
    async with httpx.AsyncClient() as client:
        try:
            headers = {
                "Authorization": f"Bearer {neon_api_key}",
                "Accept": "application/json"
            }
            
            response = await client.delete(
                f"https://console.neon.tech/api/v2/projects/{project_id}",
                headers=headers
            )
            
            if response.status_code >= 400:
                error_detail = f"Neon API error: Status {response.status_code}, Body: {response.text}"
                print(f"Error occurred: {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_detail
                )
            
            return {"message": "Project deleted successfully"}
            
        except httpx.HTTPError as e:
            error_msg = f"HTTP error occurred: {str(e)}"
            print(error_msg)
            raise HTTPException(status_code=500, detail=error_msg) 

@app.get("/api/test")
async def test():
    return {"status": "ok"}