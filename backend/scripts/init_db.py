#!/usr/bin/env python3
"""
Database Initialization Script
Creates tables and initial data for UE5 AI Studio
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.database import Base, get_db_url
from models.user import User
from models.project import Project
from models.memory import Memory
from models.token import Token
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database():
    """Initialize database with tables and default data"""
    
    try:
        # Get database URL
        db_url = get_db_url()
        logger.info(f"Connecting to database...")
        
        # Create engine
        engine = create_engine(db_url)
        
        # Create all tables
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created successfully")
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Check if admin user exists
            admin_user = db.query(User).filter(User.email == "admin@ue5studio.com").first()
            
            if not admin_user:
                logger.info("Creating default admin user...")
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                
                admin_user = User(
                    email="admin@ue5studio.com",
                    username="admin",
                    hashed_password=pwd_context.hash("admin123"),
                    is_admin=True,
                    is_active=True
                )
                db.add(admin_user)
                db.commit()
                logger.info("✅ Default admin user created")
                logger.info("   Email: admin@ue5studio.com")
                logger.info("   Password: admin123")
                logger.info("   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!")
            else:
                logger.info("Admin user already exists")
            
            # Create default project
            default_project = db.query(Project).filter(Project.name == "Default Project").first()
            if not default_project and admin_user:
                logger.info("Creating default project...")
                default_project = Project(
                    name="Default Project",
                    description="Default project for UE5 AI Studio",
                    owner_id=admin_user.id,
                    settings={}
                )
                db.add(default_project)
                db.commit()
                logger.info("✅ Default project created")
            
            logger.info("\n" + "="*50)
            logger.info("Database initialization complete!")
            logger.info("="*50)
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise


if __name__ == "__main__":
    init_database()
