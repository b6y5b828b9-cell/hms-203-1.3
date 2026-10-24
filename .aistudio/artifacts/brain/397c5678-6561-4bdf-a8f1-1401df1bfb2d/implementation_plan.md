# Implementation Plan: Dedicated Doctor Lab Orders Screen

Add a dedicated **Lab Screen** ("Doctor Lab Orders") to the sidebar navigation and workspace tab bar. This screen serves hospital laboratory technicians and clinical staff by aggregating doctor-prescribed lab test orders, defaulting to today's patient queue, enabling flexible patient search (by Name, Token No., or Registration ID/MRN), and supporting sample collection and test result entry.

---

## 1. User Intent Analysis & Requirements

### Key Requirements
1. **Sidebar Navigation**:
   - Add a dedicated "Doctor Lab Orders" (or "Lab Orders") option in the sidebar under Diagnostics / Clinical workflow.
   - Display a live badge indicating pending lab orders for the current day.
   - Integrate with the workspace tab system so selecting it opens a distinct workspace tab.
2. **Current Day Patient List by Default**:
   - Filter patient orders to the current date (`today`) by default.
   - Include a date filter toggle ("Today", "Yesterday", "Last 7 Days", or custom date picker) to inspect previous records.
3. **Multi-Field Patient Search**:
   - Fast, debounce-assisted search bar querying:
     - **Patient Name** (e.g. John Doe)
     - **Token Number** (e.g. `OPD-042`, `LAB-012`, `TK-1002`)
     - **Registration ID / MRN** (e.g. `RG-98124`, `P-001`, `MRN-2026-081`)
4. **Patient Queue Cards with Test Checklists**:
   - Display patients as interactive cards arranged in a clean queue.
   - Priority indicators: STAT / Urgent (red/amber badge) vs Routine.
   - Doctor prescription context: Ordering physician name, clinic room, ordered time, and clinical diagnosis / indication.
   - Test checklist per order: displays tests (e.g., CBC, Lipid Panel, Blood Glucose, Serum Creatinine, Liver Function Test).
5. **Interactive Lab Staff Actions**:
   - **Sample Collection**: One-click action to mark samples as "Sample Collected" with collection timestamp and technician name.
   - **Result Entry Modal**: Enter test values (e.g., `14.2 g/dL`), reference range, flag abnormal/critical values, add technician notes, and complete the test.
   - Synchronizes directly with patient records (`patient.labResults`), token diagnostic reports, and doctor order status.

---

## 2. Proposed Changes & Architecture

### A. Context & State Updates (`src/context/HospitalContext.tsx`)
- Add `lab-orders` (or enhance `'labs'`) in `NavigationTab` if needed, ensuring clean separation between:
  - **Doctor Lab Orders Station**: Technician active queue for today's doctor orders, sample collection, and result entry.
  - **Diagnostic & Radiology Reports**: Historical archive and radiology viewer.
- Add helper methods in `HospitalContext`:
  - `updateLabOrderStatus(tokenId: string, testId: string, status: 'Ordered' | 'Sample Collected' | 'Completed')`
  - `recordLabTestResult(tokenId: string, testId: string, resultData: { value: string; referenceRange: string; status: 'Normal' | 'Elevated' | 'Critical'; notes?: string; technicianName: string })`
  - Ensure sample collection and results reflect across `receptionTokens`, `patients.labResults`, and audit history.

### B. New Component: `DoctorLabOrdersStation.tsx` (`src/components/DoctorLabOrdersStation.tsx`)
- **Header & Stats Banner**:
  - Live count of Today's Patients, Pending Orders, Samples Collected, and Completed Results.
  - Date Filter bar: Quick pills ("Today", "Yesterday", "This Week", "All") with custom calendar picker.
- **Search & Quick Filter Bar**:
  - Unified search input: `Search by Patient Name, Token No. (e.g. OPD-01), or Registration ID (e.g. RG-...)`.
  - Filter by Order Status (`All`, `Pending Sample`, `Sample Collected`, `Completed`) and Urgency (`All`, `Urgent / STAT`, `Routine`).
- **Patient Queue Card List**:
  - Card layout with:
    - Token badge (e.g., `OPD-042`) and visit time.
    - Patient avatar, full name, age/gender, and Registration ID (MRN).
    - Prescribing doctor name, department, and clinical assessment / diagnosis notes.
    - Test Checklist with status chips (`Ordered` 🟡, `Sample Collected` 🔵, `Completed` 🟢).
    - Action buttons: "Collect Sample", "Enter Results", "Print Barcode / Slip".
- **Result Recording Modal**:
  - Technician inputs measured value, unit, reference interval, clinical interpretation (`Normal`, `Elevated`, `Critical`), and signature.
  - Generates official test report entry and updates patient EMR.

### C. Sidebar & Workspace Tab Integration
- **`src/components/Sidebar.tsx`**:
  - Add `Doctor Lab Orders` nav item with `FlaskConical` icon and today's pending order count badge.
  - Allow access for `admin`, `doctor`, `nurse`, and `lab` roles.
- **`src/utils/workspaceTabs.ts`**:
  - Register `lab-orders` in `WORKSPACE_TAB_DEFINITIONS` with category "Diagnostics" and distinct theme colors.
- **`src/App.tsx`**:
  - Route `'lab-orders'` to `DoctorLabOrdersStation`.

---

## 3. Verification Plan

### Automated Verification
- Run `lint_applet` to check for syntax, imports, and typing validity.
- Run `compile_applet` to ensure successful TypeScript build and Vite bundling without regressions.

### Manual Verification Workflows
1. **Sidebar Navigation & Tab System**:
   - Verify clicking "Doctor Lab Orders" opens the new workspace tab with tab icon and title.
   - Verify closing/switching tabs functions smoothly.
2. **Current Day Defaulting**:
   - Verify orders defaulting to the current date (`2026-10-24`).
   - Switch date filter to "All" or pick other dates to inspect historical orders.
3. **Search Capabilities**:
   - Search by Patient Name (e.g. "Eleanor", "Marcus", "Fatima").
   - Search by Token Number (e.g. "OPD-", "TK-").
   - Search by Registration ID / MRN (e.g. "RG-", "MRN-").
4. **Order Status & Result Recording**:
   - Click "Collect Sample" on a test item -> status updates to "Sample Collected" with timestamp.
   - Click "Enter Result" -> submit result value and reference range -> status updates to "Completed".
   - Verify result reflects in patient EMR profile and reports.
