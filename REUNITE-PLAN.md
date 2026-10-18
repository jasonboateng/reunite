# REUNITE — Product, Architecture, and Design Plan

## 1. Product Overview

### Product Name
REUNITE

### Tagline
REPORT. FIND. REUNITE.

### Positioning
Ghana's Citizen-Powered Missing Persons Reporting Platform.

### Core Purpose
Reunite helps families report missing persons, allows citizens to discover public cases and submit sightings, and provides moderators and administrators with professional tools to verify, manage, monitor, and protect the integrity of the platform.

### Product Scope
Reunite is a public-safety and case-management platform focused on missing-person reporting, community alerting, and moderated verification workflows.

### Product Boundaries
This is not:
- a generic SaaS product
- a CRM
- a banking dashboard
- a social network
- an AI dashboard
- a generic admin template
- a marketing site with a dashboard attached

The product must feel like a serious digital public service.

---

## 2. Primary Product Responsibility

Before building any feature, the team must answer:
1. Who is the user?
2. What is their role?
3. What is their goal?
4. What is their current context?
5. What information do they need?
6. What action do they need to take?
7. What happens after that action?
8. What permissions apply?
9. What data is involved?
10. What must be audited?
11. What must remain private?

Every screen must have a clear purpose.
Every interaction must have a reason.
Every piece of data displayed must have a source.
Every action must respect role permissions.

---

## 3. Navigation and Page Design Rule

The application must not be built as one large page or a single mega dashboard.

Rule:
- One major navigation item = one dedicated page
- Overview = summary
- Detail page = one entity
- Form page = one task
- Workspace = one operational context

This keeps the product structured around action, role, and purpose rather than mixing unrelated flows into one overloaded interface.

---

## 4. Product Architecture

### Frontend
- Next.js
- TypeScript

### Backend
- Node.js
- TypeScript
- REST API

### Database
- MongoDB

### Push Notifications
- Firebase Cloud Messaging only
- Not used as the primary source of truth

### Storage
- S3-compatible object storage

### Maps
- MapLibre
- OpenStreetMap-compatible data

### Server
- Linux VPS
- Nginx
- HTTPS

### Source Control
- GitHub

### Monitoring
- Sentry
- Application logs
- Infrastructure monitoring

### System Flow
PUBLIC WEB
  │
FAMILY WEB/PWA
  │
MODERATOR WEB
  │
ADMIN WEB
  │
CITIZEN ANDROID
  │
  ▼
REST API
  │
  ▼
BUSINESS LOGIC
  │
  ├── MongoDB
  │
  ├── Object Storage
  │
  ├── FCM
  │
  ├── Maps

---

## 5. User Groups

### 1. Family / Reporter
Needs to:
- submit missing-person reports
- update family information
- track status
- confirm contact details
- upload evidence or media

### 2. Citizen / Witness
Needs to:
- search public cases
- submit sightings
- add location and evidence
- report safe or suspicious observations

### 3. Moderator
Needs to:
- review incoming reports
- assess sightings
- verify identity details
- escalate high-risk cases
- maintain quality and trust

### 4. Administrator
Needs to:
- monitor platform integrity
- review audit logs
- manage users and roles
- assess regional trends
- respond to abuse, fraud, or false reports

### 5. Public Visitor
Needs to:
- understand the service
- browse public case listings
- see trust and safety information

---

## 6. Core Experience Areas

### Public Experience
- citizen-first search page with the REUNITE identity and search by name, case number, or region
- recent public cases shown as person-photo cards
- public case details containing only family-approved information
- geo-tagged sighting submission from each public case
- trust and safety messaging

### Family Experience
- sign-up and login before creating a case
- private family dashboard with case and sighting KPIs
- missing-person case creation and updates
- missing-person image and approved bio data for printable/shareable flyers
- review, approve, or reject submitted sightings
- choose whether each approved sighting is public
- assign an existing moderator or invite a person to moderate a family case
- review private account notifications for new sightings, reviewer decisions, publication, and moderator acceptance

### Moderator Experience
- family-assigned case access
- review queue for assigned cases
- eyewitness evidence review
- moderation actions recorded in a private audit log

### Intake Reviewer Experience
- role-restricted queue for reports without an accepted family moderator assignment
- verify and publish only when the family has explicitly requested publication of selected details
- request family changes or decline a report while keeping it private
- reviewer access is granted or revoked for an existing account by an operator-run API workspace command: `npm --workspace apps/api run reviewer:grant -- person@example.com` / `npm --workspace apps/api run reviewer:revoke -- person@example.com`
- decisions recorded in the moderation action log and audit trail

### Admin Experience
- operational dashboard summary
- moderation actions log
- user management
- audit trail visibility
- platform health and integrity monitoring

---

## 7. Information Architecture

### Public Routes
- /
- /cases
- /cases/[id]
- /about

### Family / Reporter Routes
- /family/dashboard
- /family/cases/new
- /family/cases/[id]
- /family/cases/[id]/sightings
- /family/cases/[id]/public-profile
- /family/cases/[id]/edit
- /family/notifications
- /family/cases/[id]/moderators
- /family/cases/[id]/flyer
- /family/profile

### Moderator Routes
- /moderation
- /moderation/queue
- /moderation/cases/[id]
- /moderation/sightings
- /moderation/audit

### Admin Routes
- /admin
- /admin/users
- /admin/reports
- /admin/monitoring
- /admin/audit

### Authentication Routes
- /auth/login
- /auth/register

### Citizen Case Flow
1. A citizen searches by name, case reference, or region.
2. Search results show only cases the family has chosen to make public.
3. Selecting a case opens the family-approved public profile and case information.
4. A citizen can submit a sighting with observation time, place, and geographic coordinates.
5. A sighting is private and pending until the family reviews it.

### Family Case and Sighting Flow
1. A family member creates an account or signs in.
2. The family creates a missing-person case and provides the person's image and bio details.
3. The family chooses what information is public and can generate a flyer from approved case details.
4. The family explicitly requests publication of selected case details; an assigned moderator verifies and publishes them.
5. Families can update report details; a change withdraws the previous publication request and returns a public case to private review.
6. A family can mark a person found, which closes new sighting submissions and removes the case from public search.
7. Sightings are reviewed in the family dashboard and can be approved or rejected.
8. Approval and public visibility are separate decisions controlled by the family.
9. A family can assign a registered moderator or invite someone to support the case.

---

## 8. Design Plan

### Design Direction
The product should feel:
- serious
- trustworthy
- civic and national-service oriented
- clear and calm under pressure
- accessible and evidence-driven

### Public Home Screen
- minimal header with REUNITE wordmark, Privacy, and Family login
- centered REUNITE wordmark and search field for name or case reference
- clear family-report call to action below the search field
- recent public cases displayed as image-led cards in a four-column desktop grid, responsive at smaller widths
- use Montserrat throughout the web interface

### Visual Language
- strong blue for trust and institutional reliability
- green for verified and safe states
- amber for caution and review
- red for urgent and critical cases
- white and light neutral surfaces to reduce noise

### UX Principles
- prioritize critical information first
- minimize ambiguity
- show clear provenance for data and source
- support urgent decision-making without panic
- reduce visual clutter in high-stakes workflows
- use consistent status patterns and clear labels

### Accessibility Requirements
- readable contrast ratios
- keyboard-friendly navigation
- semantic labels and structural clarity
- visible focus states
- large hit areas for mobile use
- form validation and feedback that works with assistive tech

### Responsive Behavior
- public and family flows optimized for mobile and low-bandwidth usage
- moderator/admin flows optimized for desktop review and multi-step operations
- forms must be straightforward and resilient on mobile devices

---

## 9. Product Principles

1. Every screen must have a purpose.
2. Every interaction must have a reason.
3. Every data point must have a source.
4. Every action must respect role permissions.
5. Sensitive information must remain protected.
6. Public-facing content must never expose private family or case details.
7. A public case timeline is distinct from the internal moderator/admin audit log.
8. A sighting's geo-location is private to the family until they explicitly approve its public visibility.
9. Moderator access is scoped to the case and granted by the family or an authorized admin.
10. Moderate and admin workflows need auditability.
11. Trust and safety must be central to the interface and architecture.

---

## 10. Functional Priorities

### Priority 1: Core public platform
- landing page
- case discovery
- missing person report intake
- case detail view
- sightings submission

### Priority 2: Moderation system
- verification queue
- status changes
- evidence review
- escalation and intervention workflows

### Priority 3: Admin operations
- platform oversight
- user roles
- logs and audit review
- analytics and integrity monitoring

### Priority 4: Integrations
- media uploads
- maps
- notifications
- monitoring and logging

---

## 11. Technical Design Standards

### Frontend Standards
- app-router architecture in Next.js
- TypeScript strict mode
- route-based UI separation
- shared page layouts and design primitives
- no oversized dashboard patterns for unrelated features

### API Standards
- clear REST resource boundaries
- validation on all inputs
- authorization checks by role
- sanitized outputs for public data
- consistent error and audit handling

### Data Standards
- private vs public data segregation
- minimal data exposure in public endpoints
- immutable case history and audit trail entries
- safe handling of location, identity, and media information

### Security Standards
- role-based access control
- secure uploads and signed media access
- input sanitization and validation
- audit logging for key actions
- protected handling of sensitive personal data

---

## 12. Summary

REUNITE should be designed as a trusted civic platform, not a generic SaaS product. Its architecture and UX should reinforce confidence, clarity, safety, and operational accountability.

The implementation should follow a disciplined information-architecture model:
- dedicated routes for each operational context
- strict role separation
- public/private data boundaries
- strong moderation and audit controls
- clear, serious, accessible product design

This ensures the platform remains useful, trustworthy, and resilient under real public-safety conditions.
