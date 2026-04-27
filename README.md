# eva-desk

Lightweight, high-performance orchestration engine designed to manage `eva-run` clusters.

It acts as a centralized control plane and test load balancer, utilizing a `Redis`-based message bus to ensure seamless task distribution and fault tolerance.

---

## Quick Start

```bash
git clone https://github.com/eva-llm/eva-desk
cd eva-desk
nvm use
pnpm install
export CLUSTER_REDIS_URL="redis://..."
export DATABASE_URL="postgresql://..."
pnpm run server
```

Once the control plane is active, `eva-run` worker nodes can be [provisioned and connected](https://eva-llm.github.io/eva-run/#quick-start).

**Infrastructure Note:** For Enterprise-Grade deployments, node scaling should be managed via automated orchestration frameworks such as **Kubernetes (K8s)**, **Docker Swarm**, or **Terraform** to ensure infrastructure-level resilience.

---

## Operating Principle

`eva-desk` implements a robust, fault-tolerant architecture for cluster management, ensuring maximum delivery guarantees for massive-scale evaluation workloads.

#### Key Mechanisms:
- **Heartbeat Monitoring:** Each `eva-run` node maintains a persistent heartbeat, reporting its health status and available capacity to the orchestrator.

- **Adaptive Balancing:** Tasks are dynamically distributed across the cluster based on real-time node telemetry and completion rates.

- **Horizontal Scalability:** The architecture is engineered for massive horizontal scaling, capable of orchestrating test runs exceeding millions of scenarios across heterogeneous clusters.

- **Self-Healing Queue:** Utilizes a non-blocking logic to ensure that if a node fails, tasks are transparently re-queued and re-routed to healthy instances.

---

## API Reference

### POST /eval
Interface Compatibility: Fully compliant with the `eva-run` [API](https://eva-llm.github.io/eva-run/#api).

Enables seamless `eva-cli` [integration](https://eva-llm.github.io/eva-cli/#configuration) for manual execution and debugging.

**Note:** _This endpoint is restricted during active automated test runs to prevent state conflicts._

### POST /run
**Payload:** `{ "run_id": "uuid_v7" }`

Triggers an automated evaluation cycle. The orchestrator retrieves test schemas from the PostgreSQL repository associated with the `run_id` and initiates the distribution protocol across the active cluster.

### GET /current_run
Returns the identifier of the execution context currently being processed by the cluster.

### GET /runs_queue
Retrieves the prioritized queue of `run_ids` awaiting orchestration.

### GET /nodes
Provides a real-time registry of active, authorized nodes within the cluster.

### GET /health
Standard health check endpoint for monitoring and ingress controllers.
