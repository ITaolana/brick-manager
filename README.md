# BrickManager

A mobile-first admin application for brick manufacturing businesses. Manage workers, customers, deliveries, petty cash, and view sales reports - all offline capable.

## Features

### Worker Management
- Add, edit, and delete workers
- Track daily attendance (Present/Absent)
- Set monthly pay date - attendance auto-resets after pay date
- View worker list with roles

### Customer Management
- Add customers with: name, product type, payment date, amount
- Product types: Bricks, Fine Sand, Rough Sand, Quarry, TLB for Hire
- Optional delivery with address tracking
- One-tap delivery status toggle (Pending → Delivered)
- Search by name, date, or address
- Filter by delivery status

### Financial Tracking
- Record petty cash expenses
- View expense history
- Auto-calculated balance

### Reports (On-Demand)
- Weekly sales summary
- Monthly sales summary
- Weekly & monthly expenses
- Profit/Loss calculation

### Dashboard
- Today's workers present
- Pending deliveries count
- Outstanding payments alert
- Quick action buttons

### Security
- 4-digit PIN lock
- PIN change in settings

### Offline Support
- Full offline functionality via IndexedDB
- Works without internet
- PWA installable on mobile

## Tech Stack

- HTML/CSS/JavaScript (Vanilla)
- IndexedDB (Dexie.js-style custom implementation)
- Service Worker for offline caching
- PWA (Progressive Web App)

## Installation

### GitHub Pages (Recommended)
1. Go to your repo: https://github.com/ITaolana/brick-manager
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: main, Folder: / (root)
5. Save
6. Visit: https://itaolana.github.io/brick-manager/

### Option 2: Local Testing
```bash
cd brick-manager
python -m http.server 8000
# Visit http://localhost:8000
```

### Option 3: Install as PWA
1. Open app in Chrome/Edge mobile
2. Tap "Add to Home Screen"
3. Works offline like a native app

## Usage

1. **First Launch**: Create a 4-digit PIN
2. **Dashboard**: View today's stats and quick actions
3. **Add Workers**: Workers → + Add → Enter name & role
4. **Mark Attendance**: Attendance → Select date → Mark Present/Absent
5. **Add Customers**: Customers → + Add → Fill details
6. **Track Delivery**: For customers with delivery, tap "Deliver" when done
7. **Record Expenses**: Petty Cash → + Add → Enter description & amount
8. **View Reports**: Reports → See sales & expenses summaries

## Data Storage

All data is stored locally in your browser using IndexedDB:
- Workers and attendance records
- Customer orders and delivery status
- Expense records
- App settings (PIN, pay date)

No server required - works completely offline.

## Files

```
brick-manager/
├── index.html      # Main application
├── css/style.css   # Styling
├── js/db.js        # Database layer
├── js/app.js       # Application logic
├── manifest.json   # PWA manifest
├── sw.js           # Service worker
└── README.md       # This file
```

## License

MIT