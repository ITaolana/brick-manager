# Firebase Firestore Setup

## Set Firestore Rules

1. Go to Firebase Console → **brick-manager-e10f0**
2. Click **Firestore Database** → **Rules**
3. Replace the rules with:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Click **Publish**

## Then Deploy

Push the updated code:
```bash
cd C:\Users\DELL\brick-manager
git add -A
git commit -m "Add Firebase sync for multi-admin"
git push
```

The app will now sync data between both admin phones in real-time!