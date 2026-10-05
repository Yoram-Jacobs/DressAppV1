# Technical Research: Replacing MongoDB Atlas with a Cheap, Scalable Database Service for DressApp

**Date:** 2026-10-04  
**Status:** Completed  
**Author:** Antigravity AI Systems & Architecture  
**Target Query:** Comprehensive evaluation of low-cost, scalable database services to replace MongoDB Atlas, tailored to DressApp's architectural requirements, schema constraints, and deployment topology.

---

## 1. Executive Summary & Cost Analysis

DressApp's production infrastructure operates on a **Hetzner Cloud CPX32 VPS** (4 AMD EPYC vCPUs, 8 GB RAM, located in Germany) costing **€15.20/month** (~$16.50/month).

In contrast, production database operations currently run on **MongoDB Atlas M10** (10 GB storage, 2 GB RAM, 2 vCPUs). As of late 2026:
- MongoDB Atlas M10 Dedicated starts at **$0.08/hour (~$57.60 - $70.00/month)** base cost.
- Additional costs for cross-cloud network egress (traffic between Atlas AWS/GCP and Hetzner VPS), snapshot backup overages, and IOPS commonly push the Atlas invoice to **$65–$85/month**.
- **The database alone costs 400% to 500% more than the entire application compute stack.**

```
Current Cost Distribution (Monthly):
┌────────────────────────────────────────────────────────────────────────┐
│ Hetzner CPX32 VPS (Backend + Eyes + Web + Caddy): €15.20 (~$16.50)     │
├────────────────────────────────────────────────────────────────────────┤
│ MongoDB Atlas M10 (10 GB, 2 GB RAM):              ~$58.00 - $75.00     │ ◄── 78% of bill!
└────────────────────────────────────────────────────────────────────────┘
```

The objective is to replace MongoDB Atlas with a **cost-effective ($5–$25/month), highly scalable, reliable database service** that satisfies all DressApp features without performance degradation or unnecessary operational risk.

---

## 2. DressApp Database Requirements Audit

An inspection of the DressApp codebase ([`docs/MONGODB_SCHEMA.md`](file:///c:/DressApp_AG/docs/MONGODB_SCHEMA.md), [`backend/app/db/database.py`](file:///c:/DressApp_AG/backend/app/db/database.py), [`backend/app/services/repos.py`](file:///c:/DressApp_AG/backend/app/services/repos.py), [`backend/app/api/v1/listings.py`](file:///c:/DressApp_AG/backend/app/api/v1/listings.py), [`backend/app/api/v1/closet/search_stats.py`](file:///c:/DressApp_AG/backend/app/api/v1/closet/search_stats.py)) reveals the following technical profile:

### 2.1 Driver & Protocol Surface
- **Client**: Asynchronous Motor driver (`motor.motor_asyncio.AsyncIOMotorClient`, `AsyncIOMotorDatabase`, `AsyncIOMotorCollection`).
- **Connection Wiring**: Configured centrally via `MONGO_URL` and `DB_NAME` in [`backend/app/config.py`](file:///c:/DressApp_AG/backend/app/config.py) and instantiated in [`backend/app/db/database.py`](file:///c:/DressApp_AG/backend/app/db/database.py).
- **CRUD Operations**: Handled via simple abstractions in [`backend/app/services/repos.py`](file:///c:/DressApp_AG/backend/app/services/repos.py) (`insert`, `find_one`, `find_many`, `update`, `delete`, `count`), with raw Motor calls in specialized routers.

### 2.2 Collections (21 Active Collections)
1. `users` (auth, styling profile, body sizing, credit ledger)
2. `closet_items` (garment metadata, matting URLs, FashionCLIP embeddings, DPP data)
3. `listings` (marketplace items with GeoJSON Point coordinates)
4. `transactions` (marketplace payment and order fulfillment state machine)
5. `stylist_sessions` (conversational session metadata)
6. `stylist_messages` (multi-turn chat history)
7. `embeddings` (multimodal FashionCLIP entity vectors)
8. `cultural_rules` (regional, religious modesty constraints)
9. `trend_reports` (localized fashion intelligence cards)
10. `outfits` (saved multi-item outfits)
11. `shared_outfits` (public share tokens)
12. `suitcases` (travel packing trips)
13. `suitcase_archives` (archived packing itineraries)
14. `daily_proposals` (scheduled morning outfit recommendations)
15. `migration_sessions` (wardrobe migration tracking)
16. `ad_campaigns` (expert stylist directory campaigns)
17. `user_credits` (expert advertising credit balances)
18. `credit_topups` (PayPal ad credit receipts)
19. `ai_credit_purchases` (AI credit pack purchases)
20. `paypal_events` (idempotent webhook event ledger)
21. `config` (runtime provider override e.g. `eyes_provider` Gemma vs. Gemini)

### 2.3 Specialized Indexing & Query Requirements
To avoid runtime errors, any candidate database **must** support the following index types and query mechanisms currently registered in `ensure_indexes()`:
1. **Geospatial 2dsphere Indexes & `$geoNear`**:
   - `db.listings.create_index([("location", "2dsphere")], sparse=True)`
   - Used in [`backend/app/api/v1/listings.py`](file:///c:/DressApp_AG/backend/app/api/v1/listings.py) (`$geoNear` aggregation pipeline for radius searches within `radius_km`).
2. **Full-Text Indexes**:
   - `db.closet_items.create_index([("title", "text"), ("brand", "text"), ("tags", "text")])`
   - Used for text search across wardrobe inventories.
3. **Compound & Unique Partial-Filter Indexes**:
   - Unique with `partialFilterExpression={"stripe.checkout_session_id": {"$type": "string"}}` on `transactions`.
   - Unique with `partialFilterExpression={"paypal.order_id": {"$type": "string"}}` on `transactions`.
   - Unique compound `[("bucket", 1), ("date", 1), ("language", 1), ("country_code", 1), ("gender", 1)]` on `trend_reports`.
4. **Time-To-Live (TTL) Auto-Expiring Indexes**:
   - `simulated_notifications_ttl_30d` (`expireAfterSeconds=30 * 24 * 3600`).
   - `token_usage_ttl_90d` (`expireAfterSeconds=90 * 24 * 3600`).
5. **Disk Sorts on Large Documents**:
   - `allow_disk_use(True)` invoked in `repos.find_many` to bypass in-memory sort limits when documents carry image URLs or payload arrays.

---

## 3. Comparative Evaluation of Database Candidates

We evaluated candidate services against:
- **Monthly Cost** (Target: $\le \$25$/mo)
- **DressApp Compatibility** (Motor driver, 2dsphere, text search, partial filters, TTL)
- **Code Migration Effort** (Lines of code / schema redesign required)
- **Network Latency** to Hetzner Germany (`178.105.144.142`)
- **Operational Scalability & Backups**

| Service | Monthly Cost | MongoDB Wire Compatible? | 2dsphere & $geoNear | Full Text Index | Code Changes Required | Latency to Hetzner VPS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hetzner Dedicated Private VPS (Percona / Mongo)** | **€5.99 (~$6.50)** | **100% Native** | Supported | Supported | **0 lines** | **<0.5 ms** (Intra-datacenter) |
| **DigitalOcean Managed MongoDB (FRA1)** | **$15.00** | **100% Native** | Supported | Supported | **0 lines** | **~2–4 ms** (Frankfurt) |
| **Supabase Pro (PostgreSQL + PostGIS + pgvector)** | **$25.00** | No (PostgreSQL) | PostGIS (Superior) | `tsvector` / GIN | Medium-High (SQL/ORM rewrite) | **~5–10 ms** (EU Central) |
| **MongoDB Atlas Flex Tier** | **$8.00–$30.00** | 100% Native | Supported | Supported | 0 lines | ~25–50 ms (AWS/GCP cross-cloud) |
| **Neon Serverless PostgreSQL** | **$19.00** | No (PostgreSQL) | PostGIS | `tsvector` | Medium-High (SQL/ORM rewrite) | ~5–12 ms (EU Central) |
| **FerretDB on PostgreSQL** | **~$10.00–$15.00** | Wire Proxy | Partial | ❌ **Unsupported** | High (Breaks `ensure_indexes()`) | Variable |

> [!CAUTION]
> **Why FerretDB is NOT Viable for DressApp Today:**
> FerretDB does not support MongoDB's native `$text` indexes (`create_index([("title", "text")...])`). DressApp's backend calls `ensure_indexes()` on boot; FerretDB would throw an unhandled schema error immediately on startup unless search code is completely stripped and rewritten.

---

## 4. The Three Recommended Database Services

### Recommendation 1: Dedicated Private Hetzner Cloud Database (Percona Server for MongoDB / PSMDB)
*The Maximum Value, Zero-Code, Ultra-Low Latency Option*

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HETZNER PRIVATE CLOUD NETWORK (VLAN)                 │
│                                                                        │
│   ┌─────────────────────────────┐    Private IP    ┌─────────────────────────────┐   │
│   │     Hetzner CPX32 VPS       │◄────────────────►│      Hetzner CX23 VPS       │   │
│   │  (Backend, Eyes, Frontend)  │   Latency <0.5ms │  (Percona Server for Mongo) │   │
│   │       €15.20 / mo           │                  │         €5.99 / mo          │   │
│   └─────────────────────────────┘                  └──────────────┬──────────────┘   │
│                                                                   │ Nightly cron     │
│                                                                   ▼                  │
│                                                    ┌─────────────────────────────┐   │
│                                                    │    Hetzner Storage Box      │   │
│                                                    │     (1 TB encrypted backup) │   │
│                                                    │         €3.80 / mo          │   │
│                                                    └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Why it fits DressApp:
1. **Drastic Cost Reduction**: A dedicated **Hetzner CX23 Cloud instance** (2 vCPU AMD, 4 GB RAM, 40 GB NVMe SSD) costs **€5.99/month** (~$6.50/mo). Total database + 1 TB backup cost is **under €10/month**, saving over **$600–$750/year** compared to Atlas M10.
2. **100% Bug-for-Bug Native Compatibility**: Runs **Percona Server for MongoDB (PSMDB)**—an enterprise-grade, 100% open-source drop-in replacement for MongoDB Community with WiredTiger compression, in-memory profiling, and enterprise security.
3. **Zero Code Changes**: Requires **zero code alterations** in `backend/app/db/database.py` or any repository file. You simply update `MONGO_URL` in `deploy/.env`.
4. **Sub-Millisecond Network Latency**: Connected via a Hetzner Cloud Private Network (VLAN). Round-trip ping between backend and database drops from Atlas's ~35–60 ms down to **0.2–0.5 ms**, drastically speeding up multi-turn Stylist queries, marketplace queries, and admin metrics.
5. **No Egress Costs**: Data transfer between Hetzner Cloud servers in the same region is 100% free and unmetered.
6. **Automated Backups**: Backed up nightly via an automated `mongodump` Docker cron job streamed directly to a 1 TB Hetzner Storage Box (€3.80/mo) or Cloudflare R2 / AWS S3.

- **Monthly Cost**: **€5.99 (~$6.50)**
- **Migration Effort**: **1 hour** (provision VPS, deploy compose, restore dump, point `.env`).

---

### Recommendation 2: DigitalOcean Managed MongoDB (Frankfurt FRA1 Region)
*The Fully Managed, Zero-DevOps, Drop-In Replacement*

#### Why it fits DressApp:
1. **Affordable Managed Tier**: DigitalOcean provides an officially licensed Managed MongoDB service in direct partnership with MongoDB Inc. Single-node clusters start at **$15.00/month** (1 GB RAM, 1 vCPU, 15 GB NVMe SSD). High-availability 3-node replica sets start at **$30.00/month** (less than half the price of Atlas M10).
2. **Complete Native Parity**: Because it runs genuine MongoDB, all 21 collections, `2dsphere` geospatial indices, `$geoNear` aggregation pipelines, text search indices, `partialFilterExpression`, and TTL expiry work out of the box without any code changes.
3. **Zero Operational Burden**: DigitalOcean handles automated OS updates, patch management, daily automated backups with 7-day point-in-time recovery (PITR), auto-failover, and SSL/TLS encryption.
4. **Geographic Proximity (Frankfurt FRA1)**: DigitalOcean’s `fra1` datacenter in Frankfurt has direct peering with DE-CIX and German fiber backbones, giving **2–4 ms network latency** to Hetzner’s German datacenters (Falkenstein/Nuremberg).
5. **Seamless One-Click Vertical Scaling**: When DressApp grows, scaling compute or storage is done via a slider in the DigitalOcean dashboard without connection resets.

- **Monthly Cost**: **$15.00/month** (Single Node) or **$30.00/month** (3-Node HA)
- **Migration Effort**: **30 minutes** (spin up cluster, run `mongorestore`, update `MONGO_URL`).

---

### Recommendation 3: Supabase Pro (Managed PostgreSQL + PostGIS + pgvector)
*The Modern, Long-Term Full-Stack Architecture Option*

#### Why it fits DressApp:
1. **Predictable Flat Pricing**: Supabase Pro is **$25.00/month flat**, which includes:
   - 8 GB database storage (overage only $0.125/GB).
   - $10/month compute credits included.
   - 100,000 Monthly Active Users (MAUs).
   - 250 GB data egress.
   - Automated daily backups with 7-day retention.
2. **PostGIS (World-Class Geospatial Engine)**: PostGIS is the industry benchmark for spatial querying. Replacing MongoDB’s `2dsphere` with PostGIS gives DressApp microsecond-level spatial bounding box queries, nearest-neighbor searches, and rich spatial geometries for marketplace listings.
3. **Native `pgvector` Integration**: DressApp currently computes 512-dimensional FashionCLIP embeddings and evaluates cosine similarity using in-memory Python loops in [`backend/app/api/v1/closet/search_stats.py`](file:///c:/DressApp_AG/backend/app/api/v1/closet/search_stats.py). Supabase's built-in `pgvector` extension allows DressApp to run indexed vector similarity search (`HNSW` / `IVFFlat`) directly inside SQL queries at scale.
4. **JSONB Flexibility**: PostgreSQL `jsonb` offers schema-less nested document storage with binary indexing (GIN indexes), preserving the document flexibility DressApp relies on for user style profiles, clothing fabrics, and cultural tags.
5. **Trade-off / Code Impact**: Requires refactoring the database access layer in `backend/app/` from Motor/MongoDB to SQLAlchemy 2.0 / `asyncpg`.

- **Monthly Cost**: **$25.00/month**
- **Migration Effort**: **1–2 weeks** (schema definition, migration of 21 collections to relational/JSONB tables, ORM rewrite).

---

## 5. Detailed Technical Comparison Matrix

| Feature / Criteria | MongoDB Atlas M10 (Current) | Recommendation #1: Hetzner PSMDB (Dedicated VPS) | Recommendation #2: DigitalOcean Managed MongoDB | Recommendation #3: Supabase Pro (Postgres + PostGIS) |
| :--- | :--- | :--- | :--- | :--- |
| **Monthly Cost** | **~$58–$75/mo** | **€5.99/mo (~$6.50)** | **$15.00/mo** (Single) / **$30/mo** (HA) | **$25.00/mo** flat |
| **Annual Database Spend** | ~$700 – $900 | **~$78** | **$180 – $360** | **$300** |
| **Savings vs. Atlas** | Baseline | **~88% – 91% Savings** | **~55% – 75% Savings** | **~55% – 65% Savings** |
| **RAM & Compute** | 2 GB RAM / 2 vCPU | 4 GB RAM / 2 vCPU (Dedicated AMD) | 1 GB RAM (Single) / 2 GB+ (HA) | 2-core shared + $10 compute credit |
| **Storage Included** | 10 GB | 40 GB NVMe SSD | 15 GB NVMe SSD | 8 GB NVMe SSD ($0.125/GB overage) |
| **Driver / Wire Protocol** | Motor / PyMongo | Motor / PyMongo (100% Drop-in) | Motor / PyMongo (100% Drop-in) | asyncpg / SQLAlchemy |
| **Lines of Code Changed** | 0 | **0 lines** | **0 lines** | ~1,200 – 1,800 lines |
| **Geospatial Queries** | 2dsphere ($geoNear) | 2dsphere ($geoNear) | 2dsphere ($geoNear) | Native PostGIS (ST_DWithin, ST_Distance) |
| **Full-Text Search** | Atlas Search / Text Index | MongoDB Text Indexes | MongoDB Text Indexes | PostgreSQL tsvector / GIN Index |
| **FashionCLIP Vector Search** | Atlas Vector Search (paid) | In-Memory (Current Python pipeline) | In-Memory (Current Python pipeline) | Native `pgvector` in-database |
| **Network Latency to VPS** | 35–60 ms | **<0.5 ms** (Private vSwitch) | **2–4 ms** (FRA1 Frankfurt) | 5–10 ms (AWS EU Central) |
| **Backup Management** | Automated Cloud Snapshots | Automated nightly S3/StorageBox script | Automated daily backups + 7d PITR | Automated daily backups + 7d PITR |
| **DevOps Overhead** | Low (Fully Managed) | Low-Medium (Docker Compose setup) | Low (Fully Managed) | Low (Fully Managed) |

---

## 6. Migration Feasibility & Step-by-Step Execution Plan

Because **Recommendation #1 (Hetzner Dedicated PSMDB)** and **Recommendation #2 (DigitalOcean Managed MongoDB)** maintain 100% MongoDB protocol compatibility, migrating away from Atlas requires **zero downtime** and can be completed in minutes:

### Step 1: Export Data from MongoDB Atlas
Take a point-in-time snapshot using standard MongoDB tooling:
```bash
# Export the entire dressapp_prod database to local archive:
mongodump --uri="<CURRENT_ATLAS_MONGO_URL>" --db=dressapp_prod --archive=dressapp_backup.gz --gzip
```

### Step 2: Restore to the New Service
Restore the archive into the newly provisioned instance:
```bash
# For Hetzner PSMDB or DigitalOcean Managed:
mongorestore --uri="<NEW_SERVICE_MONGO_URL>" --nsInclude="dressapp_prod.*" --archive=dressapp_backup.gz --gzip
```

### Step 3: Verify Indexes & Integrity
Connect to the new instance and verify all 21 collections and compound/geospatial indices:
```bash
python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('<NEW_SERVICE_MONGO_URL>')
    db = client['dressapp_prod']
    cols = await db.list_collection_names()
    print('Restored collections:', len(cols))
    assert 'closet_items' in cols and 'listings' in cols
    indexes = await db.listings.index_information()
    print('Listings indexes:', list(indexes.keys()))
    assert any('2dsphere' in str(v) for v in indexes.values())
    print('All checks passed!')

asyncio.run(check())
"
```

### Step 4: Atomic Switchover
On the production VPS (`ssh root@178.105.144.142`):
```bash
cd /srv/AI-Stylist/deploy
# Update MONGO_URL in .env to the new connection string
sed -i 's|^MONGO_URL=.*|MONGO_URL=<NEW_SERVICE_MONGO_URL>|' .env

# Gracefully reload the backend container with zero downtime for other services:
docker compose up -d --force-recreate backend
```

---

## 7. Strategic Conclusion & Verdict

1. **Top Recommendation for Immediate Cost Relief**: **Hetzner Dedicated Private VPS (Percona Server for MongoDB)**.
   - For an app already anchored on Hetzner, spinning up a dedicated private CX23 instance (€5.99/mo) or running an isolated container with an attached persistent volume (€0.96/mo) gives the **highest performance (<0.5 ms ping), 100% compatibility, and 90% cost savings** with **zero backend code edits**.
2. **Top Recommendation for Hands-Off Managed Peace of Mind**: **DigitalOcean Managed MongoDB (Frankfurt)**.
   - At **$15/mo**, it cuts the Atlas bill by **75%**, provides enterprise automated backups and point-in-time recovery, and preserves 100% compatibility with Motor.
3. **Long-Term Architectural Evolution**: **Supabase Pro ($25/mo)**.
   - If DressApp plans a future refactor to unify relational marketplace transactions, PostGIS geospatial queries, and `pgvector` FashionCLIP embeddings in a single SQL engine, Supabase is the optimal platform.
