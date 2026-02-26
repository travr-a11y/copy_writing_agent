#!/usr/bin/env python3
"""Comprehensive application test script."""
import sys
import os
import subprocess
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

def test_backend_imports():
    """Test that all backend modules can be imported."""
    print("🔍 Testing backend imports...")
    try:
        # Change to backend directory to load .env
        backend_dir = Path(__file__).parent / "backend"
        os.chdir(backend_dir)
        
        from app.config import get_settings
        from app.database import init_db, get_db
        from app.models import campaign, document, variant, offer, icp
        from app.routers import campaigns, documents, generate, export, offers, icps
        from app.services import drafting, ingestion, research, gap_analysis
        print("✅ All backend imports successful")
        return True
    except Exception as e:
        print(f"❌ Backend import error: {e}")
        return False
    finally:
        # Change back to root
        os.chdir(Path(__file__).parent)

def test_backend_config():
    """Test backend configuration loading."""
    print("\n🔍 Testing backend configuration...")
    try:
        # Change to backend directory to load .env
        backend_dir = Path(__file__).parent / "backend"
        os.chdir(backend_dir)
        
        from app.config import get_settings
        settings = get_settings()
        print(f"✅ Config loaded - Port: {settings.backend_port}, DB: {settings.database_url}")
        print(f"   API Key set: {bool(settings.anthropic_api_key)}")
        return True
    except Exception as e:
        print(f"❌ Config error: {e}")
        return False
    finally:
        # Change back to root
        os.chdir(Path(__file__).parent)

def test_database():
    """Test database connectivity and schema."""
    print("\n🔍 Testing database...")
    try:
        # Change to backend directory to load .env
        backend_dir = Path(__file__).parent / "backend"
        os.chdir(backend_dir)
        
        from app.database import init_db, get_db
        init_db()
        print("✅ Database initialized")
        
        # Test a simple query
        db = next(get_db())
        from app.models.campaign import Campaign
        count = db.query(Campaign).count()
        print(f"✅ Database query successful - {count} campaigns found")
        db.close()
        return True
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Change back to root
        os.chdir(Path(__file__).parent)

def test_frontend_build():
    """Test frontend TypeScript build."""
    print("\n🔍 Testing frontend build...")
    try:
        frontend_dir = Path(__file__).parent / "frontend"
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=frontend_dir,
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            print("✅ Frontend build successful")
            return True
        else:
            print(f"❌ Frontend build failed:")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Frontend build error: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("🧪 CopyWrite MVP - Application Test Suite")
    print("=" * 60)
    
    results = []
    
    # Backend tests
    results.append(("Backend Imports", test_backend_imports()))
    results.append(("Backend Config", test_backend_config()))
    results.append(("Database", test_database()))
    
    # Frontend tests
    results.append(("Frontend Build", test_frontend_build()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Application is ready.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
