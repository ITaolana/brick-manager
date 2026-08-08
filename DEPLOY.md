# GitHub Pages Deployment Instructions

## Option 1: Using GitHub CLI (if you can install it)

1. Install GitHub CLI from: https://cli.github.com/
2. Run these commands:

```bash
cd C:\Users\DELL\brick-manager
gh auth login
gh repo create brick-manager --public --source=. --push
gh repo edit --enable-pages=true
```

## Option 2: Manual (recommended)

1. Go to https://github.com/ITaolana/brick-manager (create repo first at github.com)
2. Upload all files from `C:\Users\DELL\brick-manager\` folder
3. Go to Settings → Pages
4. Set Source to "Deploy from a branch"
5. Select branch: "main" and folder: "/ (root)"
6. Save

The app will be live at: `https://itaolana.github.io/brick-manager/`

## Testing Locally

To test on your phone:
1. Open terminal in the brick-manager folder
2. Run: `python -m http.server 8000`
3. Find your computer's IP address (run `ipconfig`)
4. On your phone browser, visit: `http://YOUR_IP:8000`

## Files Included
- index.html - Main app
- css/style.css - Styling
- js/db.js - Database (IndexedDB)
- js/app.js - Application logic
- manifest.json - PWA manifest
- sw.js - Service worker for offline