Release 0.6.1 adds independent package CI and a verified archive distribution workflow. Runtime APIs are unchanged from 0.6.0.

Every release runs the build, typecheck, unit contracts, and real Chromium collector contracts. The archive and SHA256SUMS are attached only after these checks pass. No registry credentials are required.

This repository is private. Download assets with an authorized GitHub account; do not embed tokens in package manifests or lockfiles. Dealroom vendors the verified release archive for self-contained deployments.
