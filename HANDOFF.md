# Origin Growth Center: Technical Handoff Documentation

## 1. Project Overview
The Origin Growth Center is a world-class omnichannel marketing dashboard. It is designed to aggregate data from **Google Ads**, **Meta Ads**, and **Google Analytics 4 (GA4)** to provide a "Single Source of Truth" for marketing performance, LTV analysis, and predictive forecasting.

---

## 2. Technical Stack (Frontend)
- **Framework**: React 19 (ES6 Modules)
- **Styling**: Tailwind CSS (Dark Mode focused)
- **Icons**: Lucide-React
- **Charts**: Recharts (Customized with glow effects and tooltips)
- **AI Engine**: @google/genai (Gemini 3 Pro & Flash)

---

## 3. Data Schema & KPIs
The backend must provide endpoints that match the interfaces defined in `types.ts`.

### Key Metrics to Calculate:
1.  **ROAS (Return on Ad Spend)**: `Total Revenue / Total Ad Spend`.
2.  **CAC (Customer Acquisition Cost)**: `Total Ad Spend / New Conversions`.
3.  **LTV:CAC Ratio**: Lifetime Value of a cohort divided by its initial acquisition cost.
4.  **Payback Period**: Time (in months) required for a cohort's cumulative revenue to exceed acquisition spend.
5.  **Forecast (Linear/Trend)**: Predictive revenue model based on `Current Daily Revenue * (1 + Ad Boost Simulator Factor)`.

---

## 4. Backend Integration Requirements (The "To-Do" List)

### A. OAuth 2.0 Identity Server
- **Google Ad Manager API**: Requires `adwords` scope.
- **Meta Graph API**: Requires `ads_read` and `ads_management` scopes.
- **GA4 Data API**: Requires `analytics.readonly` scope.
- **Backend Task**: Build a secure credential store (PostgreSQL/Redis) to manage Refresh Tokens for the accounts linked via the `ConnectorsView`.

### B. Data Aggregation Worker
- **Polling**: A background worker to fetch data every 1-6 hours.
- **Normalization**: Map Google's `metrics.cost_micros` and Meta's `spend` into a unified `spend` field in the database.
- **Attribution**: Implement a first-touch or last-click logic to reconcile GA4 conversions with specific Ad IDs.

---

## 5. AI Capabilities (Gemini Service)
The application uses two distinct AI patterns in `services/geminiService.ts`:

### 1. The Insight Engine (Gemini 3 Flash)
- **Purpose**: Generates 4 structured JSON objects for the sidebar.
- **Input**: Current 30-day performance snapshot + Active Campaign names.
- **Output**: Category (SEO, Budget, Geo, etc.), Priority, and Description.

### 2. The Strategy Chat (Gemini 3 Pro + Search Grounding)
- **Purpose**: Interactive marketing consultant.
- **Capability**: Uses `googleSearch` tool to cross-reference your internal ROAS with external market trends (e.g., "Is my $40 CAC normal for the SaaS industry in Q4?").
- **Backend Requirement**: Ensure the Gemini API Key has "Google Search" enabled in the Google AI Studio console.

---

## 6. UI Logic & Navigation
- **View Controller**: Managed by `activeView` state in `App.tsx`.
- **Drill-down**: The `selectedCampaign` state allows for deep-dives into individual `Campaign` objects without full-page reloads.
- **Connectors**: The `ConnectorsView` provides the UI hooks for `window.open('/api/auth/google')`.

---

## 7. Next Steps for Implementation
1.  **Initialize Node.js/Python Environment**: Use the current project root.
2.  **API Key Management**: Move `process.env.API_KEY` to a secure server-side `.env` file.
3.  **Database Setup**: Create tables for `Campaigns`, `DailyStats`, and `Integrations`.
4.  **Replace Mocks**: In `App.tsx`, replace the `useEffect` mock data imports with `fetch('/api/v1/dashboard-data')`.

---
**End of Handoff Document**
