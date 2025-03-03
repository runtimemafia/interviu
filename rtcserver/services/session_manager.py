import logging
from typing import Dict, Any, List, Optional
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class SessionManager:
    def __init__(self):
        self.sessions = {}
        # Try to load existing sessions (for server restarts)
        self._load_existing_sessions()
        
    def _load_existing_sessions(self):
        """Load existing session data from disk"""
        try:
            uploads_dir = "uploads"
            if not os.path.exists(uploads_dir):
                return
                
            for session_id in os.listdir(uploads_dir):
                session_file = os.path.join(uploads_dir, session_id, "session_info.json")
                if os.path.exists(session_file):
                    try:
                        with open(session_file, 'r') as f:
                            self.sessions[session_id] = json.load(f)
                            logger.info(f"Loaded existing session: {session_id}")
                    except Exception as e:
                        logger.error(f"Error loading session {session_id}: {e}")
        except Exception as e:
            logger.error(f"Error loading existing sessions: {e}")
        
    def create_session(self, session_id: str, metadata: Dict[str, Any]) -> None:
        """Create a new recording session"""
        self.sessions[session_id] = {
            "id": session_id,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata,
            "chunks": [],
            "completed": False,
            "output_path": None
        }
        
        # Save session info to disk
        session_dir = os.path.join("uploads", session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        with open(os.path.join(session_dir, "session_info.json"), "w") as f:
            json.dump(self.sessions[session_id], f, indent=2)
    
    def session_exists(self, session_id: str) -> bool:
        """Check if a session exists"""
        return session_id in self.sessions
    
    def add_chunk(self, session_id: str, chunk_number: int, chunk_path: str, 
                 timestamp: int, mime_type: Optional[str] = None, is_valid: bool = True) -> None:
        """Add a chunk to a session"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        chunk_info = {
            "number": chunk_number,
            "path": chunk_path,
            "timestamp": timestamp,
            "is_valid": is_valid  # Added validation flag
        }
        
        if mime_type:
            chunk_info["mime_type"] = mime_type
            
        self.sessions[session_id]["chunks"].append(chunk_info)
        
        # Update session info on disk
        session_dir = os.path.join("uploads", session_id)
        with open(os.path.join(session_dir, "session_info.json"), "w") as f:
            json.dump(self.sessions[session_id], f, indent=2)
    
    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get session data"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        return self.sessions[session_id]
    
    def get_chunks_info(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all chunk information"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
            
        return self.sessions[session_id]["chunks"]
    
    def get_ordered_chunks(self, session_id: str) -> List[str]:
        """Get chunk paths ordered by chunk number"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        # Sort chunks by number
        chunks = sorted(self.sessions[session_id]["chunks"], key=lambda x: x["number"])
        return [chunk["path"] for chunk in chunks]
    
    def complete_session(self, session_id: str, output_path: Optional[str] = None) -> None:
        """Mark a session as complete"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        self.sessions[session_id]["completed"] = True
        self.sessions[session_id]["completed_at"] = datetime.now().isoformat()
        
        if output_path:
            self.sessions[session_id]["output_path"] = output_path
        
        # Update session info on disk
        session_dir = os.path.join("uploads", session_id)
        with open(os.path.join(session_dir, "session_info.json"), "w") as f:
            json.dump(self.sessions[session_id], f, indent=2)
        
        logger.info(f"Session {session_id} marked as completed, output_path: {output_path}")
