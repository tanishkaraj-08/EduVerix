---
name: FDR Sentinel prototype identity and evidence limits
description: Product boundary for judge-mode role switching and simulated FDR evidence.
---

FDR Sentinel's role switcher is for prototype exploration, not identity verification. Evidence submissions persist metadata only; they do not store file bytes and do not prove a bank issued an FDR.

**Why:** The problem statement requires judges to explore all roles without external registration and permits simulated uploads when persistent private storage is unavailable.

**How to apply:** Keep demo data and evidence behavior clearly labeled. Before treating the portal as a real institutional service, replace open demo-role switching with authenticated identity and connect evidence metadata to private object storage with ownership-based access checks.
