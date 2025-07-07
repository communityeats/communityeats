# CommunityEats – Food Sharing Platform (MVP)

A web-based application for connecting food donors with community members in need. Built using **Next.js** and **Firebase**, the platform allows users to list surplus food, claim available items, and coordinate handoffs—all with lightweight authentication and real-time messaging.

## 🌐 Features

- 🔐 **Authentication**: Email/password login via Firebase Auth.
- 📝 **Food Listings**: Users can create, update, and delete food item listings with image attachments.
- 🤝 **Claim System**: Listings can be claimed by other users, updating availability status.
- 💬 **Messaging**: Real-time chat between donor and claimant per listing.
- ⭐ **Feedback**: Post-claim rating and comment system.
- 📱 **Responsive Design**: Mobile-first layout using modern React patterns.
- 🚀 **Hosting**: Deployable to Firebase Hosting or Vercel.

## 🧱 Tech Stack

- **Frontend**: Next.js (React), Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Hosting**: Firebase Hosting (default) or alternative static hosts
- **Dev Tools**: TypeScript, Git, ESLint/Prettier, local mock auth for offline dev

## 📦 Status

This repository is a **development-phase MVP**. Core functionality is scoped across 5 milestones with progressive handoff to the client. Repo will be transferred to client-owned infrastructure on final delivery.

## 📄 License

Private, internal use only until contract completion. Ownership and IP to be transferred upon project delivery.

## Setup for your own firebase

1. Go to firebase console and setup own project.
2. Setup web app on firebase and replace your firebase SDK details with one in src/app/firebase.ts
3. Run `firebase login`
4. Run `firebase init`