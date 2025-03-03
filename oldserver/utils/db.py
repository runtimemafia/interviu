from sqlalchemy.orm import Session
from db.engine import engine


def new_session():
    return Session(engine)