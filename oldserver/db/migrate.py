from engine import engine
from models.user import User

def create_tables():
    # Create all tables based on the models
    try:
        User.metadata.create_all(bind=engine)
        print("Tables created successfully")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    create_tables()