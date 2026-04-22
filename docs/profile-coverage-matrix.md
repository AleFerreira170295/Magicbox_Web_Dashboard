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
| `institution-admin` | `InstitutionDashboard` | `/dashboard`, `/syncs`, `/games`, `/users`, `/permissions`, `/institutions`, `/profiles`, `/devices` | **conditional** | `Permissions` is present, but navigation depends on ACL/feature read permissions in the session. Good candidate to fully close by making the backend/UI contract explicit. |
| `director` | `InstitutionDashboard` | `/dashboard`, `/syncs`, `/games`, `/institutions`, `/profiles`, `/devices` | **closed** | Institutional scope looks coherent and intentionally excludes `users`, `permissions`, `health`, and `settings`. |
| `teacher` | `TeacherDashboard` | `/dashboard`, `/syncs`, `/games`, `/devices` | **follow-up** | Core flow is operational. Next useful check is whether `/devices` needs one more teacher-oriented pass to match the stronger work already done in `games` and `syncs`. |
| `researcher` | `ResearcherDashboard` | `/dashboard`, `/syncs`, `/games` | **closed** | Scope is intentionally narrow and already aligned with navigation/tests. |
| `family` | `FamilyDashboard` | `/dashboard`, `/syncs`, `/games` | **closed** | Scope is intentionally simple and already aligned with navigation/tests. |
| `government-viewer` | executive view inside `SuperadminDashboard` | `/dashboard`, `/territorial-alerts`, `/territorial-overview` | **closed** | Executive territorial experience is isolated from technical modules and covered by tests. |

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
