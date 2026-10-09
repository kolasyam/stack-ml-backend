# The 2026–2030 AI/ML Engineering Portfolio Strategy
**Target Project:** StackML (ML Knowledge Hub)
**Target Roles:** AI/ML Engineer, MLOps Engineer, Agentic AI Engineer

As a Senior Architect and Technical Hiring Manager, I review hundreds of AI portfolios. The vast majority are "thin wrappers"—a basic UI sending text to OpenAI's API. They demonstrate API integration, not engineering.

You have a significant advantage: **StackML is already a real application.** It has a database, a complex UI, a document reader, state management, and an event-driven core. 

To land a premium AI engineering role in 2026–2030, you don't need to build a new app. You need to **add serious intelligence, retrieval, orchestration, and operational layers** to your existing app. 

Here is the blueprint to evolve StackML into a top-tier portfolio project.

---

## 1. Analysis of Your Existing System

I have reviewed the StackML source code.

*   **Current Architecture:** Modern, modular, monolithic. Next.js 15 frontend, NestJS 10 backend, MongoDB Atlas, Supabase Storage.
*   **Existing AI:** You have a `DescriptionService` that uses OpenRouter to fix grammar. This is a basic API call, not an AI system.
*   **Resource Ingestion:** Synchronous. User uploads -> Backend saves to Supabase -> extracts text (capped at 1MB via `pdf-parse`/`mammoth`) -> saves to MongoDB.
*   **Search Architecture:** MongoDB `$text` lexical search over metadata and a raw text blob.

### 🔴 The Verdict:
**Already Exists:** Great UX/UI, robust CRUD, file handling, integrated document reading.
**Should Improve:** The ingestion pipeline is synchronous and blocks the API. The search is purely lexical and will fail on semantic queries. Text extraction is basic and loses document structure.
**Should Add:** A dedicated Python AI/ML microservice. Production RAG. Agentic workflows. ML classification. Observability.

---

## 2. The AI Capability Layer Design

Do not try to force heavy AI/ML libraries (LangChain, PyTorch, Pandas) into your NestJS/TypeScript backend. In 2026-2030, the Python ecosystem remains king for AI/ML.

**Target Architecture:**
1.  **Application Layer:** NestJS (Auth, CRUD, DB orchestration, Supabase interfacing).
2.  **AI/ML Intelligence Layer:** A new **FastAPI (Python)** microservice.
3.  **Knowledge Layer:** Qdrant (Vector DB) + MongoDB (Metadata).

NestJS becomes the API Gateway and state manager. FastAPI becomes the AI Engine. They communicate via HTTP (sync) and a message queue like Redis/RabbitMQ (async document processing).

---

## 3. GenAI Layer

You are building a Knowledge Hub, not a generic chatbot.

*   **🔴 Must Have:** Structured Outputs (Pydantic). AI models must return JSON that your app can render (e.g., returning a list of extracted concepts).
*   **🔴 Must Have:** Function/Tool Calling. Models need to be able to "search_database" or "read_page_content".
*   **🟡 Should Have:** Prompt Management. Do not hardcode prompts in your code. Use a framework or a separate config file.
*   **🟢 Optional:** Model Routing. (Switching between Claude 3.5 Sonnet for complex tasks and Llama 3 for basic tagging).

---

## 4. RAG Layer: From Lexical to Production RAG

Your current MongoDB `$text` search is insufficient for a "Knowledge Hub."

**The Evolution:**
1.  **Ingestion:** Move document parsing to the Python service. Use `Unstructured.io` or `PyMuPDF` instead of `pdf-parse`. These maintain document hierarchy (titles, paragraphs, tables).
2.  **Chunking:** Implement **Semantic Chunking**, not just fixed-character chunking.
3.  **Embeddings:** Use an open-weights embedding model (e.g., `BAAI/bge-large-en-v1.5` or `nomic-embed-text`). 
4.  **Vector DB:** Use **Qdrant**. It is developer-friendly, supports local Docker, and scales well. Avoid pgvector here since your primary DB is MongoDB.
5.  **Retrieval:** Implement **Hybrid Search** (Dense vector search in Qdrant + Sparse/Keyword search).
6.  **Reranking:** Add a Cross-Encoder (e.g., Cohere Rerank or BGE-Reranker) to re-order the top 20 results down to the most relevant 5.

**Interview Talking Point:** "I didn't just use standard LangChain RAG. I built a hybrid retrieval pipeline with semantic chunking and cross-encoder reranking, which improved retrieval precision by X%."

---

## 5. Agentic AI Layer

Do not build "agents" just to have agents. Use them where deterministic code fails.

### The Agents to Build:
1.  **The Ingestion Agent (Workflow):** When a user uploads a PDF, an async workflow triggers. The agent reads the chunks, extracts key entities, auto-tags the resource, and determines its difficulty level. *Implementation: LangGraph (State Graph).*
2.  **The Study Assistant (Interactive Agent):** An agent integrated into your PDF reader. The user highlights a complex paragraph and asks, "Explain this based on my previous knowledge." The agent has tools: `get_user_profile()`, `search_knowledge_base()`, `read_current_page()`.
3.  **The Knowledge Gap Agent (Background):** Periodically reviews the user's completed Todos and suggests prerequisites they might have missed.

**Key constraint:** Use **LangGraph** or **LlamaIndex Workflows**. Do not use black-box autonomous agents (like AutoGPT). Hiring managers want to see *controlled, deterministic state machines* combined with LLM routing.

---

## 6. Classical ML Layer

Demonstrating classical ML separates you from "prompt engineers."

**The Feature: Personalized Difficulty & Relevance Scoring**
*   **Problem:** When a user searches for a topic (e.g., "Transformers"), rank the results not just by semantic similarity, but by *predicted difficulty* matching the user's current skill level.
*   **Dataset:** Bootstrapped. Use an LLM to generate synthetic training data (1000 examples of tech text mapped to Beginner/Intermediate/Advanced).
*   **Model:** A lightweight classifier using `scikit-learn` (TF-IDF + XGBoost) or a fine-tuned `DistilBERT`.
*   **Inference:** Hosted in your FastAPI service.

---

## 7. MLOps Layer

How do you manage that classical ML model?

**The Stack (Keep it realistic):**
*   **Experiment Tracking:** **MLflow** (Run it locally/in Docker). Show how you logged metrics (F1, Accuracy) for different classifier iterations.
*   **Model Registry:** Use MLflow's registry to promote a model to `Production`.
*   **Data Versioning:** **DVC** (Data Version Control) backed by S3/Supabase to version your synthetic training data.
*   **Serving:** The FastAPI app pulls the latest `Production` model from MLflow on startup.

---

## 8. LLMOps & Observability Layer

In 2026, putting an LLM in production without observability is considered malpractice.

*   **Tool:** **Langfuse** or **Arize Phoenix** (Both have great open-source/free tiers).
*   **Implementation:** Instrument your Python FastAPI service using OpenTelemetry.
*   **What to track:** 
    *   Trace the exact execution path: Request -> Retrieval -> Prompt formulation -> LLM generation.
    *   Track latency, token usage, and cost per request.
    *   Implement user feedback (thumbs up/down on Study Assistant responses) and tie it back to the trace.

---

## 9. AI Evaluation Layer

This is the #1 skill missing from junior/mid portfolios. How do you know your RAG is good?

*   **The Framework:** **Ragas** (RAG Assessment) or **TruLens**.
*   **The Pipeline:** Create an "Evaluation Dataset" of 50 questions and expected answers based on some PDFs in your system.
*   **The CI/CD:** Write a script that runs every time you change your embedding model or prompt. It measures Context Precision, Context Recall, and Faithfulness. 
*   **Interview Impact:** If you can say, "My baseline RAG had 60% precision, but adding a Cross-Encoder bumped it to 85%, verified by my Ragas eval pipeline," you will pass the technical interview instantly.

---

## 10. AI Security & Governance

**Realistic Controls for this project:**
1.  **PII Filtering:** Use `Presidio` in your Python ingestion pipeline to redact phone numbers/emails from uploaded text *before* embedding them.
2.  **Output Validation:** Use `Guardrails AI` or Pydantic validation to ensure the LLM doesn't output malformed JSON or harmful content.

---

## 11. Cloud Architecture (AWS Target)

Keep it scalable but cost-effective for a portfolio.

*   **Frontend:** Vercel (Current - keep it).
*   **Backend API (NestJS):** AWS ECS Fargate or App Runner.
*   **AI Service (FastAPI):** AWS ECS Fargate.
*   **Async Queue:** AWS SQS (Triggers FastAPI ingestion workers).
*   **Storage:** Amazon S3 (Migrate off Supabase storage for full AWS narrative).
*   **Vector DB:** Qdrant Cloud (Free tier) or self-hosted on EC2.
*   **Databases:** MongoDB Atlas (Current - keep it).

---

## 12. Job-Market Mapping

| Project Layer | AI/ML Eng | GenAI Eng | Agentic AI Eng | MLOps Eng |
| :--- | :---: | :---: | :---: | :---: |
| Python API (FastAPI) | 🔴 | 🔴 | 🔴 | 🔴 |
| Hybrid RAG + Chunking | 🔴 | 🔴 | 🟡 | 🟢 |
| LangGraph Agents | 🟡 | 🔴 | 🔴 | 🟢 |
| ML Classification | 🔴 | 🟢 | 🟢 | 🔴 |
| MLflow / DVC | 🔴 | 🟢 | 🟢 | 🔴 |
| Ragas (Eval) | 🔴 | 🔴 | 🔴 | 🟡 |
| Langfuse (Tracing) | 🟡 | 🔴 | 🔴 | 🔴 |

*(🔴 Must Have | 🟡 Should Have | 🟢 Optional)*

**Highest Value Layers for your career:** RAG Evaluation, LLMOps Tracing, and Orchestrated Agents (LangGraph).

---

## 13. Project Evolution Roadmap

**Phase 1: Foundation & Microservice (Weeks 1-2)**
*   Spin up a FastAPI Python service.
*   Connect NestJS to FastAPI.
*   Move the `DescriptionService` logic to Python.

**Phase 2: Production Ingestion & RAG (Weeks 3-5)**
*   Implement async document uploading (NestJS -> Queue -> FastAPI).
*   Implement Semantic Chunking and PyMuPDF extraction.
*   Set up Qdrant and generate embeddings.
*   Build the Hybrid Search endpoint.

**Phase 3: Agentic Features (Weeks 6-7)**
*   Build the LangGraph Ingestion Agent (Auto-tagging, entity extraction).
*   Build the Study Assistant API (Context-aware Q&A).

**Phase 4: Evaluation & Ops (Weeks 8-10)**
*   Integrate Langfuse for tracing.
*   Create an evaluation dataset and run Ragas metrics.
*   (Optional but strong) Add the classical ML text classifier with MLflow.

---

## 14. Avoid Overengineering (The "Do Not Add" List)

1.  ⚫ **Kubernetes (K8s):** Unless you are applying strictly for Infrastructure, ECS/Docker is enough. K8s will eat your time.
2.  ⚫ **Fully Autonomous Agents (AutoGPT style):** They are flaky and hard to evaluate. Stick to deterministic graphs (LangGraph).
3.  ⚫ **Kafka:** Overkill for a single-user app. Use simple SQS or Redis queues for async jobs.
4.  ⚫ **Fine-tuning LLMs:** Too expensive and complex for a portfolio. Prompt engineering + RAG + structured outputs is what 90% of enterprises actually need.
5.  ⚫ **Custom Vector DB:** Just use Qdrant or Milvus. Don't build one from scratch.

---

## 15. Final Recommendations

### A. Top 5 Technologies to Prioritize Learning
1.  **FastAPI (Python):** The industry standard for AI microservices.
2.  **LangGraph:** The industry standard for agentic workflows.
3.  **Qdrant / Milvus:** High-performance vector databases.
4.  **Ragas / TruLens:** LLM & RAG Evaluation.
5.  **Langfuse / Arize:** AI Observability.

### B. Portfolio Positioning & The Interview Pitch

**Do not say:** "I built an app that lets you talk to your PDFs using OpenAI." (Too junior).

**Say this:** 
> "I architected and built StackML, an AI-native Knowledge Hub. I transitioned the legacy monolithic architecture into a microservices pattern, writing a high-performance Python/FastAPI AI engine to handle async document processing. I built a production-grade RAG pipeline featuring semantic chunking, hybrid sparse/dense retrieval, and cross-encoder reranking, which achieved an 85% context precision score via my Ragas evaluation pipeline. To handle complex workflows like automated document tagging and context-aware study assistance, I orchestrated stateful agents using LangGraph. The entire AI layer is fully observable using Langfuse, allowing me to trace token costs, latency, and retrieval quality in real-time."

This pitch demonstrates: Architecture, GenAI, RAG, Agentic orchestration, Evaluation, and LLMOps. You sound like a Senior Engineer.
