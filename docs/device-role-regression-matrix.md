# Device role regression matrix

A short QA matrix to validate how representative `devices` changes propagate across roles and screens.

## Roles in scope

- **admin**: full command level, executive dashboard + all operational modules
- **institution-admin**: scoped command level, no Health/Settings, optional Permissions
- **director**: read-heavy operational command level, no Users/Permissions/Health/Settings
- **teacher**: teacher dashboard, classroom-facing metrics, narrower operational view

## Representative changes

We use four concrete changes because they cover the highest-value propagation paths.

1. **Rename device**
2. **Change status**
3. **Move Home -> Institution**
4. **Reassign Institution A -> Institution B**

---

## 1) Rename device

**Change in `/devices`**
- edit `name`

**Primary surfaces expected to change**
- Devices
- Institutions
- Health
- Syncs
- Games
- Dashboards

**Role expectations**

| Role | Expected result |
|---|---|
| admin | sees new name in device rows, executive home, sync/game references, institutions previews/count context |
| institution-admin | sees new name in scoped operational home, devices, institutions, sync/game references |
| director | sees new name where device context is surfaced from command home and operational modules |
| teacher | sees new name in teacher-facing operational summaries where device totals/context are exposed |

**Automated coverage**
- Devices propagation chain already covered in Institutions, Health, Syncs, Games, SuperadminDashboard, TeacherDashboard

**Manual spot-check**
- rename one device, reload `syncs` and `games`, confirm row + detail use the updated name

---

## 2) Change status

**Change in `/devices`**
- edit `status`

**Primary surfaces expected to change**
- Devices
- Health
- Superadmin dashboard

**Role expectations**

| Role | Expected result |
|---|---|
| admin | sees new status in Devices, Health recent devices, and executive summary for devices without status |
| institution-admin | sees status in Devices and command home summaries derived from visible devices |
| director | sees status-derived summaries from command home where exposed |
| teacher | indirect impact only through device totals/context, not a rich status console |

**Automated coverage**
- Health and SuperadminDashboard already cover missing-status aggregation

**Manual spot-check**
- set one visible device to empty status, confirm Health and executive home increment the missing-status signal

---

## 3) Move Home -> Institution

**Change in `/devices`**
- switch `assignmentScope` from `home` to `institution`
- set `educationalCenterId`

**Primary surfaces expected to change**
- Devices
- Institutions
- Health
- Superadmin dashboard

**Role expectations**

| Role | Expected result |
|---|---|
| admin | sees device move out of Home semantics and into institutional aggregates |
| institution-admin | sees scoped institution counts/previews change if the target institution is within scope |
| director | sees institution-oriented command summaries shift accordingly |
| teacher | no deep institutional admin signal expected from home, but downstream device totals may move |

**Automated coverage**
- Institutions and Health already cover the strongest propagation path

**Manual spot-check**
- move a Home device into one institution, then verify:
  - Devices shows institution scope
  - Institutions increments linked devices for the target institution
  - Health updates Home-related summary

---

## 4) Reassign Institution A -> Institution B

**Change in `/devices`**
- keep `assignmentScope=institution`
- change `educationalCenterId`

**Primary surfaces expected to change**
- Devices
- Institutions
- command dashboards summarizing visible scope

**Role expectations**

| Role | Expected result |
|---|---|
| admin | sees counts/previews leave Institution A and appear under Institution B |
| institution-admin | only sees the change if the destination remains inside the current scoped visibility |
| director | sees institution-level summaries rebalance |
| teacher | usually no direct institutional control signal from the teacher home |

**Automated coverage**
- Institutions path covered structurally; this remains the most important manual regression pass

**Manual spot-check**
- reassign one device between two institutions and verify both rows/previews update after refresh

---

## Suggested regression order

Run this order when validating a build:

1. Rename device
2. Change status
3. Move Home -> Institution
4. Reassign Institution

This order starts with the safest broad propagation, then ends with the most business-sensitive institutional movement.

## Exit criteria

A build is green for this matrix when:

- no role lands on the wrong dashboard
- hidden modules stay hidden for the wrong role
- device rename propagates to all display surfaces
- missing-status signals update in Health and executive home
- institution-linked counts/previews update after scope reassignment
