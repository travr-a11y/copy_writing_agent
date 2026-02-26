# CopyWrite MVP - Testing & Launch Guide

## ✅ Pre-Launch Checklist

### 1. Environment Setup
- [x] Backend `.env` file exists in `backend/.env` with `ANTHROPIC_API_KEY`
- [x] Python virtual environment created (`backend/venv`)
- [x] Backend dependencies installed (`pip install -r requirements.txt`)
- [x] Frontend dependencies installed (`npm install` in `frontend/`)

### 2. Code Quality Checks
- [x] Frontend TypeScript build passes (`npm run build`)
- [x] No TypeScript errors
- [x] All components export correctly
- [x] API client configured correctly

## 🚀 Launch Methods

### Method 1: Using Launch Script (Recommended)
```bash
./launch.sh
```

This script will:
- Check for dependencies
- Start backend on port 8000
- Start frontend on port 5173
- Show logs and status

### Method 2: Manual Launch

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 🧪 Testing Checklist

### Backend API Tests

1. **Health Check**
   ```bash
   curl http://localhost:8000/api/health
   ```
   Expected: `{"status": "healthy", "version": "1.0.0"}`

2. **List Campaigns**
   ```bash
   curl http://localhost:8000/api/campaigns
   ```
   Expected: Array of campaigns (may be empty)

3. **API Documentation**
   - Visit: http://localhost:8000/docs
   - Should show Swagger UI with all endpoints

### Frontend Tests

1. **Home Page**
   - Visit: http://localhost:5173
   - Should show campaign list page
   - Should have "New Campaign" button

2. **Create Campaign**
   - Click "New Campaign"
   - Fill out the 5-step wizard
   - Verify campaign is created

3. **Campaign Detail**
   - Click on a campaign
   - Verify tabs: Documents, Variants, Settings
   - Check document upload works

4. **Generate Variants**
   - Upload documents
   - Process documents
   - Run ICP + VOC research
   - Generate variants
   - Verify variants appear

### End-to-End User Flow

1. ✅ **Create Campaign**
   - Name: "Test Campaign"
   - Industry: "Logistics"
   - Geography: "Australia"
   - Service Offering: "TMS Software"
   - Offer: "Free trial"

2. ✅ **Upload Documents**
   - Upload a sample document (TXT, DOCX, or MD)
   - Tag the document
   - Process the document

3. ✅ **Run Research**
   - Run ICP research
   - Run VOC research
   - Verify research data appears in Settings

4. ✅ **Generate Variants**
   - Click "Generate Variants"
   - Wait for generation (may take 30-60 seconds)
   - Verify lead + follow-up pairs appear

5. ✅ **Edit & Export**
   - Edit a variant inline
   - Star a variant
   - Export to CSV

## 🔍 Troubleshooting

### Backend Won't Start

**Error: `anthropic_api_key` Field required**
- Check that `backend/.env` exists
- Verify `ANTHROPIC_API_KEY=your_key` is set
- Restart backend server

**Error: Port 8000 already in use**
```bash
lsof -ti:8000 | xargs kill -9
```

**Error: Database errors**
- Check `backend/data/copywrite.db` exists
- Verify write permissions on `backend/data/` directory

### Frontend Won't Start

**Error: Port 5173 already in use**
```bash
lsof -ti:5173 | xargs kill -9
```

**Error: Module not found**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Error: TypeScript errors**
```bash
cd frontend
npm run build
# Fix any errors shown
```

### API Connection Issues

**Frontend can't reach backend**
- Verify backend is running on port 8000
- Check Vite proxy config in `frontend/vite.config.ts`
- Verify CORS settings in `backend/app/main.py`

**CORS errors in browser**
- Check browser console for specific error
- Verify `allow_origins` includes `http://localhost:5173`

## 📊 Expected Performance

- **Backend startup**: < 5 seconds
- **Frontend startup**: < 3 seconds
- **Campaign creation**: < 1 second
- **Document upload**: < 100ms (processing is async)
- **Document processing**: 5-30 seconds (background)
- **ICP research**: 10-30 seconds
- **VOC research**: 10-30 seconds
- **Variant generation (8 variants)**: 3-8 seconds (parallel)

## ✅ Verification Steps

After launching, verify:

1. **Backend Health**
   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Frontend Loads**
   - Open http://localhost:5173
   - Should see campaign list (may be empty)

3. **API Proxy Works**
   - Open browser DevTools → Network tab
   - Navigate to campaign list
   - Verify `/api/campaigns` request succeeds

4. **Database Works**
   - Create a test campaign
   - Verify it appears in list
   - Check `backend/data/copywrite.db` exists

## 🎯 Success Criteria

Application is working correctly if:
- ✅ Both servers start without errors
- ✅ Frontend loads and shows UI
- ✅ Can create a campaign
- ✅ Can upload documents
- ✅ Can process documents
- ✅ Can run research
- ✅ Can generate variants
- ✅ No console errors in browser
- ✅ No errors in server logs

## 📝 Notes

- Backend logs: `tail -f backend.log` (if using launch script)
- Frontend logs: `tail -f frontend.log` (if using launch script)
- Database file: `backend/data/copywrite.db`
- ChromaDB data: `backend/data/chroma/`
- Uploaded files: `backend/data/uploads/`
