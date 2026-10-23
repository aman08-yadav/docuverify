# DocuVerify

**OCR-based document review and explainable scholarship eligibility platform** built with React + Vite, Express, MongoDB/Mongoose, private GridFS storage, and local Tesseract.js OCR.

> **Important:** DocuVerify is a portfolio/demo project. Scholarship outcomes are preliminary, rules-based assessments—not official government or university decisions. OCR and matching cannot establish that a document is authentic. Use synthetic files during demos and avoid uploading sensitive identity records unless absolutely necessary.

## Features

- Public landing page, student registration/login, persistent HTTP-only JWT cookie sessions, protected React routes, and server-enforced student/admin permissions.
- Student workspace with database-backed document counts, status chart, recent uploads, and assessment history.
- Private PDF, JPEG, and PNG upload to MongoDB GridFS. Uploads are signature-checked, size-limited, account-scoped, and only retrievable through authenticated API routes.
- Real Tesseract.js OCR for images and scanned PDF pages; PDF.js text extraction for text-based PDFs. PDF pages and OCR concurrency are bounded.
- Transparent keyword-based document classification, category-aware field extraction, matched text evidence, engine confidence where available, and explicit confidence-unavailable states rather than invented scores.
- Cross-document name comparison and exact duplicate detection. Potential matches/mismatches are prompts for manual review—not automatic rejection.
- Configurable scholarship rule records, criteria-by-criteria explanations, missing-evidence handling, assessment history, and a print/save-as-PDF report.
- Admin console for users, documents needing review, scholarship rules, and audit events. Admin API routes enforce admin authorization on the server.
- Bounded in-process OCR queue with restart recovery, centralized error responses, request validation, rate limits, security headers, CSRF protection, and an exact-origin CORS allowlist.
- Synthetic OCR image fixtures, unit tests, API-level tests, and a GitHub Actions CI workflow.

## Technology stack

- **Frontend:** React 19, JavaScript/JSX, Vite 8, React Router 7, Axios, Lucide React, Recharts, plain CSS.
- **Backend:** Node.js, Express 5, Mongoose 9, MongoDB Node.js driver, JWT, bcryptjs, Multer 2, Tesseract.js 7, PDF.js, `@napi-rs/canvas`.
- **Testing/tooling:** Node's built-in test runner, Supertest, Vitest, jsdom, ESLint, GitHub Actions.

The application does not use Next.js, Python, a paid OCR API, or an external AI service. Tesseract language data may need to be downloaded/cached the first time OCR runs; that is a free open-source OCR dependency, not a paid service.

## Architecture

```text
Browser (React + Vite)
       │ HTTPS / JSON / authenticated cookies + CSRF token
       ▼
Express REST API ── auth, request validation, rate limits, CORS, CSRF
       │
       ├── Mongoose collections: users, documents, scholarships,
       │   eligibility assessments, audit logs
       │
       ├── GridFS bucket: privateDocuments (original file bytes)
       │
       └── bounded OCR queue
            ├── PDF.js text extraction / scanned-PDF rendering
            ├── Tesseract.js OCR
            ├── rules-based classification and field extraction
            ├── consistency checks
            └── explainable scholarship rules engine
```

## Repository layout

```text
docuverify/
├── client/                 # React/Vite user interface
│   ├── src/components/     # Reusable UI elements
│   ├── src/context/        # Authentication and notifications
│   ├── src/layouts/        # Public and authenticated layouts
│   ├── src/pages/          # Student, scholarship, report, admin screens
│   ├── src/services/       # Central API client
│   └── src/styles/         # Responsive design system
├── server/
│   ├── scripts/            # Seed and secure admin bootstrap
│   └── src/
│       ├── config/         # Environment and database
│       ├── controllers/    # REST request handlers
│       ├── middleware/     # Auth, CSRF, errors
│       ├── models/         # Mongoose schemas
│       ├── routes/         # REST routes
│       ├── services/       # OCR, GridFS, classification, extraction,
│       │                   # consistency and eligibility modules
│       ├── tests/          # Unit/API tests and synthetic fixtures
│       └── utils/
├── .github/workflows/ci.yml
├── render.yaml
├── eslint.config.js
└── README.md
```

## Prerequisites

- Node.js 24 LTS recommended (Node 22.12+ is supported by the configured Vite/Vitest requirements).
- npm 10+.
- MongoDB Atlas account, or MongoDB running locally.
- A browser with cookie support.

## Run locally

1. Unzip the repository and open a terminal in the `docuverify` folder.
2. Install workspace dependencies:

   ```bash
   npm install
   ```

3. Create the server environment file and edit the values:

   ```bash
   cp server/.env.example server/.env
   ```

   At minimum, set `MONGODB_URI` and replace `JWT_SECRET` with a unique random secret of at least 32 characters. Keep `NODE_ENV=development` locally. The default Mongo URI points to `mongodb://127.0.0.1:27017/docuverify` if MongoDB is running locally.

4. Create the frontend environment file:

   ```bash
   cp client/.env.example client/.env
   ```

   `VITE_API_URL` should be the API base ending in `/api`. For local development the default is `http://localhost:5000/api`.

5. Start both services from the repository root:

   ```bash
   npm run dev
   ```

   Frontend: `http://localhost:5173`  
   Backend: `http://localhost:5000`  
   Health endpoint: `http://localhost:5000/api/health`

   The backend intentionally refuses to start if it cannot establish a MongoDB connection. GridFS, user accounts, dashboard data, and assessments all need the database.

## MongoDB Atlas / GridFS setup

1. Create a MongoDB Atlas project and cluster.
2. Create a database user with a strong password. Grant only the access needed for the app database.
3. In Atlas Network Access, allow the deployment host's egress IP range when static egress is available. Avoid permanently exposing the cluster to the entire internet unless you intentionally accept that risk.
4. Copy the SRV connection string. URL-encode special characters in the username/password and replace the database name with `docuverify`.
5. Set the full string as `MONGODB_URI` in `server/.env` locally or as a server environment variable in hosting.
6. On first use, MongoDB creates collections and the GridFS bucket as records are written. GridFS files are stored in the `privateDocuments.files` and `privateDocuments.chunks` collections. Do not manually expose those collections through public routes.

### Collections

| Collection/model | Purpose |
|---|---|
| `User` | Account profile, role, hashed password, account state |
| `Document` | Owner, metadata, GridFS reference, OCR result, fields, review status |
| `Scholarship` | Configurable criteria and sample/demo program details |
| `EligibilityAssessment` | Time-stamped criteria results, explanations, evidence, and snapshot |
| `AuditLog` | Security-sensitive event metadata; avoids logging passwords, tokens, or full OCR content |
| `privateDocuments.files/chunks` | Original PDF/image contents stored via GridFS |

## Seed demo scholarship rules and create an admin

After configuring MongoDB, run the synthetic scholarship seed script:

```bash
npm run seed
```

The seed script creates/refreshes three programs clearly labelled as synthetic demo criteria. It does **not** create fake student documents or upload personal records.

To create an administrator, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` in `server/.env`. The password must be unique and at least 16 characters with letters and numbers. Then run:

```bash
npm run create-admin
```

The script hashes the password, sets the role to `admin`, and does not print the password. Never commit `.env` files or use an example password in a deployed environment. Registration always creates a student role; users cannot select admin from the signup form.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run dev:client` | Vite development server only |
| `npm run dev:server` | Express API with Node watch mode |
| `npm run build` | Vite production build |
| `npm test` | Server tests then frontend tests |
| `npm run test:core` | Dependency-light core logic tests |
| `npm run lint` | ESLint for server and client source |
| `npm run check:server` | Run Node syntax checks on backend JavaScript |
| `npm run seed` | Insert/update synthetic scholarship programs |
| `npm run create-admin` | Create/update an administrator using environment values |

## OCR, classification and assessment behavior

- Images are processed by Tesseract.js. Text-based PDFs use PDF.js to extract selectable text. Pages without enough selectable text are rendered to images and passed to Tesseract.js.
- English is configured by default. Extra languages require corresponding Tesseract trained data and configuration.
- The default upload cap is 10 MB and scanned PDFs are limited to 8 pages. Both are environment-configurable with conservative hard caps in code.
- OCR workers are created for processing and terminated after each image; the queue limits concurrency and pending work. Interrupted queue jobs are recovered during startup up to configured in-memory capacity. Any excess interrupted work is marked failed for an explicit user retry.
- Classification is a transparent keyword/rule score (`keyword-rules-v1`), not a trained machine-learning model.
- Field extraction stores matched evidence. When Tesseract word-level confidence is available for a match, it is calculated from those word confidences; otherwise the UI displays “Confidence unavailable.” Classification scores are a separate rule-based score, not OCR accuracy.
- Sensitive 12-digit sequences recognizable as common Indian identity-number patterns are masked in retained extracted OCR text. Do not use this behavior as a substitute for minimizing real sensitive documents at source.
- Cross-document checks compare normalized names and exact uploaded-file hashes. Similar-but-not-identical names need review. A mismatch alone does not reject an application.
- Eligibility outcomes are `eligible`, `not_eligible`, or `needs_review`. Missing required documents/values, low-confidence OCR values, CGPA against a percentage-only requirement, and ambiguous consistency checks can cause manual review. No official scheme's eligibility terms are included; demo rules are synthetic.

## Security and privacy notes

- Session JWTs are stored in HTTP-only cookies; browser writes require the CSRF token returned by `GET /api/auth/csrf`.
- `JWT_SECRET`, `MONGODB_URI`, and admin setup credentials are server-side only. Do not prefix server secrets with `VITE_`.
- The backend allows one exact `CLIENT_ORIGIN`. Configure it to the deployed frontend URL, including `https://` and no trailing slash.
- Original files are private in GridFS; there is no public static upload directory or public file URL.
- User document queries are scoped to the authenticated owner. Admin APIs also check the admin role server-side.
- Audit events hash IP addresses before storage and avoid logging OCR contents or credentials.
- Use a same-site custom domain arrangement when possible (for example `app.example.com` and `api.example.com`). Browsers can restrict third-party cookies when the frontend and API use unrelated hosting domains even with cross-origin credentials configured.
- This is an educational portfolio project, not a certified document-authenticity service. Before production use with real financial or identity records, conduct a security/privacy review, define retention and deletion policies, add encryption/backup controls suitable for your threat model, and validate current legal requirements.

## REST API summary

All endpoints except the health and CSRF bootstrap endpoints require an authenticated cookie unless noted. POST/PATCH/DELETE requests require `X-CSRF-Token` matching the `dv_csrf` cookie. Responses use `{ success, message, data }` for expected application responses.

| Method | Endpoint | Access / purpose |
|---|---|---|
| `GET` | `/api/health` | Public dependency/queue health; returns 503 if MongoDB is unavailable |
| `GET` | `/api/auth/csrf` | Public CSRF bootstrap for browser client |
| `POST` | `/api/auth/register` | Public student registration |
| `POST` | `/api/auth/login` | Public login, rate-limited |
| `POST` | `/api/auth/logout` | Authenticated logout |
| `GET` | `/api/auth/me` | Current account |
| `PATCH` | `/api/auth/profile` | Update profile |
| `GET/POST` | `/api/documents` | List your documents / upload PDF or image |
| `GET` | `/api/documents/:id` | Document metadata, extracted text and evidence (owner/admin) |
| `GET` | `/api/documents/:id/file` | Authenticated preview/download bytes |
| `POST` | `/api/documents/:id/reprocess` | Retry OCR |
| `PATCH` | `/api/documents/:id/fields` | Save field corrections and history |
| `DELETE` | `/api/documents/:id` | Delete own document and stored file |
| `GET` | `/api/documents/consistency` | Run cross-document consistency checks |
| `GET` | `/api/dashboard` | Current user's live dashboard aggregates |
| `GET/POST` | `/api/scholarships` | List active rules / admin create |
| `GET/PATCH/DELETE` | `/api/scholarships/:id` | View/update/deactivate rule (mutations are admin-only) |
| `GET` | `/api/assessments` | Current user's assessment history |
| `POST` | `/api/assessments/:scholarshipId` | Run a preliminary assessment |
| `GET` | `/api/assessments/detail/:id` | Explainable assessment report |
| `GET` | `/api/admin/overview` | Admin counts |
| `GET` | `/api/admin/users` | Admin user search/pagination |
| `GET` | `/api/admin/documents` | Admin document directory |
| `GET` | `/api/admin/assessments` | Admin assessments |
| `GET` | `/api/admin/audit` | Admin audit history |
| `POST` | `/api/documents/:id/admin-review` | Admin-only record of a review explanation |

## Deployment

See [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) for the step-by-step GitHub, MongoDB Atlas, Render, Vercel, administrator setup, and smoke-test checklist. The Render Blueprint uses a free demo instance to avoid opting into a paid plan automatically; free-tier CPU/RAM and sleep limits can affect OCR performance.

### 1. Backend on Render

1. Push this repository to GitHub.
2. Create a Render Web Service from the repository. The included `render.yaml` is a starting blueprint; review the selected plan and configuration before applying it.
3. Use the repository root as the service root directory, build command `npm install`, and start command `npm --workspace server run start`.
4. Add environment variables: `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters), and `CLIENT_ORIGIN` (the exact frontend URL). `NODE_ENV=production`, upload/page limits, and Node version are included in the blueprint.
5. Confirm that the service can reach Atlas, then use `/api/health` as the health-check path. A 503 means the API is up but MongoDB is not connected.
6. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `ADMIN_NAME` as temporary/sensitive service variables only when you run the admin script; do not leave an unnecessary bootstrap password in the permanent production environment.

### 2. Frontend on Vercel

1. Import the repository into Vercel.
2. Set the project root directory to `client` and use the Vite framework preset (build `npm run build`, output `dist`). `client/vercel.json` contains the SPA fallback for React Router.
3. Add `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api` (replace the example with the real backend URL).
4. Deploy and copy the final frontend origin into the backend's `CLIENT_ORIGIN`. Redeploy the backend after changing it.
5. For the most reliable cookie authentication, use custom domains under the same registrable domain for app and API where possible; unrelated Vercel/Render hostnames may trigger third-party-cookie restrictions in some browsers.

### 3. Verify deployment

After both deployments complete, test the actual service URL (replace the example host):

```bash
curl -i https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

Expected: HTTP 200 with `success: true` when MongoDB is connected; otherwise the API will report a degraded 503. Then open the deployed frontend and verify: registration, logout/login, upload a synthetic fixture, OCR status update, correction save, consistency review, scholarship assessment, report print, and admin route denial for a student account. Check Render/Vercel logs if cookies, CORS, database access, or first-run OCR trained-data downloads fail.

**No public deployment is included with this source handoff.** A live deployment requires your hosting accounts and environment variables.

## Tests

Core unit tests use synthetic strings and do not require MongoDB or external services:

```bash
npm run test:core
```

The server API/security test suite uses Express/Supertest and installed dependencies. The frontend has Vitest tests for formatting utilities. Full integration of database-backed workflows needs a dedicated test MongoDB URI and real dependency installation; do not point tests at a production database. OCR fixtures are synthetic and may be inspected at:

- `server/src/tests/fixtures/marksheet-demo.png`
- `server/src/tests/fixtures/unreadable-demo.png`

The marksheet fixture contains only made-up data and an explicit demo watermark.

## Screenshots / demo link

- Live demo: _add your deployed frontend URL here after verification_
- Landing page screenshot: _add image here_
- Student dashboard screenshot: _add image here_
- Document review screenshot: _add image here_
- Admin console screenshot: _add image here_

## Troubleshooting

- **API won't start:** verify `server/.env`, MongoDB connection string, Atlas network access, database credentials, and that you can connect to the chosen Mongo deployment.
- **Health returns 503:** the API is running without a connected database. Fix `MONGODB_URI`/network rules, then restart the service.
- **Browser reports CORS:** `CLIENT_ORIGIN` must exactly equal the frontend's origin and include the right protocol. Do not add a trailing slash.
- **Login succeeds but page looks signed out:** check browser cookie policies, `withCredentials`, HTTPS in production, CSRF bootstrap, the exact origin, and whether app/API domains are cross-site.
- **OCR returns no text:** try a high-resolution, upright image with legible print. Scanned PDFs are page-limited; text extraction is not handwriting recognition.
- **First OCR call is slow/fails on trained-data download:** ensure the host can reach the Tesseract language-data source and has enough memory/disk for the worker. Retry after the data is cached.
- **Upload rejects a file:** check signature, file type, size cap, and whether the PDF is structurally valid.
- **Admin page is forbidden:** create/upgrade the account through the secure admin script, then sign out and back in so the session reflects the account's current role.
