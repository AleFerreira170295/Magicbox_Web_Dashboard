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
| `institution-admin` | `InstitutionDashboard` | `/dashboard`, `/syncs`, `/games`, `/users`, `/permissions`, `/institutions`, `/profiles`, `/devices` | **conditional** | Almost everything is operational already. The only real closure gap is that `Permissions` depends on ACL/feature read exposure in the live session, so the product contract is still implicit instead of explicit. |
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
| `/permissions` | The screen itself is operational for institutional ACL review, with scoped filters, governance presets, and graceful blocked-state copy. | **conditional** | Make the contract explicit: define whether `institution-admin` should always receive ACL/feature-read capability, or whether the product intentionally allows institution-admin sessions without `Permissions`. That backend/session rule is the only meaningful blocker to mark the profile fully closed. |

## Exact closure condition for institution-admin

`institution-admin` can move from **conditional** to **closed** once the team decides and documents one of these two product contracts:

1. **Guaranteed access contract**: every real `institution-admin` session must include the ACL/feature read capabilities needed to expose `/permissions`.
2. **Optional access contract**: `institution-admin` is allowed to exist without `Permissions`, and the matrix/navigation should describe that as an intentional variant, not as an implicit backend dependency.

Right now, the UI is ready for both paths. What is missing is not another screen, but the explicit product rule.

## Verification notes

The matrix above was checked against:

- navigation visibility in `src/components/app-shell.tsx`
- route guards in `src/app/(app)/*/page.tsx`
- role-based dashboard selection in `src/features/dashboard/dashboard-home.tsx`
- targeted test suites for navigation, route guards, dashboards, and module screens

Targeted verification run on 2026-04-22:

- 19 test files
- 56 tests passed

## Recommended next move

If the goal is to finish profiles one by one, the best next step is:

1. **Close `institution-admin` fully** by confirming the `Permissions` contract and removing ambiguity around when it should appear.
2. **Do a final teacher pass on `/devices`** if we want the teacher experience to feel equally polished across all of its visible modules.
3. Then move to broader UX polish only after those two scope edges are explicit.
