# Profile coverage matrix

Last verified: 2026-04-22
Baseline reviewed: `main@f20016b`

## Purpose

This document is the working checklist for deciding which profile experiences are already operational in the frontend and which ones still need follow-up.

Status labels:

- **closed**: the role has explicit navigation, route guards, and screens/tests aligned with its scope
- **conditional**: the UI path exists, but visibility or usefulness still depends on backend/session contract details
- **follow-up**: usable, but there is still an obvious polish or scope-closing task pending

## Matrix

| Profile | Dashboard home | Enabled screens | Current status | Notes / follow-up |
| --- | --- | --- | --- | --- |
| `admin` | `SuperadminDashboard` | `/dashboard`, `/syncs`, `/games`, `/users`, `/permissions`, `/institutions`, `/health`, `/profiles`, `/settings`, `/devices` | **closed** | Global platform suite is aligned in navigation, guards, and tests. |
| `institution-admin` | `InstitutionDashboard` | `/dashboard`, `/syncs`, `/games`, `/users`, `/permissions`, `/institutions`, `/profiles`, `/devices` | **closed** | The strong product contract is now explicit in frontend: `Permissions` is part of the role experience, and misprovisioned sessions surface as contract gaps instead of silently hiding the module. |
| `director` | `InstitutionDashboard` | `/dashboard`, `/syncs`, `/games`, `/institutions`, `/profiles`, `/devices` | **closed** | Institutional scope looks coherent and intentionally excludes `users`, `permissions`, `health`, and `settings`. |
| `teacher` | `TeacherDashboard` | `/dashboard`, `/syncs`, `/games`, `/devices` | **follow-up** | Core flow is operational. Next useful check is whether `/devices` needs one more teacher-oriented pass to match the stronger work already done in `games` and `syncs`. |
| `researcher` | `ResearcherDashboard` | `/dashboard`, `/syncs`, `/games` | **closed** | Scope is intentionally narrow and already aligned with navigation/tests. |
| `family` | `FamilyDashboard` | `/dashboard`, `/syncs`, `/games` | **closed** | Scope is intentionally simple and already aligned with navigation/tests. |
| `government-viewer` | executive view inside `SuperadminDashboard` | `/dashboard`, `/territorial-alerts`, `/territorial-overview` | **closed** | Executive territorial experience is isolated from technical modules and covered by tests. |

## Institution-admin breakdown

| Screen | Current read | Status | What would make it fully closed |
| --- | --- | --- | --- |
| `/dashboard` | Dedicated institutional home with quick access to users, permissions, institutions, profiles, devices, games, and syncs. Metrics are already scoped to visible institutions/data. | **closed** | Nothing important missing at the UI level. |
| `/users` | Strong institutional behavior already exists: single-institution anchoring, ACL cues, role inference, operational focus filters, and read-only cues when management permissions are missing. | **closed** | Nothing critical missing. |
| `/institutions` | Institutional scope is explicit, with operational focus segments and clear read-only cues when the session is scoped. | **closed** | Nothing critical missing. |
| `/profiles` | Properly anchored to the visible institution with ownership, bindings, session activity, and focus filters. | **closed** | Nothing critical missing. |
| `/devices` | Operational and scoped, with ownership, assignment scope, status, metadata, and read-only cues when update permission is absent. | **closed** | Nothing critical missing for institution-admin. |
| `/games` | Institution-scoped view is explicit and already explains why each game is visible, including access relation and owner/device context. | **closed** | Nothing critical missing. |
| `/syncs` | Operational sync reading works when BLE read capability is present, and the UI explains whether access is personal vs ACL-expanded. | **closed** | Nothing critical missing as long as BLE read is part of the intended role contract. |
| `/permissions` | The screen is operational for institutional ACL review, with scoped filters, governance presets, and an explicit contract-gap state when the session arrives misprovisioned. | **closed** | Frontend now treats `Permissions` as part of the role contract and exposes configuration problems instead of hiding the module. |

## Chosen contract for institution-admin

The team chose the **guaranteed access contract**:

1. every real `institution-admin` session should include the ACL/feature read capabilities needed for `/permissions`
2. frontend must always expose the module for `institution-admin`
3. if a session arrives without those capabilities, the UI should show an explicit contract-gap state instead of silently hiding the module

That means the frontend closure work for `institution-admin` is done. Any remaining gap is now a backend/session provisioning issue, not a missing product rule in the UI.

## Where the contract is currently implicit in code

The decision used to be spread across UI surfaces and is now centralized through a shared permission-contract helper. The main touchpoints are still:

- `src/components/app-shell.tsx`: decides whether `Permissions` appears in navigation for `institution-admin`
- `src/features/dashboard/institution-dashboard.tsx`: decides whether the `Permisos` quick access card appears
- `src/features/permissions/permissions-center.tsx`: decides whether the screen loads real ACL data or only shows the blocked-state explanation
- `src/features/auth/auth-context.tsx` + `src/features/auth/role-resolver.ts`: define the user/session shape that carries `roles`, `permissions`, and `educationalCenterId`

The frontend now depends on a shared helper set in `src/features/auth/permission-contract.ts`, so navigation, dashboard shortcuts, and the permissions screen follow the same rule.

## Verification notes

The matrix above was checked against:

- navigation visibility in `src/components/app-shell.tsx`
- route guards in `src/app/(app)/*/page.tsx`
- role-based dashboard selection in `src/features/dashboard/dashboard-home.tsx`
- targeted test suites for navigation, route guards, dashboards, and module screens

Targeted verification run on 2026-04-22:

- 19 test files
- 56 tests passed
- real backend validation completed after enforcing the strong contract: a temporary `institution-admin` user created through the live local API now receives `access_control:read` and `feature:read` on login and `/auth/me`

## Recommended next move

If the goal is to finish profiles one by one, the best next step is:

1. **Validate the backend/session provisioning** for real `institution-admin` sessions so they actually arrive with ACL/feature read as expected.
2. **Do a final teacher pass on `/devices`** if we want the teacher experience to feel equally polished across all of its visible modules.
3. Then move to broader UX polish only after those two checks are explicit.
