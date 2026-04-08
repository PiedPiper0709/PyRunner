from sqlmodel import SQLModel, create_engine, Session
from pathlib import Path

# Database file location
DB_PATH = Path(__file__).parent.parent / "data" / "pyrunner.db"
DB_PATH.parent.mkdir(exist_ok=True)

# Create engine
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def init_db():
    """Initialize database tables"""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Get database session"""
    with Session(engine) as session:
        yield session
