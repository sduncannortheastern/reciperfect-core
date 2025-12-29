# 🍽️ Reciperfect-Core

**Microservices modules for the Reciperfect application.**

This repository contains the core microservices that power the Reciperfect ecosystem — a modular, service-oriented application for managing, serving, and interacting with recipe-related functionality.

---

## 📌 Table of Contents

- 🔍 [Overview](#-overview)
- 🚀 [Features](#-features)
- 📁 [Project Structure](#-project-structure)
- 🛠️ [Getting Started](#-getting-started)
  - 📦 [Prerequisites](#-prerequisites)
  - ⚙️ [Installation](#-installation)
- 🧪 [Usage](#-usage)
- 🤝 [Contributing](#-contributing)
- 📄 [License](#-license)
- 📬 [Contact](#-contact)

---

## 🔍 Overview

**Reciperfect-Core** is the foundational microservices repository for the Reciperfect application — a distributed system that separates backend services for scalability, maintainability, and independent deployment.

Each service focuses on a specific domain, such as API backend functionality, file storage, translation helpers, and frontend integration.

---

## 🚀 Features

- 🛠️ Modular microservices architecture
- 📡 Decoupled services for backend, file handling, and translation
- 📦 Easy to extend with new services
- 🔄 Supports independent deployment of each microservice

---

## 📁 Project Structure

```text
reciperfect-core/
├── .vscode/                     # Editor/IDE settings
├── reciperfect-backend/         # Core API service
├── reciperfect-fileserver/      # Static file storage service
├── reciperfect-frontend/        # Frontend application UI
├── reciperfect-translator/      # Translation / helper microservice
├── .gitignore
