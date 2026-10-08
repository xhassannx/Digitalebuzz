# WhatsApp API SaaS Platform

## Overview
A professional multi-tenant WhatsApp SaaS platform enabling users to connect WhatsApp devices via QR code, send messages through comprehensive APIs with API key authentication, and manage conversations through a live chat interface. The platform aims to provide a scalable and robust solution for businesses to integrate WhatsApp messaging into their workflows.

## User Preferences
- Clean, modern WhatsApp-inspired design
- Real-time capabilities are essential
- Professional SaaS presentation
- Multi-tenant architecture for scalability
- Focus on ease of use and clarity

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, and Tailwind CSS, utilizing Shadcn UI components for a professional and modern aesthetic inspired by WhatsApp's design. It features a responsive, mobile-first layout with a fixed sidebar for navigation and a three-column chat layout. Typography uses Inter font for readability, with a consistent spacing scale.

### Technical Implementations
The platform uses a monorepo structure with a React/TypeScript frontend and a Node.js/Express backend. Real-time communication is handled via WebSockets.  

**WhatsApp Integration Modes:**
- **Unofficial Mode**: Uses whatsapp-web.js for QR-based authentication (requires Chromium)
- **Official Mode**: WhatsApp Business Cloud API integration with credentials-based authentication
- **Mock Mode**: Simulated WhatsApp client for testing in constrained environments
- Dynamic routing system automatically selects the correct client based on session connectionType

### Feature Specifications
- **Core MVP**: Database persistence with PostgreSQL/Drizzle ORM, mock WhatsApp integration (QR code generation, message sending/receiving), and a live chat interface.
- **Multi-Tenant Architecture**: User authentication via password-based system, API key management for programmatic access, and strict data isolation per tenant.
- **Webhooks**: Secure webhook system with HMAC-SHA256 signing, exponential retry logic, and a UI for management. Supports events like `session.connected`, `message.received`, etc.
- **Advanced Messaging**: Support for sending location and contact messages, and group messaging.
- **Rate Limiting**: A sliding window algorithm (100 requests per minute per user) applied to all API endpoints, with `Retry-After` and `X-RateLimit-*` headers.
- **Subscription & Billing**: Comprehensive billing dashboard showing current plan, usage stats, payment history. Usage limits middleware enforces message/session/webhook limits per plan. Dual payment gateway support (Razorpay for INR, Stripe for global). Four tiered plans (Free, Starter, Pro, Enterprise) with monthly/quarterly/yearly billing cycles. Automatic subscription management with webhooks.
- **Dual-Mode WhatsApp Support**: Sessions support both 'unofficial' (QR code) and 'official' (Business API) connection types. All messaging endpoints dynamically route to the correct WhatsApp client based on session type. Business API client supports text, media, location, and contact messages with webhook-based message delivery.

### System Design Choices
The backend is designed with clear separation of concerns, including dedicated modules for routing, storage, authentication, webhooks, and the WhatsApp client. The database schema is relational, ensuring data integrity and tenant isolation. Server-side WebSocket authentication prevents cross-tenant data leakage.

## External Dependencies
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Authentication**: Simple password-based authentication system (Passport.js with bcrypt, PostgreSQL session store)
- **Real-time**: WebSockets (`ws` library)
- **Payment Gateways**: Razorpay (INR payments), Stripe (global payments)
- **WhatsApp Integration**: whatsapp-web.js (unofficial), WhatsApp Business Cloud API v18.0 (official)
- **Frontend Libraries**: React, Wouter, TanStack Query, Tailwind CSS, Shadcn UI
- **Backend Libraries**: Node.js, Express, Passport.js, formdata-node

## Recent Changes (November 2025)
### Phase 5-6: Subscription & Billing System (Completed)
- ✅ Billing dashboard UI with plan comparison, usage tracking, payment history
- ✅ Usage limits middleware enforcing plan-based restrictions
- ✅ Dual payment gateway integration (Razorpay + Stripe)
- ✅ Webhook handlers for payment verification
- ✅ Four subscription tiers with flexible billing cycles
- ✅ Fixed Plan type structure (nested features object)
- ✅ Fixed subscription expiry comparison logic

### Phase 7-9: Dual-Mode WhatsApp Support (Completed)
- ✅ WhatsApp Business API client implementation (Cloud API v18.0)
- ✅ Connection type selection (unofficial/official)
- ✅ Dynamic manager routing via getWhatsAppManager() helper
- ✅ All messaging endpoints support both connection modes
- ✅ Business API credential validation with session rollback on failure
- ✅ Proper error handling for unsupported operations (501 status)
- ✅ Webhook receiver for Business API incoming messages

### Phase 10: Settings & Credential Management (Completed)
- ✅ User settings schema with encrypted credential storage
- ✅ AES-256-GCM encryption for all API credentials (Razorpay, Stripe, WhatsApp Business)
- ✅ Settings API endpoints with authentication and encryption layer
- ✅ Comprehensive Settings UI with tabbed credential management
- ✅ Security warnings and encryption notices for users
- ✅ Form validation with react-hook-form and zod

### Phase 11: Send Message UI Enhancements (Completed)
- ✅ Comprehensive Send Message page with tabbed interface (Text, Media, Location, Contact)
- ✅ Emoji picker with 150+ emojis organized in 6 categories
- ✅ Cursor-aware emoji insertion in message textarea
- ✅ Multiple phone number support (comma or newline separated)
- ✅ Bulk messaging capability with delivery tracking
- ✅ Form validation and success/error notifications

### Phase 12: Advanced Features - Groups, Contacts, Campaigns, Multi-User (Completed)
**Database Schema:**
- ✅ Organizations table for multi-tenant workspace support
- ✅ Organization members with role-based access (owner, admin, member)
- ✅ Enhanced managed contacts with custom fields, tags, and organization scoping
- ✅ Contact tags with color coding
- ✅ Groups table with WhatsApp group ID mapping
- ✅ Group members junction table
- ✅ Campaigns system with scheduling and analytics tracking
- ✅ Campaign recipients with delivery status tracking
- ✅ Message activity log for dashboard analytics

**Implemented Features:**
- ✅ Contacts management UI with CRUD operations, CSV import/export, tagging system with color coding, and filtering by tags
- ✅ Groups management UI for creating/editing groups and managing members
- ✅ Campaigns builder with message template editor, recipient management, and execution tracking
- ✅ Organization/Team management UI with member invitations and role assignment
- ✅ Enhanced Dashboard with real-time analytics widgets (messages, sessions, users, campaigns)
- ✅ Role-based permission middleware (withOrgAdmin, withOrgOwner) enforcing access control on 24+ endpoints
- ✅ Campaign execution engine with personalized message templates, rate limiting, and status tracking
- ✅ Message activity logging integrated with campaign execution for dashboard analytics
- ✅ UI/UX fixes: scroll behavior, user profile dropdown with logout, timezone-safe analytics

**Architecture Highlights:**
- Organization context middleware injects organizationId into all requests
- RBAC enforced: Members (read-only), Admins (create/edit/delete), Owners (full control)
- Campaign executor validates state, sends via correct WhatsApp manager, tracks recipients individually
- Timezone-safe date handling in dashboard analytics using local Date methods
- AES-256-GCM encrypted credential storage for all payment/WhatsApp Business API secrets

### Phase 13: Multi-Session Chat & Bug Fixes (Completed - Nov 7, 2025)
- ✅ Multi-session chat support: Session selector dropdown in Chat page to switch between multiple connected WhatsApp devices
- ✅ Auto-select first connected session on Chat page load
- ✅ Clear selected chat when switching sessions for clean UX
- ✅ Fixed disconnect button: Gracefully handles sessions without active WhatsApp clients (mock or not fully initialized)
- ✅ Session-specific conversations: Each device shows only its own chat history
- ✅ Real-time session switching without page reload
- ✅ Created comprehensive LOCAL_TESTING_GUIDE.md with setup instructions for testing with real WhatsApp devices locally

### Phase 14: Local Password Authentication (Completed - Nov 7, 2025)
**Authentication System:**
- ✅ Database schema updated with passwordHash field (bcrypt-hashed)
- ✅ Passport.js serialization configured for local auth
- ✅ getUserByEmail storage method for local auth lookups

**Backend Implementation:**
- ✅ server/localAuth.ts with signup and login endpoints
- ✅ POST /api/auth/signup: Creates user, organization, and auto-login
- ✅ POST /api/auth/login: Email/password validation with bcrypt
- ✅ Automatic organization creation on signup with user as owner
- ✅ Session management via express-session with PostgreSQL store

**Frontend Implementation:**
- ✅ Signup page (/signup) with form validation (email, password, names, organization)
- ✅ Login page (/login) with email/password form
- ✅ React-hook-form + Zod validation on both pages
- ✅ Navigation between signup/login with proper routing
- ✅ Design guideline compliant (no text-primary violations)
- ✅ Comprehensive data-testid attributes for testing
- ✅ Toast notifications for success/error feedback
- ✅ Auto-redirect to dashboard after successful authentication

### Phase 15: Layout Separation & WhatsApp Manager Enhancements (Completed - Nov 7, 2025)
**Layout Architecture:**
- ✅ Complete separation of public and authenticated layouts in App.tsx
- ✅ Public pages (landing, login, signup) render WITHOUT sidebar and authenticated layout
- ✅ Authenticated pages (dashboard, chat, etc.) render WITH sidebar and full navigation
- ✅ AppContent component properly wraps useAuth() inside QueryClientProvider to prevent hook errors
- ✅ Conditional layout rendering based on authentication status

**WhatsApp Client Enhancements:**
- ✅ Added sendLocationMessage method to WhatsAppClientManager (unofficial mode)
- ✅ Added sendContactMessage method to WhatsAppClientManager (unofficial mode)
- ✅ Added getGroups method to WhatsAppClientManager (unofficial mode)
- ✅ All three WhatsApp managers (unofficial, official, mock) now support complete feature parity

### Phase 16: Authentication Simplification - OIDC Removal (Completed - Nov 7, 2025)
**Changes:**
- ✅ Removed all OIDC/Replit Auth code from server/replitAuth.ts
- ✅ Simplified to single-mode authentication: password-based only for all environments
- ✅ Removed openid-client imports and dependencies from auth system
- ✅ Removed FORCE_LOCAL_AUTH environment variable (no longer needed)
- ✅ Removed conditional OIDC registration logic from server/routes.ts
- ✅ Simplified logout endpoint: now just destroys session and redirects to home
- ✅ Simplified isAuthenticated middleware: removed token expiry checking and refresh logic
- ✅ Updated authentication hint messages to guide users to login page
- ✅ Always registers local auth routes (POST /api/auth/signup, POST /api/auth/login)
- ✅ Updated documentation to reflect single authentication mode

### Known Limitations & Future Enhancements
- Message status storage updates for Business API webhooks (documented in code as TODO)
- Connection testing for API credentials (validation endpoints)
- Advanced conversation analytics and sentiment analysis
- WhatsApp group chat synchronization improvements