import uuid
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
        
    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=True)
    email = Column(String(200), nullable=True)
    
    access_token = Column(String(500), nullable=True)
    refresh_token = Column(String(500), nullable=True)
    id_token = Column(String(500), nullable=True)
    
    google_id = Column(String(50), nullable=True)
    picture = Column(String(100), nullable=True)