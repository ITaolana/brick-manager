# BrickManager

A mobile-first admin app for brick businesses. Manage workers, customers, deliveries, and track sales.

## Features

- **Worker Management**: Add workers, track daily attendance
- **Customer Management**: Add customers by product type (Bricks, Sand, Quarry, TLB), track payments & delivery
- **Delivery Tracking**: Mark deliveries as pending/delivered
- **Search & Filter**: Find customers by name, date, or address
- **Petty Cash**: Record and track expenses
- **Reports**: Weekly/monthly sales and expenses summary
- **PIN Security**: 4-digit PIN to protect data
- **Data Export**: Backup data as JSON

## Products Supported

- Bricks
- Fine Sand
- Rough Sand
- Quarry
- TLB for Hire

## Installation

### Quick Start (Recommended)
1. Go to: **https://itaolana.github.io/brick-manager/**
2. Add to home screen (tap menu → Add to Home Screen)

### Local Testing
```bash
# Clone or download files
cd brick-manager
# Open index.html in browser
```

## First Time Setup

1. Open the app
2. **Set PIN**: Enter a 4-digit PIN and press OK
3. Start using the app!

## Usage

- **Dashboard**: View today's stats and quick actions
- **Workers**: Add workers, mark attendance
- **Customers**: Add orders, track deliveries
- **Petty Cash**: Record expenses
- **Reports**: View sales summaries

## Tests

Run tests at: **https://itaolana.github.io/brick-manager/test.html**

## Files

```
brick-manager/
├── index.html      # Main app
├── css/style.css   # Styling
├── js/db.js        # Database
├── js/app.js       # App logic
├── manifest.json   # PWA manifest
└── README.md       # This file
```

## Note

This app stores data locally on your device. Each device has its own data.