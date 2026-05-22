# Navron Labs Website

## First admin setup

Admin access is controlled by Firebase Auth plus a Firestore allowlist document at:

```text
admins/{uid}
```

To create the first admin:

1. Create or sign in the user with Firebase Authentication email/password.
2. In Firebase Console, open Authentication > Users and copy that user's `User UID`.
3. In Firestore, create a document in the `admins` collection using that UID as the document ID.

Example document:

```json
{
  "email": "admin@example.com",
  "role": "super-admin",
  "createdAt": "Firebase server timestamp or creation date"
}
```

Do not create admin allowlist documents from the public frontend. Add or remove admins from the Firebase Console, a trusted backend, or an admin script/service account.
