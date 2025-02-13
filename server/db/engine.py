from sqlalchemy import create_engine
import os
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

engine = create_engine(
    f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}", 
    echo=True
)

